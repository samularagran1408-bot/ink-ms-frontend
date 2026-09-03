import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

import { Disability, Sport, SportDisability } from '../../../../core/models/sports';
import { SportsService } from '../../../../core/services/sports.service';
import { ReportsService } from '../../../../core/services/reports.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { matchesQuery } from '../../../../core/utils/search.util';

@Component({
  selector: 'app-associations-page',
  templateUrl: './associations-page.component.html',
  styleUrl: './associations-page.component.scss'
})
export class AssociationsPageComponent implements OnInit {
  sports: Sport[] = [];
  disabilities: Disability[] = [];
  allAssociations: SportDisability[] = [];
  form: FormGroup;
  selectedSportId: number | null = null;
  listSportId = '';
  searchQuery = '';
  loading = true;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  constructor(
    private sportsService: SportsService,
    private reportsService: ReportsService,
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
    this.reload();
    this.form.get('sportId')!.valueChanges.subscribe((sportId) => {
      if (sportId != null) {
        this.selectedSportId = Number(sportId);
      }
    });
  }

  get associations(): SportDisability[] {
    if (!this.listSportId) {
      return this.allAssociations;
    }
    const sportId = Number(this.listSportId);
    return this.allAssociations.filter((item) => item.sportId === sportId);
  }

  get filteredAssociations(): SportDisability[] {
    return this.associations.filter((item) =>
      matchesQuery(
        this.searchQuery,
        item.disabilityName,
        item.sportName,
        item.adaptations,
        item.disabilityId,
        item.sportId
      )
    );
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.listSportId = '';
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
        this.reload();
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
        this.reload();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'No se pudo eliminar la asociación.';
      }
    });
  }

  private reload(): void {
    this.loading = true;
    this.reportsService.getAssociationsPanel().subscribe({
      next: (panel) => {
        this.sports = panel.sports || [];
        this.disabilities = panel.disabilities || [];
        this.allAssociations = panel.associations || [];
        if (this.sports.length && this.selectedSportId == null) {
          this.selectedSportId = this.sports[0].id;
          this.form.patchValue({
            sportId: this.sports[0].id,
            disabilityId: this.disabilities[0]?.id ?? null
          });
        }
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'No se pudieron cargar deportes o discapacidades.';
        this.loading = false;
      }
    });
  }
}
