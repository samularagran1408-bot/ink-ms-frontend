import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, interval, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

import { AppNotification, Preference } from '../models/accessibility-api';
import { PreferencesApiService } from './preferences-api.service';
import { SessionService } from './session.service';
import { TtsService } from './tts.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationAnnounceService implements OnDestroy {
  private pollSub: Subscription | null = null;
  private unlockListener: (() => void) | null = null;
  private started = false;
  private readonly pollMs = 45000;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly shownIds = new Set<string>();
  private readonly visualAlertSubject = new BehaviorSubject<string | null>(null);

  readonly visualAlert$ = this.visualAlertSubject.asObservable();

  constructor(
    private preferencesApi: PreferencesApiService,
    private session: SessionService,
    private tts: TtsService
  ) {}

  /** Arranca sync de preferencias, desbloqueo por gesto y polling de no leídas. */
  start(): void {
    if (this.started) {
      this.refreshPreferences().subscribe();
      return;
    }
    this.started = true;
    this.bindUnlockGesture();
    this.refreshPreferences().subscribe();
    this.startPolling();
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
    this.removeUnlockGesture();
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
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

  private startPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = interval(this.pollMs).pipe(
      switchMap(() => {
        if (!this.session.isAuthenticated()) {
          return of([] as AppNotification[]);
        }
        return this.refreshPreferences().pipe(
          switchMap(() => {
            if (!this.tts.isVisualNotificationsActive && !this.tts.isAudioNotificationsActive) {
              return of([] as AppNotification[]);
            }
            return this.preferencesApi.getUnreadNotifications().pipe(
              catchError(() => of([] as AppNotification[]))
            );
          })
        );
      }),
      map((unread) => unread.filter((n) => n.id && !this.shownIds.has(n.id)))
    ).subscribe((fresh) => {
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
