import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { EventItem, Registration, Sport } from '../../../../core/models/sports';
import { SessionService } from '../../../../core/services/session.service';
import { SportsService } from '../../../../core/services/sports.service';

interface EventManageRow {
  event: EventItem;
  waitlist: Registration[];
  showWaitlist: boolean;
}

@Component({
  selector: 'app-events-page',
  templateUrl: './events-page.component.html',
  styleUrl: './events-page.component.scss'
})
export class EventsPageComponent implements OnInit {
  mode: 'user' | 'manage' = 'user';
  events: EventItem[] = [];
  manageRows: EventManageRow[] = [];
  sports: Sport[] = [];
  form: FormGroup;
  loading = true;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  registeringId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private sportsService: SportsService,
    private session: SessionService,
    private fb: FormBuilder
  ) {
    this.form = this.fb.group({
      sportId: [null, Validators.required],
      name: ['', Validators.required],
      description: [''],
      eventDate: ['', Validators.required],
      eventTime: ['', Validators.required],
      location: [''],
      maxCapacity: [20, [Validators.required, Validators.min(1)]]
    });
  }

  ngOnInit(): void {
    this.mode = (this.route.snapshot.data['mode'] as 'user' | 'manage') || 'user';
    this.reload();
  }

  get canManage(): boolean {
    return this.mode === 'manage'
      || this.session.hasRole('ADMIN', 'ORGANIZADOR', 'ENTRENADOR');
  }

  reload(): void {
    this.loading = true;
    this.sportsService.getEvents().subscribe({
      next: (events) => {
        this.events = events;
        if (this.canManage && this.mode === 'manage') {
          this.loadWaitlists(events);
        } else {
          this.loading = false;
        }
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'No se pudieron cargar eventos.';
        this.loading = false;
      }
    });

    if (this.canManage) {
      this.sportsService.getActiveSports().subscribe({
        next: (sports) => {
          this.sports = sports;
          if (sports.length && !this.form.value.sportId) {
            this.form.patchValue({ sportId: sports[0].id });
          }
        }
      });
    }
  }

  createEvent(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = {
      ...this.form.value,
      sportId: Number(this.form.value.sportId),
      maxCapacity: Number(this.form.value.maxCapacity),
      createdBy: this.session.getProfile()?.id
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
  }

  register(event: EventItem): void {
    const userId = this.session.getProfile()?.id;
    if (!userId) {
      this.errorMessage = 'Perfil no disponible.';
      return;
    }

    this.registeringId = event.id;
    this.sportsService.registerToEvent(userId, event.id).subscribe({
      next: () => {
        this.registeringId = null;
        this.successMessage = `Inscripción a ${event.name} realizada.`;
      },
      error: (error) => {
        this.registeringId = null;
        this.errorMessage = error?.error?.message || 'No se pudo inscribir.';
      }
    });
  }

  toggleWaitlist(row: EventManageRow): void {
    row.showWaitlist = !row.showWaitlist;
  }

  occupied(event: EventItem): number {
    return Math.max((event.maxCapacity || 0) - (event.availableCapacity ?? (event.maxCapacity || 0)), 0);
  }

  private loadWaitlists(events: EventItem[]): void {
    if (!events.length) {
      this.manageRows = [];
      this.loading = false;
      return;
    }

    forkJoin(
      events.map((event) =>
        this.sportsService.getEventWaitlist(event.id).pipe(catchError(() => of([] as Registration[])))
      )
    ).subscribe({
      next: (waitlists) => {
        this.manageRows = events.map((event, index) => ({
          event,
          waitlist: waitlists[index] || [],
          showWaitlist: false
        }));
        this.loading = false;
      },
      error: () => {
        this.manageRows = events.map((event) => ({
          event,
          waitlist: [],
          showWaitlist: false
        }));
        this.loading = false;
      }
    });
  }
}
