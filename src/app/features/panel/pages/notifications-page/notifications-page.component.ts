import { Component, OnInit } from '@angular/core';

import { AppNotification } from '../../../../core/models/accessibility-api';
import { SessionService } from '../../../../core/services/session.service';
import { PreferencesApiService } from '../../../../core/services/preferences-api.service';
import { NotificationAnnounceService } from '../../../../core/services/notification-announce.service';
import { TtsService } from '../../../../core/services/tts.service';

@Component({
  selector: 'app-notifications-page',
  templateUrl: './notifications-page.component.html',
  styleUrl: './notifications-page.component.scss'
})
export class NotificationsPageComponent implements OnInit {
  notifications: AppNotification[] = [];
  loading = true;
  errorMessage: string | null = null;

  constructor(
    private session: SessionService,
    private preferencesApi: PreferencesApiService,
    private notificationAnnounce: NotificationAnnounceService,
    private tts: TtsService
  ) {}

  ngOnInit(): void {
    this.notificationAnnounce.start();
    this.reload();
  }

  get fixedSidebar(): boolean {
    return this.session.getPrimaryRole() !== 'USUARIO';
  }

  get audioActive(): boolean {
    return this.tts.isAudioNotificationsActive;
  }

  reload(): void {
    this.loading = true;
    this.preferencesApi.getNotifications().subscribe({
      next: (notifications) => {
        this.notifications = notifications;
        this.loading = false;
        const unread = notifications.filter((n) => !n.read);
        if (unread.length) {
          this.notificationAnnounce.announceList(unread, true);
        }
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'No se pudieron cargar notificaciones.';
        this.loading = false;
      }
    });
  }

  listenUnread(): void {
    const unread = this.notifications.filter((n) => !n.read);
    this.tts.clearSpokenHistory();
    this.notificationAnnounce.announceList(unread.length ? unread : this.notifications, unread.length > 0);
  }

  listenOne(note: AppNotification): void {
    this.notificationAnnounce.announceOne(note, true);
  }

  stopAudio(): void {
    this.tts.stop();
  }

  markAll(): void {
    this.preferencesApi.markAllAsRead().subscribe({
      next: () => {
        this.notifications = this.notifications.map((n) => ({ ...n, read: true }));
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'No se pudieron marcar como leídas.';
      }
    });
  }

  markOne(note: AppNotification): void {
    this.preferencesApi.markAsRead(note.id).subscribe({
      next: () => {
        note.read = true;
      }
    });
  }
}
