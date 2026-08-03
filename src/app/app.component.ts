import { Component, OnInit } from '@angular/core';

import { LanguageService } from './core/services/language.service';
import { NotificationAnnounceService } from './core/services/notification-announce.service';
import { SessionService } from './core/services/session.service';
import { UnreadNotificationsService } from './core/services/unread-notifications.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'Fronted-Inklusport';

  constructor(
    private languageService: LanguageService,
    private session: SessionService,
    private notificationAnnounce: NotificationAnnounceService,
    private unreadNotifications: UnreadNotificationsService
  ) {}

  ngOnInit(): void {
    this.languageService.init().subscribe(() => {
      if (this.session.isAuthenticated()) {
        this.notificationAnnounce.start();
        this.unreadNotifications.start();
      }
    });
  }
}
