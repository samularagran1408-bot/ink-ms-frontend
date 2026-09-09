import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AdminUserActivityItem, UserProfile } from '@core/models/user-profile';
import { UsersService } from '@features/users/services/users.service';
import { SessionService } from '@core/services/session.service';
import { ReportsService } from '@features/reports/services/reports.service';
import { ConfirmDialogService } from '@shared/services/confirm-dialog.service';
import { SharedModule } from '@shared/shared.module';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, SharedModule],
  selector: 'app-admin-users',
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminUsersComponent implements OnInit {
  users: UserProfile[] = [];
  filteredUsers: UserProfile[] = [];
  pagedUsers: UserProfile[] = [];
  loading = true;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  actionEmail: string | null = null;
  bulkLoading = false;
  selected = new Set<string>();
  filter: 'active' | 'all' | 'inactive' = 'active';
  nameQuery = '';
  disabilityQuery = '';
  readonly pageSize = 6;
  currentPage = 1;
  totalPages = 1;
  showingFrom = 0;
  showingTo = 0;
  allVisibleSelected = false;
  activityUser: UserProfile | null = null;
  activityItems: AdminUserActivityItem[] = [];
  activityLastLogin: string | null = null;
  activityLoading = false;

  readonly disabilityOptions = [
    { value: '', labelKey: 'ADMIN_USERS.ALL_DISABILITIES' },
    { value: 'VISUAL', labelKey: 'PROFILE.DISABILITY_VISUAL' },
    { value: 'MOTRIZ', labelKey: 'PROFILE.DISABILITY_MOTOR' },
    { value: 'AUDITIVA', labelKey: 'PROFILE.DISABILITY_HEARING' },
    { value: 'INTELECTUAL', labelKey: 'PROFILE.DISABILITY_INTELLECTUAL' },
    { value: 'COGNITIVA', labelKey: 'PROFILE.DISABILITY_COGNITIVE' },
    { value: 'MULTIPLE', labelKey: 'PROFILE.DISABILITY_MULTIPLE' }
  ];

  constructor(
    private usersService: UsersService,
    private reportsService: ReportsService,
    private session: SessionService,
    private confirm: ConfirmDialogService,
    private router: Router,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.reload();
  }

  get selectedCount(): number {
    return this.selected.size;
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  trackByUser(_index: number, user: UserProfile): string {
    return user.id || user.email;
  }

  trackByActivity(_index: number, item: AdminUserActivityItem): string {
    return `${item.createdAt || ''}-${item.action || ''}-${item.source || ''}-${_index}`;
  }

  reload(silent = false): void {
    if (!silent) {
      this.loading = true;
    }
    this.errorMessage = null;
    this.reportsService.getUsersPanel('all').subscribe({
      next: (panel) => {
        this.users = panel.users || [];
        this.selected.clear();
        this.currentPage = 1;
        this.loading = false;
        this.applyView();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || this.translate.instant('ADMIN_USERS.LOAD_LIST_ERROR');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  setFilter(filter: 'active' | 'all' | 'inactive'): void {
    if (this.filter === filter) {
      return;
    }
    this.filter = filter;
    this.currentPage = 1;
    this.applyView();
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.applyView();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) {
      return;
    }
    this.currentPage = page;
    this.applyView();
  }

  toggleOne(email: string, checked: boolean): void {
    if (checked) {
      this.selected.add(email);
    } else {
      this.selected.delete(email);
    }
    this.syncSelectionFlags();
    this.cdr.markForCheck();
  }

  toggleAll(checked: boolean): void {
    if (checked) {
      this.pagedUsers.forEach((u) => this.selected.add(u.email));
    } else {
      this.pagedUsers.forEach((u) => this.selected.delete(u.email));
    }
    this.syncSelectionFlags();
    this.cdr.markForCheck();
  }

  private applyView(): void {
    const name = this.nameQuery.trim().toLowerCase();
    const disability = this.disabilityQuery.trim().toLowerCase();
    let list = this.users;
    if (this.filter === 'active') {
      list = list.filter((user) => !this.isInactive(user));
    } else if (this.filter === 'inactive') {
      list = list.filter((user) => this.isInactive(user));
    }
    if (name) {
      list = list.filter((user) =>
        (user.fullName || '').toLowerCase().includes(name)
        || (user.email || '').toLowerCase().includes(name)
      );
    }
    if (disability) {
      list = list.filter((user) => (user.disability || '').toLowerCase().includes(disability));
    }
    this.filteredUsers = list;
    this.totalPages = Math.max(1, Math.ceil(list.length / this.pageSize));
    this.currentPage = Math.min(Math.max(1, this.currentPage), this.totalPages);
    const start = (this.currentPage - 1) * this.pageSize;
    this.pagedUsers = list.slice(start, start + this.pageSize);
    this.showingFrom = list.length ? start + 1 : 0;
    this.showingTo = Math.min(start + this.pageSize, list.length);
    this.syncSelectionFlags();
    this.cdr.markForCheck();
  }

  private syncSelectionFlags(): void {
    this.allVisibleSelected = this.pagedUsers.length > 0
      && this.pagedUsers.every((user) => this.selected.has(user.email));
  }

  isSelected(email: string): boolean {
    return this.selected.has(email);
  }

  disabilityLabel(user: UserProfile): string {
    return user.disability?.trim() || this.translate.instant('COMMON.NONE');
  }

  initials(user: UserProfile): string {
    const name = (user.fullName || user.email || 'U').trim();
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'U';
  }

  openProfile(user: UserProfile): void {
    void this.router.navigate(['/admin/users', user.email]);
  }

  block(user: UserProfile): void {
    void this.confirmBlock(user);
  }

  private async confirmBlock(user: UserProfile): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.translate.instant('ADMIN_USERS.BLOCK_TITLE'),
      message: this.translate.instant('ADMIN_USERS.BLOCK_CONFIRM', { name: user.fullName || user.email }),
      confirmLabel: this.translate.instant('COMMON.CONFIRM'),
      cancelLabel: this.translate.instant('COMMON.CANCEL'),
      tone: 'danger'
    });
    if (!ok) {
      return;
    }
    this.actionEmail = user.email;
    this.usersService.blockUser(user.email, { reason: this.translate.instant('ADMIN_USERS.BLOCK_TITLE'), permanent: false }).subscribe({
      next: () => {
        this.actionEmail = null;
        this.reload(true);
      },
      error: (error) => {
        this.actionEmail = null;
        this.errorMessage = error?.error?.message || this.translate.instant('ADMIN_USERS.BLOCK_ERROR');
        this.cdr.markForCheck();
      }
    });
  }

  activate(user: UserProfile): void {
    void this.confirmActivate(user);
  }

  private async confirmActivate(user: UserProfile): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.translate.instant('ADMIN_USERS.ACTIVATE_TITLE'),
      message: this.translate.instant('ADMIN_USERS.ACTIVATE_CONFIRM', { name: user.fullName || user.email }),
      confirmLabel: this.translate.instant('COMMON.CONFIRM'),
      cancelLabel: this.translate.instant('COMMON.CANCEL')
    });
    if (!ok) {
      return;
    }
    this.actionEmail = user.email;
    this.usersService.activateUser(user.email).subscribe({
      next: () => {
        this.actionEmail = null;
        this.reload(true);
      },
      error: (error) => {
        this.actionEmail = null;
        this.errorMessage = error?.error?.message || this.translate.instant('ADMIN_USERS.ACTIVATE_ERROR');
        this.cdr.markForCheck();
      }
    });
  }

  deleteOne(user: UserProfile): void {
    const me = this.session.getProfile()?.email;
    if (me && me.toLowerCase() === user.email.toLowerCase()) {
      this.errorMessage = this.translate.instant('ADMIN_USERS.CANNOT_DELETE_SELF');
      return;
    }
    void this.confirmDeleteOne(user);
  }

  private async confirmDeleteOne(user: UserProfile): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.translate.instant('ADMIN_USERS.DELETE_TITLE'),
      message: this.translate.instant('ADMIN_USERS.DELETE_ONE_CONFIRM', { name: user.fullName || user.email }),
      confirmLabel: this.translate.instant('COMMON.CONFIRM'),
      cancelLabel: this.translate.instant('COMMON.CANCEL'),
      tone: 'danger'
    });
    if (!ok) {
      return;
    }
    this.actionEmail = user.email;
    this.successMessage = null;
    this.errorMessage = null;
    this.usersService.deleteUser(user.email).subscribe({
      next: (result) => {
        this.actionEmail = null;
        this.successMessage = result?.message || this.translate.instant('ADMIN_USERS.DELETED_OK', { name: user.fullName || user.email });
        this.reload(true);
      },
      error: (error) => {
        this.actionEmail = null;
        this.errorMessage = error?.error?.message
          || this.translate.instant('ADMIN_USERS.DELETE_BLOCKED_EVENTS');
        this.cdr.markForCheck();
      }
    });
  }

  deleteSelected(): void {
    const emails = [...this.selected];
    if (!emails.length) {
      return;
    }
    const me = this.session.getProfile()?.email;
    const filtered = me
      ? emails.filter((email) => email.toLowerCase() !== me.toLowerCase())
      : emails;
    if (!filtered.length) {
      this.errorMessage = this.translate.instant('ADMIN_USERS.CANNOT_DELETE_SELF');
      return;
    }
    void this.confirmDeleteSelected(filtered);
  }

  private async confirmDeleteSelected(filtered: string[]): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.translate.instant('ADMIN_USERS.DELETE_TITLE'),
      message: this.translate.instant('ADMIN_USERS.DELETE_BULK_CONFIRM', { count: filtered.length }),
      confirmLabel: this.translate.instant('COMMON.CONFIRM'),
      cancelLabel: this.translate.instant('COMMON.CANCEL'),
      tone: 'danger'
    });
    if (!ok) {
      return;
    }
    this.bulkLoading = true;
    this.errorMessage = null;
    this.successMessage = null;
    this.cdr.markForCheck();
    this.usersService.bulkDeleteUsers(filtered).subscribe({
      next: (result) => {
        this.bulkLoading = false;
        this.successMessage = this.translate.instant('ADMIN_USERS.DELETE_BULK_OK', {
          succeeded: result.succeeded,
          failed: result.failed
        });
        if (result.errors?.length) {
          this.errorMessage = result.errors.join(' · ');
        }
        this.reload(true);
      },
      error: (error) => {
        this.bulkLoading = false;
        this.errorMessage = error?.error?.message || this.translate.instant('ADMIN_USERS.DELETE_SELECTION_ERROR');
        this.cdr.markForCheck();
      }
    });
  }

  rolesLabel(user: UserProfile): string {
    return user.roles?.join(', ') || 'USUARIO';
  }

  isInactive(user: UserProfile): boolean {
    return user.isActive === false || !!user.blockReason || !!user.blockedPermanently;
  }

  statusClass(user: UserProfile): string {
    return this.isInactive(user) ? 'status-pill--bad' : 'status-pill--ok';
  }

  formatDate(value?: string | null): string {
    if (!value) {
      return this.translate.instant('ADMIN_USERS.NEVER_LOGIN');
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  openActivity(user: UserProfile): void {
    this.activityUser = user;
    this.activityItems = [];
    this.activityLastLogin = user.lastLoginAt || null;
    this.activityLoading = true;
    this.usersService.getUserActivities(user.email).pipe(
      catchError(() => of({ lastLoginAt: user.lastLoginAt, items: [] }))
    ).subscribe({
      next: (response) => {
        this.activityLastLogin = response.lastLoginAt || user.lastLoginAt || null;
        this.activityItems = response.items || [];
        this.activityLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  closeActivity(): void {
    this.activityUser = null;
    this.activityItems = [];
    this.activityLastLogin = null;
    this.activityLoading = false;
    this.cdr.markForCheck();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.activityUser) {
      this.closeActivity();
    }
  }

  formatActivityAction(action?: string): string {
    const key = `ADMIN_USERS.ACTION_${(action || 'UNKNOWN').toUpperCase()}`;
    const translated = this.translate.instant(key);
    return translated === key ? (action || '—') : translated;
  }

  formatActivitySource(source?: string): string {
    if (source === 'LOGIN') {
      return this.translate.instant('ADMIN_USERS.SOURCE_LOGIN');
    }
    if (source === 'PROFILE') {
      return this.translate.instant('ADMIN_USERS.SOURCE_PROFILE');
    }
    return source || '';
  }

  formatActivityDetails(details?: string): string {
    if (!details?.trim()) {
      return '';
    }
    try {
      const parsed = JSON.parse(details);
      if (parsed && typeof parsed === 'object') {
        if (parsed.message) {
          return String(parsed.message);
        }
        if (parsed.method) {
          return this.translate.instant('ADMIN_USERS.LOGIN_METHOD', { method: parsed.method });
        }
      }
    } catch {
      return details;
    }
    return details;
  }
}
