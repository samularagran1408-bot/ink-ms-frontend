import { Component, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

import { EventItem } from '@features/sports-disabilities/models/sports';
import { UserProfile } from '@core/models/user-profile';
import { DashboardResponse } from '@features/reports/models/reports';
import { ReportsService } from '@features/reports/services/reports.service';
import { ConfirmDialogService } from '@shared/services/confirm-dialog.service';
import { FlashMessageService } from '@shared/services/flash-message.service';
import { SharedModule } from '@shared/shared.module';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, SharedModule],
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
    private router: Router,
    private translate: TranslateService,
    private confirm: ConfirmDialogService,
    private flash: FlashMessageService
  ) {}

  ngOnInit(): void {
    this.reportsService.getDashboard().subscribe({
      next: (dashboard) => {
        this.applyDashboard(dashboard);
        this.loading = false;
      },
      error: () => {
        const message = this.translate.instant('ADMIN_DASHBOARD.LOAD_ERROR');
        this.errorMessage = message;
        this.loading = false;
        this.notifyError(message);
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
        this.notifyInfo(
          this.translate.instant('COMMON.MSG_INFO'),
          this.translate.instant('ADMIN_DASHBOARD.EXPORT_OK')
        );
      },
      error: () => {
        const message = this.translate.instant('ADMIN_DASHBOARD.EXPORT_ERROR');
        this.errorMessage = message;
        this.exporting = false;
        this.notifyError(message);
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

  private notifyError(message: string): void {
    this.flash.error(this.translate.instant('COMMON.MSG_ERROR'), message);
    void this.confirm.error({
      title: this.translate.instant('COMMON.MSG_ERROR'),
      message,
      confirmLabel: this.translate.instant('COMMON.GOT_IT'),
      kindLabel: this.translate.instant('COMMON.MSG_ERROR')
    });
  }

  private notifyInfo(title: string, message: string): void {
    this.flash.info(title, message);
    void this.confirm.info({
      title,
      message,
      confirmLabel: this.translate.instant('COMMON.GOT_IT'),
      kindLabel: this.translate.instant('COMMON.MSG_INFO')
    });
  }
}
