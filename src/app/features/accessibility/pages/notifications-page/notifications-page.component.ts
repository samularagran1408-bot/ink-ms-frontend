import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { AppNotification } from '@features/accessibility/models/accessibility-api';
import { SessionService } from '@core/services/session.service';
import { PreferencesApiService } from '@features/accessibility/services/preferences-api.service';
import { NotificationAnnounceService } from '@features/accessibility/services/notification-announce.service';
import { TtsService } from '@features/accessibility/services/tts.service';
import { UnreadNotificationsService } from '@features/accessibility/services/unread-notifications.service';
import { SharedModule } from '@shared/shared.module';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, SharedModule],
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
  private pollTimer: ReturnType<typeof setInterval> | null = null;

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
    this.pollTimer = setInterval(() => this.reload(false), 20_000);
  }

  ngOnDestroy(): void {
    this.prefsSub?.unsubscribe();
    this.playingSub?.unsubscribe();
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  reload(showLoading = true): void {
    if (showLoading) {
      this.loading = true;
    }
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
