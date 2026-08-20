import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { AppRole } from '../../../core/models/app-role';
import { SessionService } from '../../../core/services/session.service';
import { UnreadNotificationsService } from '../../../core/services/unread-notifications.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { HeroIconName } from '../../icons/heroicons-outline';

export interface SidebarNavItem {
  labelKey: string;
  route?: string;
  exact?: boolean;
  showBadge?: boolean;
  icon: HeroIconName;
}

@Component({
  selector: 'app-sidebar-nav',
  templateUrl: './sidebar-nav.component.html',
  styleUrl: './sidebar-nav.component.scss'
})
export class SidebarNavComponent implements OnInit, OnDestroy {
  private static readonly MOBILE_BREAKPOINT = 700;

  sidebarOpen = false;
  role: AppRole = 'USUARIO';
  displayName = 'Usuario';
  roleKey = 'ROLES.USUARIO';
  brandTitle = 'INKLUSPORT';
  /** Preferencia por rol: atletas siempre drawer; staff fija en desktop. */
  preferredLayout: 'drawer' | 'fixed' = 'drawer';
  isMobileViewport = false;
  profilePicture: string | null = null;
  navItems: SidebarNavItem[] = [];
  secondaryItems: SidebarNavItem[] = [];
  unreadCount = 0;

  private subs = new Subscription();

  constructor(
    private router: Router,
    private session: SessionService,
    private translate: TranslateService,
    private unreadNotifications: UnreadNotificationsService,
    private confirm: ConfirmDialogService
  ) {}

  /** En móvil el staff también usa drawer + hamburguesa. */
  get layout(): 'drawer' | 'fixed' {
    if (this.preferredLayout === 'drawer') {
      return 'drawer';
    }
    return this.isMobileViewport ? 'drawer' : 'fixed';
  }

  ngOnInit(): void {
    this.updateViewport();
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

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateViewport();
  }

  openSidebar(): void {
    this.sidebarOpen = true;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  handleLogout(): void {
    void this.confirmLogout();
  }

  private async confirmLogout(): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.translate.instant('COMMON.LOGOUT'),
      message: this.translate.instant('COMMON.LOGOUT_CONFIRM'),
      confirmLabel: this.translate.instant('COMMON.CONFIRM'),
      cancelLabel: this.translate.instant('COMMON.CANCEL'),
      tone: 'danger'
    });
    if (ok) {
      this.session.logout();
    }
  }

  get initials(): string {
    return this.displayName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'U';
  }

  private updateViewport(): void {
    if (typeof window === 'undefined') {
      return;
    }
    const mobile = window.innerWidth <= SidebarNavComponent.MOBILE_BREAKPOINT;
    if (mobile === this.isMobileViewport) {
      return;
    }
    this.isMobileViewport = mobile;
    if (!mobile) {
      this.sidebarOpen = false;
    }
  }

  private refreshFromSession(): void {
    this.role = this.session.getPrimaryRole();
    this.displayName = this.session.getDisplayName();
    this.roleKey = `ROLES.${this.role}`;
    this.profilePicture = this.session.getProfile()?.profilePicture || null;
    this.preferredLayout = this.role === 'USUARIO' ? 'drawer' : 'fixed';
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
      { labelKey: 'NAV.PROFILE', route: `${base}/profile`, icon: 'user-circle' },
      { labelKey: 'NAV.ACCESSIBILITY', route: `${base}/accessibility`, icon: 'eye' },
      { labelKey: 'NAV.NOTIFICATIONS', route: `${base}/notifications`, showBadge: true, icon: 'bell' }
    ];
  }

  private applyMenuByRole(): void {
    switch (this.role) {
      case 'ADMIN':
        this.navItems = [
          { labelKey: 'NAV.DASHBOARD', route: '/admin', exact: true, icon: 'squares-2x2' },
          { labelKey: 'NAV.USERS', route: '/admin/users', icon: 'users' },
          { labelKey: 'NAV.EVENTS', route: '/admin/events', icon: 'calendar-days' },
          { labelKey: 'NAV.ATHLETES_WAITLIST', route: '/admin/athletes', icon: 'user-group' },
          { labelKey: 'NAV.SPORTS', route: '/admin/sports', icon: 'trophy' },
          { labelKey: 'NAV.DISABILITIES', route: '/admin/disabilities', icon: 'heart' },
          { labelKey: 'NAV.ASSOCIATIONS', route: '/admin/associations', icon: 'link' },
          { labelKey: 'NAV.ROLES', route: '/admin/roles', icon: 'shield-check' },
          { labelKey: 'NAV.AUDIT_LOGS', route: '/admin/audit', icon: 'clipboard-document-list' }
        ];
        this.secondaryItems = this.commonAccountItems('/admin');
        break;
      case 'ENTRENADOR':
        this.navItems = [
          { labelKey: 'NAV.DASHBOARD', route: '/trainer', exact: true, icon: 'squares-2x2' },
          { labelKey: 'NAV.QUIZ', route: '/trainer/quiz', icon: 'academic-cap' },
          { labelKey: 'NAV.SESSIONS', route: '/trainer/sessions', icon: 'academic-cap' },
          { labelKey: 'NAV.SPORTS', route: '/trainer/sports', icon: 'trophy' },
          { labelKey: 'NAV.DISABILITIES', route: '/trainer/disabilities', icon: 'heart' },
          { labelKey: 'NAV.ASSOCIATIONS', route: '/trainer/associations', icon: 'link' }
        ];
        this.secondaryItems = this.commonAccountItems('/trainer');
        break;
      case 'ORGANIZADOR':
        this.navItems = [
          { labelKey: 'NAV.EVENTS', route: '/organizer', exact: true, icon: 'calendar-days' },
          { labelKey: 'NAV.QUIZ', route: '/organizer/quiz', icon: 'academic-cap' },
          { labelKey: 'NAV.MANAGE_EVENTS', route: '/organizer/events', icon: 'cog-6-tooth' },
          { labelKey: 'NAV.ATHLETES_WAITLIST', route: '/organizer/athletes', icon: 'user-group' }
        ];
        this.secondaryItems = this.commonAccountItems('/organizer');
        break;
      default:
        this.navItems = [
          { labelKey: 'NAV.HOME', route: '/home', exact: true, icon: 'home' },
          { labelKey: 'NAV.EVENTS', route: '/home/events', icon: 'calendar-days' },
          { labelKey: 'NAV.HISTORY', route: '/home/events', icon: 'clipboard-document-list' },
          ...this.commonAccountItems('/home')
        ];
        this.secondaryItems = [];
        break;
    }
  }
}
