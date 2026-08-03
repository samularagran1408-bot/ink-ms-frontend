import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { AppRole } from '../../../core/models/app-role';
import { SessionService } from '../../../core/services/session.service';
import { UnreadNotificationsService } from '../../../core/services/unread-notifications.service';

export interface SidebarNavItem {
  labelKey: string;
  route?: string;
  exact?: boolean;
  showBadge?: boolean;
}

@Component({
  selector: 'app-sidebar-nav',
  templateUrl: './sidebar-nav.component.html',
  styleUrl: './sidebar-nav.component.scss'
})
export class SidebarNavComponent implements OnInit, OnDestroy {
  sidebarOpen = false;
  role: AppRole = 'USUARIO';
  displayName = 'Usuario';
  roleKey = 'ROLES.USUARIO';
  brandTitle = 'INKLUSPORT';
  layout: 'drawer' | 'fixed' = 'drawer';
  profilePicture: string | null = null;
  navItems: SidebarNavItem[] = [];
  secondaryItems: SidebarNavItem[] = [];
  unreadCount = 0;

  private subs = new Subscription();

  constructor(
    private router: Router,
    private session: SessionService,
    private translate: TranslateService,
    private unreadNotifications: UnreadNotificationsService
  ) {}

  ngOnInit(): void {
    this.refreshFromSession();
    this.unreadNotifications.start();
    this.subs.add(this.session.profile$.subscribe(() => this.refreshFromSession()));
    this.subs.add(this.session.roles$.subscribe(() => this.refreshFromSession()));
    this.subs.add(this.translate.onLangChange.subscribe(() => this.refreshFromSession()));
    this.subs.add(this.unreadNotifications.count$.subscribe((count) => {
      this.unreadCount = count;
    }));
    this.subs.add(
      this.router.events
        .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe((event) => {
          this.sidebarOpen = false;
          if (event.urlAfterRedirects.includes('/notifications')) {
            this.unreadNotifications.refresh();
          }
        })
    );

    if (!this.session.getProfile() && this.session.isAuthenticated()) {
      this.session.loadProfile().subscribe();
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  openSidebar(): void {
    this.sidebarOpen = true;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  handleLogout(): void {
    this.session.logout();
  }

  get initials(): string {
    return this.displayName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'U';
  }

  private refreshFromSession(): void {
    this.role = this.session.getPrimaryRole();
    this.displayName = this.session.getDisplayName();
    this.roleKey = `ROLES.${this.role}`;
    this.profilePicture = this.session.getProfile()?.profilePicture || null;
    this.layout = this.role === 'USUARIO' ? 'drawer' : 'fixed';
    this.brandTitle = this.role === 'ADMIN' ? 'INKLUSPORT ADMIN' : 'INKLUSPORT';
    this.applyMenuByRole();
    if (this.session.isAuthenticated()) {
      this.unreadNotifications.start();
      this.unreadNotifications.refresh();
    }
  }

  get sessionHome(): string {
    return this.session.homeForCurrentUser();
  }

  private commonAccountItems(base: string): SidebarNavItem[] {
    return [
      { labelKey: 'NAV.PROFILE', route: `${base}/profile` },
      { labelKey: 'NAV.ACCESSIBILITY', route: `${base}/accessibility` },
      { labelKey: 'NAV.NOTIFICATIONS', route: `${base}/notifications`, showBadge: true }
    ];
  }

  private applyMenuByRole(): void {
    switch (this.role) {
      case 'ADMIN':
        this.navItems = [
          { labelKey: 'NAV.DASHBOARD', route: '/admin', exact: true },
          { labelKey: 'NAV.USERS', route: '/admin/users' },
          { labelKey: 'NAV.EVENTS', route: '/admin/events' },
          { labelKey: 'NAV.ATHLETES_WAITLIST', route: '/admin/athletes' },
          { labelKey: 'NAV.SPORTS', route: '/admin/sports' },
          { labelKey: 'NAV.DISABILITIES', route: '/admin/disabilities' },
          { labelKey: 'NAV.ASSOCIATIONS', route: '/admin/associations' },
          { labelKey: 'NAV.ROLES', route: '/admin/roles' },
          { labelKey: 'NAV.AUDIT_LOGS', route: '/admin/audit' }
        ];
        this.secondaryItems = this.commonAccountItems('/admin');
        break;
      case 'ENTRENADOR':
        this.navItems = [
          { labelKey: 'NAV.DASHBOARD', route: '/trainer', exact: true },
          { labelKey: 'NAV.SESSIONS', route: '/trainer/sessions' },
          { labelKey: 'NAV.SPORTS', route: '/trainer/sports' },
          { labelKey: 'NAV.DISABILITIES', route: '/trainer/disabilities' },
          { labelKey: 'NAV.ASSOCIATIONS', route: '/trainer/associations' }
        ];
        this.secondaryItems = this.commonAccountItems('/trainer');
        break;
      case 'ORGANIZADOR':
        this.navItems = [
          { labelKey: 'NAV.EVENTS', route: '/organizer', exact: true },
          { labelKey: 'NAV.MANAGE_EVENTS', route: '/organizer/events' },
          { labelKey: 'NAV.ATHLETES_WAITLIST', route: '/organizer/athletes' }
        ];
        this.secondaryItems = this.commonAccountItems('/organizer');
        break;
      default:
        this.navItems = [
          { labelKey: 'NAV.HOME', route: '/home', exact: true },
          { labelKey: 'NAV.EVENTS', route: '/home/events' },
          ...this.commonAccountItems('/home')
        ];
        this.secondaryItems = [];
        break;
    }
  }
}
