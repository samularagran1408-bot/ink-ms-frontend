import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

import { Routine, Sport } from '../../../../core/models/sports';
import { SessionService } from '../../../../core/services/session.service';
import { SportsService } from '../../../../core/services/sports.service';

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

  constructor(
    private fb: FormBuilder,
    private session: SessionService,
    private sportsService: SportsService
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      sportId: [null],
      description: [''],
      disabilityFocus: [''],
      level: ['beginner'],
      durationMinutes: [60, [Validators.min(1)]],
      maxCapacity: [10, [Validators.min(1)]],
      exercisesJson: ['']
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
    const trainerId = this.session.getProfile()?.id;
    if (!trainerId) {
      this.session.loadProfile().subscribe((profile) => {
        if (profile?.id) {
          this.fetchRoutines(profile.id);
        }
      });
      return;
    }
    this.fetchRoutines(trainerId);
  }

  create(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const trainerId = this.session.getProfile()?.id;
    const payload = {
      ...this.form.value,
      trainerId,
      sportId: this.form.value.sportId ? Number(this.form.value.sportId) : undefined,
      durationMinutes: Number(this.form.value.durationMinutes),
      maxCapacity: Number(this.form.value.maxCapacity)
    };

    this.sportsService.createRoutine(payload).subscribe({
      next: () => {
        this.successMessage = 'Sesión creada.';
        this.errorMessage = null;
        this.form.patchValue({ name: '', description: '', disabilityFocus: '', exercisesJson: '' });
        this.reload();
      },
      error: (error) => {
        this.successMessage = null;
        this.errorMessage = error?.error?.message || 'No se pudo crear la sesión.';
      }
    });
  }

  publish(routine: Routine): void {
    this.sportsService.publishRoutine(routine.id).subscribe({
      next: () => this.reload(),
      error: (error) => this.errorMessage = error?.error?.message || 'No se pudo publicar.'
    });
  }

  private fetchRoutines(trainerId: string): void {
    this.sportsService.getRoutinesByTrainer(trainerId).subscribe({
      next: (routines) => this.routines = routines,
      error: (error) => this.errorMessage = error?.error?.message || 'No se pudieron cargar sesiones.'
    });
  }
}
