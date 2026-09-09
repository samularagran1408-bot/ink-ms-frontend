import { ChangeDetectorRef, Component, HostListener, Input, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { SessionService } from '@core/services/session.service';

@Component({
  selector: 'app-panel-shell',
  templateUrl: './panel-shell.component.html',
  styleUrl: './panel-shell.component.scss'
})
export class PanelShellComponent implements OnInit, OnDestroy {
  private static readonly MOBILE_BREAKPOINT = 700;

  /** Si se pasa, fuerza el margen del sidebar (p. ej. asistencia). Si no, se deriva del rol. */
  @Input()
  set fixedSidebar(value: boolean) {
    this.overrideFixed = value;
    this.syncFixed();
  }

  isSidebarFixed = false;

  private overrideFixed: boolean | null = null;
  private isMobileViewport = false;
  private readonly subs = new Subscription();

  constructor(
    private session: SessionService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.updateViewport();
    this.syncFixed();
    this.subs.add(this.session.roles$.subscribe(() => this.syncFixed()));
    this.subs.add(
      this.router.events
        .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe(() => this.cdr.detectChanges())
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateViewport();
    this.syncFixed();
  }

  private updateViewport(): void {
    if (typeof window === 'undefined') {
      return;
    }
    this.isMobileViewport = window.innerWidth <= PanelShellComponent.MOBILE_BREAKPOINT;
  }

  private syncFixed(): void {
    if (this.overrideFixed !== null) {
      this.isSidebarFixed = this.overrideFixed && !this.isMobileViewport;
    } else {
      const staff = this.session.getPrimaryRole() !== 'USUARIO';
      this.isSidebarFixed = staff && !this.isMobileViewport;
    }
    this.cdr.markForCheck();
  }
}
