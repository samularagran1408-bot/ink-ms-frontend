import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { AppRole } from '@core/models/app-role';
import { SessionService } from '@core/services/session.service';
import { UnreadNotificationsService } from '@features/accessibility/services/unread-notifications.service';
import { LiveSyncService } from '@features/accessibility/services/live-sync.service';
import { ConfirmDialogService } from '@shared/services/confirm-dialog.service';
import { HeroIconName } from '../../icons/heroicons-outline';
import { preloadNavRoute, preloadNavRoutes } from './nav-preload';

export interface SidebarNavItem {
  labelKey: string;
  route?: string;
  queryParams?: Record<string, string>;
  exact?: boolean;
  showBadge?: boolean;
  icon: HeroIconName;
}

@Component({
  selector: 'app-sidebar-nav',
  templateUrl: './sidebar-nav.component.html',
  styleUrl: './sidebar-nav.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
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
  badgePulse = false;
  sessionHome = '/home';
  notificationsRoute = '/home/notifications';

  private subs = new Subscription();
  private pulseTimer: ReturnType<typeof setTimeout> | null = null;
  private preloadTimer: ReturnType<typeof setTimeout> | null = null;
  private activeUrl = '';
  private activeVista: string | undefined;
  readonly emptyQuery: Record<string, string> = {};

  constructor(
    private router: Router,
    private session: SessionService,
    private translate: TranslateService,
    private unreadNotifications: UnreadNotificationsService,
    private liveSync: LiveSyncService,
    private confirm: ConfirmDialogService,
    private cdr: ChangeDetectorRef
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
    this.liveSync.start();
    this.subs.add(this.session.profile$.subscribe(() => this.refreshFromSession()));
    this.subs.add(this.session.roles$.subscribe(() => this.refreshFromSession()));
    this.subs.add(this.translate.onLangChange.subscribe(() => this.refreshFromSession()));
    this.subs.add(this.unreadNotifications.count$.subscribe((count) => {
      if (count > this.unreadCount) {
        this.badgePulse = true;
        if (this.pulseTimer) {
          clearTimeout(this.pulseTimer);
        }
        this.pulseTimer = setTimeout(() => {
          this.badgePulse = false;
          this.pulseTimer = null;
          this.cdr.markForCheck();
        }, 1800);
      }
      this.unreadCount = count;
      this.cdr.markForCheck();
    }));
    this.cacheActiveUrl(this.router.url);
    this.subs.add(
      this.router.events
        .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe((event) => {
          this.sidebarOpen = false;
          this.cacheActiveUrl(event.urlAfterRedirects);
          this.cdr.markForCheck();
        })
    );

    if (!this.session.getProfile() && this.session.isAuthenticated()) {
      this.session.loadProfile().subscribe();
    }
  }

  ngOnDestroy(): void {
    if (this.pulseTimer) {
      clearTimeout(this.pulseTimer);
    }
    if (this.preloadTimer) {
      clearTimeout(this.preloadTimer);
    }
    this.subs.unsubscribe();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateViewport();
    this.cdr.markForCheck();
  }

  trackByNav(_index: number, item: SidebarNavItem): string {
    return `${item.route || ''}:${item.queryParams?.['vista'] || ''}:${item.labelKey}`;
  }

  openSidebar(): void {
    this.sidebarOpen = true;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  prefetchNav(item: SidebarNavItem): void {
    preloadNavRoute(item.route);
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
    this.cdr.markForCheck();
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
    this.sessionHome = this.session.homeForCurrentUser();
    this.notificationsRoute = `${this.sessionHome}/notifications`;
    this.applyMenuByRole();
    this.scheduleMenuPreload();
    this.cdr.markForCheck();
  }

  isNavActive(item: SidebarNavItem): boolean {
    if (!item.route) {
      return false;
    }
    const pathActive = item.exact
      ? this.activeUrl === item.route
      : this.activeUrl === item.route || this.activeUrl.startsWith(`${item.route}/`);
    if (!pathActive) {
      return false;
    }
    const wantedVista = item.queryParams?.['vista'];
    if (wantedVista) {
      return this.activeVista === wantedVista;
    }
    return !this.activeVista;
  }

  private cacheActiveUrl(url: string): void {
    const clean = (url || this.router.url || '').split('#')[0];
    this.activeUrl = clean.split('?')[0] || '/';
    this.activeVista = this.router.parseUrl(clean).queryParams['vista'];
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
          { labelKey: 'NAV.AUDIT_LOGS', route: '/admin/audit', icon: 'clipboard-document-list' },
          { labelKey: 'NAV.SUBSCRIPTIONS', route: '/admin/subscriptions', icon: 'chart-bar' }
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
          { labelKey: 'NAV.ATHLETES_WAITLIST', route: '/organizer/athletes', icon: 'user-group' },
          { labelKey: 'NAV.PLANS', route: '/organizer/plans', icon: 'sparkles' },
          { labelKey: 'NAV.MY_SUBSCRIPTION', route: '/organizer/subscription', icon: 'chart-bar' },
          { labelKey: 'NAV.PAYMENT_HISTORY', route: '/organizer/payments', icon: 'clipboard-document-list' }
        ];
        this.secondaryItems = this.commonAccountItems('/organizer');
        break;
      default:
        this.navItems = [
          { labelKey: 'NAV.HOME', route: '/home', exact: true, icon: 'home' },
          { labelKey: 'NAV.EVENTS', route: '/home/events', icon: 'calendar-days' },
          { labelKey: 'NAV.HISTORY', route: '/home/events', queryParams: { vista: 'historial' }, icon: 'clipboard-document-list' },
          ...this.commonAccountItems('/home')
        ];
        this.secondaryItems = [];
        break;
    }
  }

  private scheduleMenuPreload(): void {
    if (this.preloadTimer) {
      clearTimeout(this.preloadTimer);
    }
    this.preloadTimer = setTimeout(() => {
      preloadNavRoutes([
        ...this.navItems.map((item) => item.route),
        ...this.secondaryItems.map((item) => item.route)
      ]);
    }, 400);
  }
}
