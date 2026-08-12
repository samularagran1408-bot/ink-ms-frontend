import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { EventItem, Sport } from '../../../../core/models/sports';
import { SessionService } from '../../../../core/services/session.service';
import { SportsService } from '../../../../core/services/sports.service';
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
    private fb: FormBuilder,
    private router: Router
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
      forkJoin({
        events: this.sportsService.getEvents().pipe(catchError(() => of([] as EventItem[]))),
        activeEvents: this.sportsService.countActiveEvents().pipe(catchError(() => of(0))),
        sports: this.sportsService.getActiveSports().pipe(catchError(() => of([] as Sport[])))
      }).subscribe({
        next: ({ events, activeEvents, sports }) => {
          const profileId = this.session.getProfile()?.id;
          const own = profileId
            ? events.filter((event) => event.createdBy === profileId)
            : [];
          this.events = own.length ? own : events;
          this.activeEvents = activeEvents;
          this.sports = sports;
          if (sports.length && !this.form.value.sportId) {
            this.form.patchValue({ sportId: sports[0].id });
          }
          this.loadAthleteCount(this.events);
          this.loadAttendanceRate(this.events);
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

  private loadAthleteCount(events: EventItem[]): void {
    if (!events.length) {
      this.athleteCount = 0;
      return;
    }

    this.athleteCount = events.reduce((acc, event) => {
      const taken = (event.maxCapacity || 0) - (event.availableCapacity ?? (event.maxCapacity || 0));
      return acc + Math.max(taken, 0);
    }, 0);
  }

  private loadAttendanceRate(events: EventItem[]): void {
    const sample = events.slice(0, 8);
    this.attendanceSampledEvents = sample.length;
    if (!sample.length) {
      this.attendanceRatePercent = null;
      return;
    }

    forkJoin(
      sample.map((event) =>
        this.sportsService.getAttendanceReport(event.id).pipe(
          catchError(() => of({ totalRegistered: 0, totalAttended: 0 }))
        )
      )
    ).subscribe((reports) => {
      const totals = reports.reduce(
        (acc, report) => {
          acc.registered += Number(report.totalRegistered || 0);
          acc.attended += Number(report.totalAttended || 0);
          return acc;
        },
        { registered: 0, attended: 0 }
      );
      this.attendanceRatePercent = totals.registered
        ? Math.round((totals.attended * 10000) / totals.registered) / 100
        : 0;
    });
  }
}
