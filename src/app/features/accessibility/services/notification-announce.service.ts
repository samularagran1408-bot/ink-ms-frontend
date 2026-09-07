import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';

import { AppNotification, Preference } from '../models/accessibility-api';
import { PreferencesApiService } from './preferences-api.service';
import { SessionService } from '@core/services/session.service';
import { TtsService } from './tts.service';
import { UnreadNotificationsService } from './unread-notifications.service';
import { NotificationRealtimeService } from './notification-realtime.service';

export interface LiveNotificationAlert {
  count: number;
  title: string;
  body: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationAnnounceService implements OnDestroy {
  private countSub: Subscription | null = null;
  private incomingSub: Subscription | null = null;
  private unlockListener: (() => void) | null = null;
  private started = false;
  private lastSeenCount = -1;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly shownIds = new Set<string>();
  private readonly visualAlertSubject = new BehaviorSubject<LiveNotificationAlert | null>(null);

  readonly visualAlert$ = this.visualAlertSubject.asObservable();

  constructor(
    private preferencesApi: PreferencesApiService,
    private session: SessionService,
    private tts: TtsService,
    private unreadNotifications: UnreadNotificationsService,
    private realtime: NotificationRealtimeService,
    private translate: TranslateService
  ) {}

  /** Arranca sync de preferencias, desbloqueo por gesto y avisos de no leídas. */
  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.bindUnlockGesture();
    const cached = this.preferencesApi.cached;
    if (cached) {
      this.tts.applyPreferences(cached);
    } else {
      this.refreshPreferences().subscribe();
    }
    this.bindUnreadAnnouncements();
    this.bindIncomingAlerts();
  }

  stop(): void {
    this.countSub?.unsubscribe();
    this.incomingSub?.unsubscribe();
    this.countSub = null;
    this.incomingSub = null;
    this.started = false;
    this.lastSeenCount = -1;
    this.shownIds.clear();
    this.removeUnlockGesture();
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.visualAlertSubject.next(null);
  }

  ngOnDestroy(): void {
    this.stop();
  }

  refreshPreferences(): Observable<Preference | null> {
    if (!this.session.isAuthenticated()) {
      return of(null);
    }
    return this.preferencesApi.getPreferences().pipe(
      tap((prefs) => this.tts.applyPreferences(prefs)),
      catchError(() => of(null))
    );
  }

  /** Anuncia una lista (p. ej. al abrir el panel). Requiere gesto previo del usuario. */
  announceList(notes: AppNotification[], onlyUnread = true): void {
    this.tts.unlock();
    this.refreshPreferences().subscribe(() => {
      this.showVisual(notes.find((note) => !onlyUnread || !note.read) || null);
      this.tts.announceNotifications(notes, { onlyUnread, force: false });
    });
  }

  announceOne(note: AppNotification, force = false): void {
    this.tts.unlock();
    this.refreshPreferences().subscribe(() => {
      this.showVisual(note);
      this.tts.speakNotification(note, { force, skipIfSpoken: !force });
    });
  }

  private bindIncomingAlerts(): void {
    this.incomingSub?.unsubscribe();
    this.incomingSub = this.realtime.incoming$.subscribe((note) => {
      this.announceIncoming(note);
    });
  }

  private bindUnreadAnnouncements(): void {
    this.countSub?.unsubscribe();
    this.countSub = this.unreadNotifications.count$.subscribe((count) => {
      const previous = this.lastSeenCount;
      this.lastSeenCount = count;
      if (previous < 0 || count <= previous) {
        return;
      }
      this.announceFreshUnread();
    });
  }

  private announceIncoming(note: AppNotification): void {
    if (!this.session.isAuthenticated() || !note || note.read) {
      return;
    }
    if (note.id && this.shownIds.has(note.id)) {
      return;
    }
    if (note.id) {
      this.shownIds.add(note.id);
    }
    this.presentIncoming(note);
  }

  private announceFreshUnread(): void {
    if (!this.session.isAuthenticated()) {
      return;
    }
    this.preferencesApi.getUnreadNotifications().pipe(
      catchError(() => of([] as AppNotification[]))
    ).subscribe((unread) => {
      const fresh = unread.filter((note) => note.id && !this.shownIds.has(note.id));
      if (!fresh.length) {
        return;
      }
      fresh.forEach((note) => {
        if (note.id) {
          this.shownIds.add(note.id);
        }
      });
      this.presentIncoming(fresh[0]);
    });
  }

  /** Muestra el aviso y lo lee en voz alta, sin entrar al panel. */
  private presentIncoming(note: AppNotification): void {
    this.tts.unlock();
    this.tts.playAlertChime();
    this.showVisual(note);
    this.pushOsNotification(note);
    this.tts.speakNotification(note, { force: true, skipIfSpoken: false });
  }

  private showVisual(note: AppNotification | null | undefined): void {
    if (!note || !this.tts.isVisualNotificationsActive) {
      return;
    }
    const title = (note.title || '').trim();
    const body = (note.body || '').trim();
    if (!title && !body) {
      return;
    }
    this.visualAlertSubject.next({
      count: Math.max(this.unreadNotifications.count, 1),
      title: title || this.translate.instant('NAV.NOTIFICATIONS'),
      body
    });
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toastTimer = setTimeout(() => this.visualAlertSubject.next(null), 10000);
  }

  private pushOsNotification(note: AppNotification): void {
    if (typeof Notification === 'undefined' || !this.tts.isVisualNotificationsActive) {
      return;
    }
    if (Notification.permission === 'default') {
      void Notification.requestPermission();
      return;
    }
    if (Notification.permission !== 'granted') {
      return;
    }
    const count = Math.max(this.unreadNotifications.count, 1);
    try {
      new Notification(note.title || this.translate.instant('NAV.NOTIFICATIONS'), {
        body: note.body || this.translate.instant('NOTIFICATIONS.LIVE_SPEECH', { count }),
        tag: 'inklusport-live'
      });
    } catch {
      // El navegador puede bloquear notificaciones nativas.
    }
  }

  private bindUnlockGesture(): void {
    if (typeof document === 'undefined' || this.unlockListener) {
      return;
    }
    this.unlockListener = () => {
      this.tts.unlock();
    };
    document.addEventListener('pointerdown', this.unlockListener, { passive: true });
    document.addEventListener('keydown', this.unlockListener, { passive: true });
  }

  private removeUnlockGesture(): void {
    if (!this.unlockListener || typeof document === 'undefined') {
      return;
    }
    document.removeEventListener('pointerdown', this.unlockListener);
    document.removeEventListener('keydown', this.unlockListener);
    this.unlockListener = null;
  }
}
