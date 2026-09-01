import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { EventItem, Sport } from '../../../../core/models/sports';
import { SessionService } from '../../../../core/services/session.service';
import { SportsService } from '../../../../core/services/sports.service';
import { ReportsService } from '../../../../core/services/reports.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { resolveEventImage } from '../../../../core/utils/event-image.util';
import { EventPlaceLocation } from '../../../../core/utils/maps.util';

@Component({
  selector: 'app-organizer-dashboard',
  templateUrl: './organizer-dashboard.component.html',
  styleUrl: './organizer-dashboard.component.scss'
})
export class OrganizerDashboardComponent implements OnInit {
  loading = true;
  events: EventItem[] = [];
  sports: Sport[] = [];
  activeEvents = 0;
  athleteCount = 0;
  attendanceRatePercent: number | null = null;
  attendanceSampledEvents = 0;
  form: FormGroup;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  quizPassed = false;

  constructor(
    private session: SessionService,
    private sportsService: SportsService,
    private reportsService: ReportsService,
    private fb: FormBuilder,
    private router: Router,
    private confirm: ConfirmDialogService
  ) {
    this.form = this.fb.group({
      sportId: [null, Validators.required],
      name: ['', Validators.required],
      description: [''],
      eventDate: ['', Validators.required],
      eventTime: ['', Validators.required],
      location: [''],
      latitude: [null as number | null],
      longitude: [null as number | null],
      maxCapacity: [30, [Validators.required, Validators.min(1)]]
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading = true;
    const profile$ = this.session.getProfile()
      ? of(this.session.getProfile())
      : this.session.loadProfile();

    profile$.subscribe((profile) => {
      this.quizPassed = !!profile?.organizerQuizPassed;
      this.reportsService.getOrganizerPanel(profile?.id).subscribe({
        next: (panel) => {
          this.events = panel.events || [];
          this.activeEvents = panel.metrics?.['active_events'] ?? 0;
          this.sports = panel.sports || [];
          this.athleteCount = panel.athleteCount ?? panel.metrics?.['athletes'] ?? 0;
          this.attendanceRatePercent = panel.attendanceRatePercent ?? null;
          this.attendanceSampledEvents = panel.attendanceSampledEvents ?? 0;
          if (this.sports.length && !this.form.value.sportId) {
            this.form.patchValue({ sportId: this.sports[0].id });
          }
          this.loading = false;
        },
        error: () => {
          this.errorMessage = 'No se pudo cargar el panel del organizador.';
          this.loading = false;
        }
      });
    });
  }

  /**
   * Navega a la pantalla de quiz de aptitud del organizador.
   */
  goQuiz(): void {
    this.router.navigate(['/organizer/quiz']);
  }

  goAttendanceReports(): void {
    this.router.navigate(['/organizer/events']);
  }

  /**
   * Crea un evento; si el quiz no está aprobado, redirige al flujo de aptitud.
   */
  createEvent(): void {
    if (!this.quizPassed) {
      this.errorMessage = 'Debes completar el quiz de aptitud antes de crear eventos.';
      this.goQuiz();
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    void this.confirmCreateEvent();
  }

  private async confirmCreateEvent(): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Crear evento',
      message: `¿Confirmas la creación de "${this.form.value.name}"?`,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar'
    });
    if (!ok) {
      return;
    }

    const ensureProfile$ = this.session.getProfile()
      ? of(this.session.getProfile())
      : this.session.loadProfile();

    ensureProfile$.subscribe((profile) => {
      const payload = {
        ...this.form.value,
        sportId: Number(this.form.value.sportId),
        maxCapacity: Number(this.form.value.maxCapacity),
        createdBy: profile?.id
      };

      this.sportsService.createEvent(payload).subscribe({
        next: () => {
          this.successMessage = 'Evento creado.';
          this.errorMessage = null;
          this.form.patchValue({
            name: '',
            description: '',
            location: '',
            latitude: null,
            longitude: null
          });
          this.reload();
        },
        error: (error) => {
          this.successMessage = null;
          this.errorMessage = error?.error?.message || 'No se pudo crear el evento.';
        }
      });
    });
  }

  onPlaceChange(place: EventPlaceLocation): void {
    this.form.patchValue({
      location: place.address,
      latitude: place.latitude,
      longitude: place.longitude
    });
  }

  eventImage(event: EventItem): string {
    return resolveEventImage(event);
  }

  occupied(event: EventItem): number {
    const max = event.maxCapacity || 0;
    return Math.max(max - (event.availableCapacity ?? max), 0);
  }
}
