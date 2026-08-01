import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { AppRole, ROLE_LABELS } from '../../../core/models/app-role';
import { SessionService } from '../../../core/services/session.service';

export interface SidebarNavItem {
  label: string;
  route?: string;
  exact?: boolean;
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
  roleLabel = ROLE_LABELS.USUARIO;
  brandTitle = 'INKLUSPORT';
  layout: 'drawer' | 'fixed' = 'drawer';
  navItems: SidebarNavItem[] = [];
  secondaryItems: SidebarNavItem[] = [];

  private subs = new Subscription();

  constructor(
    private router: Router,
    private session: SessionService
  ) {}

  ngOnInit(): void {
    this.refreshFromSession();
    this.subs.add(this.session.profile$.subscribe(() => this.refreshFromSession()));
    this.subs.add(this.session.roles$.subscribe(() => this.refreshFromSession()));
    this.subs.add(
      this.router.events
        .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe(() => {
          this.sidebarOpen = false;
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

  private refreshFromSession(): void {
    this.role = this.session.getPrimaryRole();
    this.displayName = this.session.getDisplayName();
    this.roleLabel = this.session.getRoleLabel();
    this.layout = this.role === 'USUARIO' ? 'drawer' : 'fixed';
    this.brandTitle = this.role === 'ADMIN' ? 'INKLUSPORT ADMIN' : 'INKLUSPORT';
    this.applyMenuByRole();
  }

  get sessionHome(): string {
    return this.session.homeForCurrentUser();
  }

  private commonAccountItems(base: string): SidebarNavItem[] {
    return [
      { label: 'Perfil', route: `${base}/profile` },
      { label: 'Accesibilidad', route: `${base}/accessibility` },
      { label: 'Notificaciones', route: `${base}/notifications` }
    ];
  }

  private applyMenuByRole(): void {
    switch (this.role) {
      case 'ADMIN':
        this.navItems = [
          { label: 'Dashboard', route: '/admin', exact: true },
          { label: 'Users', route: '/admin/users' },
          { label: 'Events', route: '/admin/events' },
          { label: 'Atletas / Waitlist', route: '/admin/athletes' },
          { label: 'Sports', route: '/admin/sports' },
          { label: 'Disabilities', route: '/admin/disabilities' },
          { label: 'Roles', route: '/admin/roles' },
          { label: 'Audit Logs', route: '/admin/audit' }
        ];
        this.secondaryItems = this.commonAccountItems('/admin');
        break;
      case 'ENTRENADOR':
        this.navItems = [
          { label: 'Atletas', route: '/trainer', exact: true },
          { label: 'Sesiones', route: '/trainer/sessions' },
          { label: 'Eventos', route: '/trainer/events' },
          { label: 'Waitlist', route: '/trainer/athletes' }
        ];
        this.secondaryItems = this.commonAccountItems('/trainer');
        break;
      case 'ORGANIZADOR':
        this.navItems = [
          { label: 'Eventos', route: '/organizer', exact: true },
          { label: 'Gestionar eventos', route: '/organizer/events' },
          { label: 'Atletas / Waitlist', route: '/organizer/athletes' }
        ];
        this.secondaryItems = this.commonAccountItems('/organizer');
        break;
      default:
        this.navItems = [
          { label: 'Inicio', route: '/home', exact: true },
          { label: 'Eventos', route: '/home/events' },
          ...this.commonAccountItems('/home')
        ];
        this.secondaryItems = [];
        break;
    }
  }
}
