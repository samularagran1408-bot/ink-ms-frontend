import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { EventItem, Sport } from '../../../../core/models/sports';
import { SessionService } from '../../../../core/services/session.service';
import { SportsService } from '../../../../core/services/sports.service';

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
  form: FormGroup;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  constructor(
    private session: SessionService,
    private sportsService: SportsService,
    private fb: FormBuilder
  ) {
    this.form = this.fb.group({
      sportId: [null, Validators.required],
      name: ['', Validators.required],
      description: [''],
      eventDate: ['', Validators.required],
      eventTime: ['', Validators.required],
      location: [''],
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

    profile$.subscribe(() => {
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
          this.loading = false;
        },
        error: () => {
          this.errorMessage = 'No se pudo cargar el panel del organizador.';
          this.loading = false;
        }
      });
    });
  }

  createEvent(): void {
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
          this.form.patchValue({ name: '', description: '', location: '' });
          this.reload();
        },
        error: (error) => {
          this.successMessage = null;
          this.errorMessage = error?.error?.message || 'No se pudo crear el evento.';
        }
      });
    });
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
}
