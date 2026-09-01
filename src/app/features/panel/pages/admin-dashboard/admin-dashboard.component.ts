import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { EventItem } from '../../../../core/models/sports';
import { UserProfile } from '../../../../core/models/user-profile';
import { DashboardResponse } from '../../../../core/models/reports';
import { ReportsService } from '../../../../core/services/reports.service';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss'
})
export class AdminDashboardComponent implements OnInit {
  loading = true;
  totalUsers = 0;
  activeUsers = 0;
  activeEvents = 0;
  sportsCount = 0;
  recentUsers: UserProfile[] = [];
  events: EventItem[] = [];
  disabilitiesCount = 0;
  weeklyTrend: { date: string; count: number }[] = [];
  eventCounts: { type: string; count: number }[] = [];
  exporting = false;
  errorMessage: string | null = null;

  constructor(
    private reportsService: ReportsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.reportsService.getDashboard().subscribe({
      next: (dashboard) => {
        this.applyDashboard(dashboard);
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'No se pudo cargar el dashboard admin.';
        this.loading = false;
      }
    });
  }

  goUser(user: UserProfile): void {
    void this.router.navigate(['/admin/users', user.email]);
  }

  go(path: string): void {
    this.router.navigate([path]);
  }

  exportPdf(): void {
    this.exporting = true;
    this.reportsService.exportDashboardPdf().subscribe({
      next: (blob) => {
        this.reportsService.downloadBlob(blob, `inklusport-dashboard-${new Date().toISOString().slice(0, 10)}.pdf`);
        this.exporting = false;
      },
      error: () => {
        this.errorMessage = 'No se pudo exportar el dashboard a PDF.';
        this.exporting = false;
      }
    });
  }

  statusClass(user: UserProfile): string {
    if (user.blockedPermanently || user.blockReason) return 'status-pill--bad';
    if (user.isActive === false) return 'status-pill--warn';
    return 'status-pill--ok';
  }

  statusLabel(user: UserProfile): string {
    if (user.blockedPermanently || user.blockReason) return 'COMMON.BLOCKED';
    if (user.isActive === false) return 'COMMON.INACTIVE';
    return 'COMMON.ACTIVE';
  }

  private applyDashboard(dashboard: DashboardResponse): void {
    this.totalUsers = dashboard.metrics?.total_users ?? 0;
    this.activeUsers = dashboard.metrics?.active_users ?? 0;
    this.activeEvents = dashboard.metrics?.active_events ?? 0;
    this.sportsCount = dashboard.metrics?.total_sports ?? 0;
    this.disabilitiesCount = dashboard.metrics?.total_disabilities ?? 0;
    this.recentUsers = dashboard.recentUsers || [];
    this.events = dashboard.recentEvents || [];
    this.weeklyTrend = Object.entries(dashboard.weeklyTrend || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count: Number(count) || 0 }));
    this.eventCounts = Object.entries(dashboard.eventCounts || {})
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 6)
      .map(([type, count]) => ({ type, count: Number(count) || 0 }));
  }
}
