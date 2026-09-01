import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
import { of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import {
  AttendanceReport,
  CalendarEvent,
  EventItem,
  Registration,
  Sport
} from '../../../../core/models/sports';
import { SessionService } from '../../../../core/services/session.service';
import { SportsService } from '../../../../core/services/sports.service';
import { ReportsService } from '../../../../core/services/reports.service';
import { PreferencesApiService } from '../../../../core/services/preferences-api.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { AttendanceCheckInMethod, normalizeAttendanceCheckInMethod } from '../../../../core/models/accessibility-api';
import { resolveEventImage } from '../../../../core/utils/event-image.util';
import { EventPlaceLocation } from '../../../../core/utils/maps.util';
import { buildAttendanceCheckinUrl, extractQrCode, eventDateTimeMs } from '../../../../core/utils/qr-attendance.util';

interface EventManageRow {
  event: EventItem;
  waitlist: Registration[];
  showWaitlist: boolean;
  editing: boolean;
  editForm: FormGroup;
  saving: boolean;
}

interface MyPassRow {
  registration: Registration;
  event: EventItem | null;
  qrDataUrl: string | null;
  loadingQr: boolean;
}

@Component({
  selector: 'app-events-page',
  templateUrl: './events-page.component.html',
  styleUrl: './events-page.component.scss'
})
export class EventsPageComponent implements OnInit, OnDestroy {
  mode: 'user' | 'manage' = 'user';
  events: EventItem[] = [];
  registrations: Registration[] = [];
  myPasses: MyPassRow[] = [];
  manageRows: EventManageRow[] = [];
  sports: Sport[] = [];
  form: FormGroup;
  loading = true;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  registeringId: string | null = null;
  highlightedEventId: string | null = null;
  attendanceCheckInMethod: AttendanceCheckInMethod = 'qr';
  nowMs = Date.now();

  lookupEventId = '';
  lookupEvent: EventItem | null = null;
  catalogQuery = '';
  calendarFrom = '';
  calendarTo = '';
  calendarItems: CalendarEvent[] = [];
  calendarLoaded = false;
  cancellingId: string | null = null;
  cancellingRegistrationId: string | null = null;

  checkInOpen = false;
  checkInEvent: EventItem | null = null;
  manualQrCode = '';
  checkInBusy = false;
  checkInMessage: string | null = null;
  checkInError: string | null = null;
  scannerRunning = false;
  scannerError: string | null = null;

  reportOpen = false;
  reportLoading = false;
  reportError: string | null = null;
  attendanceReport: AttendanceReport | null = null;

  myAttendanceOpen = false;
  myAttendanceEvent: EventItem | null = null;
  myAttendancePass: MyPassRow | null = null;
  attendanceSurvey = {
    present: false,
    readyForCheckIn: false,
    notes: ''
  };

  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private html5Qr: Html5Qrcode | null = null;
  private readonly scannerElementId = 'attendance-qr-reader';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sportsService: SportsService,
    private session: SessionService,
    private reportsService: ReportsService,
    private preferencesApi: PreferencesApiService,
    private fb: FormBuilder,
    private confirm: ConfirmDialogService
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
      maxCapacity: [20, [Validators.required, Validators.min(1)]]
    });
  }

  ngOnInit(): void {
    this.mode = (this.route.snapshot.data['mode'] as 'user' | 'manage') || 'user';
    this.highlightedEventId = this.route.snapshot.queryParamMap.get('eventoId');
    this.clockTimer = setInterval(() => {
      this.nowMs = Date.now();
      if (this.mode === 'user') {
        void this.refreshPassQrImages();
      }
    }, 30_000);
    this.reload();
  }

  ngOnDestroy(): void {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
    }
    void this.stopScanner();
  }

  get canManage(): boolean {
    return this.mode === 'manage'
      || this.session.hasRole('ADMIN', 'ORGANIZADOR', 'ENTRENADOR');
  }

  get filteredEvents(): EventItem[] {
    return this.filterEventList(this.events);
  }

  get filteredManageRows(): EventManageRow[] {
    const q = this.catalogQuery.trim().toLowerCase();
    if (!q) {
      return this.manageRows;
    }
    return this.manageRows.filter((row) => this.eventMatchesQuery(row.event, q));
  }

  private filterEventList(events: EventItem[]): EventItem[] {
    const q = this.catalogQuery.trim().toLowerCase();
    if (!q) {
      return events;
    }
    return events.filter((event) => this.eventMatchesQuery(event, q));
  }

  private eventMatchesQuery(event: EventItem, q: string): boolean {
    return event.name.toLowerCase().includes(q)
      || (event.sportName || '').toLowerCase().includes(q)
      || (event.location || '').toLowerCase().includes(q)
      || (event.description || '').toLowerCase().includes(q)
      || event.id.toLowerCase().includes(q);
  }

  reload(): void {
    this.loading = true;
    this.errorMessage = null;

    const profile$ = this.session.getProfile()
      ? of(this.session.getProfile())
      : this.session.loadProfile();

    profile$.pipe(
      switchMap((profile) => this.reportsService.getEventsPanel(profile?.id, this.mode === 'manage' ? 'manage' : 'user'))
    ).subscribe({
      next: (panel) => {
        const events = panel.events || [];
        const registrations = panel.registrations || [];
        const sports = panel.sports || [];
        this.events = events;
        this.registrations = registrations;
        this.sports = sports;
        this.attendanceCheckInMethod = normalizeAttendanceCheckInMethod(
          this.preferencesApi.cached?.attendanceCheckInMethod
        );
        if (sports.length && !this.form.value.sportId) {
          this.form.patchValue({ sportId: sports[0].id });
        }
        if (this.mode === 'user') {
          this.buildMyPasses();
          void this.refreshPassQrImages();
        }
        this.applyEventsToCalendar(events);
        if (this.canManage && this.mode === 'manage') {
          this.applyWaitlists(events, panel.waitlists || {});
        } else {
          this.loading = false;
        }
        this.scrollToHighlighted();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'No se pudieron cargar eventos.';
        this.loading = false;
      }
    });
  }

  createEvent(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
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

  onCreatePlaceChange(place: EventPlaceLocation): void {
    this.form.patchValue({
      location: place.address,
      latitude: place.latitude,
      longitude: place.longitude
    });
  }

  onEditPlaceChange(row: EventManageRow, place: EventPlaceLocation): void {
    row.editForm.patchValue({
      location: place.address,
      latitude: place.latitude,
      longitude: place.longitude
    });
  }

  startEdit(row: EventManageRow): void {
    row.editing = true;
    row.editForm.patchValue({
      name: row.event.name,
      eventDate: row.event.eventDate,
      eventTime: (row.event.eventTime || '').substring(0, 5),
      location: row.event.location || '',
      latitude: row.event.latitude ?? null,
      longitude: row.event.longitude ?? null,
      maxCapacity: row.event.maxCapacity
    });
  }

  cancelEdit(row: EventManageRow): void {
    row.editing = false;
  }

  saveEventChanges(row: EventManageRow): void {
    if (row.editForm.invalid) {
      row.editForm.markAllAsTouched();
      return;
    }
    void this.confirmSaveEvent(row);
  }

  private async confirmSaveEvent(row: EventManageRow): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Guardar cambios',
      message: `¿Confirmas actualizar "${row.event.name}"? Se notificará a los inscritos si cambia fecha o lugar.`,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar'
    });
    if (!ok) {
      return;
    }

    row.saving = true;
    const payload = {
      name: row.editForm.value.name,
      eventDate: row.editForm.value.eventDate,
      eventTime: row.editForm.value.eventTime,
      location: row.editForm.value.location,
      latitude: row.editForm.value.latitude,
      longitude: row.editForm.value.longitude,
      maxCapacity: Number(row.editForm.value.maxCapacity)
    };

    this.sportsService.updateEvent(row.event.id, payload).subscribe({
      next: () => {
        row.saving = false;
        row.editing = false;
        this.successMessage = 'Evento actualizado. Se notificó a los inscritos si cambió fecha o lugar.';
        this.errorMessage = null;
        this.reload();
      },
      error: (error) => {
        row.saving = false;
        this.successMessage = null;
        this.errorMessage = error?.error?.message || 'No se pudo actualizar el evento.';
      }
    });
  }

  searchEvent(): void {
    const id = (this.lookupEventId || '').trim();
    if (!id) {
      this.errorMessage = 'Indica el nombre del evento.';
      this.lookupEvent = null;
      return;
    }

    const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f-]{4,}$/i.test(id);
    if (!looksLikeUuid) {
      this.sportsService.searchEvents(id).subscribe({
        next: (events) => {
          if (!events.length) {
            this.lookupEvent = null;
            this.successMessage = null;
            this.errorMessage = `Evento no encontrado: ${id}`;
            return;
          }
          this.lookupEvent = events[0];
          this.catalogQuery = id;
          this.errorMessage = null;
          this.successMessage = `Evento encontrado: ${events[0].name}.`;
        },
        error: (error) => {
          this.lookupEvent = null;
          this.successMessage = null;
          this.errorMessage = error?.error?.message || `Evento no encontrado: ${id}`;
        }
      });
      return;
    }

    this.sportsService.getEvent(id).subscribe({
      next: (event) => {
        this.lookupEvent = event;
        this.errorMessage = null;
        this.successMessage = `Evento encontrado: ${event.name}.`;
      },
      error: (error) => {
        this.lookupEvent = null;
        this.successMessage = null;
        this.errorMessage = error?.error?.message || 'Evento no encontrado.';
      }
    });
  }

  loadCalendar(): void {
    this.sportsService.getEventCalendar(this.calendarFrom || undefined, this.calendarTo || undefined).subscribe({
      next: (items) => {
        this.calendarItems = items;
        this.calendarLoaded = true;
      },
      error: (error) => {
        this.calendarItems = [];
        this.calendarLoaded = true;
        this.errorMessage = error?.error?.message || 'No se pudo cargar el calendario.';
      }
    });
  }

  clearCalendarFilter(): void {
    this.calendarFrom = '';
    this.calendarTo = '';
    this.loadCalendar();
  }

  cancelManagedEvent(event: EventItem): void {
    if (this.cancellingId) {
      return;
    }
    void this.confirmCancelEvent(event);
  }

  private async confirmCancelEvent(event: EventItem): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Cancelar evento',
      message: `¿Confirmas cancelar "${event.name}"? Esta acción no se puede deshacer.`,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar',
      tone: 'danger'
    });
    if (!ok) {
      return;
    }

    this.cancellingId = event.id;
    this.sportsService.cancelEvent(event.id).subscribe({
      next: () => {
        this.cancellingId = null;
        this.successMessage = `Evento "${event.name}" cancelado.`;
        this.errorMessage = null;
        this.reload();
        this.loadCalendar();
      },
      error: (error) => {
        this.cancellingId = null;
        this.successMessage = null;
        this.errorMessage = error?.error?.message || 'No se pudo cancelar el evento.';
      }
    });
  }

  register(event: EventItem): void {
    void this.confirmRegister(event);
  }

  private async confirmRegister(event: EventItem): Promise<void> {
    const waitlist = (event.availableCapacity ?? 0) <= 0;
    const ok = await this.confirm.ask({
      title: waitlist ? 'Lista de espera' : 'Inscribirse',
      message: waitlist
        ? `El evento "${event.name}" está lleno. ¿Quieres unirte a la lista de espera?`
        : `¿Confirmas tu inscripción a "${event.name}"?`,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar'
    });
    if (!ok) {
      return;
    }

    const ensureProfile$ = this.session.getProfile()
      ? of(this.session.getProfile())
      : this.session.loadProfile();

    ensureProfile$.subscribe((profile) => {
      const userId = profile?.id;
      if (!userId) {
        this.errorMessage = 'Perfil no disponible.';
        return;
      }

      this.registeringId = event.id;
      this.sportsService.registerToEvent(userId, event.id).subscribe({
        next: (registration) => {
          this.registeringId = null;
          this.successMessage = registration?.message
            || (registration?.waitlistPosition != null
              ? `El evento está lleno. Quedaste en lista de espera (posición ${registration.waitlistPosition}).`
              : `Inscripción a ${event.name} realizada.`);
          this.errorMessage = null;
          this.reload();
        },
        error: (error) => {
          this.registeringId = null;
          this.errorMessage = error?.error?.message || 'No se pudo inscribir.';
        }
      });
    });
  }

  isRegistered(eventId: string): boolean {
    return this.registrations.some((reg) => reg.eventId === eventId && reg.waitlistPosition == null);
  }

  isOnWaitlist(eventId: string): boolean {
    return this.registrations.some((reg) => reg.eventId === eventId && reg.waitlistPosition != null);
  }

  waitlistPositionFor(eventId: string): number | null {
    return this.registrations.find((reg) => reg.eventId === eventId && reg.waitlistPosition != null)?.waitlistPosition ?? null;
  }

  canJoinEvent(eventId: string): boolean {
    return !this.isRegistered(eventId) && !this.isOnWaitlist(eventId);
  }

  catalogJoinLabel(event: EventItem): string {
    if (this.registeringId === event.id) {
      return (event.availableCapacity ?? 0) <= 0 ? 'Uniendo a espera...' : 'Inscribiendo...';
    }
    return (event.availableCapacity ?? 0) <= 0 ? 'Unirme a lista de espera' : 'Inscribirse';
  }

  get historyRegistrations(): Registration[] {
    return [...this.registrations].sort((a, b) => {
      const aKey = `${a.eventDate || a.registrationDate || ''}T${a.eventTime || '00:00:00'}`;
      const bKey = `${b.eventDate || b.registrationDate || ''}T${b.eventTime || '00:00:00'}`;
      return bKey.localeCompare(aKey);
    });
  }

  historyDateLabel(reg: Registration): string {
    if (reg.eventDate) {
      return `${reg.eventDate} ${((reg.eventTime || '').substring(0, 5))}`;
    }
    return reg.registrationDate || 'Sin fecha';
  }

  isHighlighted(eventId: string | number | undefined): boolean {
    if (this.highlightedEventId == null || eventId == null) {
      return false;
    }
    return String(eventId) === String(this.highlightedEventId);
  }

  private scrollToHighlighted(): void {
    if (!this.highlightedEventId || typeof document === 'undefined') {
      return;
    }
    setTimeout(() => {
      document.getElementById(`evento-${this.highlightedEventId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }, 50);
  }

  registrationFor(eventId: string): Registration | null {
    return this.registrations.find((reg) => reg.eventId === eventId && reg.waitlistPosition == null) || null;
  }

  anyRegistrationFor(eventId: string): Registration | null {
    return this.registrations.find((reg) => reg.eventId === eventId) || null;
  }

  canCancelRegistration(reg: Registration | null | undefined, event?: EventItem | null): boolean {
    if (!reg?.id || reg.attended) {
      return false;
    }
    const status = event?.status || reg.eventStatus;
    return status !== 'finished' && status !== 'cancelled';
  }

  canCancelEventRegistration(event: EventItem): boolean {
    return this.canCancelRegistration(this.anyRegistrationFor(event.id), event);
  }

  cancelMyRegistration(event: EventItem): void {
    const registration = this.anyRegistrationFor(event.id);
    if (!registration) {
      return;
    }
    void this.confirmCancelRegistration(registration, event.name, event);
  }

  cancelRegistrationRecord(reg: Registration): void {
    const event = this.events.find((item) => item.id === reg.eventId) || null;
    void this.confirmCancelRegistration(reg, reg.eventName || event?.name || 'este evento', event);
  }

  private async confirmCancelRegistration(
    registration: Registration,
    eventName: string,
    event?: EventItem | null
  ): Promise<void> {
    if (this.cancellingRegistrationId || !this.canCancelRegistration(registration, event)) {
      return;
    }

    const onWaitlist = registration.waitlistPosition != null;
    const ok = await this.confirm.ask({
      title: onWaitlist ? 'Salir de lista de espera' : 'Cancelar inscripción',
      message: onWaitlist
        ? `¿Confirmas salir de la lista de espera de "${eventName}"?`
        : `¿Confirmas cancelar tu inscripción a "${eventName}"? Si hay lista de espera, la persona en la posición 1 quedará inscrita automáticamente.`,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Volver',
      tone: 'danger'
    });
    if (!ok) {
      return;
    }

    this.cancellingRegistrationId = registration.id;
    this.sportsService.cancelRegistration(registration.id).subscribe({
      next: () => {
        this.cancellingRegistrationId = null;
        this.successMessage = onWaitlist
          ? `Saliste de la lista de espera de "${eventName}".`
          : `Inscripción a "${eventName}" cancelada. Si había lista de espera, el primero fue inscrito automáticamente.`;
        this.errorMessage = null;
        this.reload();
      },
      error: (error) => {
        this.cancellingRegistrationId = null;
        this.successMessage = null;
        this.errorMessage = error?.error?.message || 'No se pudo cancelar la inscripción.';
      }
    });
  }

  hasAttended(eventId: string): boolean {
    return !!this.registrationFor(eventId)?.attended;
  }

  get attendanceByQr(): boolean {
    return this.attendanceCheckInMethod === 'qr';
  }

  /** Inscrito confirmado, aún no asistió, eligió el formulario y el evento ya empezó. */
  canFillAttendance(event: EventItem): boolean {
    return this.isRegistered(event.id)
      && !this.hasAttended(event.id)
      && !this.attendanceByQr
      && this.eventHasStarted(event);
  }

  /** El formulario existe, pero todavía no llega la hora del evento. */
  canFillAttendanceSoon(event: EventItem | null | undefined): boolean {
    if (!event) {
      return false;
    }
    return this.isRegistered(event.id)
      && !this.hasAttended(event.id)
      && !this.attendanceByQr
      && !this.eventHasStarted(event);
  }

  canRecordAttendance(event: EventItem | null | undefined): boolean {
    return this.eventHasStarted(event);
  }

  catalogButtonLabel(event: EventItem): string {
    if (this.hasAttended(event.id)) {
      return 'Asistió';
    }
    if (this.canFillAttendance(event)) {
      return 'Llenar asistencia';
    }
    if (this.isRegistered(event.id)) {
      return 'Inscrito';
    }
    return 'Inscribirse';
  }

  onCatalogAction(event: EventItem): void {
    if (this.canFillAttendance(event)) {
      this.openMyAttendance(event);
      return;
    }
    if (this.canJoinEvent(event.id)) {
      this.register(event);
    }
  }

  openMyAttendance(event: EventItem): void {
    if (!this.eventHasStarted(event)) {
      this.errorMessage = `El llenado de asistencia se habilita a partir de ${this.eventStartLabel(event)}.`;
      return;
    }
    const registration = this.registrationFor(event.id);
    if (!registration?.qrCode) {
      this.errorMessage = 'No se encontró tu inscripción para este evento.';
      return;
    }
    void this.router.navigate(['/asistencia'], {
      queryParams: {
        code: registration.qrCode,
        eventId: event.id
      }
    });
  }

  closeMyAttendance(): void {
    this.myAttendanceOpen = false;
    this.myAttendanceEvent = null;
    this.myAttendancePass = null;
  }

  get surveyReady(): boolean {
    return this.attendanceSurvey.present && this.attendanceSurvey.readyForCheckIn;
  }

  eventImage(event: EventItem): string {
    return resolveEventImage(event);
  }

  toggleWaitlist(row: EventManageRow): void {
    row.showWaitlist = !row.showWaitlist;
  }

  occupied(event: { maxCapacity?: number | null; availableCapacity?: number | null } | null | undefined): number {
    if (!event) {
      return 0;
    }
    const max = event.maxCapacity || 0;
    return Math.max(max - (event.availableCapacity ?? max), 0);
  }

  eventHasStarted(event: EventItem | null | undefined): boolean {
    if (!event?.eventDate) {
      return false;
    }
    const start = this.eventStartMs(event);
    return start == null || this.nowMs >= start;
  }

  eventStartLabel(event: EventItem | null | undefined): string {
    if (!event) {
      return 'hora del evento';
    }
    const start = this.eventStartMs(event);
    if (start == null) {
      return 'hora del evento';
    }
    const parsed = new Date(start);
    const date = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    const time = `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
    return `${date} ${time}`;
  }

  openCheckIn(event: EventItem): void {
    if (!this.eventHasStarted(event)) {
      this.errorMessage = `El check-in se habilita a partir de ${this.eventStartLabel(event)}.`;
      return;
    }
    this.checkInEvent = event;
    this.checkInOpen = true;
    this.manualQrCode = '';
    this.checkInMessage = null;
    this.checkInError = null;
    this.scannerError = null;
  }

  closeCheckIn(): void {
    this.checkInOpen = false;
    this.checkInEvent = null;
    this.manualQrCode = '';
    this.checkInMessage = null;
    this.checkInError = null;
    this.scannerError = null;
    void this.stopScanner();
  }

  async startScanner(): Promise<void> {
    this.scannerError = null;
    try {
      await this.stopScanner();
      this.html5Qr = new Html5Qrcode(this.scannerElementId);
      await this.html5Qr.start(
        { facingMode: 'environment' },
        { fps: 8, qrbox: { width: 220, height: 220 } },
        (decoded) => {
          void this.submitQrCode(decoded);
        },
        () => undefined
      );
      this.scannerRunning = true;
    } catch (error: unknown) {
      this.scannerRunning = false;
      this.scannerError = error instanceof Error
        ? error.message
        : 'No se pudo abrir la cámara. Usa el código manual o una imagen.';
    }
  }

  async stopScanner(): Promise<void> {
    if (!this.html5Qr) {
      this.scannerRunning = false;
      return;
    }
    try {
      if (this.html5Qr.isScanning) {
        await this.html5Qr.stop();
      }
      await this.html5Qr.clear();
    } catch {
      // ignore cleanup errors
    }
    this.html5Qr = null;
    this.scannerRunning = false;
  }

  async onScanFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    this.scannerError = null;
    this.checkInError = null;

    try {
      await this.stopScanner();
      const scanner = new Html5Qrcode(this.scannerElementId);
      this.html5Qr = scanner;
      const decoded = await scanner.scanFile(file, true);
      await this.submitQrCode(decoded);
    } catch (error: unknown) {
      this.scannerError = error instanceof Error
        ? error.message
        : 'No se pudo leer el QR del archivo. Prueba con una imagen (PNG/JPG).';
    } finally {
      await this.stopScanner();
    }
  }

  submitManualQr(): void {
    void this.submitQrCode(this.manualQrCode);
  }

  openAttendanceReport(event: EventItem): void {
    this.reportOpen = true;
    this.attendanceReport = null;
    this.reportError = null;
    this.reportLoading = true;

    this.sportsService.getAttendanceReport(event.id).subscribe({
      next: (report) => {
        this.attendanceReport = report;
        this.reportLoading = false;
      },
      error: (error) => {
        this.reportLoading = false;
        this.reportError = error?.error?.message || 'No se pudo cargar el reporte de asistencia.';
      }
    });
  }

  closeAttendanceReport(): void {
    this.reportOpen = false;
    this.attendanceReport = null;
    this.reportError = null;
  }

  printAttendanceReport(): void {
    window.print();
  }

  exportAttendanceCsv(): void {
    const report = this.attendanceReport;
    if (!report) {
      return;
    }

    const header = ['Evento', 'Estado', 'Nombre', 'Email', 'UserId', 'CheckIn', 'Metodo', 'VerificadoPor'];
    const attendedRows = (report.attendees || []).map((row) => [
      report.eventName || report.eventId,
      'ASISTIO',
      row.fullName || '',
      row.email || '',
      row.userId || '',
      row.checkInTime || '',
      row.checkInMethod || '',
      row.verifiedBy || ''
    ]);
    const absentRows = (report.absentees || []).map((row) => [
      report.eventName || report.eventId,
      'AUSENTE',
      row.fullName || '',
      row.email || '',
      row.userId || '',
      '',
      '',
      ''
    ]);

    const csv = [header, ...attendedRows, ...absentRows]
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const slug = (report.eventName || report.eventId || 'evento')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    this.reportsService.downloadBlob(blob, `asistencia-${slug}-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  attendanceRateLabel(report: AttendanceReport | null): string {
    if (!report) {
      return '0%';
    }
    const rate = report.attendanceRatePercent
      ?? (report.totalRegistered
        ? Math.round((report.totalAttended * 10000) / report.totalRegistered) / 100
        : 0);
    return `${rate}%`;
  }

  private async submitQrCode(rawCode: string): Promise<void> {
    const qrCode = extractQrCode(rawCode);
    if (!qrCode || this.checkInBusy) {
      return;
    }

    this.checkInBusy = true;
    this.checkInError = null;
    this.checkInMessage = null;

    const verifiedBy = this.session.getProfile()?.id || this.session.getDisplayName();
    this.sportsService.markAttendanceByQr(qrCode, verifiedBy).subscribe({
      next: (response) => {
        this.checkInBusy = false;
        this.checkInMessage = response?.message || 'Asistencia registrada.';
        this.manualQrCode = '';
        void this.stopScanner();
      },
      error: (error) => {
        this.checkInBusy = false;
        this.checkInError = error?.error?.message || 'No se pudo registrar la asistencia.';
      }
    });
  }

  private buildMyPasses(): void {
    this.myPasses = this.registrations
      .filter((reg) => reg.waitlistPosition == null)
      .map((registration) => ({
        registration,
        event: this.events.find((event) => event.id === registration.eventId) || null,
        qrDataUrl: null,
        loadingQr: false
      }));
  }

  private async refreshPassQrImages(): Promise<void> {
    for (const pass of this.myPasses) {
      await this.ensurePassQr(pass);
    }
    if (this.myAttendancePass) {
      await this.ensurePassQr(this.myAttendancePass);
    }
  }

  private async ensurePassQr(pass: MyPassRow): Promise<void> {
    const code = pass.registration.qrCode;
    const ready = !!code && !pass.registration.attended;
    if (!ready) {
      pass.qrDataUrl = null;
      pass.loadingQr = false;
      return;
    }
    if (pass.qrDataUrl || pass.loadingQr) {
      return;
    }
    pass.loadingQr = true;
    try {
      pass.qrDataUrl = await QRCode.toDataURL(buildAttendanceCheckinUrl(code as string, pass.event?.id), {
        width: 220,
        margin: 1,
        errorCorrectionLevel: 'M'
      });
    } catch {
      pass.qrDataUrl = null;
    } finally {
      pass.loadingQr = false;
    }
  }

  private eventStartMs(event: EventItem): number | null {
    return eventDateTimeMs(event.eventDate, event.eventTime);
  }

  private buildEditForm(event: EventItem): FormGroup {
    return this.fb.group({
      name: [event.name, Validators.required],
      eventDate: [event.eventDate, Validators.required],
      eventTime: [(event.eventTime || '').substring(0, 5), Validators.required],
      location: [event.location || ''],
      latitude: [event.latitude ?? null],
      longitude: [event.longitude ?? null],
      maxCapacity: [event.maxCapacity, [Validators.required, Validators.min(1)]]
    });
  }

  private applyEventsToCalendar(events: EventItem[]): void {
    if (this.calendarFrom || this.calendarTo) {
      return;
    }
    this.calendarItems = events.map((event) => ({
      id: event.id,
      title: event.name,
      startDate: event.eventDate,
      startTime: event.eventTime,
      location: event.location,
      sportName: event.sportName,
      availableCapacity: event.availableCapacity,
      maxCapacity: event.maxCapacity
    }));
    this.calendarLoaded = true;
  }

  private applyWaitlists(events: EventItem[], waitlists: Record<string, Registration[]>): void {
    this.manageRows = events.map((event) => ({
      event,
      waitlist: waitlists[event.id] || [],
      showWaitlist: false,
      editing: false,
      editForm: this.buildEditForm(event),
      saving: false
    }));
    this.loading = false;
  }
}
