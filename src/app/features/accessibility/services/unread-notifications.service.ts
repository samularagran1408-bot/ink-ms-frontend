import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { PreferencesApiService } from './preferences-api.service';
import { SessionService } from '@core/services/session.service';

@Injectable({
  providedIn: 'root'
})
export class UnreadNotificationsService implements OnDestroy {
  private readonly countSubject = new BehaviorSubject<number>(0);
  readonly count$ = this.countSubject.asObservable();

  /** Sondeo mientras la pestaña está a la vista; oculta no se pide nada. */
  private static readonly POLL_MS = 10_000;
  /**
   * El aviso se envía en segundo plano tras confirmar la acción, así que al
   * volver la respuesta puede no estar escrito todavía. Se vuelve a mirar un
   * momento después para no esperar al siguiente sondeo.
   */
  private static readonly REINTENTO_MS = 1_500;

  private started = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private visibilityHandler: (() => void) | null = null;

  constructor(
    private preferencesApi: PreferencesApiService,
    private session: SessionService
  ) {}

  start(): void {
    if (this.started || !this.session.isAuthenticated()) {
      return;
    }
    this.started = true;
    this.refresh();
    this.pollTimer = setInterval(
      () => this.refreshIfVisible(),
      UnreadNotificationsService.POLL_MS
    );
    if (typeof document !== 'undefined') {
      this.visibilityHandler = () => {
        if (!document.hidden) {
          this.refresh();
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  stop(): void {
    this.started = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    this.countSubject.next(0);
  }

  refresh(): void {
    if (!this.session.isAuthenticated()) {
      this.countSubject.next(0);
      return;
    }
    this.preferencesApi.getUnreadCount().pipe(
      catchError(() => of(0))
    ).subscribe((value) => this.countSubject.next(this.normalize(value)));
  }

  /**
   * Para usar justo después de una acción que genera aviso (inscribirse,
   * cancelar…): mira ya y repite una vez, sin esperar al sondeo.
   */
  refreshAfterAction(): void {
    this.refresh();
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.refresh();
    }, UnreadNotificationsService.REINTENTO_MS);
  }

  private refreshIfVisible(): void {
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }
    this.refresh();
  }

  setCount(count: number): void {
    this.countSubject.next(Math.max(0, count));
  }

  get count(): number {
    return this.countSubject.value;
  }

  ngOnDestroy(): void {
    this.stop();
  }

  private normalize(value: { count: number } | number): number {
    if (typeof value === 'number') {
      return value;
    }
    return value?.count ?? 0;
  }
}
