import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';

import { LanguageService } from './core/services/language.service';
import { AccessibilityService } from './core/services/accessibility.service';
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
  visualAlert$: Observable<string | null>;

  constructor(
    private languageService: LanguageService,
    private accessibility: AccessibilityService,
    private session: SessionService,
    private notificationAnnounce: NotificationAnnounceService,
    private unreadNotifications: UnreadNotificationsService
  ) {
    this.visualAlert$ = this.notificationAnnounce.visualAlert$;
  }

  ngOnInit(): void {
    this.languageService.init();
    this.accessibility.init().subscribe(() => {
      if (this.session.isAuthenticated()) {
        this.notificationAnnounce.start();
        this.unreadNotifications.start();
      }
    });
  }
}
