import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

import { Disability } from '../../../../core/models/sports';
import { SportsService } from '../../../../core/services/sports.service';
import { ReportsService } from '../../../../core/services/reports.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { matchesQuery } from '../../../../core/utils/search.util';

@Component({
  selector: 'app-disabilities-page',
  templateUrl: './disabilities-page.component.html',
  styleUrl: './disabilities-page.component.scss'
})
export class DisabilitiesPageComponent implements OnInit {
  items: Disability[] = [];
  form: FormGroup;
  editForm: FormGroup;
  searchQuery = '';
  statusFilter: 'all' | 'active' | 'inactive' = 'all';
  categoryFilter = '';
  editingId: number | null = null;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  constructor(
    private sportsService: SportsService,
    private reportsService: ReportsService,
    private fb: FormBuilder,
    private confirm: ConfirmDialogService
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: [''],
      category: ['fisica', Validators.required],
      isActive: [true]
    });
    this.editForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: [''],
      category: ['fisica', Validators.required]
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  get filteredItems(): Disability[] {
    return this.items.filter((item) => {
      if (this.statusFilter === 'active' && item.isActive === false) {
        return false;
      }
      if (this.statusFilter === 'inactive' && item.isActive !== false) {
        return false;
      }
      if (this.categoryFilter && (item.category || '').toLowerCase() !== this.categoryFilter) {
        return false;
      }
      return matchesQuery(this.searchQuery, item.id, item.name, item.category, item.description);
    });
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.categoryFilter = '';
  }

  reload(): void {
    this.reportsService.getDisabilitiesPanel().subscribe({
      next: (panel) => {
        this.items = panel.disabilities || [];
        this.errorMessage = null;
      },
      error: (error) => this.errorMessage = error?.error?.message || 'No se pudieron cargar discapacidades.'
    });
  }

  create(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    void this.confirmCreate();
  }

  private async confirmCreate(): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Registrar discapacidad',
      message: `¿Confirmas registrar "${this.form.value.name}"?`,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar'
    });
    if (!ok) {
      return;
    }
    this.sportsService.createDisability(this.form.value).subscribe({
      next: () => {
        this.successMessage = 'Discapacidad registrada.';
        this.errorMessage = null;
        this.form.reset({ category: 'fisica', isActive: true });
        this.reload();
      },
      error: (error) => {
        this.successMessage = null;
        this.errorMessage = error?.error?.message || 'No se pudo crear.';
      }
    });
  }

  startEdit(item: Disability): void {
    this.editingId = item.id;
    this.editForm.reset({
      name: item.name,
      description: item.description || '',
      category: item.category || 'fisica'
    });
  }

  cancelEdit(): void {
    this.editingId = null;
  }

  saveEdit(item: Disability): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.sportsService.updateDisability(item.id, {
      ...this.editForm.value,
      isActive: item.isActive
    }).subscribe({
      next: () => {
        this.successMessage = 'Discapacidad actualizada.';
        this.errorMessage = null;
        this.editingId = null;
        this.reload();
      },
      error: (error) => {
        this.successMessage = null;
        this.errorMessage = error?.error?.message || 'No se pudo editar.';
      }
    });
  }

  deactivate(item: Disability): void {
    void this.confirmDeactivate(item);
  }

  private async confirmDeactivate(item: Disability): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Desactivar discapacidad',
      message: `¿Confirmas desactivar "${item.name}"? Dejará de poder buscarse.`,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar',
      tone: 'danger'
    });
    if (!ok) {
      return;
    }
    this.sportsService.deactivateDisability(item.id).subscribe({
      next: () => {
        this.successMessage = `"${item.name}" desactivada.`;
        this.errorMessage = null;
        this.reload();
      },
      error: (error) => {
        this.successMessage = null;
        this.errorMessage = error?.error?.message || 'No se pudo desactivar.';
      }
    });
  }

  activate(item: Disability): void {
    void this.confirmActivate(item);
  }

  private async confirmActivate(item: Disability): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Reactivar discapacidad',
      message: `¿Confirmas reactivar "${item.name}"?`,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar'
    });
    if (!ok) {
      return;
    }
    this.sportsService.activateDisability(item.id).subscribe({
      next: () => {
        this.successMessage = `"${item.name}" reactivada.`;
        this.errorMessage = null;
        this.reload();
      },
      error: (error) => {
        this.successMessage = null;
        this.errorMessage = error?.error?.message || 'No se pudo reactivar.';
      }
    });
  }

  remove(item: Disability): void {
    void this.confirmRemove(item);
  }

  private async confirmRemove(item: Disability): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminar discapacidad',
      message: `¿Confirmas eliminar "${item.name}"? Esta acción no se puede deshacer.`,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar',
      tone: 'danger'
    });
    if (!ok) {
      return;
    }
    this.sportsService.deleteDisability(item.id).subscribe({
      next: () => {
        this.successMessage = 'Discapacidad eliminada.';
        this.reload();
      },
      error: (error) => this.errorMessage = error?.error?.message || 'No se pudo eliminar.'
    });
  }
}
