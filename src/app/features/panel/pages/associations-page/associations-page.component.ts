import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { Disability, Sport, SportDisability } from '../../../../core/models/sports';
import { SportsService } from '../../../../core/services/sports.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-associations-page',
  templateUrl: './associations-page.component.html',
  styleUrl: './associations-page.component.scss'
})
export class AssociationsPageComponent implements OnInit {
  sports: Sport[] = [];
  disabilities: Disability[] = [];
  associations: SportDisability[] = [];
  form: FormGroup;
  selectedSportId: number | null = null;
  searchQuery = '';
  loading = true;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  constructor(
    private sportsService: SportsService,
    private fb: FormBuilder,
    private confirm: ConfirmDialogService
  ) {
    this.form = this.fb.group({
      sportId: [null, Validators.required],
      disabilityId: [null, Validators.required],
      adaptations: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    forkJoin({
      sports: this.sportsService.getSports().pipe(catchError(() => of([] as Sport[]))),
      disabilities: this.sportsService.getActiveDisabilities().pipe(catchError(() => of([] as Disability[])))
    }).subscribe({
      next: ({ sports, disabilities }) => {
        this.sports = sports;
        this.disabilities = disabilities;
        if (sports.length) {
          this.selectedSportId = sports[0].id;
          this.form.patchValue({ sportId: sports[0].id, disabilityId: disabilities[0]?.id ?? null });
          this.loadAssociations(sports[0].id);
        }
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'No se pudieron cargar deportes o discapacidades.';
        this.loading = false;
      }
    });

    this.form.get('sportId')!.valueChanges.subscribe((sportId) => {
      if (sportId != null) {
        this.selectedSportId = Number(sportId);
        this.loadAssociations(Number(sportId));
      }
    });
  }

  get filteredAssociations(): SportDisability[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) {
      return this.associations;
    }
    return this.associations.filter((item) =>
      (item.disabilityName || '').toLowerCase().includes(q)
      || (item.sportName || '').toLowerCase().includes(q)
      || (item.adaptations || '').toLowerCase().includes(q)
      || String(item.disabilityId).includes(q)
    );
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
      title: 'Crear asociación',
      message: '¿Confirmas vincular este deporte con la discapacidad y sus adaptaciones?',
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar'
    });
    if (!ok) {
      return;
    }

    const payload = {
      sportId: Number(this.form.value.sportId),
      disabilityId: Number(this.form.value.disabilityId),
      adaptations: String(this.form.value.adaptations).trim()
    };

    this.sportsService.addSportDisability(payload).subscribe({
      next: () => {
        this.successMessage = 'Asociación creada.';
        this.errorMessage = null;
        this.form.patchValue({ adaptations: '' });
        this.loadAssociations(payload.sportId);
      },
      error: (error) => {
        this.successMessage = null;
        this.errorMessage = error?.error?.message || 'No se pudo crear la asociación.';
      }
    });
  }

  remove(item: SportDisability): void {
    void this.confirmRemove(item);
  }

  private async confirmRemove(item: SportDisability): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminar asociación',
      message: `¿Confirmas eliminar la asociación de "${item.disabilityName || ('#' + item.disabilityId)}"?`,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar',
      tone: 'danger'
    });
    if (!ok) {
      return;
    }
    this.sportsService.removeSportDisability(item.sportId, item.disabilityId).subscribe({
      next: () => {
        this.successMessage = 'Asociación eliminada.';
        this.loadAssociations(item.sportId);
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'No se pudo eliminar la asociación.';
      }
    });
  }

  private loadAssociations(sportId: number): void {
    this.sportsService.getSportDisabilities(sportId).subscribe({
      next: (items) => {
        this.associations = items;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'No se pudieron cargar asociaciones.';
        this.associations = [];
      }
    });
  }
}
