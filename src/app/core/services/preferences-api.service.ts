import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config/api.config';
import { AppNotification, Preference, PreferenceRequest } from '../models/accessibility-api';

@Injectable({
  providedIn: 'root'
})
export class PreferencesApiService {
  private readonly preferencesUrl = `${API_BASE_URL}/api/preferences`;
  private readonly notificationsUrl = `${API_BASE_URL}/api/notifications`;

  constructor(private http: HttpClient) {}

  getPreferences(): Observable<Preference> {
    return this.http.get<Preference>(this.preferencesUrl);
  }

  updatePreferences(payload: PreferenceRequest): Observable<Preference> {
    return this.http.put<Preference>(this.preferencesUrl, payload);
  }

  getNotifications(): Observable<AppNotification[]> {
    return this.http.get<AppNotification[]>(this.notificationsUrl);
  }

  getUnreadNotifications(): Observable<AppNotification[]> {
    return this.http.get<AppNotification[]>(`${this.notificationsUrl}/unread`);
  }

  getUnreadCount(): Observable<{ count: number } | number> {
    return this.http.get<{ count: number } | number>(`${this.notificationsUrl}/unread/count`);
  }

  markAsRead(notificationId: string): Observable<AppNotification> {
    return this.http.get<AppNotification>(`${this.notificationsUrl}/${notificationId}/read`);
  }

  markAllAsRead(): Observable<unknown> {
    return this.http.get(`${this.notificationsUrl}/read-all`);
  }
}
