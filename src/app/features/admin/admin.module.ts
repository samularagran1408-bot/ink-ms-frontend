import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { SharedModule } from '@shared/shared.module';
import { AdminDashboardComponent } from './pages/admin-dashboard/admin-dashboard.component';
import { AdminRolesComponent } from './pages/admin-roles/admin-roles.component';
import { AdminAuditComponent } from './pages/admin-audit/admin-audit.component';

/**
 * M05 - Gestion Administrativa.
 * Panel administrativo, gestion de roles e historial de acciones (auditoria).
 * Ver features/MODULES.md.
 */
@NgModule({
  declarations: [
    AdminDashboardComponent,
    AdminRolesComponent,
    AdminAuditComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    SharedModule
  ],
  exports: [
    AdminDashboardComponent,
    AdminRolesComponent,
    AdminAuditComponent
  ]
})
export class AdminModule {}
