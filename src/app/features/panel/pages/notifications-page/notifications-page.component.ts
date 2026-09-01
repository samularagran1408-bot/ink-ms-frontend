import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { AppNotification } from '../../../../core/models/accessibility-api';
import { SessionService } from '../../../../core/services/session.service';
import { PreferencesApiService } from '../../../../core/services/preferences-api.service';
import { NotificationAnnounceService } from '../../../../core/services/notification-announce.service';
import { TtsService } from '../../../../core/services/tts.service';
import { UnreadNotificationsService } from '../../../../core/services/unread-notifications.service';

@Component({
  selector: 'app-notifications-page',
  templateUrl: './notifications-page.component.html',
  styleUrl: './notifications-page.component.scss'
})
export class NotificationsPageComponent implements OnInit, OnDestroy {
  notifications: AppNotification[] = [];
  loading = true;
  errorMessage: string | null = null;
  audioMode = false;
  playingId: string | null = null;

  private prefsSub: Subscription | null = null;
  private playingSub: Subscription | null = null;

  constructor(
    private session: SessionService,
    private preferencesApi: PreferencesApiService,
    private notificationAnnounce: NotificationAnnounceService,
    private tts: TtsService,
    private translate: TranslateService,
    private unreadNotifications: UnreadNotificationsService
  ) {}

  ngOnInit(): void {
    this.notificationAnnounce.start();
    this.prefsSub = this.tts.preferences$.subscribe(() => {
      this.audioMode = this.tts.isAudioNotificationsActive;
    });
    this.playingSub = this.tts.playingId$.subscribe((id) => {
      this.playingId = id;
    });
    this.reload();
  }

  ngOnDestroy(): void {
    this.prefsSub?.unsubscribe();
    this.playingSub?.unsubscribe();
  }

  get fixedSidebar(): boolean {
    return this.session.getPrimaryRole() !== 'USUARIO';
  }

  reload(): void {
    this.loading = true;
    this.audioMode = this.tts.isAudioNotificationsActive;
    this.preferencesApi.getNotifications().subscribe({
      next: (notifications) => {
        this.notifications = notifications;
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || this.translate.instant('NOTIFICATIONS.LOAD_ERROR');
        this.loading = false;
      }
    });
  }

  togglePlay(note: AppNotification): void {
    if (!this.audioMode) {
      return;
    }
    if (this.playingId === note.id) {
      this.tts.stop();
      return;
    }
    this.notificationAnnounce.announceOne(note, true);
  }

  stopAudio(): void {
    this.tts.stop();
  }

  isPlaying(note: AppNotification): boolean {
    return this.playingId === note.id;
  }

  markAll(): void {
    this.preferencesApi.markAllAsRead().subscribe({
      next: () => {
        this.notifications = this.notifications.map((n) => ({ ...n, read: true }));
        this.unreadNotifications.setCount(0);
      },
      error: (error) => {
        this.errorMessage =
          error?.error?.message || this.translate.instant('NOTIFICATIONS.MARK_ERROR');
      }
    });
  }

  markOne(note: AppNotification): void {
    this.preferencesApi.markAsRead(note.id).subscribe({
      next: () => {
        note.read = true;
        this.unreadNotifications.setCount(this.unreadNotifications.count - 1);
      }
    });
  }
}
