import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';

import { EventItem, Registration } from '../../../../core/models/sports';
import { AppNotification } from '../../../../core/models/accessibility-api';
import { SessionService } from '../../../../core/services/session.service';
import { SportsService } from '../../../../core/services/sports.service';
import { PreferencesApiService } from '../../../../core/services/preferences-api.service';
import { NotificationAnnounceService } from '../../../../core/services/notification-announce.service';
import { TtsService } from '../../../../core/services/tts.service';
import { LanguageService } from '../../../../core/services/language.service';
import { UnreadNotificationsService } from '../../../../core/services/unread-notifications.service';
import { resolveEventImage } from '../../../../core/utils/event-image.util';

@Component({
  selector: 'app-user-interface',
  templateUrl: './user-interface.component.html',
  styleUrl: './user-interface.component.scss'
})
export class UserInterfaceComponent implements OnInit, OnDestroy {
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
  audioMode = false;

  private prefsSub: Subscription | null = null;
  private playingSub: Subscription | null = null;
  private langSub: Subscription | null = null;
  playingId: string | null = null;

  constructor(
    private session: SessionService,
    private sportsService: SportsService,
    private preferencesApi: PreferencesApiService,
    private router: Router,
    private notificationAnnounce: NotificationAnnounceService,
    private tts: TtsService,
    private translate: TranslateService,
    private languageService: LanguageService,
    private unreadNotifications: UnreadNotificationsService
  ) {}

  ngOnInit(): void {
    this.notificationAnnounce.start();
    this.prefsSub = this.tts.preferences$.subscribe(() => {
      this.audioMode = this.tts.isAudioNotificationsActive;
    });
    this.playingSub = this.tts.playingId$.subscribe((id) => {
      this.playingId = id;
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
      const userId = profile?.id;
      forkJoin({
        events: this.sportsService.getEvents().pipe(catchError(() => of([] as EventItem[]))),
        registrations: userId
          ? this.sportsService.getRegistrationsByUser(userId).pipe(catchError(() => of([] as Registration[])))
          : of([] as Registration[]),
        unread: this.preferencesApi.getUnreadCount().pipe(catchError(() => of(0))),
        notifications: this.preferencesApi.getNotifications().pipe(catchError(() => of([] as AppNotification[]))),
        prefs: this.notificationAnnounce.refreshPreferences()
      }).subscribe({
        next: ({ events, registrations, unread, notifications }) => {
          this.events = this.sortEvents(events).slice(0, 6);
          this.registrations = registrations;
          this.nextEvent = this.resolveNextEvent(events, registrations);
          this.unreadCount = typeof unread === 'number' ? unread : (unread?.count ?? 0);
          this.unreadNotifications.setCount(this.unreadCount);
          this.notifications = notifications.slice(0, 5);
          this.audioMode = this.tts.isAudioNotificationsActive;
          this.markEventDays(events);
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
    this.prefsSub?.unsubscribe();
    this.playingSub?.unsubscribe();
    this.langSub?.unsubscribe();
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
          this.unreadNotifications.setCount(0);
          this.notifications = this.notifications.map((n) => ({ ...n, read: true }));
        }
      });
    }
  }

  togglePlay(note: AppNotification): void {
    if (!this.audioMode) {
      return;
    }
    if (this.playingId === note.id) {
      this.tts.stop();
      return;
    }
    this.notificationAnnounce.announceOne(note, true);
  }

  isPlaying(note: AppNotification): boolean {
    return this.playingId === note.id;
  }

  onSeeAllEvents(): void {
    this.router.navigate(['/home/events']);
  }

  onRegisterEvent(event: EventItem): void {
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
