import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

import { RoleInfo, UserProfile } from '../../../../core/models/user-profile';
import { UsersService } from '../../../../core/services/users.service';
import { ReportsService } from '../../../../core/services/reports.service';

@Component({
  selector: 'app-admin-roles',
  templateUrl: './admin-roles.component.html',
  styleUrl: './admin-roles.component.scss'
})
export class AdminRolesComponent implements OnInit {
  roles: RoleInfo[] = [];
  users: UserProfile[] = [];
  form: FormGroup;
  message: string | null = null;
  errorMessage: string | null = null;

  constructor(
    private usersService: UsersService,
    private reportsService: ReportsService,
    private fb: FormBuilder
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      roleName: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  assign(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, roleName } = this.form.value;
    this.usersService.assignRole(email, { roleName }).subscribe({
      next: () => {
        this.message = `Rol ${roleName} asignado a ${email}`;
        this.errorMessage = null;
        this.reload();
      },
      error: (error) => {
        this.message = null;
        this.errorMessage = error?.error?.message || 'No se pudo asignar el rol.';
      }
    });
  }

  private reload(): void {
    this.reportsService.getRolesPanel().subscribe({
      next: (panel) => {
        this.roles = panel.roles || [];
        this.users = panel.users || [];
        if (this.roles.length && !this.form.value.roleName) {
          this.form.patchValue({ roleName: this.roles[0].name });
        }
      },
      error: (error) => this.errorMessage = error?.error?.message || 'No se pudieron cargar roles.'
    });
  }
}
