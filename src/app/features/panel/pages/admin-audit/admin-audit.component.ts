import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { AdminAuditLog, UserProfile } from '../../../../core/models/user-profile';
import { DashboardResponse } from '../../../../core/models/reports';
import { ReportsService } from '../../../../core/services/reports.service';

interface ChartBar {
  label: string;
  value: number;
  height: number;
  highlight: 'peak' | 'accent' | 'default';
}

interface DonutSlice {
  label: string;
  value: number;
  percent: number;
  color: string;
}

@Component({
  selector: 'app-admin-audit',
  templateUrl: './admin-audit.component.html',
  styleUrl: './admin-audit.component.scss'
})
export class AdminAuditComponent implements OnInit {
  logs: AdminAuditLog[] = [];
  filteredLogs: AdminAuditLog[] = [];
  pagedLogs: AdminAuditLog[] = [];

  dashboard: DashboardResponse | null = null;
  weeklyBars: ChartBar[] = [];
  disabilitySlices: DonutSlice[] = [];
  donutGradient = 'conic-gradient(#E2E8F0 0deg 360deg)';
  totalUsersLabel = '0';

  loading = true;
  exporting = false;
  errorMessage: string | null = null;
  selectedDetail: AdminAuditLog | null = null;

  rangeFilter: '7' | '30' | '90' | 'all' = '30';
  actionFilter = 'ALL';
  availableActions: string[] = [];

  page = 1;
  readonly pageSize = 15;

  private readonly actionLabels: Record<string, string> = {
    BLOCK_USER_PERMANENT: 'Bloqueo permanente',
    BLOCK_USER_TEMPORARY: 'Bloqueo temporal',
    ACTIVATE_USER: 'Activar usuario',
    DEACTIVATE_USER: 'Desactivar usuario',
    ASSIGN_ROLE: 'Asignar rol',
    REMOVE_ROLE: 'Quitar rol',
    REPLACE_ROLES: 'Reemplazar roles',
    UPDATE_PROFILE: 'Actualizar perfil',
  };

  private readonly detailLabels: Record<string, string> = {
    reason: 'Motivo',
    blockedUntil: 'Hasta',
    role: 'Rol',
    roleId: 'ID rol',
    roles: 'Roles',
    message: 'Detalle',
  };

  private readonly sliceColors = ['#A30D11', '#1D4ED8', '#0F766E', '#B45309', '#7C3AED', '#0369A1'];

  constructor(
    private reportsService: ReportsService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.reportsService.getAuditPanel().subscribe({
      next: (panel) => {
        const logs = panel.auditLogs || [];
        const users = panel.users || [];
        const dashboard: DashboardResponse = {
          metrics: panel.metrics || {},
          eventCounts: panel.eventCounts || {},
          weeklyTrend: panel.weeklyTrend || {},
          recentUsers: users,
          recentEvents: []
        };
        this.logs = logs;
        this.availableActions = [...new Set(logs.map((l) => l.action).filter(Boolean) as string[])].sort();
        this.dashboard = dashboard;
        this.buildWeeklyBars(dashboard);
        this.buildDisabilitySlices(users, dashboard);
        this.applyFilters();
        this.loading = false;
        if (!logs.length && !dashboard.metrics) {
          this.errorMessage = this.translate.instant('ADMIN_AUDIT.LOAD_ERROR');
        }
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || this.translate.instant('ADMIN_AUDIT.LOAD_ERROR');
        this.loading = false;
      }
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredLogs.length / this.pageSize));
  }

  get rangeStart(): number {
    return this.filteredLogs.length ? (this.page - 1) * this.pageSize + 1 : 0;
  }

  get rangeEnd(): number {
    return Math.min(this.page * this.pageSize, this.filteredLogs.length);
  }

  get visiblePages(): number[] {
    const total = this.totalPages;
    const pages: number[] = [];
    for (let i = 1; i <= total; i++) {
      if (total <= 5 || i === 1 || i === total || Math.abs(i - this.page) <= 1) {
        pages.push(i);
      }
    }
    return pages;
  }

  applyFilters(): void {
    const now = Date.now();
    const rangeMs =
      this.rangeFilter === '7' ? 7 * 86400000 :
      this.rangeFilter === '30' ? 30 * 86400000 :
      this.rangeFilter === '90' ? 90 * 86400000 :
      null;

    this.filteredLogs = this.logs.filter((log) => {
      if (this.actionFilter !== 'ALL' && log.action !== this.actionFilter) {
        return false;
      }
      if (!rangeMs || !log.createdAt) {
        return true;
      }
      const ts = new Date(log.createdAt).getTime();
      return !Number.isNaN(ts) && now - ts <= rangeMs;
    });

    this.page = 1;
    this.updatePage();
  }

  goToPage(page: number): void {
    this.page = Math.min(Math.max(1, page), this.totalPages);
    this.updatePage();
  }

  exportCsv(): void {
    const header = ['Fecha', 'Accion', 'Admin', 'Objetivo', 'IP', 'Detalle'];
    const rows = this.filteredLogs.map((log) => [
      this.formatDate(log.createdAt),
      log.action || '',
      log.adminEmail || '',
      log.targetEmail || log.targetUserId || '',
      log.ipAddress || '',
      this.formatDetails(log.details).replace(/"/g, '""')
    ]);
    const csv = [header, ...rows]
      .map((cols) => cols.map((c) => `"${c}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    this.reportsService.downloadBlob(blob, `inklusport-audit-${this.today()}.csv`);
  }

  exportPdf(): void {
    this.exporting = true;
    const payload = {
      logs: this.filteredLogs.map((log) => ({
        id: log.id,
        adminEmail: log.adminEmail,
        action: log.action,
        targetEmail: log.targetEmail,
        targetUserId: log.targetUserId,
        details: log.details,
        ipAddress: log.ipAddress,
        createdAt: this.formatDate(log.createdAt)
      }))
    };

    this.reportsService.exportAnalysisPdf(payload).subscribe({
      next: (blob) => {
        this.reportsService.downloadBlob(blob, `inklusport-audit-analysis-${this.today()}.pdf`);
        this.exporting = false;
      },
      error: () => {
        this.errorMessage = this.translate.instant('ADMIN_AUDIT.EXPORT_ERROR');
        this.exporting = false;
      }
    });
  }

  exportDashboardPdf(): void {
    this.exporting = true;
    this.reportsService.exportDashboardPdf().subscribe({
      next: (blob) => {
        this.reportsService.downloadBlob(blob, `inklusport-dashboard-${this.today()}.pdf`);
        this.exporting = false;
      },
      error: () => {
        this.errorMessage = this.translate.instant('ADMIN_AUDIT.EXPORT_ERROR');
        this.exporting = false;
      }
    });
  }

  openDetail(log: AdminAuditLog): void {
    this.selectedDetail = log;
  }

  closeDetail(): void {
    this.selectedDetail = null;
  }

  formatDate(value?: string): string {
    if (!value) {
      return '—';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  formatAction(action?: string): string {
    if (!action) {
      return '—';
    }
    return this.actionLabels[action] || action;
  }

  actionClass(action?: string): string {
    if (!action) {
      return 'action-pill action-pill--neutral';
    }
    if (action.includes('DELETE') || action.includes('BLOCK') || action.includes('REMOVE')) {
      return 'action-pill action-pill--danger';
    }
    if (action.includes('EXPORT') || action.includes('ASSIGN') || action.includes('ACTIVATE')) {
      return 'action-pill action-pill--teal';
    }
    return 'action-pill action-pill--info';
  }

  initials(email?: string): string {
    if (!email) {
      return '?';
    }
    const base = email.split('@')[0] || email;
    const parts = base.split(/[._-]/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return base.slice(0, 2).toUpperCase();
  }

  formatDetails(details?: string): string {
    if (!details || !details.trim()) {
      return '—';
    }

    const trimmed = details.trim();
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed === null || typeof parsed !== 'object') {
        return String(parsed);
      }
      if (Array.isArray(parsed)) {
        return parsed.map((item) => this.stringifyDetailValue(item)).join(', ') || '—';
      }

      const entries = Object.entries(parsed as Record<string, unknown>)
        .filter(([, value]) => value !== null && value !== undefined && value !== '');

      if (!entries.length) {
        return this.translate.instant('ADMIN_AUDIT.NO_EXTRA');
      }

      return entries
        .map(([key, value]) => `${this.detailLabels[key] || this.humanizeKey(key)}: ${this.stringifyDetailValue(value)}`)
        .join(' · ');
    } catch {
      return trimmed;
    }
  }

  private updatePage(): void {
    const start = (this.page - 1) * this.pageSize;
    this.pagedLogs = this.filteredLogs.slice(start, start + this.pageSize);
  }

  private buildWeeklyBars(dashboard: DashboardResponse | null): void {
    if (!dashboard?.weeklyTrend) {
      this.weeklyBars = [];
      return;
    }

    const entries = Object.entries(dashboard.weeklyTrend)
      .sort(([a], [b]) => a.localeCompare(b));
    const max = Math.max(...entries.map(([, v]) => Number(v) || 0), 1);
    const peakValue = Math.max(...entries.map(([, v]) => Number(v) || 0));

    this.weeklyBars = entries.map(([date, value], index) => {
      const num = Number(value) || 0;
      const day = new Date(date + 'T00:00:00');
      const label = Number.isNaN(day.getTime())
        ? date.slice(5)
        : day.toLocaleDateString('es-ES', { weekday: 'short' });
      let highlight: ChartBar['highlight'] = 'default';
      if (num === peakValue && peakValue > 0) {
        highlight = 'peak';
      } else if (index === entries.length - 2 && num > 0) {
        highlight = 'accent';
      }
      return {
        label,
        value: num,
        height: Math.max(8, Math.round((num / max) * 100)),
        highlight
      };
    });
  }

  private buildDisabilitySlices(users: UserProfile[], dashboard: DashboardResponse | null): void {
    const totalUsers = dashboard?.metrics?.total_users || users.length || 0;
    this.totalUsersLabel = totalUsers >= 1000
      ? `${(totalUsers / 1000).toFixed(1).replace(/\.0$/, '')}k`
      : String(totalUsers);

    const counts = new Map<string, number>();
    for (const user of users) {
      const key = (user.disability || '').trim() || 'Sin especificar';
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    if (!counts.size && dashboard?.eventCounts) {
      Object.entries(dashboard.eventCounts).forEach(([key, value]) => {
        counts.set(key, Number(value) || 0);
      });
    }

    const total = [...counts.values()].reduce((sum, n) => sum + n, 0) || 1;
    const top = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    this.disabilitySlices = top.map(([label, value], index) => ({
      label,
      value,
      percent: Math.round((value / total) * 100),
      color: this.sliceColors[index % this.sliceColors.length]
    }));

    if (!this.disabilitySlices.length) {
      this.donutGradient = 'conic-gradient(#E2E8F0 0deg 360deg)';
      return;
    }

    let cursor = 0;
    const parts = this.disabilitySlices.map((slice) => {
      const start = cursor;
      cursor += (slice.percent / 100) * 360;
      return `${slice.color} ${start}deg ${cursor}deg`;
    });
    this.donutGradient = `conic-gradient(${parts.join(', ')})`;
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private humanizeKey(key: string): string {
    return key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/^\w/, (c) => c.toUpperCase());
  }

  private stringifyDetailValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '—';
    }
    if (typeof value === 'boolean') {
      return value ? 'Sí' : 'No';
    }
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    if (typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => `${this.humanizeKey(k)}: ${this.stringifyDetailValue(v)}`)
        .join(', ');
    }
    return String(value);
  }
}
