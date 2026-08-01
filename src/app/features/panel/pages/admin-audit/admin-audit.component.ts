import { Component, OnInit } from '@angular/core';

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

  constructor(private usersService: UsersService) {}

  ngOnInit(): void {
    this.usersService.getAuditLogs().subscribe({
      next: (logs) => {
        this.logs = logs;
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'No se pudo cargar la auditoría.';
        this.loading = false;
      }
    });
  }
}
