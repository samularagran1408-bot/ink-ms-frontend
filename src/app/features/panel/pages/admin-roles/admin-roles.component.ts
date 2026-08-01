import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

import { RoleInfo, UserProfile } from '../../../../core/models/user-profile';
import { UsersService } from '../../../../core/services/users.service';

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
    private fb: FormBuilder
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      roleName: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.usersService.getRoles().subscribe({
      next: (roles) => {
        this.roles = roles;
        if (roles.length) {
          this.form.patchValue({ roleName: roles[0].name });
        }
      },
      error: (error) => this.errorMessage = error?.error?.message || 'No se pudieron cargar roles.'
    });

    this.usersService.getAllUsers().subscribe({
      next: (users) => this.users = users,
      error: () => undefined
    });
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
        this.usersService.getAllUsers().subscribe((users) => this.users = users);
      },
      error: (error) => {
        this.message = null;
        this.errorMessage = error?.error?.message || 'No se pudo asignar el rol.';
      }
    });
  }
}
