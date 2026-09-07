import { Component, OnDestroy, OnInit } from '@angular/core';
import { of, Subscription } from 'rxjs';

import { AttendanceReport, EventItem, Registration } from '@features/sports-disabilities/models/sports';
import { SessionService } from '@core/services/session.service';
import { ReportsService } from '@features/reports/services/reports.service';
import { LiveSyncService } from '@features/accessibility/services/live-sync.service';
import { userInitials } from '@core/utils/avatar.util';
import { matchesQuery } from '@core/utils/search.util';
import { isEventVisible } from '@features/sports-disabilities/utils/event-visibility.util';

type AttendanceFilter = 'all' | 'attended' | 'absent';

interface EnrolledUserRow {
  registrationId: string;
  userId?: string;
  fullName?: string;
  email?: string;
  profilePicture?: string;
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
export class AthletesPageComponent implements OnInit, OnDestroy {
  summaries: EventAthleteSummary[] = [];
  searchQuery = '';
  loading = true;
  errorMessage: string | null = null;
  private liveSub: Subscription | null = null;

  constructor(
    private session: SessionService,
    private reportsService: ReportsService,
    private liveSync: LiveSyncService
  ) {}

  ngOnInit(): void {
    this.reload();
    this.liveSync.start();
    this.liveSub = this.liveSync.pulse$.subscribe(() => this.reload(true));
  }

  ngOnDestroy(): void {
    this.liveSub?.unsubscribe();
  }

  reload(silent = false): void {
    if (!silent) {
      this.loading = true;
      this.errorMessage = null;
    }
    const start = this.session.getProfile()
      ? of(this.session.getProfile())
      : this.session.loadProfile();

    start.subscribe((profile) => {
      const allEvents = this.session.hasRole('ADMIN', 'ENTRENADOR');
      this.reportsService.getAthletesPanel(profile?.id, allEvents).subscribe({
        next: (panel) => {
          const prevFilters = new Map(this.summaries.map((row) => [row.event.id, row.filter]));
          this.summaries = (panel.athleteSummaries || [])
            .map((row) => {
              const summary = this.toSummary(row);
              summary.filter = prevFilters.get(summary.event.id) || 'all';
              return summary;
            })
            .filter((summary) => isEventVisible(summary.event));
          this.loading = false;
        },
        error: (error) => {
          if (!silent) {
            this.errorMessage = error?.error?.message || 'No se pudieron cargar eventos.';
            this.loading = false;
          }
        }
      });
    });
  }

  setFilter(summary: EventAthleteSummary, filter: AttendanceFilter): void {
    summary.filter = filter;
  }

  filteredEnrolled(summary: EventAthleteSummary): EnrolledUserRow[] {
    let rows = summary.enrolled;
    if (summary.filter === 'attended') {
      rows = rows.filter((row) => row.attended);
    } else if (summary.filter === 'absent') {
      rows = rows.filter((row) => !row.attended);
    }
    return rows.filter((row) => matchesQuery(this.searchQuery, row.fullName, row.email, row.userId));
  }

  visibleSummaries(): EventAthleteSummary[] {
    const q = this.searchQuery.trim();
    if (!q) {
      return this.summaries;
    }
    return this.summaries.filter((summary) =>
      matchesQuery(q, summary.event.name, summary.event.sportName)
      || this.filteredEnrolled(summary).length > 0
      || summary.waitlist.some((item) =>
        matchesQuery(q, item.userFullName, item.userEmail, item.userId)
      )
    );
  }

  clearSearch(): void {
    this.searchQuery = '';
  }

  attendedCount(summary: EventAthleteSummary): number {
    return summary.enrolled.filter((row) => row.attended).length;
  }

  absentCount(summary: EventAthleteSummary): number {
    return summary.enrolled.filter((row) => !row.attended).length;
  }

  initials(name?: string | null): string {
    return userInitials(name);
  }

  private toSummary(row: {
    event: EventItem;
    waitlist?: Registration[];
    attendanceReport?: AttendanceReport;
  }): EventAthleteSummary {
    const event = row.event;
    const report = row.attendanceReport;
    const enrolled: EnrolledUserRow[] = [
      ...(report?.attendees || []).map((item) => ({
        registrationId: item.registrationId,
        userId: item.userId,
        fullName: item.fullName,
        email: item.email,
        profilePicture: item.profilePicture,
        attended: true,
        checkInTime: item.checkInTime
      })),
      ...(report?.absentees || []).map((item) => ({
        registrationId: item.registrationId,
        userId: item.userId,
        fullName: item.fullName,
        email: item.email,
        profilePicture: item.profilePicture,
        attended: false
      }))
    ];
    return {
      event,
      occupied: enrolled.length || Math.max(
        (event.maxCapacity || 0) - (event.availableCapacity ?? (event.maxCapacity || 0)),
        0
      ),
      waitlist: row.waitlist || [],
      enrolled,
      filter: 'all'
    };
  }
}
