import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

import { Disability, Sport } from '../../../../core/models/sports';
import { SportsService } from '../../../../core/services/sports.service';
import { ReportsService } from '../../../../core/services/reports.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-sports-page',
  templateUrl: './sports-page.component.html',
  styleUrl: './sports-page.component.scss'
})
export class SportsPageComponent implements OnInit {
  sports: Sport[] = [];
  form: FormGroup;
  searchQuery = '';
  expandedSportId: number | null = null;
  errorMessage: string | null = null;

  constructor(
    private sportsService: SportsService,
    private reportsService: ReportsService,
    private fb: FormBuilder,
    private confirm: ConfirmDialogService
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      difficulty: ['bajo'],
      requiredMaterials: [''],
      isActive: [true]
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  get filteredSports(): Sport[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) {
      return this.sports;
    }
    return this.sports.filter((sport) =>
      sport.name.toLowerCase().includes(q)
      || (sport.description || '').toLowerCase().includes(q)
      || (sport.difficulty || '').toLowerCase().includes(q)
      || String(sport.id).includes(q)
    );
  }

  adaptationsOf(sport: Sport): Disability[] {
    return (sport.disabilities || []).filter((item) => item.isActive !== false);
  }

  toggleAdaptations(sport: Sport): void {
    this.expandedSportId = this.expandedSportId === sport.id ? null : sport.id;
  }

  reload(): void {
    this.reportsService.getSportsPanel().subscribe({
      next: (panel) => this.sports = panel.sports || [],
      error: (error) => this.errorMessage = error?.error?.message || 'No se pudieron cargar deportes.'
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
      title: 'Crear deporte',
      message: `¿Confirmas registrar "${this.form.value.name}"?`,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar'
    });
    if (!ok) {
      return;
    }
    this.sportsService.createSport(this.form.value).subscribe({
      next: () => {
        this.form.reset({ difficulty: 'bajo', isActive: true });
        this.reload();
      },
      error: (error) => this.errorMessage = error?.error?.message || 'No se pudo crear el deporte.'
    });
  }

  remove(sport: Sport): void {
    void this.confirmRemove(sport);
  }

  private async confirmRemove(sport: Sport): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Eliminar deporte',
      message: `¿Confirmas eliminar "${sport.name}"?`,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar',
      tone: 'danger'
    });
    if (!ok) {
      return;
    }
    this.sportsService.deleteSport(sport.id).subscribe({
      next: () => this.reload(),
      error: (error) => this.errorMessage = error?.error?.message || 'No se pudo eliminar.'
    });
  }
}
