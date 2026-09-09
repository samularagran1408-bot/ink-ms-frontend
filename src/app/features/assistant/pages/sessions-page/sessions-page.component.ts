import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { of, Subscription } from 'rxjs';

import { Routine, Sport } from '@features/sports-disabilities/models/sports';
import { SessionService } from '@core/services/session.service';
import { SportsService } from '@features/sports-disabilities/services/sports.service';
import { ReportsService } from '@features/reports/services/reports.service';
import { ConfirmDialogService } from '@shared/services/confirm-dialog.service';
import { LiveSyncService } from '@features/accessibility/services/live-sync.service';
import { matchesQuery } from '@core/utils/search.util';
import { SharedModule } from '@shared/shared.module';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, SharedModule],
  selector: 'app-sessions-page',
  templateUrl: './sessions-page.component.html',
  styleUrl: './sessions-page.component.scss'
})
export class SessionsPageComponent implements OnInit, OnDestroy {
  routines: Routine[] = [];
  sports: Sport[] = [];
  form: FormGroup;
  searchQuery = '';
  errorMessage: string | null = null;
  successMessage: string | null = null;
  loading = true;
  private liveSub: Subscription | null = null;

  constructor(
    private fb: FormBuilder,
    private session: SessionService,
    private sportsService: SportsService,
    private reportsService: ReportsService,
    private confirm: ConfirmDialogService,
    private liveSync: LiveSyncService
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      sportId: [null],
      description: [''],
      disabilityFocus: [''],
      level: ['principiante'],
      durationMinutes: [60, [Validators.min(1)]],
      maxCapacity: [10, [Validators.min(1)]],
      exercisesJson: ['[]']
    });
  }

  ngOnInit(): void {
    this.reload();
    this.liveSync.start();
    this.liveSub = this.liveSync.pulse$.subscribe(() => this.reload(true));
  }

  ngOnDestroy(): void {
    this.liveSub?.unsubscribe();
  }

  get filteredRoutines(): Routine[] {
    return this.routines.filter((routine) =>
      matchesQuery(this.searchQuery, routine.name, routine.status, routine.disabilityFocus, routine.description)
    );
  }

  clearSearch(): void {
    this.searchQuery = '';
  }

  reload(silent = false): void {
    if (!silent) {
      this.loading = true;
    }
    this.withTrainerId((trainerId) => {
      this.reportsService.getSessionsPanel(trainerId).subscribe({
        next: (panel) => {
          this.routines = panel.routines || [];
          this.sports = panel.sports || [];
          if (this.sports.length && !this.form.value.sportId) {
            this.form.patchValue({ sportId: this.sports[0].id });
          }
          this.loading = false;
        },
        error: (error) => {
          if (!silent) {
            this.errorMessage = error?.error?.message || 'No se pudieron cargar sesiones.';
            this.loading = false;
          }
        }
      });
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
      title: 'Crear sesión',
      message: `¿Confirmas crear la rutina "${this.form.value.name}"?`,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar'
    });
    if (!ok) {
      return;
    }

    this.withTrainerId((trainerId) => {
      const exercisesRaw = String(this.form.value.exercisesJson || '').trim();
      const payload = {
        ...this.form.value,
        trainerId,
        sportId: this.form.value.sportId ? Number(this.form.value.sportId) : undefined,
        durationMinutes: Number(this.form.value.durationMinutes),
        maxCapacity: Number(this.form.value.maxCapacity),
        exercisesJson: exercisesRaw && exercisesRaw !== 'null' ? exercisesRaw : '[]'
      };

      this.sportsService.createRoutine(payload).subscribe({
        next: () => {
          this.successMessage = 'Sesión creada.';
          this.errorMessage = null;
          this.form.patchValue({ name: '', description: '', disabilityFocus: '', exercisesJson: '[]' });
          this.reload();
        },
        error: (error) => {
          this.successMessage = null;
          this.errorMessage = error?.error?.message || 'No se pudo crear la sesión.';
        }
      });
    });
  }

  publish(routine: Routine): void {
    void this.confirmPublish(routine);
  }

  private async confirmPublish(routine: Routine): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Publicar sesión',
      message: `¿Confirmas publicar "${routine.name}"?`,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar'
    });
    if (!ok) {
      return;
    }
    this.sportsService.publishRoutine(routine.id).subscribe({
      next: () => {
        this.successMessage = 'Sesión publicada.';
        this.errorMessage = null;
        this.reload();
      },
      error: (error) => this.errorMessage = error?.error?.message || 'No se pudo publicar.'
    });
  }

  private withTrainerId(action: (trainerId: string) => void): void {
    const profile$ = this.session.getProfile()
      ? of(this.session.getProfile())
      : this.session.loadProfile();

    profile$.subscribe((profile) => {
      const trainerId = profile?.id;
      if (!trainerId) {
        this.loading = false;
        this.errorMessage = 'Perfil de entrenador no disponible.';
        return;
      }
      action(trainerId);
    });
  }
}
