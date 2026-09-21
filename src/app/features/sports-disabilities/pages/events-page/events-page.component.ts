import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import type { Html5Qrcode } from 'html5-qrcode';
import { Subscription, Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

import {
  AttendanceReport,
  EventItem,
  Registration,
  Sport
} from '@features/sports-disabilities/models/sports';
import { SessionService } from '@core/services/session.service';
import { SportsService } from '@features/sports-disabilities/services/sports.service';
import { PaymentsService } from '@features/subscriptions/services/payments.service';
import { ReportsService } from '@features/reports/services/reports.service';
import { PreferencesApiService } from '@features/accessibility/services/preferences-api.service';
import { LanguageService } from '@features/accessibility/services/language.service';
import { LiveSyncService } from '@features/accessibility/services/live-sync.service';
import { UnreadNotificationsService } from '@features/accessibility/services/unread-notifications.service';
import { ConfirmDialogService } from '@shared/services/confirm-dialog.service';
import { AttendanceCheckInMethod, normalizeAttendanceCheckInMethod } from '@features/accessibility/models/accessibility-api';
import { resolveEventImage } from '@features/sports-disabilities/utils/event-image.util';
import { EventPlaceLocation } from '@features/sports-disabilities/utils/maps.util';
import { buildAttendanceCheckinUrl, extractQrCode, eventDateTimeMs } from '@core/utils/qr-attendance.util';
import { userInitials } from '@core/utils/avatar.util';
import { matchesQuery } from '@core/utils/search.util';
import { isEventVisible } from '@features/sports-disabilities/utils/event-visibility.util';
import { SharedModule } from '@shared/shared.module';

interface EventManageRow {
  event: EventItem;
  waitlist: Registration[];
  waitlistLoaded: boolean;
  waitlistLoading: boolean;
  showWaitlist: boolean;
  editing: boolean;
  editForm: FormGroup | null;
  saving: boolean;
  actionsOpen: boolean;
}

interface MyPassRow {
  registration: Registration;
  event: EventItem | null;
  qrDataUrl: string | null;
  loadingQr: boolean;
}

type CapacityEvent = {
  maxCapacity?: number | null;
  availableCapacity?: number | null;
} | null | undefined;

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, SharedModule],
  selector: 'app-events-page',
  templateUrl: './events-page.component.html',
  styleUrl: './events-page.component.scss'
})
export class EventsPageComponent implements OnInit, OnDestroy {
  mode: 'user' | 'manage' = 'user';
  userView: 'catalog' | 'history' = 'catalog';
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
  creating = false;
  highlightedEventId: string | null = null;
  attendanceCheckInMethod: AttendanceCheckInMethod = 'qr';
  nowMs = Date.now();

  catalogQuery = '';
  catalogPage = 0;
  catalogPageSize = 12;
  readonly emptyQuery: Record<string, string> = {};
  eventsTotal = 0;
  eventsTotalPages = 0;
  calendarFrom = '';
  calendarTo = '';
  creatingForm = false;
  cancellingId: string | null = null;
  cancellingRegistrationId: string | null = null;

  checkInOpen = false;
  checkInEvent: EventItem | null = null;
  manualQrCode = '';
  checkInBusy = false;
  checkInMessage: string | null = null;
  checkInError: string | null = null;
  checkInNotes = '';
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
  private occupancyTimer: ReturnType<typeof setInterval> | null = null;
  private occupancySub: Subscription | null = null;
  private reportPoll: ReturnType<typeof setInterval> | null = null;
  private html5Qr: Html5Qrcode | null = null;
  private querySub: Subscription | null = null;
  private liveSub: Subscription | null = null;
  private catalogSearchSub: Subscription | null = null;
  private readonly catalogSearch$ = new Subject<string>();
  private reportEventId: string | null = null;
  private readonly scannerElementId = 'attendance-qr-reader';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sportsService: SportsService,
    private paymentsService: PaymentsService,
    private session: SessionService,
    private reportsService: ReportsService,
    private preferencesApi: PreferencesApiService,
    private liveSync: LiveSyncService,
    private fb: FormBuilder,
    private confirm: ConfirmDialogService,
    private translate: TranslateService,
    private language: LanguageService,
    private unreadNotifications: UnreadNotificationsService
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
      maxCapacity: [20, [Validators.required, Validators.min(1), Validators.max(500)]]
    });
  }

  ngOnInit(): void {
    this.mode = (this.route.snapshot.data['mode'] as 'user' | 'manage') || 'user';
    this.querySub = this.route.queryParamMap.subscribe((params) => {
      this.highlightedEventId = params.get('eventoId');
      this.userView = params.get('vista') === 'historial' ? 'history' : 'catalog';
      if (this.mode === 'user' && this.userView === 'history') {
        if (!this.myPasses.length) {
          this.buildMyPasses();
        }
        void this.refreshPassQrImages();
      }
      this.scrollToHighlighted();
    });
    this.clockTimer = setInterval(() => {
      this.nowMs = Date.now();
      if (this.mode === 'user' && this.userView === 'history') {
        void this.refreshPassQrImages();
      }
    }, 30_000);
    this.catalogPageSize = this.mode === 'manage' ? 15 : 12;
    this.catalogSearchSub = this.catalogSearch$.pipe(
      debounceTime(180),
      distinctUntilChanged()
    ).subscribe(() => {
      this.catalogPage = 0;
      this.reload();
    });
    this.reload();
    this.startOccupancyWatch();
    this.liveSync.start();
    this.liveSub = this.liveSync.pulse$.subscribe((pulse) => {
      // Con el scanner abierto no regeneramos todo el panel (evita “recarga”).
      if (pulse.kind === 'attendance' && this.checkInOpen) {
        if (this.reportOpen && this.reportEventId) {
          if (!pulse.eventId || pulse.eventId === this.reportEventId) {
            this.fetchAttendanceReport(this.reportEventId, true);
          }
        }
        return;
      }
      this.reload(true);
      if (this.reportOpen && this.reportEventId) {
        if (!pulse.eventId || pulse.eventId === this.reportEventId || pulse.kind === 'reconnect') {
          this.fetchAttendanceReport(this.reportEventId, true);
        }
      }
    });
  }

  ngOnDestroy(): void {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
    }
    this.stopOccupancyWatch();
    this.stopReportPoll();
    this.querySub?.unsubscribe();
    this.liveSub?.unsubscribe();
    this.catalogSearchSub?.unsubscribe();
    void this.stopScanner();
  }

  get canManage(): boolean {
    return this.mode === 'manage'
      || this.session.hasRole('ADMIN', 'ORGANIZADOR', 'ENTRENADOR');
  }

  get minEventDate(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  isInvalid(name: string): boolean {
    const control = this.form.get(name);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  get filteredEvents(): EventItem[] {
    return this.visibleEvents;
  }

  /** Eventos en los que el atleta está inscrito o en lista de espera. */
  get myRegisteredEvents(): EventItem[] {
    const ids = new Set(this.registrations.map((reg) => reg.eventId));
    const items = this.filterEventList(this.visibleEvents.filter((event) => ids.has(event.id)));
    return [...items].sort((a, b) => {
      const aMs = eventDateTimeMs(a.eventDate, a.eventTime) ?? 0;
      const bMs = eventDateTimeMs(b.eventDate, b.eventTime) ?? 0;
      const aUpcoming = aMs >= this.nowMs;
      const bUpcoming = bMs >= this.nowMs;
      if (aUpcoming !== bUpcoming) {
        return aUpcoming ? -1 : 1;
      }
      return aUpcoming ? aMs - bMs : bMs - aMs;
    });
  }

  get filteredManageRows(): EventManageRow[] {
    return this.manageRows.filter((row) => {
      if (!isEventVisible(row.event, this.nowMs)) {
        return false;
      }
      const date = row.event.eventDate || '';
      if (this.calendarFrom && date < this.calendarFrom) {
        return false;
      }
      if (this.calendarTo && date > this.calendarTo) {
        return false;
      }
      return true;
    });
  }

  private get visibleEvents(): EventItem[] {
    return this.events.filter((event) => isEventVisible(event, this.nowMs));
  }

  private filterEventList(events: EventItem[]): EventItem[] {
    const q = this.catalogQuery;
    if (!q.trim()) {
      return events;
    }
    return events.filter((event) => this.eventMatchesQuery(event, q));
  }

  private eventMatchesQuery(event: EventItem, q: string): boolean {
    return matchesQuery(
      q,
      event.name,
      event.sportName,
      event.location,
      event.description,
      event.id,
      event.status
    );
  }

  onCatalogQueryChange(value: string): void {
    this.catalogQuery = value;
    this.catalogSearch$.next(value.trim());
  }

  clearCatalogQuery(): void {
    this.catalogQuery = '';
    this.calendarFrom = '';
    this.calendarTo = '';
    this.catalogPage = 0;
    this.reload();
  }

  prevCatalogPage(): void {
    if (this.catalogPage <= 0) {
      return;
    }
    this.catalogPage -= 1;
    this.reload();
  }

  nextCatalogPage(): void {
    if (this.catalogPage + 1 >= this.eventsTotalPages) {
      return;
    }
    this.catalogPage += 1;
    this.reload();
  }

  reload(silent = false): void {
    if (!silent) {
      this.loading = true;
      this.errorMessage = null;
    }

    const profile$ = this.session.getProfile()
      ? of(this.session.getProfile())
      : this.session.loadProfile();

    profile$.pipe(
      switchMap((profile) => this.reportsService.getEventsPanel(
        profile?.id,
        this.mode === 'manage' ? 'manage' : 'user',
        this.catalogPage,
        this.catalogPageSize,
        this.catalogQuery.trim() || undefined
      ))
    ).subscribe({
      next: (panel) => {
        const events = panel.events || [];
        const registrations = panel.registrations || [];
        const sports = panel.sports || [];
        this.events = events;
        this.registrations = registrations;
        this.sports = sports;
        this.eventsTotal = panel.eventsTotal ?? events.length;
        this.eventsTotalPages = Math.max(panel.eventsTotalPages ?? 1, 1);
        this.catalogPage = panel.eventsPage ?? this.catalogPage;
        this.attendanceCheckInMethod = normalizeAttendanceCheckInMethod(
          this.preferencesApi.cached?.attendanceCheckInMethod
        );
        if (sports.length && !this.form.value.sportId) {
          this.form.patchValue({ sportId: sports[0].id });
        }
        if (this.mode === 'user') {
          this.buildMyPasses();
          if (this.userView === 'history') {
            void this.refreshPassQrImages();
          }
        }
        if (this.canManage && this.mode === 'manage') {
          this.applyWaitlists(events, panel.waitlists || {});
        } else {
          this.loading = false;
        }
        this.ensureHighlightedEvent();
        this.scrollToHighlighted();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'No se pudieron cargar eventos.';
        this.loading = false;
      }
    });
  }

  createEvent(): void {
    this.errorMessage = null;
    this.successMessage = null;
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
      title: this.translate.instant('EVENTS_PAGE.CONFIRM_CREATE_TITLE'),
      message: this.translate.instant('EVENTS_PAGE.CONFIRM_CREATE_MSG', { name: this.form.value.name }),
      confirmLabel: this.translate.instant('COMMON.CONFIRM'),
      cancelLabel: this.translate.instant('COMMON.CANCEL')
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
          this.successMessage = null;
          this.errorMessage = null;
          this.form.patchValue({
            name: '',
            description: '',
            location: '',
            latitude: null,
            longitude: null
          });
          this.catalogPage = 0;
          this.creatingForm = false;
          this.reload();
          this.notifySuccess(
            'EVENTS_PAGE.SUCCESS_CREATE_TITLE',
            this.translate.instant('EVENTS_PAGE.SUCCESS_CREATE_MSG', { name: payload.name })
          );
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

  onCreatePlaceChange(place: EventPlaceLocation): void {
    this.form.patchValue({
      location: place.address,
      latitude: place.latitude,
      longitude: place.longitude
    });
  }

  onEditPlaceChange(row: EventManageRow, place: EventPlaceLocation): void {
    row.editForm?.patchValue({
      location: place.address,
      latitude: place.latitude,
      longitude: place.longitude
    });
  }

  startEdit(row: EventManageRow): void {
    row.actionsOpen = true;
    row.editing = true;
    if (!row.editForm) {
      row.editForm = this.buildEditForm(row.event);
    }
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
    if (!row.editForm || row.editForm.invalid) {
      row.editForm?.markAllAsTouched();
      return;
    }
    void this.confirmSaveEvent(row);
  }

  private async confirmSaveEvent(row: EventManageRow): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.translate.instant('EVENTS_PAGE.CONFIRM_SAVE_TITLE'),
      message: this.translate.instant('EVENTS_PAGE.CONFIRM_SAVE_MSG', { name: row.event.name }),
      confirmLabel: this.translate.instant('COMMON.CONFIRM'),
      cancelLabel: this.translate.instant('COMMON.CANCEL')
    });
    if (!ok) {
      return;
    }

    const form = row.editForm;
    if (!form) {
      return;
    }

    row.saving = true;
    const payload = {
      name: form.value.name,
      eventDate: form.value.eventDate,
      eventTime: form.value.eventTime,
      location: form.value.location,
      latitude: form.value.latitude,
      longitude: form.value.longitude,
      maxCapacity: Number(form.value.maxCapacity)
    };

    this.sportsService.updateEvent(row.event.id, payload).subscribe({
      next: () => {
        const updated: EventItem = {
          ...row.event,
          name: payload.name,
          eventDate: payload.eventDate,
          eventTime: payload.eventTime,
          location: payload.location,
          latitude: payload.latitude,
          longitude: payload.longitude,
          maxCapacity: payload.maxCapacity
        };
        row.event = updated;
        const idx = this.events.findIndex((item) => item.id === updated.id);
        if (idx >= 0) {
          this.events[idx] = updated;
        }
        row.saving = false;
        row.editing = false;
        this.successMessage = null;
        this.errorMessage = null;
        this.notifySuccess(
          'EVENTS_PAGE.SUCCESS_UPDATE_TITLE',
          this.translate.instant('EVENTS_PAGE.SUCCESS_UPDATE_MSG', { name: payload.name })
        );
      },
      error: (error) => {
        row.saving = false;
        this.successMessage = null;
        this.errorMessage = error?.error?.message || 'No se pudo actualizar el evento.';
      }
    });
  }

  cancelManagedEvent(event: EventItem): void {
    if (this.cancellingId) {
      return;
    }
    void this.confirmCancelEvent(event);
  }

  private async confirmCancelEvent(event: EventItem): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.translate.instant('EVENTS_PAGE.CONFIRM_CANCEL_EVENT_TITLE'),
      message: this.translate.instant('EVENTS_PAGE.CONFIRM_CANCEL_EVENT_MSG', { name: event.name }),
      confirmLabel: this.translate.instant('COMMON.CONFIRM'),
      cancelLabel: this.translate.instant('COMMON.CANCEL'),
      tone: 'danger'
    });
    if (!ok) {
      return;
    }

    this.cancellingId = event.id;
    this.sportsService.cancelEvent(event.id).subscribe({
      next: () => {
        this.cancellingId = null;
        this.successMessage = null;
        this.errorMessage = null;
        this.reload();
        this.notifySuccess(
          'EVENTS_PAGE.SUCCESS_CANCEL_EVENT_TITLE',
          this.translate.instant('EVENTS_PAGE.SUCCESS_CANCEL_EVENT_MSG', { name: event.name })
        );
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
      title: waitlist
        ? this.translate.instant('EVENTS_PAGE.CONFIRM_WAITLIST_TITLE')
        : this.translate.instant('EVENTS_PAGE.CONFIRM_REGISTER_TITLE'),
      message: this.translate.instant(
        waitlist ? 'EVENTS_PAGE.CONFIRM_WAITLIST_MSG' : 'EVENTS_PAGE.CONFIRM_REGISTER_MSG',
        { name: event.name }
      ),
      confirmLabel: this.translate.instant('COMMON.CONFIRM'),
      cancelLabel: this.translate.instant('COMMON.CANCEL')
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

      // RF55 / RF57: si el organizador configuró el evento como pago (según su plan
      // para la comisión), el atleta debe pagar desde la primera inscripción.
      // ink-ms-sports no conoce esPago (vive en ink-ms-subscriptions): hay que
      // preguntar ANTES de inscribir; si no, registerToEvent() deja al atleta gratis.
      this.paymentsService.obtenerConfiguracionEvento(event.id).subscribe({
        next: (config) => {
          if (config.esPago) {
            this.iniciarPagoInscripcion(event);
            return;
          }
          this.registrarSinCosto(event, userId);
        },
        error: (err) => {
          this.registeringId = null;
          const msg =
            err?.error?.message ||
            err?.error?.detail ||
            'No se pudo verificar si el evento requiere pago. Intenta de nuevo.';
          this.errorMessage = msg;
          void this.confirm.error({ title: 'No se pudo inscribir', message: msg });
        },
      });
    });
  }

  private registrarSinCosto(event: EventItem, userId: string): void {
    this.sportsService.registerToEvent(userId, event.id).subscribe({
      next: (registration) => {
        this.registeringId = null;
        this.successMessage = null;
        this.errorMessage = null;
        this.applyLocalRegistration(event, registration);
        this.unreadNotifications.refreshAfterAction();
        const onWaitlist = registration?.waitlistPosition != null;
        this.notifySuccess(
          onWaitlist ? 'EVENTS_PAGE.SUCCESS_WAITLIST_TITLE' : 'EVENTS_PAGE.SUCCESS_REGISTER_TITLE',
          registration?.message || this.translate.instant(
            onWaitlist ? 'EVENTS_PAGE.SUCCESS_WAITLIST_MSG' : 'EVENTS_PAGE.SUCCESS_REGISTER_MSG',
            { name: event.name, position: registration?.waitlistPosition }
          )
        );
      },
      error: (error) => {
        // Defensa adicional: si el backend llega a rechazar la inscripción gratuita
        // (p. ej. la config de pago se creó justo después de consultarla arriba),
        // se cae igual al flujo de pago en vez de mostrar solo un error.
        if (this.isPaidEventRequired(error)) {
          this.iniciarPagoInscripcion(event);
          return;
        }
        this.registeringId = null;
        const msg = error?.error?.message || 'No se pudo inscribir.';
        this.errorMessage = msg;
        void this.confirm.error({
          title: 'No se pudo inscribir',
          message: msg,
        });
      }
    });
  }

  private iniciarPagoInscripcion(event: EventItem): void {
    this.registeringId = null;
    void this.confirm
      .info({
        title: this.translate.instant('EVENTS_PAGE.CONFIRM_REGISTER_TITLE'),
        message:
          `“${event.name}” requiere pago de inscripción. ` +
          'Te llevamos al panel para revisar el monto y pagar con Mercado Pago.',
        confirmLabel: 'Continuar al pago',
        kindLabel: 'Pago requerido',
      })
      .then(() => {
        void this.router.navigate(['/home/eventos', event.id, 'pago']);
      });
  }

  private isPaidEventRequired(error: { error?: { message?: string; detail?: string } } | null): boolean {
    const msg = String(error?.error?.message || error?.error?.detail || '').toLowerCase();
    return msg.includes('pago') || msg.includes('checkout');
  }

  private applyLocalRegistration(event: EventItem, registration: Registration | null | undefined): void {
    if (!registration) {
      return;
    }
    const already = this.registrations.some((reg) => reg.id === registration.id);
    if (!already) {
      this.registrations = [...this.registrations, registration];
    }
    const target = this.events.find((item) => item.id === event.id);
    if (target && registration.waitlistPosition == null && target.availableCapacity != null) {
      target.availableCapacity = Math.max(0, target.availableCapacity - 1);
    }
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
    if (this.isRegistered(eventId) || this.isOnWaitlist(eventId)) {
      return false;
    }
    const event = this.events.find((item) => item.id === eventId);
    const status = (event?.status || '').toLowerCase();
    return status !== 'cancelled' && status !== 'finished';
  }

  catalogJoinLabel(event: EventItem): string {
    if (this.registeringId === event.id) {
      return (event.availableCapacity ?? 0) <= 0 ? 'Uniendo a espera...' : 'Inscribiendo...';
    }
    return (event.availableCapacity ?? 0) <= 0 ? 'Unirme a lista de espera' : 'Inscribirse';
  }

  get historyRegistrations(): Registration[] {
    return [...this.registrations]
      .filter((reg) => {
        const event = this.events.find((item) => item.id === reg.eventId);
        return !event || isEventVisible(event, this.nowMs);
      })
      .sort((a, b) => {
      const aKey = `${a.eventDate || a.registrationDate || ''}T${a.eventTime || '00:00:00'}`;
      const bKey = `${b.eventDate || b.registrationDate || ''}T${b.eventTime || '00:00:00'}`;
      return bKey.localeCompare(aKey);
    });
  }

  get nextRegisteredEvent(): EventItem | null {
    const registeredIds = new Set(
      this.registrations
        .filter((reg) => reg.waitlistPosition == null)
        .map((reg) => reg.eventId)
    );
    const upcoming = [...this.events]
      .filter((event) => {
        const status = (event.status || '').toLowerCase();
        if (status === 'cancelled' || status === 'finished') {
          return false;
        }
        const when = eventDateTimeMs(event.eventDate, event.eventTime);
        return when == null || when >= this.nowMs;
      })
      .sort((a, b) => {
        const aMs = eventDateTimeMs(a.eventDate, a.eventTime) ?? Number.MAX_SAFE_INTEGER;
        const bMs = eventDateTimeMs(b.eventDate, b.eventTime) ?? Number.MAX_SAFE_INTEGER;
        return aMs - bMs;
      });
    return upcoming.find((event) => registeredIds.has(event.id)) || null;
  }

  get nextPass(): MyPassRow | null {
    const nextId = this.nextRegisteredEvent?.id;
    if (!nextId) {
      return null;
    }
    return this.myPasses.find((pass) => pass.registration.eventId === nextId) || null;
  }

  get otherHistoryRegistrations(): Registration[] {
    const nextId = this.nextRegisteredEvent?.id;
    return this.historyRegistrations.filter((reg) => reg.eventId !== nextId);
  }

  get recentHistoryPreview(): Registration[] {
    return this.otherHistoryRegistrations.slice(0, 3);
  }

  get upcomingPassList(): MyPassRow[] {
    const nextId = this.nextRegisteredEvent?.id;
    return this.myPasses.filter((pass) => {
      if (pass.registration.attended || pass.registration.eventId === nextId) {
        return false;
      }
      return this.canShowPassQr(pass);
    });
  }

  get confirmedHistoryCount(): number {
    return this.registrations.filter((reg) => reg.waitlistPosition == null).length;
  }

  get attendedHistoryCount(): number {
    return this.registrations.filter((reg) => reg.waitlistPosition == null && reg.attended).length;
  }

  get waitlistHistoryCount(): number {
    return this.registrations.filter((reg) => reg.waitlistPosition != null).length;
  }

  get attendanceHistoryProgress(): number {
    if (!this.confirmedHistoryCount) {
      return 0;
    }
    return Math.round((this.attendedHistoryCount * 100) / this.confirmedHistoryCount);
  }

  get upcomingRegisteredCount(): number {
    const ids = new Set(
      this.registrations
        .filter((reg) => reg.waitlistPosition == null && !reg.attended)
        .map((reg) => reg.eventId)
    );
    return this.events.filter((event) => {
      if (!ids.has(event.id)) {
        return false;
      }
      const status = (event.status || '').toLowerCase();
      if (status === 'cancelled' || status === 'finished') {
        return false;
      }
      const when = eventDateTimeMs(event.eventDate, event.eventTime);
      return when == null || when >= this.nowMs;
    }).length;
  }

  eventForRegistration(reg: Registration): EventItem | null {
    return this.events.find((item) => item.id === reg.eventId)
      || this.eventFromRegistration(reg);
  }

  historyEventImage(reg: Registration): string {
    const event = this.eventForRegistration(reg);
    return event ? this.eventImage(event) : resolveEventImage({});
  }

  historyDateLabel(reg: Registration): string {
    if (reg.eventDate) {
      return this.eventWhenLabel({ eventDate: reg.eventDate, eventTime: reg.eventTime });
    }
    return this.formatEventDate(reg.registrationDate);
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
      title: onWaitlist
        ? this.translate.instant('EVENTS_PAGE.CONFIRM_LEAVE_WAITLIST_TITLE')
        : this.translate.instant('EVENTS_PAGE.CONFIRM_CANCEL_REG_TITLE'),
      message: this.translate.instant(
        onWaitlist ? 'EVENTS_PAGE.CONFIRM_LEAVE_WAITLIST_MSG' : 'EVENTS_PAGE.CONFIRM_CANCEL_REG_MSG',
        { name: eventName }
      ),
      confirmLabel: this.translate.instant('COMMON.CONFIRM'),
      cancelLabel: this.translate.instant('COMMON.CANCEL'),
      tone: 'danger'
    });
    if (!ok) {
      return;
    }

    this.cancellingRegistrationId = registration.id;
    this.sportsService.cancelRegistration(registration.id).subscribe({
      next: () => {
        this.cancellingRegistrationId = null;
        this.successMessage = null;
        this.errorMessage = null;
        this.reload();
        this.unreadNotifications.refreshAfterAction();
        this.notifySuccess(
          onWaitlist ? 'EVENTS_PAGE.SUCCESS_LEAVE_WAITLIST_TITLE' : 'EVENTS_PAGE.SUCCESS_CANCEL_REG_TITLE',
          this.translate.instant(
            onWaitlist ? 'EVENTS_PAGE.SUCCESS_LEAVE_WAITLIST_MSG' : 'EVENTS_PAGE.SUCCESS_CANCEL_REG_MSG',
            { name: eventName }
          )
        );
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

  canFillAttendanceFor(reg: Registration): boolean {
    const event = this.eventForRegistration(reg);
    return !!event && this.canFillAttendance(event);
  }

  openAttendanceFor(reg: Registration): void {
    const event = this.eventForRegistration(reg);
    if (event) {
      this.openMyAttendance(event);
    }
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

  initials(name?: string | null): string {
    return userInitials(name);
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (!document.hidden && this.mode === 'manage') {
      this.refreshOccupancy();
    }
  }

  private startOccupancyWatch(): void {
    this.stopOccupancyWatch();
    if (this.mode !== 'manage') {
      return;
    }
    this.occupancyTimer = setInterval(() => this.refreshOccupancy(), 3000);
    this.refreshOccupancy();
  }

  private stopOccupancyWatch(): void {
    if (this.occupancyTimer) {
      clearInterval(this.occupancyTimer);
      this.occupancyTimer = null;
    }
    this.occupancySub?.unsubscribe();
    this.occupancySub = null;
  }

  private refreshOccupancy(): void {
    if (this.mode !== 'manage' || document.hidden || this.occupancySub) {
      return;
    }
    this.occupancySub = this.reportsService.getEventsPanel(
      this.session.getProfile()?.id,
      'manage',
      this.catalogPage,
      this.catalogPageSize,
      this.catalogQuery.trim() || undefined
    ).subscribe({
      next: (panel) => {
        this.occupancySub = null;
        this.applyOccupancy(panel.events || []);
      },
      error: () => {
        this.occupancySub = null;
      }
    });
  }

  private applyOccupancy(fresh: EventItem[]): void {
    if (!fresh.length) {
      return;
    }
    const byId = new Map(fresh.map((event) => [event.id, event]));
    for (const event of this.events) {
      const next = byId.get(event.id);
      if (!next) {
        continue;
      }
      event.availableCapacity = next.availableCapacity;
      event.maxCapacity = next.maxCapacity;
      event.status = next.status;
    }
    for (const row of this.manageRows) {
      const next = byId.get(row.event.id);
      if (!next) {
        continue;
      }
      row.event.availableCapacity = next.availableCapacity;
      row.event.maxCapacity = next.maxCapacity;
      row.event.status = next.status;
    }
  }

  toggleActions(row: EventManageRow, event?: Event): void {
    event?.stopPropagation();
    const open = !row.actionsOpen;
    for (const item of this.manageRows) {
      if (item !== row) {
        item.actionsOpen = false;
      }
    }
    row.actionsOpen = open;
  }

  @HostListener('document:click')
  closeActionMenus(): void {
    for (const row of this.manageRows) {
      if (row.actionsOpen && !row.editing && !row.showWaitlist) {
        row.actionsOpen = false;
      }
    }
  }

  toggleWaitlist(row: EventManageRow): void {
    row.actionsOpen = true;
    row.showWaitlist = !row.showWaitlist;
    if (!row.showWaitlist || row.waitlistLoaded || row.waitlistLoading) {
      return;
    }
    row.waitlistLoading = true;
    this.sportsService.getEventWaitlist(row.event.id).subscribe({
      next: (waitlist) => {
        row.waitlist = waitlist;
        row.waitlistLoaded = true;
        row.waitlistLoading = false;
      },
      error: () => {
        row.waitlistLoading = false;
        this.errorMessage = 'No se pudo cargar la lista de espera.';
      }
    });
  }

  occupied(event: CapacityEvent): number {
    if (!event) {
      return 0;
    }
    const max = event.maxCapacity || 0;
    return Math.max(max - (event.availableCapacity ?? max), 0);
  }

  spotsLeft(event: CapacityEvent): number {
    if (!event) {
      return 0;
    }
    if (event.availableCapacity != null) {
      return Math.max(event.availableCapacity, 0);
    }
    return Math.max((event.maxCapacity || 0) - this.occupied(event), 0);
  }

  occupancyPercent(event: CapacityEvent): number {
    const max = event?.maxCapacity || 0;
    if (!max) {
      return 0;
    }
    return Math.min(100, Math.round((this.occupied(event) * 100) / max));
  }

  occupancyTone(event: CapacityEvent): 'ok' | 'warn' | 'full' {
    if (this.spotsLeft(event) <= 0 && (event?.maxCapacity || 0) > 0) {
      return 'full';
    }
    const percent = this.occupancyPercent(event);
    if (percent >= 75) {
      return 'warn';
    }
    return 'ok';
  }

  spotsHint(event: CapacityEvent): string {
    if (this.occupancyTone(event) === 'full') {
      return this.translate.instant('EVENTS_PAGE.SPOTS_FULL');
    }
    return this.translate.instant('EVENTS_PAGE.SPOTS_LEFT', { count: this.spotsLeft(event) });
  }

  formatEventDate(value?: string | null): string {
    const date = this.parseLocalDate(value);
    if (!date) {
      return value || this.translate.instant('EVENTS_PAGE.NO_DATE');
    }
    const today = this.startOfLocalDay(new Date());
    const target = this.startOfLocalDay(date);
    const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
    if (diffDays === 0) {
      return this.translate.instant('EVENTS_PAGE.DATE_TODAY');
    }
    if (diffDays === 1) {
      return this.translate.instant('EVENTS_PAGE.DATE_TOMORROW');
    }
    const locale = this.language.currentLang === 'en' ? 'en-US' : 'es-MX';
    return date.toLocaleDateString(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  formatEventTime(value?: string | null): string {
    if (!value) {
      return '';
    }
    return value.length >= 5 ? value.slice(0, 5) : value;
  }

  eventWhenLabel(event: { eventDate?: string | null; eventTime?: string | null } | null | undefined): string {
    if (!event) {
      return this.translate.instant('EVENTS_PAGE.NO_DATE');
    }
    const date = this.formatEventDate(event.eventDate);
    const time = this.formatEventTime(event.eventTime);
    return time ? `${date} · ${time}` : date;
  }

  eventHasStarted(event: EventItem | null | undefined): boolean {
    if (!event?.eventDate) {
      return false;
    }
    const start = this.eventStartMs(event);
    return start != null && this.nowMs >= start;
  }

  canShowEventQr(event: EventItem | null | undefined): boolean {
    if (!event || this.hasAttended(event.id) || !this.eventHasStarted(event)) {
      return false;
    }
    return this.isRegistered(event.id) && !!this.nextPass;
  }

  canShowPassQr(pass: MyPassRow): boolean {
    if (!pass?.event || pass.registration.attended || pass.registration.waitlistPosition != null) {
      return false;
    }
    return this.eventHasStarted(pass.event);
  }

  eventStartLabel(event: EventItem | null | undefined): string {
    if (!event) {
      return this.translate.instant('EVENTS_PAGE.EVENT_TIME_FALLBACK');
    }
    return this.eventWhenLabel(event);
  }

  openCheckIn(event: EventItem): void {
    if (!this.eventHasStarted(event)) {
      this.errorMessage = `El check-in se habilita a partir de ${this.eventStartLabel(event)}.`;
      return;
    }
    this.checkInEvent = event;
    this.checkInOpen = true;
    this.manualQrCode = '';
    this.checkInNotes = '';
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
    this.checkInNotes = '';
    void this.stopScanner();
  }

  async startScanner(): Promise<void> {
    this.scannerError = null;
    try {
      await this.stopScanner();
      this.html5Qr = new (await import('html5-qrcode')).Html5Qrcode(this.scannerElementId);
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
      const { Html5Qrcode } = await import('html5-qrcode');
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
    this.reportEventId = event.id;
    this.attendanceReport = null;
    this.reportError = null;
    this.reportLoading = true;
    this.fetchAttendanceReport(event.id, false);
    this.startReportPoll();
  }

  closeAttendanceReport(): void {
    this.reportOpen = false;
    this.reportEventId = null;
    this.attendanceReport = null;
    this.reportError = null;
    this.stopReportPoll();
  }

  printAttendanceReport(): void {
    window.print();
  }

  exportAttendanceCsv(): void {
    const report = this.attendanceReport;
    if (!report) {
      return;
    }

    const header = ['Evento', 'Estado', 'Nombre', 'Email', 'CheckIn', 'Metodo', 'Comentario'];
    const attendedRows = (report.attendees || []).map((row) => [
      report.eventName || report.eventId,
      'ASISTIO',
      row.fullName || '',
      row.email || '',
      row.checkInTime || '',
      row.checkInMethod || '',
      row.notes || ''
    ]);
    const absentRows = (report.absentees || []).map((row) => [
      report.eventName || report.eventId,
      'AUSENTE',
      row.fullName || '',
      row.email || '',
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
    this.sportsService.markAttendanceByQr(qrCode, verifiedBy, this.checkInNotes).subscribe({
      next: (response) => {
        this.checkInBusy = false;
        this.checkInMessage = response?.message || this.translate.instant('EVENTS_PAGE.SUCCESS_CHECKIN_MSG');
        this.manualQrCode = '';
        this.checkInNotes = '';
        this.unreadNotifications.refreshAfterAction();
        this.liveSync.emitAttendance(this.checkInEvent?.id, 'attendance_checkin');
        if (this.reportOpen && this.reportEventId) {
          this.fetchAttendanceReport(this.reportEventId, true);
        }
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
        event: this.events.find((event) => event.id === registration.eventId)
          || this.eventFromRegistration(registration),
        qrDataUrl: null,
        loadingQr: false
      }));
  }

  private eventFromRegistration(reg: Registration): EventItem | null {
    if (!reg.eventId) {
      return null;
    }
    return {
      id: reg.eventId,
      sportId: 0,
      name: reg.eventName || 'Evento',
      eventDate: reg.eventDate || '',
      eventTime: reg.eventTime || '',
      maxCapacity: 0,
      status: reg.eventStatus
    };
  }

  private ensureHighlightedEvent(): void {
    const id = this.highlightedEventId;
    if (!id || this.events.some((event) => event.id === id)) {
      return;
    }
    this.sportsService.getEvent(id).subscribe({
      next: (event) => {
        if (!event?.id || this.events.some((item) => item.id === event.id)) {
          return;
        }
        this.events = [event, ...this.events];
        if (this.mode === 'manage') {
          this.applyWaitlists(this.events, {});
        }
        this.scrollToHighlighted();
      }
    });
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
    const ready = !!code && !pass.registration.attended && this.eventHasStarted(pass.event);
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
      const { default: QRCode } = await import('qrcode');
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

  private fetchAttendanceReport(eventId: string, silent: boolean): void {
    if (!silent) {
      this.reportLoading = true;
      this.reportError = null;
    }
    this.sportsService.getAttendanceReport(eventId).subscribe({
      next: (report) => {
        this.attendanceReport = report;
        this.reportLoading = false;
      },
      error: (error) => {
        if (!silent) {
          this.reportLoading = false;
          this.reportError = error?.error?.message || 'No se pudo cargar el reporte de asistencia.';
        }
      }
    });
  }

  private startReportPoll(): void {
    this.stopReportPoll();
    this.reportPoll = setInterval(() => {
      if (this.reportOpen && this.reportEventId) {
        this.fetchAttendanceReport(this.reportEventId, true);
      }
    }, 15000);
  }

  private stopReportPoll(): void {
    if (this.reportPoll) {
      clearInterval(this.reportPoll);
      this.reportPoll = null;
    }
  }

  private applyWaitlists(events: EventItem[], waitlists: Record<string, Registration[]>): void {
    const prev = new Map(this.manageRows.map((row) => [row.event.id, row]));
    this.manageRows = events.map((event) => {
      const existing = prev.get(event.id);
      return {
        event,
        waitlist: existing?.waitlistLoaded ? existing.waitlist : (waitlists[event.id] || []),
        waitlistLoaded: existing?.waitlistLoaded || false,
        waitlistLoading: false,
        showWaitlist: existing?.showWaitlist || false,
        editing: existing?.editing || false,
        editForm: existing?.editForm || null,
        saving: existing?.saving || false,
        actionsOpen: existing?.actionsOpen || false
      };
    });
    this.loading = false;
  }

  private notifySuccess(titleKey: string, message: string): void {
    void this.confirm.ack({
      title: this.translate.instant(titleKey),
      message,
      confirmLabel: this.translate.instant('COMMON.GOT_IT')
    });
  }

  private parseLocalDate(value?: string | null): Date | null {
    if (!value) {
      return null;
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
    if (match) {
      const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private startOfLocalDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
}
