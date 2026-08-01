import { Component, OnInit } from '@angular/core';

import { UserProfile } from '../../../../core/models/user-profile';
import { UsersService } from '../../../../core/services/users.service';

@Component({
  selector: 'app-admin-users',
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss'
})
export class AdminUsersComponent implements OnInit {
  users: UserProfile[] = [];
  loading = true;
  errorMessage: string | null = null;
  actionEmail: string | null = null;

  constructor(private usersService: UsersService) {}

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading = true;
    this.usersService.getAllUsers().subscribe({
      next: (users) => {
        this.users = users;
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'No se pudieron cargar usuarios.';
        this.loading = false;
      }
    });
  }

  block(user: UserProfile): void {
    this.actionEmail = user.email;
    this.usersService.blockUser(user.email, { reason: 'Bloqueo administrativo', permanent: false }).subscribe({
      next: () => {
        this.actionEmail = null;
        this.reload();
      },
      error: (error) => {
        this.actionEmail = null;
        this.errorMessage = error?.error?.message || 'No se pudo bloquear.';
      }
    });
  }

  activate(user: UserProfile): void {
    this.actionEmail = user.email;
    this.usersService.activateUser(user.email).subscribe({
      next: () => {
        this.actionEmail = null;
        this.reload();
      },
      error: (error) => {
        this.actionEmail = null;
        this.errorMessage = error?.error?.message || 'No se pudo activar.';
      }
    });
  }

  rolesLabel(user: UserProfile): string {
    return user.roles?.join(', ') || 'USUARIO';
  }
}
