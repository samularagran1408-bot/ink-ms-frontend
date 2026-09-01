import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { finalize, shareReplay, tap } from 'rxjs/operators';

import { API_BASE_URL } from '../config/api.config';
import { AppNotification, Preference, PreferenceRequest } from '../models/accessibility-api';

@Injectable({
  providedIn: 'root'
})
export class PreferencesApiService {
  private readonly preferencesUrl = `${API_BASE_URL}/api/preferences`;
  private readonly notificationsUrl = `${API_BASE_URL}/api/notifications`;

  private cachedPreferences: Preference | null = null;
  private preferencesInFlight: Observable<Preference> | null = null;
  private unreadCountInFlight: Observable<{ count: number } | number> | null = null;

  constructor(private http: HttpClient) {}

  get cached(): Preference | null {
    return this.cachedPreferences;
  }

  getPreferences(force = false): Observable<Preference> {
    if (!force && this.cachedPreferences) {
      return of(this.cachedPreferences);
    }
    if (!force && this.preferencesInFlight) {
      return this.preferencesInFlight;
    }
    const request$ = this.http.get<Preference>(this.preferencesUrl).pipe(
      tap((prefs) => {
        this.cachedPreferences = prefs;
      }),
      finalize(() => {
        this.preferencesInFlight = null;
      }),
      shareReplay(1)
    );
    this.preferencesInFlight = request$;
    return request$;
  }

  updatePreferences(payload: PreferenceRequest): Observable<Preference> {
    return this.http.put<Preference>(this.preferencesUrl, payload).pipe(
      tap((prefs) => {
        this.cachedPreferences = prefs;
      })
    );
  }

  clearCache(): void {
    this.cachedPreferences = null;
    this.preferencesInFlight = null;
    this.unreadCountInFlight = null;
  }

  getNotifications(): Observable<AppNotification[]> {
    return this.http.get<AppNotification[]>(this.notificationsUrl);
  }

  getUnreadNotifications(): Observable<AppNotification[]> {
    return this.http.get<AppNotification[]>(`${this.notificationsUrl}/unread`);
  }

  getUnreadCount(): Observable<{ count: number } | number> {
    if (this.unreadCountInFlight) {
      return this.unreadCountInFlight;
    }
    const request$ = this.http.get<{ count: number } | number>(`${this.notificationsUrl}/unread/count`).pipe(
      finalize(() => {
        this.unreadCountInFlight = null;
      }),
      shareReplay(1)
    );
    this.unreadCountInFlight = request$;
    return request$;
  }

  markAsRead(notificationId: string): Observable<AppNotification> {
    return this.http.get<AppNotification>(`${this.notificationsUrl}/${notificationId}/read`);
  }

  markAllAsRead(): Observable<unknown> {
    return this.http.get(`${this.notificationsUrl}/read-all`);
  }
}
