import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subscription, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AppNotification } from '../models/accessibility-api';
import { NotificationRealtimeService } from './notification-realtime.service';
import { PreferencesApiService } from './preferences-api.service';
import { SessionService } from '@core/services/session.service';

@Injectable({
  providedIn: 'root'
})
export class UnreadNotificationsService implements OnDestroy {
  private readonly countSubject = new BehaviorSubject<number>(0);
  readonly count$ = this.countSubject.asObservable();

  private started = false;
  private incomingSub: Subscription | null = null;
  private reconnectSub: Subscription | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private readonly seenIds = new Set<string>();

  constructor(
    private preferencesApi: PreferencesApiService,
    private session: SessionService,
    private realtime: NotificationRealtimeService
  ) {}

  start(): void {
    if (this.started || !this.session.isAuthenticated()) {
      return;
    }
    this.started = true;
    this.refresh();
    this.realtime.start();
    this.incomingSub = this.realtime.incoming$.subscribe((note) => this.onIncoming(note));
    this.reconnectSub = this.realtime.reconnected$.subscribe(() => this.refresh());
    this.pollTimer = setInterval(() => this.refresh(), 20_000);
  }

  stop(): void {
    this.started = false;
    this.incomingSub?.unsubscribe();
    this.reconnectSub?.unsubscribe();
    this.incomingSub = null;
    this.reconnectSub = null;
    this.seenIds.clear();
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.realtime.stop();
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

  private onIncoming(note: AppNotification): void {
    if (note.id) {
      if (this.seenIds.has(note.id)) {
        return;
      }
      this.seenIds.add(note.id);
    }
    if (note.read) {
      return;
    }
    this.countSubject.next(this.count + 1);
  }

  private normalize(value: { count: number } | number): number {
    if (typeof value === 'number') {
      return value;
    }
    return value?.count ?? 0;
  }
}
