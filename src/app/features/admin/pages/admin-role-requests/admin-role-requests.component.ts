import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

import { PendingRoleRequest } from '@core/models/user-profile';
import { RoleRequestStatus, UsersService } from '@features/users/services/users.service';
import { ConfirmDialogService } from '@shared/services/confirm-dialog.service';
import { SharedModule } from '@shared/shared.module';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SharedModule],
  selector: 'app-admin-role-requests',
  templateUrl: './admin-role-requests.component.html',
  styleUrl: './admin-role-requests.component.scss'
})
export class AdminRoleRequestsComponent implements OnInit {
  requests: PendingRoleRequest[] = [];
  statusFilter: RoleRequestStatus = 'PENDING';
  loading = true;
  message: string | null = null;
  errorMessage: string | null = null;
  processingId: string | null = null;

  readonly statusOptions: RoleRequestStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

  constructor(
    private usersService: UsersService,
    private confirm: ConfirmDialogService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.reload();
  }

  onFilterChange(status: RoleRequestStatus): void {
    this.statusFilter = status;
    this.reload();
  }

  reload(): void {
    this.loading = true;
    this.errorMessage = null;
    this.usersService.getRoleRequests(this.statusFilter).subscribe({
      next: (page) => {
        this.requests = page.content || [];
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || this.translate.instant('ADMIN_ROLE_REQUESTS.LOAD_ERROR');
        this.loading = false;
      }
    });
  }

  approve(request: PendingRoleRequest): void {
    this.processingId = request.id;
    this.message = null;
    this.errorMessage = null;
    this.usersService.approveRoleRequest(request.id).subscribe({
      next: () => {
        this.message = this.translate.instant('ADMIN_ROLE_REQUESTS.APPROVED_MSG', { email: request.userEmail });
        this.processingId = null;
        this.reload();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || this.translate.instant('ADMIN_ROLE_REQUESTS.ACTION_ERROR');
        this.processingId = null;
      }
    });
  }

  async reject(request: PendingRoleRequest): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.translate.instant('ADMIN_ROLE_REQUESTS.REJECT_CONFIRM_TITLE'),
      message: this.translate.instant('ADMIN_ROLE_REQUESTS.REJECT_CONFIRM', { email: request.userEmail }),
      confirmLabel: this.translate.instant('COMMON.CONFIRM'),
      cancelLabel: this.translate.instant('COMMON.CANCEL'),
      tone: 'danger'
    });
    if (!ok) {
      return;
    }

    this.processingId = request.id;
    this.message = null;
    this.errorMessage = null;
    this.usersService.rejectRoleRequest(request.id).subscribe({
      next: () => {
        this.message = this.translate.instant('ADMIN_ROLE_REQUESTS.REJECTED_MSG', { email: request.userEmail });
        this.processingId = null;
        this.reload();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || this.translate.instant('ADMIN_ROLE_REQUESTS.ACTION_ERROR');
        this.processingId = null;
      }
    });
  }

  statusPillClass(status: string): string {
    if (status === 'APPROVED') {
      return 'status-pill status-pill--ok';
    }
    if (status === 'REJECTED') {
      return 'status-pill status-pill--bad';
    }
    return 'status-pill status-pill--warn';
  }

  formatDate(value?: string | null): string {
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
      minute: '2-digit'
    });
  }
}
