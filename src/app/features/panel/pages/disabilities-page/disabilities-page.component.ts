import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

import { Disability } from '../../../../core/models/sports';
import { SportsService } from '../../../../core/services/sports.service';

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
  lookup: Disability | null = null;
  editingId: number | null = null;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  constructor(
    private sportsService: SportsService,
    private fb: FormBuilder
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

  reload(): void {
    this.sportsService.getDisabilities().subscribe({
      next: (items) => {
        this.items = items;
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
    const id = Number(this.searchId);
    if (!Number.isInteger(id) || id <= 0) {
      this.errorMessage = 'Indica un ID numérico válido.';
      this.lookup = null;
      return;
    }

    this.sportsService.getDisability(id).subscribe({
      next: (item) => {
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
    this.sportsService.deleteDisability(item.id).subscribe({
      next: () => {
        this.successMessage = 'Discapacidad eliminada.';
        this.reload();
      },
      error: (error) => this.errorMessage = error?.error?.message || 'No se pudo eliminar.'
    });
  }
}
