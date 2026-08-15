import { Component, OnInit } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AttendanceReport, EventItem, Registration } from '../../../../core/models/sports';
import { SessionService } from '../../../../core/services/session.service';
import { SportsService } from '../../../../core/services/sports.service';

type AttendanceFilter = 'all' | 'attended' | 'absent';

interface EnrolledUserRow {
  registrationId: string;
  userId?: string;
  fullName?: string;
  email?: string;
  attended: boolean;
  checkInTime?: string;
}

interface EventAthleteSummary {
  event: EventItem;
  occupied: number;
  waitlist: Registration[];
  enrolled: EnrolledUserRow[];
  filter: AttendanceFilter;
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

  setFilter(summary: EventAthleteSummary, filter: AttendanceFilter): void {
    summary.filter = filter;
  }

  filteredEnrolled(summary: EventAthleteSummary): EnrolledUserRow[] {
    if (summary.filter === 'attended') {
      return summary.enrolled.filter((row) => row.attended);
    }
    if (summary.filter === 'absent') {
      return summary.enrolled.filter((row) => !row.attended);
    }
    return summary.enrolled;
  }

  attendedCount(summary: EventAthleteSummary): number {
    return summary.enrolled.filter((row) => row.attended).length;
  }

  absentCount(summary: EventAthleteSummary): number {
    return summary.enrolled.filter((row) => !row.attended).length;
  }

  private scopeEvents(events: EventItem[]): EventItem[] {
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
        forkJoin({
          waitlist: this.sportsService.getEventWaitlist(event.id).pipe(catchError(() => of([] as Registration[]))),
          report: this.sportsService.getAttendanceReport(event.id).pipe(
            catchError(() => of({
              eventId: event.id,
              totalRegistered: 0,
              totalAttended: 0,
              attendees: [],
              absentees: []
            } as AttendanceReport))
          )
        })
      )
    ).subscribe({
      next: (results) => {
        this.summaries = events.map((event, index) => {
          const report = results[index].report;
          const enrolled: EnrolledUserRow[] = [
            ...(report.attendees || []).map((row) => ({
              registrationId: row.registrationId,
              userId: row.userId,
              fullName: row.fullName,
              email: row.email,
              attended: true,
              checkInTime: row.checkInTime
            })),
            ...(report.absentees || []).map((row) => ({
              registrationId: row.registrationId,
              userId: row.userId,
              fullName: row.fullName,
              email: row.email,
              attended: false
            }))
          ];
          return {
            event,
            occupied: enrolled.length || Math.max(
              (event.maxCapacity || 0) - (event.availableCapacity ?? (event.maxCapacity || 0)),
              0
            ),
            waitlist: results[index].waitlist || [],
            enrolled,
            filter: 'all' as AttendanceFilter
          };
        });
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'No se pudo cargar el detalle de atletas.';
        this.loading = false;
      }
    });
  }
}
