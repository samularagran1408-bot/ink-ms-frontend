import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { EventItem, Registration, Routine, RoutineRegistration, Sport, Disability, SportDisability, CalendarEvent } from '../../../../core/models/sports';
import { SessionService } from '../../../../core/services/session.service';
import { SportsService } from '../../../../core/services/sports.service';
import { ReportsService } from '../../../../core/services/reports.service';
import { LanguageService } from '../../../../core/services/language.service';
import { UnreadNotificationsService } from '../../../../core/services/unread-notifications.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { AssistantUiService } from '../../../../core/services/assistant-ui.service';
import { CompetitionProgressService } from '../../../../core/services/competition-progress.service';
import { CompetitionModeState } from '../../../../core/models/competition';
import { resolveEventImage } from '../../../../core/utils/event-image.util';
import { eventDateTimeMs } from '../../../../core/utils/qr-attendance.util';

type CatalogFilter = 'all' | 'sports' | 'disabilities' | 'associations' | 'routines';

@Component({
  selector: 'app-user-interface',
  templateUrl: './user-interface.component.html',
  styleUrl: './user-interface.component.scss'
})
export class UserInterfaceComponent implements OnInit, OnDestroy {
  loading = true;
  errorMessage: string | null = null;
  events: EventItem[] = [];
  allEvents: EventItem[] = [];
  registrations: Registration[] = [];
  routines: Routine[] = [];
  routineRegistrations: RoutineRegistration[] = [];
  registeringRoutineId: string | null = null;
  loggingSessionRoutineId: string | null = null;
  nextEvent: EventItem | null = null;
  unreadCount = 0;
  registeringId: string | null = null;
  cancellingRegistrationId: string | null = null;
  successMessage: string | null = null;
  calendarMonthLabel = '';
  calendarCells: { day: number | null; muted: boolean; selected: boolean; hasEvent: boolean }[] = [];
  competition: CompetitionModeState | null = null;

  catalogQuery = '';
  catalogFilter: CatalogFilter = 'all';
  sports: Sport[] = [];
  disabilities: Disability[] = [];
  associations: SportDisability[] = [];
  calendarFrom = '';
  calendarTo = '';
  calendarItems: CalendarEvent[] = [];
  calendarLoaded = false;
  selectedCalendarDate: string | null = null;
  private calendarYear = 0;
  private calendarMonth = 0;
  private sportsLoaded = false;
  private disabilitiesLoaded = false;
  private associationsLoaded = false;
  private routinesLoaded = false;

  private langSub: Subscription | null = null;
  private competitionSub: Subscription | null = null;
  private unreadSub: Subscription | null = null;

  constructor(
    private session: SessionService,
    private sportsService: SportsService,
    private reportsService: ReportsService,
    private router: Router,
    private translate: TranslateService,
    private languageService: LanguageService,
    private unreadNotifications: UnreadNotificationsService,
    private confirm: ConfirmDialogService,
    private competitionProgress: CompetitionProgressService,
    private assistantUi: AssistantUiService
  ) {}

  ngOnInit(): void {
    this.unreadSub = this.unreadNotifications.count$.subscribe((count) => {
      this.unreadCount = count;
    });
    this.competitionSub = this.competitionProgress.state$.subscribe((state) => {
      this.competition = state;
    });
    this.buildCalendar(new Date());
    this.langSub = this.translate.onLangChange.subscribe(() => this.buildCalendar(new Date()));
    this.loadHomeData();
  }

  private loadHomeData(): void {
    this.loading = true;
    const profile$ = this.session.getProfile()
      ? of(this.session.getProfile())
      : this.session.loadProfile();

    profile$.subscribe((profile) => {
      this.reportsService.getHomePanel(profile?.id).subscribe({
        next: (panel) => {
          const events = panel.events || [];
          const registrations = panel.registrations || [];
          this.allEvents = this.sortEvents(events);
          this.events = this.resolveFeaturedEvents(this.allEvents, registrations);
          this.registrations = this.sortRegistrations(registrations);
          this.nextEvent = this.resolveNextEvent(events, registrations);
          this.applyEventsToCalendar(this.allEvents);
          this.sports = panel.sports || [];
          this.disabilities = panel.disabilities || [];
          this.associations = panel.associations || [];
          this.routines = panel.routines || [];
          this.routineRegistrations = panel.routineRegistrations || [];
          this.sportsLoaded = true;
          this.disabilitiesLoaded = true;
          this.associationsLoaded = true;
          this.routinesLoaded = true;
          this.loading = false;
        },
        error: () => {
          this.errorMessage = this.translate.instant('HOME.LOAD_ERROR');
          this.loading = false;
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
    this.competitionSub?.unsubscribe();
    this.unreadSub?.unsubscribe();
  }

  get catalogEventCount(): number {
    return this.allEvents.length;
  }

  get confirmedCount(): number {
    return this.confirmedRegistrations.length;
  }

  get confirmedRegistrations(): Registration[] {
    return this.registrations.filter((reg) => reg.waitlistPosition == null);
  }

  get waitlistRegistrations(): Registration[] {
    return this.registrations.filter((reg) => reg.waitlistPosition != null);
  }

  get attendedCount(): number {
    return this.confirmedRegistrations.filter((reg) => !!reg.attended).length;
  }

  get attendanceProgress(): number {
    if (!this.confirmedCount) {
      return 0;
    }
    return Math.round((this.attendedCount * 100) / this.confirmedCount);
  }

  get competitionActive(): boolean {
    return !!this.competition?.activo;
  }

  get competitionObjective(): string {
    return (this.competition?.objetivo || '').trim();
  }

  get competitionPlanPct(): number {
    const value = Number(this.competition?.plan_pct || 0);
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  get competitionWeekLabel(): string {
    const current = Number(this.competition?.semana_actual || 0);
    const total = Number(this.competition?.semanas || 0);
    if (!current || !total) {
      return '';
    }
    return this.translate.instant('HOME.COMPETE_WEEK', { current, total });
  }

  get competitionMixLabel(): string {
    const checkHechos = Number(this.competition?.checklist_hechos || 0);
    const checkTotal = Number(this.competition?.checklist_total || 0);
    const sesHechas = Number(this.competition?.sesiones_hechas || 0);
    const sesObj = Number(this.competition?.sesiones_objetivo || 0);
    if (!checkTotal && !sesObj) {
      return '';
    }
    return this.translate.instant('HOME.COMPETE_MIX', {
      list: `${checkHechos}/${checkTotal || 0}`,
      sessions: `${sesHechas}/${sesObj || 0}`
    });
  }

  get competitionEventTitle(): string {
    const evento = this.competition?.evento_objetivo;
    if (!evento || typeof evento !== 'object') {
      return '';
    }
    const row = evento as { titulo?: string };
    return (row.titulo || '').trim();
  }

  openCompetition(): void {
    this.competitionProgress.refresh().subscribe(() => {
      this.assistantUi.open('competencia');
    });
  }

  get myRoutines(): { registration: RoutineRegistration; routine: Routine | null }[] {
    return this.routineRegistrations.map((registration) => ({
      registration,
      routine: this.routines.find((routine) => routine.id === registration.routineId) || null
    }));
  }

  get availableRoutines(): Routine[] {
    const enrolledIds = new Set(this.routineRegistrations.map((reg) => reg.routineId));
    return this.routines.filter((routine) => !enrolledIds.has(routine.id));
  }

  routineName(routineId: string): string {
    return this.routines.find((routine) => routine.id === routineId)?.name || this.translate.instant('HOME.ROUTINE_FALLBACK');
  }

  eventStatusLabel(reg: Registration): string {
    if (reg.waitlistPosition != null) {
      return this.translate.instant('HOME.WAITLIST');
    }
    if (reg.attended) {
      return this.translate.instant('HOME.ATTENDED');
    }
    return this.translate.instant('HOME.REGISTERED_STATUS');
  }

  onRegisterRoutine(routine: Routine): void {
    void this.confirmJoinRoutine(routine);
  }

  onLogJoinedRoutine(routine: Routine): void {
    void this.confirmLogRoutineSession(routine.id, routine.name, false);
  }

  onLogRoutineSession(item: { registration: RoutineRegistration; routine: Routine | null }): void {
    const name = item.routine?.name || this.routineName(item.registration.routineId);
    void this.confirmLogRoutineSession(item.registration.routineId, name, false);
  }

  private async confirmLogRoutineSession(
    routineId: string,
    name: string,
    afterJoin: boolean
  ): Promise<void> {
    if (!routineId) {
      return;
    }
    if (!this.competitionActive) {
      this.errorMessage = this.translate.instant('HOME.SESSION_NEEDS_COMPETE');
      this.successMessage = null;
      this.openCompetition();
      return;
    }
    const ok = await this.confirm.ask({
      title: this.translate.instant('HOME.LOG_SESSION'),
      message: this.translate.instant(
        afterJoin ? 'HOME.CONFIRM_FIRST_SESSION' : 'HOME.CONFIRM_LOG_SESSION',
        { name }
      ),
      confirmLabel: this.translate.instant('COMMON.CONFIRM'),
      cancelLabel: this.translate.instant('COMMON.CANCEL')
    });
    if (!ok) {
      return;
    }
    this.loggingSessionRoutineId = routineId;
    this.competitionProgress.registrarSesion(routineId).subscribe({
      next: () => {
        this.loggingSessionRoutineId = null;
        this.successMessage = this.translate.instant('HOME.SESSION_LOGGED');
        this.errorMessage = null;
      },
      error: (error) => {
        this.loggingSessionRoutineId = null;
        this.errorMessage = error?.error?.detail || this.translate.instant('HOME.SESSION_LOG_ERROR');
      }
    });
  }

  private async confirmJoinRoutine(routine: Routine): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.translate.instant('HOME.JOIN_ROUTINE'),
      message: this.translate.instant('HOME.CONFIRM_JOIN_ROUTINE', { name: routine.name }),
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
        this.errorMessage = this.translate.instant('HOME.NO_PROFILE');
        return;
      }

      this.registeringRoutineId = routine.id;
      this.sportsService.registerToRoutine(userId, routine.id).subscribe({
        next: () => {
          this.registeringRoutineId = null;
          this.errorMessage = null;
          this.successMessage = this.translate.instant('HOME.JOINED_ROUTINE_OK', { name: routine.name });
          this.refreshRoutineMembership();
          if (this.competitionActive) {
            void this.confirmLogRoutineSession(routine.id, routine.name, true);
          }
        },
        error: (error) => {
          this.registeringRoutineId = null;
          this.errorMessage = error?.error?.message || this.translate.instant('HOME.JOIN_ERROR');
        }
      });
    });
  }

  private refreshRoutineMembership(): void {
    const userId = this.session.getProfile()?.id;
    if (!userId) {
      this.loadHomeData();
      return;
    }
    this.reportsService.getHomePanel(userId).subscribe({
      next: (panel) => {
        this.routines = panel.routines || [];
        this.routineRegistrations = panel.routineRegistrations || [];
        this.routinesLoaded = true;
      },
      error: () => this.loadHomeData()
    });
  }

  onSeeAllEvents(): void {
    this.router.navigate(['/home/events']);
  }

  onSeeHistory(): void {
    this.router.navigate(['/home/events'], { queryParams: { vista: 'historial' } });
  }

  onRegisterEvent(event: EventItem): void {
    void this.confirmRegisterEvent(event);
  }

  private async confirmRegisterEvent(event: EventItem): Promise<void> {
    const waitlist = (event.availableCapacity ?? 0) <= 0;
    const ok = await this.confirm.ask({
      title: waitlist
        ? this.translate.instant('HOME.JOIN_WAITLIST')
        : this.translate.instant('HOME.REGISTER'),
      message: this.translate.instant(
        waitlist ? 'HOME.CONFIRM_JOIN_WAITLIST' : 'HOME.CONFIRM_REGISTER_EVENT',
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
        this.errorMessage = this.translate.instant('HOME.NO_PROFILE');
        return;
      }

      this.registeringId = event.id;
      this.sportsService.registerToEvent(userId, event.id).subscribe({
        next: () => {
          this.registeringId = null;
          this.errorMessage = null;
          this.loadHomeData();
        },
        error: (error) => {
          this.registeringId = null;
          this.errorMessage = error?.error?.message || this.translate.instant('HOME.REGISTER_ERROR');
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
    if (this.isRegistered(eventId) || this.isOnWaitlist(eventId)) {
      return false;
    }
    const event = this.allEvents.find((item) => item.id === eventId) || this.events.find((item) => item.id === eventId);
    const status = (event?.status || '').toLowerCase();
    return status !== 'cancelled' && status !== 'finished';
  }

  anyRegistrationFor(eventId: string): Registration | null {
    return this.registrations.find((reg) => reg.eventId === eventId) || null;
  }

  canCancelEventRegistration(event: EventItem): boolean {
    return this.canCancelRegistration(this.anyRegistrationFor(event.id), event);
  }

  canCancelRegistration(reg: Registration | null | undefined, event?: EventItem | null): boolean {
    if (!reg?.id || reg.attended) {
      return false;
    }
    const status = event?.status || reg.eventStatus;
    return status !== 'finished' && status !== 'cancelled';
  }

  onCancelRegistration(event: EventItem): void {
    const registration = this.anyRegistrationFor(event.id);
    if (!registration) {
      return;
    }
    void this.confirmCancelRegistration(registration, event.name, event);
  }

  onCancelRegistrationRecord(reg: Registration): void {
    const event = this.allEvents.find((item) => item.id === reg.eventId)
      || this.events.find((item) => item.id === reg.eventId)
      || null;
    void this.confirmCancelRegistration(reg, reg.eventName || event?.name || this.translate.instant('HOME.EVENT_FALLBACK'), event);
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
        ? this.translate.instant('HOME.LEAVE_WAITLIST')
        : this.translate.instant('HOME.CANCEL_REGISTRATION'),
      message: this.translate.instant(
        onWaitlist ? 'HOME.CONFIRM_LEAVE_WAITLIST' : 'HOME.CONFIRM_CANCEL_REGISTRATION',
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
        this.errorMessage = null;
        this.successMessage = this.translate.instant(
          onWaitlist ? 'HOME.LEAVE_WAITLIST_OK' : 'HOME.CANCEL_REGISTRATION_OK',
          { name: eventName }
        );
        this.loadHomeData();
      },
      error: (error) => {
        this.cancellingRegistrationId = null;
        this.successMessage = null;
        this.errorMessage = error?.error?.message || this.translate.instant('HOME.CANCEL_REGISTRATION_ERROR');
      }
    });
  }

  cancelLabel(event: EventItem): string {
    if (this.cancellingRegistrationId === this.anyRegistrationFor(event.id)?.id) {
      return '...';
    }
    return this.isOnWaitlist(event.id)
      ? this.translate.instant('HOME.LEAVE_WAITLIST')
      : this.translate.instant('HOME.CANCEL_REGISTRATION');
  }

  joinLabel(event: EventItem): string {
    if (this.registeringId === event.id) {
      return '...';
    }
    return (event.availableCapacity ?? 0) <= 0
      ? this.translate.instant('HOME.JOIN_WAITLIST')
      : this.translate.instant('HOME.REGISTER');
  }

  historyDate(reg: Registration): string {
    if (reg.eventDate) {
      return this.formatDate(reg.eventDate);
    }
    return this.formatDate(reg.registrationDate);
  }

  hasAttended(eventId: string): boolean {
    return !!this.registrations.find((reg) => reg.eventId === eventId && reg.waitlistPosition == null)?.attended;
  }

  canFillAttendance(event: EventItem): boolean {
    if (!this.isRegistered(event.id) || this.hasAttended(event.id) || !event.eventDate) {
      return false;
    }
    const time = ((event.eventTime || '00:00:00').trim()).substring(0, 8);
    const normalized = time.length === 5 ? `${time}:00` : time;
    const start = Date.parse(`${event.eventDate}T${normalized}`);
    return !Number.isNaN(start) && Date.now() >= start;
  }

  eventImage(event: EventItem): string {
    return resolveEventImage(event);
  }

  occupied(event: { maxCapacity?: number | null; availableCapacity?: number | null } | null | undefined): number {
    if (!event) {
      return 0;
    }
    const max = event.maxCapacity || 0;
    return Math.max(max - (event.availableCapacity ?? max), 0);
  }

  setCatalogFilter(filter: CatalogFilter): void {
    this.catalogFilter = filter;
  }

  onCatalogQueryChange(): void {
    return;
  }

  get showSports(): boolean {
    return this.catalogFilter === 'all' || this.catalogFilter === 'sports';
  }

  get showDisabilities(): boolean {
    return this.catalogFilter === 'all' || this.catalogFilter === 'disabilities';
  }

  get showAssociations(): boolean {
    return this.catalogFilter === 'all' || this.catalogFilter === 'associations';
  }

  get showRoutinesCatalog(): boolean {
    return this.catalogFilter === 'all' || this.catalogFilter === 'routines';
  }

  get filteredSports(): Sport[] {
    return this.sports.filter((sport) => this.matchesQuery(sport.name, sport.description, sport.difficulty, String(sport.id)));
  }

  get filteredDisabilities(): Disability[] {
    return this.disabilities.filter((item) =>
      item.isActive !== false
      && this.matchesQuery(item.name, item.category, item.description, String(item.id))
    );
  }

  get filteredAssociations(): SportDisability[] {
    return this.associations.filter((item) =>
      this.matchesQuery(item.sportName, item.disabilityName, item.adaptations)
    );
  }

  get filteredRoutines(): Routine[] {
    return this.routines.filter((routine) =>
      this.matchesQuery(routine.name, routine.sportName, routine.level, routine.description, routine.disabilityFocus)
    );
  }

  isRoutineJoined(routineId: string): boolean {
    return this.routineRegistrations.some((reg) => reg.routineId === routineId);
  }

  applyCalendarFilter(): void {
    if (!this.calendarFrom && !this.calendarTo) {
      this.applyEventsToCalendar(this.allEvents);
      return;
    }
    this.sportsService.getEventCalendar(this.calendarFrom || undefined, this.calendarTo || undefined).subscribe({
      next: (items) => {
        this.calendarItems = items;
        this.calendarLoaded = true;
        this.markEventDays(this.allEvents);
      },
      error: (error) => {
        this.calendarItems = [];
        this.calendarLoaded = true;
        this.errorMessage = error?.error?.message || this.translate.instant('HOME.CALENDAR_ERROR');
      }
    });
  }

  clearCalendarFilter(): void {
    this.calendarFrom = '';
    this.calendarTo = '';
    this.selectedCalendarDate = null;
    this.applyEventsToCalendar(this.allEvents);
  }

  onCalendarDayClick(cell: { day: number | null; muted: boolean }): void {
    if (!cell.day || cell.muted) {
      return;
    }
    const date = this.dateForCell(cell.day);
    this.selectedCalendarDate = date;
    this.calendarFrom = date;
    this.calendarTo = date;
    this.applyCalendarFilter();
  }

  formatDate(value?: string): string {
    if (!value) return this.translate.instant('HOME.NO_DATE');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const locale = this.languageService.currentLang === 'en' ? 'en-US' : 'es-MX';
    return date.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatTime(value?: string): string {
    if (!value) return '';
    return value.length >= 5 ? value.slice(0, 5) : value;
  }

  private applyEventsToCalendar(events: EventItem[]): void {
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
    this.markEventDays(events);
  }

  private sortEvents(events: EventItem[]): EventItem[] {
    return [...events].sort((a, b) => {
      const aKey = `${a.eventDate}T${a.eventTime || '00:00:00'}`;
      const bKey = `${b.eventDate}T${b.eventTime || '00:00:00'}`;
      return aKey.localeCompare(bKey);
    });
  }

  private sortRegistrations(registrations: Registration[]): Registration[] {
    return [...registrations].sort((a, b) => {
      const aKey = `${a.eventDate || a.registrationDate || ''}T${a.eventTime || '00:00:00'}`;
      const bKey = `${b.eventDate || b.registrationDate || ''}T${b.eventTime || '00:00:00'}`;
      return bKey.localeCompare(aKey);
    });
  }

  private resolveNextEvent(events: EventItem[], registrations: Registration[]): EventItem | null {
    const registeredIds = new Set(
      registrations
        .filter((reg) => reg.waitlistPosition == null)
        .map((reg) => reg.eventId)
    );
    const upcoming = this.sortEvents(events).filter((event) => {
      const when = eventDateTimeMs(event.eventDate, event.eventTime);
      const status = (event.status || '').toLowerCase();
      if (status === 'cancelled' || status === 'finished') {
        return false;
      }
      return when == null || when >= Date.now();
    });

    const registeredUpcoming = upcoming.find((event) => registeredIds.has(event.id));
    return registeredUpcoming || upcoming[0] || null;
  }

  private resolveFeaturedEvents(events: EventItem[], registrations: Registration[]): EventItem[] {
    const next = this.resolveNextEvent(events, registrations);
    return next ? [next] : [];
  }

  get nextRegisteredEvent(): EventItem | null {
    const registeredIds = new Set(this.confirmedRegistrations.map((reg) => reg.eventId));
    return this.sortEvents(this.allEvents).find((event) => {
      if (!registeredIds.has(event.id)) {
        return false;
      }
      const status = (event.status || '').toLowerCase();
      if (status === 'cancelled' || status === 'finished') {
        return false;
      }
      const when = eventDateTimeMs(event.eventDate, event.eventTime);
      return when == null || when >= Date.now();
    }) || null;
  }

  get historyPreview(): Registration[] {
    const nextId = this.nextRegisteredEvent?.id;
    return this.registrations.filter((reg) => reg.eventId !== nextId).slice(0, 3);
  }

  historyEventImage(reg: Registration): string {
    const event = this.allEvents.find((item) => item.id === reg.eventId);
    return event ? this.eventImage(event) : resolveEventImage({});
  }

  private buildCalendar(base: Date): void {
    const year = base.getFullYear();
    const month = base.getMonth();
    this.calendarYear = year;
    this.calendarMonth = month;
    const locale = this.languageService.currentLang === 'en' ? 'en-US' : 'es-MX';
    this.calendarMonthLabel = base.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = base.getDate();
    const cells: typeof this.calendarCells = [];

    for (let i = 0; i < firstDay; i++) {
      cells.push({ day: null, muted: true, selected: false, hasEvent: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ day, muted: false, selected: day === today, hasEvent: false });
    }
    this.calendarCells = cells;
  }

  private dateForCell(day: number): string {
    const month = String(this.calendarMonth + 1).padStart(2, '0');
    const date = String(day).padStart(2, '0');
    return `${this.calendarYear}-${month}-${date}`;
  }

  private matchesQuery(...values: Array<string | undefined>): boolean {
    const q = this.catalogQuery.trim().toLowerCase();
    if (!q) {
      return true;
    }
    return values.some((value) => (value || '').toLowerCase().includes(q));
  }

  private eventInCalendarRange(eventDate?: string): boolean {
    if (!eventDate) {
      return false;
    }
    const date = eventDate.substring(0, 10);
    if (this.calendarFrom && date < this.calendarFrom) {
      return false;
    }
    if (this.calendarTo && date > this.calendarTo) {
      return false;
    }
    return true;
  }

  private markEventDays(events: EventItem[]): void {
    const source = this.calendarFrom || this.calendarTo
      ? events.filter((event) => this.eventInCalendarRange(event.eventDate))
      : events;
    const days = new Set(
      source
        .filter((event) => {
          const date = new Date(event.eventDate);
          return date.getMonth() === this.calendarMonth && date.getFullYear() === this.calendarYear;
        })
        .map((event) => new Date(event.eventDate).getDate())
    );

    this.calendarCells = this.calendarCells.map((cell) => {
      const cellDate = cell.day ? this.dateForCell(cell.day) : null;
      const today = this.dateForCell(new Date().getDate());
      const isCurrentMonth = new Date().getMonth() === this.calendarMonth && new Date().getFullYear() === this.calendarYear;
      return {
        ...cell,
        selected: !!cellDate && (this.selectedCalendarDate
          ? cellDate === this.selectedCalendarDate
          : isCurrentMonth && cellDate === today),
        hasEvent: !!cell.day && days.has(cell.day)
      };
    });
  }
}
