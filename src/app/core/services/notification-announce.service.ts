import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subscription, interval, of } from 'rxjs';
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
      this.tts.announceNotifications(notes, { onlyUnread, force: false });
    });
  }

  announceOne(note: AppNotification, force = false): void {
    this.tts.unlock();
    this.refreshPreferences().subscribe(() => {
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
            if (!this.tts.isAudioNotificationsActive) {
              return of([] as AppNotification[]);
            }
            return this.preferencesApi.getUnreadNotifications().pipe(
              catchError(() => of([] as AppNotification[]))
            );
          })
        );
      }),
      map((unread) => unread.filter((n) => n.id && !this.tts.wasSpoken(n.id)))
    ).subscribe((fresh) => {
      if (fresh.length) {
        this.tts.announceNotifications(fresh, { onlyUnread: true });
      }
    });
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
