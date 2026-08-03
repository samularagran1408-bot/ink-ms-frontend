import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { AdminAuditLog } from '../../../../core/models/user-profile';
import { UsersService } from '../../../../core/services/users.service';

@Component({
  selector: 'app-admin-audit',
  templateUrl: './admin-audit.component.html',
  styleUrl: './admin-audit.component.scss'
})
export class AdminAuditComponent implements OnInit {
  logs: AdminAuditLog[] = [];
  loading = true;
  errorMessage: string | null = null;

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

  constructor(
    private usersService: UsersService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.usersService.getAuditLogs().subscribe({
      next: (logs) => {
        this.logs = logs;
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || this.translate.instant('ADMIN_AUDIT.LOAD_ERROR');
        this.loading = false;
      }
    });
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
      minute: '2-digit'
    });
  }

  formatAction(action?: string): string {
    if (!action) {
      return '—';
    }
    return this.actionLabels[action] || action.replace(/_/g, ' ').toLowerCase()
      .replace(/^\w/, (c) => c.toUpperCase());
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
        return 'Sin detalle adicional';
      }

      return entries
        .map(([key, value]) => `${this.detailLabels[key] || this.humanizeKey(key)}: ${this.stringifyDetailValue(value)}`)
        .join(' · ');
    } catch {
      return trimmed;
    }
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
