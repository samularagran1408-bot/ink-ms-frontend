import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { of, Subscription } from 'rxjs';

import { AttendanceReport, EventItem, Registration } from '@features/sports-disabilities/models/sports';
import { SessionService } from '@core/services/session.service';
import { ReportsService } from '@features/reports/services/reports.service';
import { LiveSyncService } from '@features/accessibility/services/live-sync.service';
import { userInitials } from '@core/utils/avatar.util';
import { matchesQuery } from '@core/utils/search.util';
import { isEventVisible } from '@features/sports-disabilities/utils/event-visibility.util';
import { SharedModule } from '@shared/shared.module';

type AttendanceFilter = 'all' | 'attended' | 'absent';

interface EnrolledUserRow {
  registrationId: string;
  userId?: string;
  fullName?: string;
  email?: string;
  profilePicture?: string;
  attended: boolean;
  checkInTime?: string;
  notes?: string;
}

interface EventAthleteSummary {
  event: EventItem;
  occupied: number;
  waitlist: Registration[];
  enrolled: EnrolledUserRow[];
  visibleEnrolled: EnrolledUserRow[];
  attendedCount: number;
  absentCount: number;
  filter: AttendanceFilter;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, SharedModule],
  selector: 'app-athletes-page',
  templateUrl: './athletes-page.component.html',
  styleUrl: './athletes-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AthletesPageComponent implements OnInit, OnDestroy {
  summaries: EventAthleteSummary[] = [];
  visibleSummaries: EventAthleteSummary[] = [];
  searchQuery = '';
  loading = true;
  errorMessage: string | null = null;
  private liveSub: Subscription | null = null;

  constructor(
    private session: SessionService,
    private reportsService: ReportsService,
    private liveSync: LiveSyncService,
    private cdr: ChangeDetectorRef
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
          this.applyView();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          if (!silent) {
            this.errorMessage = error?.error?.message || 'No se pudieron cargar eventos.';
            this.loading = false;
            this.cdr.markForCheck();
          }
        }
      });
    });
  }

  setFilter(summary: EventAthleteSummary, filter: AttendanceFilter): void {
    summary.filter = filter;
    this.applyView();
  }

  onSearchChange(): void {
    this.applyView();
  }

  trackBySummary(_index: number, summary: EventAthleteSummary): string {
    return summary.event.id;
  }

  trackByEnrolled(_index: number, row: EnrolledUserRow): string {
    return row.registrationId || row.email || String(_index);
  }

  private applyView(): void {
    const q = this.searchQuery.trim();
    this.summaries.forEach((summary) => {
      summary.attendedCount = summary.enrolled.filter((row) => row.attended).length;
      summary.absentCount = summary.enrolled.length - summary.attendedCount;
      summary.visibleEnrolled = this.computeEnrolled(summary);
    });
    this.visibleSummaries = !q
      ? this.summaries
      : this.summaries.filter((summary) =>
        matchesQuery(q, summary.event.name, summary.event.sportName)
        || summary.visibleEnrolled.length > 0
        || summary.waitlist.some((item) =>
          matchesQuery(q, item.userFullName, item.userEmail)
        )
      );
    this.cdr.markForCheck();
  }

  private computeEnrolled(summary: EventAthleteSummary): EnrolledUserRow[] {
    let rows = summary.enrolled;
    if (summary.filter === 'attended') {
      rows = rows.filter((row) => row.attended);
    } else if (summary.filter === 'absent') {
      rows = rows.filter((row) => !row.attended);
    }
    return rows.filter((row) => matchesQuery(this.searchQuery, row.fullName, row.email, row.notes));
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.applyView();
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
        checkInTime: item.checkInTime,
        notes: item.notes
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
      visibleEnrolled: enrolled,
      attendedCount: enrolled.filter((row) => row.attended).length,
      absentCount: enrolled.filter((row) => !row.attended).length,
      filter: 'all'
    };
  }
}
