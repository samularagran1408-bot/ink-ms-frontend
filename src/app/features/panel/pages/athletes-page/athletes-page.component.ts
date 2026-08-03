import { Component, OnInit } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { EventItem, Registration } from '../../../../core/models/sports';
import { SessionService } from '../../../../core/services/session.service';
import { SportsService } from '../../../../core/services/sports.service';

interface EventAthleteSummary {
  event: EventItem;
  occupied: number;
  waitlist: Registration[];
}

@Component({
  selector: 'app-athletes-page',
  templateUrl: './athletes-page.component.html',
  styleUrl: './athletes-page.component.scss'
})
export class AthletesPageComponent implements OnInit {
  summaries: EventAthleteSummary[] = [];
  loading = true;
  errorMessage: string | null = null;

  constructor(
    private session: SessionService,
    private sportsService: SportsService
  ) {}

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading = true;
    this.errorMessage = null;
    const start = this.session.getProfile()
      ? of(this.session.getProfile())
      : this.session.loadProfile();

    start.subscribe(() => {
      this.sportsService.getEvents().subscribe({
        next: (events) => {
          this.loadSummaries(this.scopeEvents(events));
        },
        error: (error) => {
          this.errorMessage = error?.error?.message || 'No se pudieron cargar eventos.';
          this.loading = false;
        }
      });
    });
  }

  private scopeEvents(events: EventItem[]): EventItem[] {
    // Admin / entrenador ven todos; organizador prioriza los suyos.
    if (this.session.hasRole('ADMIN', 'ENTRENADOR')) {
      return events;
    }

    const profileId = this.session.getProfile()?.id;
    if (!profileId) {
      return events;
    }

    const own = events.filter((event) => event.createdBy === profileId);
    return own.length ? own : events;
  }

  private loadSummaries(events: EventItem[]): void {
    if (!events.length) {
      this.summaries = [];
      this.loading = false;
      return;
    }

    forkJoin(
      events.map((event) =>
        this.sportsService.getEventWaitlist(event.id).pipe(catchError(() => of([] as Registration[])))
      )
    ).subscribe({
      next: (waitlists) => {
        this.summaries = events.map((event, index) => ({
          event,
          occupied: Math.max(
            (event.maxCapacity || 0) - (event.availableCapacity ?? (event.maxCapacity || 0)),
            0
          ),
          waitlist: waitlists[index] || []
        }));
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'No se pudo cargar el detalle de atletas.';
        this.loading = false;
      }
    });
  }
}
