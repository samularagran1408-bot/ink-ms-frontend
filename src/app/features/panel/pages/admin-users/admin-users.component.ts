import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { UserProfile } from '../../../../core/models/user-profile';
import { UsersService } from '../../../../core/services/users.service';
import { SessionService } from '../../../../core/services/session.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';

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
  nameQuery = '';
  disabilityQuery = '';

  readonly disabilityOptions = [
    { value: '', label: 'Todas las discapacidades' },
    { value: 'VISUAL', label: 'Visual' },
    { value: 'MOTRIZ', label: 'Motriz' },
    { value: 'AUDITIVA', label: 'Auditiva' },
    { value: 'INTELECTUAL', label: 'Intelectual' },
    { value: 'COGNITIVA', label: 'Cognitiva' },
    { value: 'MULTIPLE', label: 'Múltiple' }
  ];

  constructor(
    private usersService: UsersService,
    private session: SessionService,
    private confirm: ConfirmDialogService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.reload();
  }

  get selectedCount(): number {
    return this.selected.size;
  }

  get allVisibleSelected(): boolean {
    return this.filteredUsers.length > 0 && this.filteredUsers.every((u) => this.selected.has(u.email));
  }

  get filteredUsers(): UserProfile[] {
    const name = this.nameQuery.trim().toLowerCase();
    const disability = this.disabilityQuery.trim().toLowerCase();
    return this.users.filter((user) => {
      const matchesName = !name
        || (user.fullName || '').toLowerCase().includes(name)
        || (user.email || '').toLowerCase().includes(name);
      const matchesDisability = !disability
        || (user.disability || '').toLowerCase().includes(disability);
      return matchesName && matchesDisability;
    });
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
      this.filteredUsers.forEach((u) => this.selected.add(u.email));
    } else {
      this.filteredUsers.forEach((u) => this.selected.delete(u.email));
    }
  }

  isSelected(email: string): boolean {
    return this.selected.has(email);
  }

  disabilityLabel(user: UserProfile): string {
    return user.disability?.trim() || '—';
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
      title: 'Bloquear usuario',
      message: `¿Confirmas bloquear a ${user.fullName || user.email}?`,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar',
      tone: 'danger'
    });
    if (!ok) {
      return;
    }
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
    void this.confirmActivate(user);
  }

  private async confirmActivate(user: UserProfile): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Activar usuario',
      message: `¿Confirmas activar a ${user.fullName || user.email}?`,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar'
    });
    if (!ok) {
      return;
    }
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
    void this.confirmDeleteOne(user);
  }

  private async confirmDeleteOne(user: UserProfile): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminar usuario',
      message: `¿Eliminar lógicamente a ${user.fullName || user.email}? Dejará de aparecer en el panel. Si tiene eventos futuros inscritos, la eliminación se bloqueará.`,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar',
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
        this.successMessage = result?.message || `${user.fullName || user.email} fue eliminado lógicamente.`;
        this.reload();
      },
      error: (error) => {
        this.actionEmail = null;
        this.errorMessage = error?.error?.message
          || 'No se pudo eliminar. Si el usuario tiene eventos futuros inscritos, cancélalos primero.';
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
    void this.confirmDeleteSelected(filtered);
  }

  private async confirmDeleteSelected(filtered: string[]): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminar usuarios',
      message: `¿Eliminar lógicamente ${filtered.length} usuario(s) seleccionado(s)? Quienes tengan eventos futuros inscritos no se eliminarán.`,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar',
      tone: 'danger'
    });
    if (!ok) {
      return;
    }
    this.bulkLoading = true;
    this.errorMessage = null;
    this.successMessage = null;
    this.usersService.bulkDeleteUsers(filtered).subscribe({
      next: (result) => {
        this.bulkLoading = false;
        this.successMessage = `Eliminados lógicamente: ${result.succeeded}. Bloqueados o fallidos: ${result.failed}.`;
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
