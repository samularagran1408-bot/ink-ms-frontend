import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { PreferencesApiService } from './preferences-api.service';
import { SessionService } from './session.service';

@Injectable({
  providedIn: 'root'
})
export class UnreadNotificationsService implements OnDestroy {
  private readonly countSubject = new BehaviorSubject<number>(0);
  readonly count$ = this.countSubject.asObservable();

  private started = false;

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
  }

  stop(): void {
    this.started = false;
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
