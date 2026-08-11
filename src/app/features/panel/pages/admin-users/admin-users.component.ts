import { Component, OnInit } from '@angular/core';

import { UserProfile } from '../../../../core/models/user-profile';
import { UsersService } from '../../../../core/services/users.service';
import { SessionService } from '../../../../core/services/session.service';

@Component({
  selector: 'app-admin-users',
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss'
})
export class AdminUsersComponent implements OnInit {
  users: UserProfile[] = [];
  loading = true;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  actionEmail: string | null = null;
  bulkLoading = false;
  selected = new Set<string>();
  filter: 'active' | 'all' | 'inactive' = 'active';

  constructor(
    private usersService: UsersService,
    private session: SessionService
  ) {}

  ngOnInit(): void {
    this.reload();
  }

  get selectedCount(): number {
    return this.selected.size;
  }

  get allVisibleSelected(): boolean {
    return this.users.length > 0 && this.users.every((u) => this.selected.has(u.email));
  }

  reload(): void {
    this.loading = true;
    this.errorMessage = null;
    const request$ =
      this.filter === 'active'
        ? this.usersService.getActiveUsers()
        : this.filter === 'inactive'
          ? this.usersService.getInactiveUsers()
          : this.usersService.getAllUsers();

    request$.subscribe({
      next: (users) => {
        this.users = users;
        this.selected.clear();
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'No se pudieron cargar usuarios.';
        this.loading = false;
      }
    });
  }

  setFilter(filter: 'active' | 'all' | 'inactive'): void {
    if (this.filter === filter) {
      return;
    }
    this.filter = filter;
    this.reload();
  }

  toggleOne(email: string, checked: boolean): void {
    if (checked) {
      this.selected.add(email);
    } else {
      this.selected.delete(email);
    }
  }

  toggleAll(checked: boolean): void {
    if (checked) {
      this.users.forEach((u) => this.selected.add(u.email));
    } else {
      this.selected.clear();
    }
  }

  isSelected(email: string): boolean {
    return this.selected.has(email);
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

  deleteOne(user: UserProfile): void {
    const me = this.session.getProfile()?.email;
    if (me && me.toLowerCase() === user.email.toLowerCase()) {
      this.errorMessage = 'No puedes eliminarte a ti mismo.';
      return;
    }
    if (!confirm(`¿Eliminar a ${user.fullName || user.email}? Esta acción no se puede deshacer.`)) {
      return;
    }
    this.actionEmail = user.email;
    this.usersService.deleteUser(user.email).subscribe({
      next: () => {
        this.actionEmail = null;
        this.successMessage = 'Usuario eliminado.';
        this.reload();
      },
      error: (error) => {
        this.actionEmail = null;
        this.errorMessage = error?.error?.message || 'No se pudo eliminar.';
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
      this.errorMessage = 'No puedes eliminarte a ti mismo.';
      return;
    }
    if (!confirm(`¿Eliminar ${filtered.length} usuario(s) seleccionado(s)? Esta acción no se puede deshacer.`)) {
      return;
    }
    this.bulkLoading = true;
    this.errorMessage = null;
    this.successMessage = null;
    this.usersService.bulkDeleteUsers(filtered).subscribe({
      next: (result) => {
        this.bulkLoading = false;
        this.successMessage = `Eliminados: ${result.succeeded}. Fallidos: ${result.failed}.`;
        if (result.errors?.length) {
          this.errorMessage = result.errors.join(' · ');
        }
        this.reload();
      },
      error: (error) => {
        this.bulkLoading = false;
        this.errorMessage = error?.error?.message || 'No se pudo eliminar la selección.';
      }
    });
  }

  rolesLabel(user: UserProfile): string {
    return user.roles?.join(', ') || 'USUARIO';
  }

  isInactive(user: UserProfile): boolean {
    return user.isActive === false || !!user.blockReason;
  }
}
