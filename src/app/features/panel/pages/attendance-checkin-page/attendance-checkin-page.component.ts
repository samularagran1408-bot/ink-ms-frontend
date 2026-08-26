import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { AttendanceCheckInMethod, normalizeAttendanceCheckInMethod, Preference } from '../../../../core/models/accessibility-api';
import { EventItem, QrAttendanceInfo, Registration } from '../../../../core/models/sports';
import { PreferencesApiService } from '../../../../core/services/preferences-api.service';
import { SessionService } from '../../../../core/services/session.service';
import { SportsService } from '../../../../core/services/sports.service';
import { extractQrCode, eventDateTimeMs } from '../../../../core/utils/qr-attendance.util';

@Component({
  selector: 'app-attendance-checkin-page',
  templateUrl: './attendance-checkin-page.component.html',
  styleUrl: './attendance-checkin-page.component.scss'
})
export class AttendanceCheckinPageComponent implements OnInit, OnDestroy {
  loading = true;
  submitting = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  nowMs = Date.now();
  private clockTimer: ReturnType<typeof setInterval> | null = null;

  qrCode = '';
  info: QrAttendanceInfo | null = null;
  event: EventItem | null = null;
  registration: Registration | null = null;
  attendanceCheckInMethod: AttendanceCheckInMethod = 'qr';

  survey = {
    present: false,
    readyForCheckIn: false,
    notes: ''
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private session: SessionService,
    private sportsService: SportsService,
    private preferencesApi: PreferencesApiService
  ) {}

  ngOnInit(): void {
    this.clockTimer = setInterval(() => {
      this.nowMs = Date.now();
      if (!this.loading && !this.alreadyAttended && this.attendanceByQr && this.eventHasStarted && !this.submitting && !this.successMessage) {
        this.submitAttendance();
      }
    }, 15_000);
    this.qrCode = extractQrCode(this.route.snapshot.queryParamMap.get('code') || '');
    if (!this.qrCode) {
      this.loading = false;
      this.errorMessage = 'Este enlace no incluye un código de asistencia válido.';
      return;
    }
    this.reload();
  }

  ngOnDestroy(): void {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
    }
  }

  get surveyReady(): boolean {
    return this.survey.present && this.survey.readyForCheckIn;
  }

  get alreadyAttended(): boolean {
    return !!this.info?.attended || !!this.registration?.attended;
  }

  get attendanceByQr(): boolean {
    return this.attendanceCheckInMethod === 'qr'
      || this.session.hasRole('ADMIN', 'ORGANIZADOR', 'ENTRENADOR');
  }

  get eventTitle(): string {
    return this.info?.eventName || this.event?.name || 'Evento';
  }

  get eventWhen(): string {
    const date = this.info?.eventDate || this.event?.eventDate || '';
    const time = (this.info?.eventTime || this.event?.eventTime || '').toString().substring(0, 5);
    return `${date} ${time}`.trim();
  }

  get eventHasStarted(): boolean {
    const start = eventDateTimeMs(
      this.info?.eventDate || this.event?.eventDate,
      this.info?.eventTime || this.event?.eventTime
    );
    return start == null || this.nowMs >= start;
  }

  reload(): void {
    this.loading = true;
    this.errorMessage = null;

    const profile$ = this.session.getProfile()
      ? of(this.session.getProfile())
      : this.session.loadProfile();

    profile$.pipe(
      switchMap((profile) => {
        const userId = profile?.id;
        return forkJoin({
          info: this.sportsService.getAttendanceQrInfo(this.qrCode).pipe(catchError(() => of(null))),
          events: this.sportsService.getEvents().pipe(catchError(() => of([] as EventItem[]))),
          registrations: userId
            ? this.sportsService.getRegistrationsByUser(userId).pipe(catchError(() => of([] as Registration[])))
            : of([] as Registration[]),
          preferences: this.preferencesApi.getPreferences().pipe(catchError(() => of(null as Preference | null)))
        });
      })
    ).subscribe({
      next: ({ info, events, registrations, preferences }) => {
        this.info = info;
        this.attendanceCheckInMethod = normalizeAttendanceCheckInMethod(preferences?.attendanceCheckInMethod);
        const eventId = info?.eventId || this.route.snapshot.queryParamMap.get('eventId');
        this.event = events.find((item) => item.id === eventId) || null;
        this.registration = registrations.find((reg) => {
          const code = extractQrCode(reg.qrCode);
          return code && code === this.qrCode;
        }) || registrations.find((reg) => eventId && reg.eventId === eventId && reg.waitlistPosition == null) || null;
        this.loading = false;
        if (!this.info && !this.registration) {
          this.errorMessage = 'No encontramos una inscripción válida para este código QR.';
          return;
        }
        if (!this.alreadyAttended && this.attendanceByQr && this.eventHasStarted) {
          this.submitAttendance();
        }
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error?.error?.message || 'No se pudo cargar la asistencia.';
      }
    });
  }

  submit(): void {
    if (!this.surveyReady || !this.eventHasStarted) {
      return;
    }
    this.submitAttendance();
  }

  goEvents(): void {
    const home = this.session.homeForCurrentUser();
    this.router.navigate([`${home}/events`.replace(/\/\/+/g, '/')]);
  }

  private submitAttendance(): void {
    if (this.submitting || this.alreadyAttended) {
      return;
    }
    if (!this.eventHasStarted) {
      this.errorMessage = `El registro de asistencia se habilita a partir de ${this.eventWhen || 'la hora del evento'}.`;
      return;
    }

    this.submitting = true;
    this.errorMessage = null;
    const verifiedBy = this.session.getProfile()?.id || this.session.getDisplayName();
    this.sportsService.markAttendanceByQr(this.qrCode, verifiedBy).subscribe({
      next: (response) => {
        this.submitting = false;
        this.successMessage = response?.message || 'Asistencia registrada. ¡Gracias!';
        if (this.info) {
          this.info = { ...this.info, attended: true };
        }
        if (this.registration) {
          this.registration = { ...this.registration, attended: true };
        }
      },
      error: (error) => {
        this.submitting = false;
        this.errorMessage = error?.error?.message || 'No se pudo registrar la asistencia.';
      }
    });
  }
}
