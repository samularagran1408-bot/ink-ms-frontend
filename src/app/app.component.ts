import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

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
export class AppComponent implements OnInit, OnDestroy {
  title = 'Fronted-Inklusport';
  visualAlert$: Observable<string | null>;

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
      this.notificationAnnounce.start();
      this.unreadNotifications.start();
    });
  }
}
