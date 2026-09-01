import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

import { Disability } from '../../../../core/models/sports';
import { SportsService } from '../../../../core/services/sports.service';
import { ReportsService } from '../../../../core/services/reports.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-disabilities-page',
  templateUrl: './disabilities-page.component.html',
  styleUrl: './disabilities-page.component.scss'
})
export class DisabilitiesPageComponent implements OnInit {
  items: Disability[] = [];
  form: FormGroup;
  editForm: FormGroup;
  searchId = '';
  searchQuery = '';
  lookup: Disability | null = null;
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
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) {
      return this.items;
    }
    return this.items.filter((item) => {
      if (!item.isActive) {
        return false;
      }
      return item.name.toLowerCase().includes(q)
        || (item.category || '').toLowerCase().includes(q)
        || (item.description || '').toLowerCase().includes(q)
        || String(item.id).includes(q);
    });
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

  searchById(): void {
    const raw = String(this.searchId || '').trim();
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      this.errorMessage = 'Indica un ID numérico válido.';
      this.lookup = null;
      return;
    }

    this.sportsService.searchDisabilities(raw).subscribe({
      next: (items) => {
        const item = items[0];
        if (!item) {
          this.lookup = null;
          this.successMessage = null;
          this.errorMessage = `Discapacidad no encontrada con ID: ${id}`;
          return;
        }
        this.lookup = item;
        this.errorMessage = null;
        this.successMessage = `Discapacidad #${item.id} encontrada.`;
      },
      error: (error) => {
        this.lookup = null;
        this.successMessage = null;
        this.errorMessage = error?.error?.message || `Discapacidad no encontrada con ID: ${id}`;
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
