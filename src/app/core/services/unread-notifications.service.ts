import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subscription, interval, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { PreferencesApiService } from './preferences-api.service';
import { SessionService } from './session.service';

@Injectable({
  providedIn: 'root'
})
export class UnreadNotificationsService implements OnDestroy {
  private readonly countSubject = new BehaviorSubject<number>(0);
  readonly count$ = this.countSubject.asObservable();

  private pollSub: Subscription | null = null;
  private readonly pollMs = 30000;

  constructor(
    private preferencesApi: PreferencesApiService,
    private session: SessionService
  ) {}

  start(): void {
    if (this.pollSub || !this.session.isAuthenticated()) {
      return;
    }
    this.refresh();
    this.pollSub = interval(this.pollMs).pipe(
      switchMap(() => {
        if (!this.session.isAuthenticated()) {
          return of(0);
        }
        return this.preferencesApi.getUnreadCount().pipe(
          catchError(() => of(0))
        );
      })
    ).subscribe((value) => this.countSubject.next(this.normalize(value)));
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

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  private normalize(value: { count: number } | number): number {
    if (typeof value === 'number') {
      return value;
    }
    return value?.count ?? 0;
  }
}
