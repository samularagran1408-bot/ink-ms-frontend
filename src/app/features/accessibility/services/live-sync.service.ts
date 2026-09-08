import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

export type LiveSyncKind =
  | 'attendance'
  | 'registration'
  | 'routine'
  | 'event'
  | 'reconnect'
  | 'generic';

export interface LiveSyncPulse {
  kind: LiveSyncKind;
  type?: string;
  eventId?: string;
}

/**
 * Punto de extensión para refrescar pantallas. El canal SSE de notificaciones
 * se eliminó; las vistas se actualizan al navegar o al recargar datos.
 */
@Injectable({ providedIn: 'root' })
export class LiveSyncService implements OnDestroy {
  private readonly pulseSubject = new Subject<LiveSyncPulse>();
  readonly pulse$ = this.pulseSubject.pipe(debounceTime(400));

  private started = false;

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
  }

  ngOnDestroy(): void {
    this.started = false;
    this.pulseSubject.complete();
  }
}
