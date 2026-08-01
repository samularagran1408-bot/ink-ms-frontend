import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { EventItem, Registration } from '../../../../core/models/sports';
import { AppNotification } from '../../../../core/models/accessibility-api';
import { SessionService } from '../../../../core/services/session.service';
import { SportsService } from '../../../../core/services/sports.service';
import { PreferencesApiService } from '../../../../core/services/preferences-api.service';

@Component({
  selector: 'app-user-interface',
  templateUrl: './user-interface.component.html',
  styleUrl: './user-interface.component.scss'
})
export class UserInterfaceComponent implements OnInit {
  loading = true;
  errorMessage: string | null = null;
  events: EventItem[] = [];
  registrations: Registration[] = [];
  nextEvent: EventItem | null = null;
  unreadCount = 0;
  notifications: AppNotification[] = [];
  showNotifications = false;
  registeringId: string | null = null;
  calendarMonthLabel = '';
  calendarCells: { day: number | null; muted: boolean; selected: boolean; hasEvent: boolean }[] = [];

  constructor(
    private session: SessionService,
    private sportsService: SportsService,
    private preferencesApi: PreferencesApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.buildCalendar(new Date());
    const profile$ = this.session.getProfile()
      ? of(this.session.getProfile())
      : this.session.loadProfile();

    profile$.subscribe((profile) => {
      const userId = profile?.id;
      forkJoin({
        events: this.sportsService.getEvents().pipe(catchError(() => of([] as EventItem[]))),
        registrations: userId
          ? this.sportsService.getRegistrationsByUser(userId).pipe(catchError(() => of([] as Registration[])))
          : of([] as Registration[]),
        unread: this.preferencesApi.getUnreadCount().pipe(catchError(() => of(0))),
        notifications: this.preferencesApi.getNotifications().pipe(catchError(() => of([] as AppNotification[])))
      }).subscribe({
        next: ({ events, registrations, unread, notifications }) => {
          this.events = this.sortEvents(events).slice(0, 6);
          this.registrations = registrations;
          this.nextEvent = this.resolveNextEvent(events, registrations);
          this.unreadCount = typeof unread === 'number' ? unread : (unread?.count ?? 0);
          this.notifications = notifications.slice(0, 5);
          this.markEventDays(events);
          this.loading = false;
        },
        error: () => {
          this.errorMessage = 'No se pudo cargar el panel.';
          this.loading = false;
        }
      });
    });
  }

  get confirmedCount(): number {
    return this.registrations.length;
  }

  onNotifications(): void {
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications && this.unreadCount > 0) {
      this.preferencesApi.markAllAsRead().subscribe({
        next: () => {
          this.unreadCount = 0;
          this.notifications = this.notifications.map((n) => ({ ...n, read: true }));
        }
      });
    }
  }

  onSeeAllEvents(): void {
    this.router.navigate(['/home/events']);
  }

  onRegisterEvent(event: EventItem): void {
    const userId = this.session.getProfile()?.id;
    if (!userId) {
      this.errorMessage = 'No se encontró el perfil del usuario.';
      return;
    }

    this.registeringId = event.id;
    this.sportsService.registerToEvent(userId, event.id).subscribe({
      next: (registration) => {
        this.registrations = [...this.registrations, registration];
        this.registeringId = null;
        this.events = this.events.map((item) =>
          item.id === event.id
            ? { ...item, availableCapacity: Math.max((item.availableCapacity ?? 1) - 1, 0) }
            : item
        );
        this.nextEvent = this.resolveNextEvent(this.events, this.registrations);
      },
      error: (error) => {
        this.registeringId = null;
        this.errorMessage = error?.error?.message || 'No se pudo completar la inscripción.';
      }
    });
  }

  isRegistered(eventId: string): boolean {
    return this.registrations.some((reg) => reg.eventId === eventId);
  }

  formatDate(value?: string): string {
    if (!value) return 'Sin fecha';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatTime(value?: string): string {
    if (!value) return '';
    return value.length >= 5 ? value.slice(0, 5) : value;
  }

  private sortEvents(events: EventItem[]): EventItem[] {
    return [...events].sort((a, b) => {
      const aKey = `${a.eventDate}T${a.eventTime || '00:00:00'}`;
      const bKey = `${b.eventDate}T${b.eventTime || '00:00:00'}`;
      return aKey.localeCompare(bKey);
    });
  }

  private resolveNextEvent(events: EventItem[], registrations: Registration[]): EventItem | null {
    const registeredIds = new Set(registrations.map((reg) => reg.eventId));
    const upcoming = this.sortEvents(events).filter((event) => {
      const when = new Date(`${event.eventDate}T${event.eventTime || '00:00:00'}`);
      return when.getTime() >= Date.now() && (registeredIds.has(event.id) || event.status === 'active');
    });

    const registeredUpcoming = upcoming.find((event) => registeredIds.has(event.id));
    return registeredUpcoming || upcoming[0] || null;
  }

  private buildCalendar(base: Date): void {
    const year = base.getFullYear();
    const month = base.getMonth();
    this.calendarMonthLabel = base.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
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

  private markEventDays(events: EventItem[]): void {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const days = new Set(
      events
        .filter((event) => {
          const date = new Date(event.eventDate);
          return date.getMonth() === month && date.getFullYear() === year;
        })
        .map((event) => new Date(event.eventDate).getDate())
    );

    this.calendarCells = this.calendarCells.map((cell) => ({
      ...cell,
      hasEvent: !!cell.day && days.has(cell.day)
    }));
  }
}
