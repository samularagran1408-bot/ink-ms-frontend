import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { of } from 'rxjs';

import { Routine, Sport } from '../../../../core/models/sports';
import { SessionService } from '../../../../core/services/session.service';
import { SportsService } from '../../../../core/services/sports.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-sessions-page',
  templateUrl: './sessions-page.component.html',
  styleUrl: './sessions-page.component.scss'
})
export class SessionsPageComponent implements OnInit {
  routines: Routine[] = [];
  sports: Sport[] = [];
  form: FormGroup;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  loading = true;

  constructor(
    private fb: FormBuilder,
    private session: SessionService,
    private sportsService: SportsService,
    private confirm: ConfirmDialogService
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
    this.sportsService.getActiveSports().subscribe({
      next: (sports) => {
        this.sports = sports;
        if (sports.length) {
          this.form.patchValue({ sportId: sports[0].id });
        }
      }
    });
  }

  reload(): void {
    this.loading = true;
    this.withTrainerId((trainerId) => {
      this.fetchRoutines(trainerId);
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

  private fetchRoutines(trainerId: string): void {
    this.sportsService.getRoutinesByTrainer(trainerId).subscribe({
      next: (routines) => {
        this.routines = routines;
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'No se pudieron cargar sesiones.';
        this.loading = false;
      }
    });
  }
}
