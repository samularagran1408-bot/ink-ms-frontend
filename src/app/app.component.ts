import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { LanguageService } from '@features/accessibility/services/language.service';
import { AccessibilityService } from '@features/accessibility/services/accessibility.service';
import { LiveNotificationAlert, NotificationAnnounceService } from '@features/accessibility/services/notification-announce.service';
import { SessionService } from '@core/services/session.service';
import { UnreadNotificationsService } from '@features/accessibility/services/unread-notifications.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Fronted-Inklusport';
  visualAlert$: Observable<LiveNotificationAlert | null>;

  private routerSub: Subscription | null = null;
  private panelBooted = false;

  constructor(
    private languageService: LanguageService,
    private accessibility: AccessibilityService,
    private session: SessionService,
    private notificationAnnounce: NotificationAnnounceService,
    private unreadNotifications: UnreadNotificationsService,
    private router: Router
  ) {
    this.visualAlert$ = this.notificationAnnounce.visualAlert$;
  }

  ngOnInit(): void {
    this.languageService.init();
    this.accessibility.init().subscribe();
    this.routerSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.bootPanelServices());
    this.bootPanelServices();
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  openLiveNotification(): void {
    const home = this.session.homeForCurrentUser();
    void this.router.navigate([`${home}/notifications`]);
  }

  /** Preferencias y badge: una sola vez al entrar al panel, no en cada navegación. */
  private bootPanelServices(): void {
    if (!this.session.isAuthenticated() || this.session.isPublicRoute()) {
      this.panelBooted = false;
      return;
    }
    if (this.panelBooted) {
      return;
    }
    this.panelBooted = true;
    this.accessibility.syncFromServer().subscribe(() => {
      this.unreadNotifications.start();
      this.notificationAnnounce.start();
    });
  }
}
