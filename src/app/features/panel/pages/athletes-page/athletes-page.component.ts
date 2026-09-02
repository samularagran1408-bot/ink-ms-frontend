import { Component, OnInit } from '@angular/core';
import { of } from 'rxjs';

import { AttendanceReport, EventItem, Registration } from '../../../../core/models/sports';
import { SessionService } from '../../../../core/services/session.service';
import { ReportsService } from '../../../../core/services/reports.service';
import { userInitials } from '../../../../core/utils/avatar.util';

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
export class AthletesPageComponent implements OnInit {
  summaries: EventAthleteSummary[] = [];
  loading = true;
  errorMessage: string | null = null;

  constructor(
    private session: SessionService,
    private reportsService: ReportsService
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

    start.subscribe((profile) => {
      const allEvents = this.session.hasRole('ADMIN', 'ENTRENADOR');
      this.reportsService.getAthletesPanel(profile?.id, allEvents).subscribe({
        next: (panel) => {
          this.summaries = (panel.athleteSummaries || []).map((row) => this.toSummary(row));
          this.loading = false;
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
