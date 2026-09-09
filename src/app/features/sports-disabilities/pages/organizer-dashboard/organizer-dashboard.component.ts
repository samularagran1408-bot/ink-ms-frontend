import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { forkJoin, of, Subscription } from 'rxjs';

import { AttendanceReport, EventItem, Registration, Sport } from '@features/sports-disabilities/models/sports';
import { SessionService } from '@core/services/session.service';
import { SportsService } from '@features/sports-disabilities/services/sports.service';
import { ReportsService } from '@features/reports/services/reports.service';
import { ConfirmDialogService } from '@shared/services/confirm-dialog.service';
import { LiveSyncService } from '@features/accessibility/services/live-sync.service';
import { resolveEventImage } from '@features/sports-disabilities/utils/event-image.util';
import { EventPlaceLocation } from '@features/sports-disabilities/utils/maps.util';
import { eventDateTimeMs } from '@core/utils/qr-attendance.util';
import { userInitials } from '@core/utils/avatar.util';
import { isEventVisible } from '@features/sports-disabilities/utils/event-visibility.util';
import { SharedModule } from '@shared/shared.module';

interface EnrolledPreview {
  registrationId: string;
  fullName?: string;
  email?: string;
  profilePicture?: string;
  attended: boolean;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, SharedModule],
  selector: 'app-organizer-dashboard',
  templateUrl: './organizer-dashboard.component.html',
  styleUrl: './organizer-dashboard.component.scss'
})
export class OrganizerDashboardComponent implements OnInit, OnDestroy {
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
  creating = false;
  nextEvent: EventItem | null = null;
  nextWaitlist: Registration[] = [];
  nextEnrolled: EnrolledPreview[] = [];
  nextReport: AttendanceReport | null = null;
  loadingNextDetails = false;
  private liveSub: Subscription | null = null;

  constructor(
    private session: SessionService,
    private sportsService: SportsService,
    private reportsService: ReportsService,
    private fb: FormBuilder,
    private router: Router,
    private confirm: ConfirmDialogService,
    private liveSync: LiveSyncService
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
      maxCapacity: [30, [Validators.required, Validators.min(1), Validators.max(500)]]
    });
  }

  ngOnInit(): void {
    this.reload();
    this.liveSync.start();
    this.liveSub = this.liveSync.pulse$.subscribe(() => this.reload(true));
  }

  ngOnDestroy(): void {
    this.liveSub?.unsubscribe();
  }

  get upcomingCount(): number {
    return this.upcomingEvents.length;
  }

  get finishedCount(): number {
    const now = Date.now();
    return this.events.filter((event) => {
      const status = (event.status || '').toLowerCase();
      if (status === 'finished' || status === 'cancelled') {
        return true;
      }
      const start = eventDateTimeMs(event.eventDate, event.eventTime);
      return start != null && start < now;
    }).length;
  }

  get totalCapacity(): number {
    return this.events.reduce((sum, event) => sum + (event.maxCapacity || 0), 0);
  }

  get occupancyPercent(): number {
    if (!this.totalCapacity) {
      return 0;
    }
    return Math.round((this.athleteCount * 100) / this.totalCapacity);
  }

  get nextOccupancyPercent(): number {
    if (!this.nextEvent?.maxCapacity) {
      return 0;
    }
    return Math.round((this.occupied(this.nextEvent) * 100) / this.nextEvent.maxCapacity);
  }

  get nextSpotsLeft(): number {
    return Math.max(this.nextEvent?.availableCapacity ?? 0, 0);
  }

  get upcomingEvents(): EventItem[] {
    const now = Date.now();
    return this.sortEvents(this.events).filter((event) => {
      const status = (event.status || '').toLowerCase();
      if (status === 'finished' || status === 'cancelled') {
        return false;
      }
      const start = eventDateTimeMs(event.eventDate, event.eventTime);
      return start == null || start >= now;
    });
  }

  reload(silent = false): void {
    if (!silent) {
      this.loading = true;
    }
    const profile$ = this.session.getProfile()
      ? of(this.session.getProfile())
      : this.session.loadProfile();

    profile$.subscribe((profile) => {
      this.quizPassed = !!profile?.organizerQuizPassed;
      this.reportsService.getOrganizerPanel(profile?.id).subscribe({
        next: (panel) => {
          this.events = (panel.events || []).filter((event) => isEventVisible(event));
          this.activeEvents = panel.metrics?.['active_events'] ?? 0;
          this.sports = panel.sports || [];
          this.athleteCount = panel.athleteCount ?? panel.metrics?.['athletes'] ?? 0;
          this.attendanceRatePercent = panel.attendanceRatePercent ?? null;
          this.attendanceSampledEvents = panel.attendanceSampledEvents ?? 0;
          if (this.sports.length && !this.form.value.sportId) {
            this.form.patchValue({ sportId: this.sports[0].id });
          }
          this.nextEvent = this.resolveNextEvent(this.events);
          if (!silent) {
            this.loading = false;
          }
          this.loadNextEventDetails(silent);
        },
        error: () => {
          this.errorMessage = 'No se pudo cargar el panel del organizador.';
          if (!silent) {
            this.loading = false;
          }
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

  goAthletes(): void {
    this.router.navigate(['/organizer/athletes']);
  }

  goManageNext(): void {
    if (!this.nextEvent) {
      this.goAttendanceReports();
      return;
    }
    this.router.navigate(['/organizer/events'], {
      queryParams: { eventoId: this.nextEvent.id }
    });
  }

  get minEventDate(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  isInvalid(name: string): boolean {
    const control = this.form.get(name);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  /**
   * Crea un evento; si el quiz no está aprobado, redirige al flujo de aptitud.
   */
  createEvent(): void {
    this.errorMessage = null;
    this.successMessage = null;
    if (!this.quizPassed) {
      this.errorMessage = 'Debes completar el quiz de aptitud antes de crear eventos.';
      this.goQuiz();
      return;
    }
    if (!this.sports.length) {
      this.errorMessage = 'No hay deportes activos. Activa un deporte antes de crear el evento.';
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage = 'Completa deporte, nombre, fecha, hora y cupo.';
      return;
    }
    if (!this.isEventDateTimeFuture()) {
      this.errorMessage = 'La fecha y hora del evento deben ser posteriores al momento actual.';
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

    this.creating = true;
    const ensureProfile$ = this.session.getProfile()
      ? of(this.session.getProfile())
      : this.session.loadProfile();

    ensureProfile$.subscribe((profile) => {
      if (!profile?.id) {
        this.creating = false;
        this.errorMessage = 'No se pudo identificar tu perfil. Vuelve a iniciar sesión.';
        return;
      }
      const payload = {
        ...this.form.value,
        sportId: Number(this.form.value.sportId),
        maxCapacity: Number(this.form.value.maxCapacity),
        createdBy: profile.id
      };

      this.sportsService.createEvent(payload).subscribe({
        next: () => {
          this.creating = false;
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
          this.creating = false;
          this.successMessage = null;
          this.errorMessage = error?.error?.message || 'No se pudo crear el evento.';
        }
      });
    });
  }

  private isEventDateTimeFuture(): boolean {
    const ms = eventDateTimeMs(this.form.value.eventDate, this.form.value.eventTime);
    return ms != null && ms > Date.now();
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

  initials(name?: string | null): string {
    return userInitials(name);
  }

  eventWhen(event: EventItem | null): string {
    if (!event) {
      return '';
    }
    const time = (event.eventTime || '').substring(0, 5);
    return `${event.eventDate || ''} ${time}`.trim();
  }

  countdownLabel(event: EventItem | null): string {
    if (!event) {
      return '';
    }
    const start = eventDateTimeMs(event.eventDate, event.eventTime);
    if (start == null) {
      return '';
    }
    const diff = start - Date.now();
    if (diff <= 0) {
      return 'En curso o por iniciar el check-in';
    }
    const minutes = Math.round(diff / 60_000);
    if (minutes < 60) {
      return `En ${minutes} min`;
    }
    const hours = Math.round(minutes / 60);
    if (hours < 48) {
      return `En ${hours} h`;
    }
    const days = Math.round(hours / 24);
    return `En ${days} días`;
  }

  private loadNextEventDetails(silent = false): void {
    if (!this.nextEvent) {
      this.nextWaitlist = [];
      this.nextEnrolled = [];
      this.nextReport = null;
      this.loadingNextDetails = false;
      return;
    }

    if (!silent) {
      this.loadingNextDetails = true;
    }
    const eventId = this.nextEvent.id;
    forkJoin({
      report: this.sportsService.getAttendanceReport(eventId),
      waitlist: this.sportsService.getEventWaitlist(eventId)
    }).subscribe({
      next: ({ report, waitlist }) => {
        this.nextReport = report;
        this.nextWaitlist = waitlist || [];
        this.nextEnrolled = [
          ...(report?.attendees || []).map((item) => ({
            registrationId: item.registrationId,
            fullName: item.fullName,
            email: item.email,
            profilePicture: item.profilePicture,
            attended: true
          })),
          ...(report?.absentees || []).map((item) => ({
            registrationId: item.registrationId,
            fullName: item.fullName,
            email: item.email,
            profilePicture: item.profilePicture,
            attended: false
          }))
        ];
        this.loadingNextDetails = false;
      },
      error: () => {
        this.nextWaitlist = [];
        this.nextEnrolled = [];
        this.nextReport = null;
        this.loadingNextDetails = false;
      }
    });
  }

  private resolveNextEvent(events: EventItem[]): EventItem | null {
    const upcoming = this.upcomingEvents;
    if (upcoming.length) {
      return upcoming[0];
    }
    const sorted = this.sortEvents(events);
    return sorted[sorted.length - 1] || null;
  }

  private sortEvents(events: EventItem[]): EventItem[] {
    return [...events].sort((a, b) => {
      const aMs = eventDateTimeMs(a.eventDate, a.eventTime) ?? Number.MAX_SAFE_INTEGER;
      const bMs = eventDateTimeMs(b.eventDate, b.eventTime) ?? Number.MAX_SAFE_INTEGER;
      return aMs - bMs;
    });
  }
}
