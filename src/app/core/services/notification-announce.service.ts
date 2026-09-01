import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

import { AppNotification, Preference } from '../models/accessibility-api';
import { PreferencesApiService } from './preferences-api.service';
import { SessionService } from './session.service';
import { TtsService } from './tts.service';
import { UnreadNotificationsService } from './unread-notifications.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationAnnounceService implements OnDestroy {
  private countSub: Subscription | null = null;
  private unlockListener: (() => void) | null = null;
  private started = false;
  private lastSeenCount = -1;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly shownIds = new Set<string>();
  private readonly visualAlertSubject = new BehaviorSubject<string | null>(null);

  readonly visualAlert$ = this.visualAlertSubject.asObservable();

  constructor(
    private preferencesApi: PreferencesApiService,
    private session: SessionService,
    private tts: TtsService,
    private unreadNotifications: UnreadNotificationsService
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
  }

  stop(): void {
    this.countSub?.unsubscribe();
    this.countSub = null;
    this.started = false;
    this.lastSeenCount = -1;
    this.shownIds.clear();
    this.removeUnlockGesture();
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
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

  private announceFreshUnread(): void {
    if (!this.session.isAuthenticated()) {
      return;
    }
    if (!this.tts.isVisualNotificationsActive && !this.tts.isAudioNotificationsActive) {
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
      this.showVisual(fresh[0]);
      if (this.tts.isAudioNotificationsActive) {
        this.tts.announceNotifications(fresh, { onlyUnread: true });
      }
    });
  }

  private showVisual(note: AppNotification | null | undefined): void {
    if (!note || !this.tts.isVisualNotificationsActive) {
      return;
    }
    const text = [note.title, note.body].filter(Boolean).join('. ');
    if (!text) {
      return;
    }
    this.visualAlertSubject.next(text);
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toastTimer = setTimeout(() => this.visualAlertSubject.next(null), 8000);
  }

  private bindUnlockGesture(): void {
    if (typeof document === 'undefined' || this.unlockListener) {
      return;
    }
    this.unlockListener = () => {
      this.tts.unlock();
      this.removeUnlockGesture();
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
