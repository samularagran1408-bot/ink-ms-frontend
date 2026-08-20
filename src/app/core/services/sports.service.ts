import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config/api.config';
import {
  AttendanceActionResponse,
  AttendanceReport,
  CalendarEvent,
  Disability,
  QrAttendanceInfo,
  DisabilityRequest,
  EventItem,
  EventRequest,
  Registration,
  Routine,
  RoutineRegistration,
  RoutineRequest,
  Sport,
  SportDisability,
  SportDisabilityRequest,
  SportRequest
} from '../models/sports';

@Injectable({
  providedIn: 'root'
})
export class SportsService {
  private readonly sportsUrl = `${API_BASE_URL}/api/sports`;
  private readonly eventsUrl = `${API_BASE_URL}/api/events`;
  private readonly disabilitiesUrl = `${API_BASE_URL}/api/disabilities`;
  private readonly sportDisabilitiesUrl = `${API_BASE_URL}/api/sport-disabilities`;
  private readonly registrationsUrl = `${API_BASE_URL}/api/registrations`;
  private readonly attendanceUrl = `${API_BASE_URL}/api/attendance`;
  private readonly routinesUrl = `${API_BASE_URL}/api/routines`;
  private readonly routineRegistrationsUrl = `${API_BASE_URL}/api/routine-registrations`;

  constructor(private http: HttpClient) {}

  getSports(): Observable<Sport[]> {
    return this.http.get<Sport[]>(this.sportsUrl);
  }

  getActiveSports(): Observable<Sport[]> {
    return this.http.get<Sport[]>(`${this.sportsUrl}/active`);
  }

  searchSports(q?: string, activeOnly = true): Observable<Sport[]> {
    const params: Record<string, string> = { activeOnly: String(activeOnly) };
    if (q) {
      params['q'] = q;
    }
    return this.http.get<Sport[]>(`${this.sportsUrl}/search`, { params });
  }

  getSport(id: number): Observable<Sport> {
    return this.http.get<Sport>(`${this.sportsUrl}/${id}`);
  }

  countSports(): Observable<number> {
    return this.http.get<number>(`${this.sportsUrl}/count`);
  }

  createSport(payload: SportRequest): Observable<Sport> {
    return this.http.post<Sport>(this.sportsUrl, payload);
  }

  updateSport(id: number, payload: SportRequest): Observable<Sport> {
    return this.http.put<Sport>(`${this.sportsUrl}/${id}`, payload);
  }

  deleteSport(id: number): Observable<void> {
    return this.http.delete<void>(`${this.sportsUrl}/${id}`);
  }

  getEvents(): Observable<EventItem[]> {
    return this.http.get<EventItem[]>(this.eventsUrl);
  }

  getAvailableEvents(): Observable<EventItem[]> {
    return this.http.get<EventItem[]>(`${this.eventsUrl}/available`);
  }

  getEvent(id: string): Observable<EventItem> {
    return this.http.get<EventItem>(`${this.eventsUrl}/${id}`);
  }

  searchEvents(q?: string, from?: string, to?: string): Observable<EventItem[]> {
    const params: Record<string, string> = {};
    if (q) {
      params['q'] = q;
    }
    if (from) {
      params['from'] = from;
    }
    if (to) {
      params['to'] = to;
    }
    return this.http.get<EventItem[]>(`${this.eventsUrl}/search`, { params });
  }

  getEventCalendar(from?: string, to?: string): Observable<CalendarEvent[]> {
    const params: Record<string, string> = {};
    if (from) {
      params['from'] = from;
    }
    if (to) {
      params['to'] = to;
    }
    return this.http.get<CalendarEvent[]>(`${this.eventsUrl}/calendar`, { params });
  }

  createEvent(payload: EventRequest): Observable<EventItem> {
    return this.http.post<EventItem>(this.eventsUrl, payload);
  }

  updateEvent(id: string, payload: Partial<EventRequest>): Observable<EventItem> {
    return this.http.put<EventItem>(`${this.eventsUrl}/${id}`, payload);
  }

  cancelEvent(id: string): Observable<EventItem> {
    return this.http.post<EventItem>(`${this.eventsUrl}/${id}/cancel`, {});
  }

  countActiveEvents(): Observable<number> {
    return this.http.get<number>(`${this.eventsUrl}/active/count`);
  }

  getDisabilities(): Observable<Disability[]> {
    return this.http.get<Disability[]>(this.disabilitiesUrl);
  }

  getActiveDisabilities(): Observable<Disability[]> {
    return this.http.get<Disability[]>(`${this.disabilitiesUrl}/active`);
  }

  searchDisabilities(q?: string): Observable<Disability[]> {
    const params: Record<string, string> = {};
    if (q) {
      params['q'] = q;
    }
    return this.http.get<Disability[]>(`${this.disabilitiesUrl}/search`, { params });
  }

  getDisability(id: number): Observable<Disability> {
    return this.http.get<Disability>(`${this.disabilitiesUrl}/${id}`);
  }

  createDisability(payload: DisabilityRequest): Observable<Disability> {
    return this.http.post<Disability>(this.disabilitiesUrl, payload);
  }

  updateDisability(id: number, payload: DisabilityRequest): Observable<Disability> {
    return this.http.put<Disability>(`${this.disabilitiesUrl}/${id}`, payload);
  }

  deactivateDisability(id: number): Observable<Disability> {
    return this.http.patch<Disability>(`${this.disabilitiesUrl}/${id}/deactivate`, {});
  }

  activateDisability(id: number): Observable<Disability> {
    return this.http.patch<Disability>(`${this.disabilitiesUrl}/${id}/activate`, {});
  }

  deleteDisability(id: number): Observable<void> {
    return this.http.delete<void>(`${this.disabilitiesUrl}/${id}`);
  }

  getSportDisabilities(sportId: number): Observable<SportDisability[]> {
    return this.http.get<SportDisability[]>(`${this.sportDisabilitiesUrl}/sport/${sportId}`);
  }

  getAssociations(): Observable<SportDisability[]> {
    return this.http.get<SportDisability[]>(this.sportDisabilitiesUrl);
  }

  searchAssociations(q?: string): Observable<SportDisability[]> {
    const params: Record<string, string> = {};
    if (q) {
      params['q'] = q;
    }
    return this.http.get<SportDisability[]>(`${this.sportDisabilitiesUrl}/search`, { params });
  }

  addSportDisability(payload: SportDisabilityRequest): Observable<SportDisability> {
    return this.http.post<SportDisability>(this.sportDisabilitiesUrl, payload);
  }

  removeSportDisability(sportId: number, disabilityId: number): Observable<void> {
    return this.http.delete<void>(`${this.sportDisabilitiesUrl}/sport/${sportId}/disability/${disabilityId}`);
  }

  registerToEvent(userId: string, eventId: string): Observable<Registration> {
    return this.http.post<Registration>(this.registrationsUrl, { userId, eventId });
  }

  cancelRegistration(id: string): Observable<unknown> {
    return this.http.delete(`${this.registrationsUrl}/${id}`);
  }

  getRegistrationsByUser(userId: string): Observable<Registration[]> {
    return this.http.get<Registration[]>(`${this.registrationsUrl}/user/${userId}`);
  }

  getEventWaitlist(eventId: string): Observable<Registration[]> {
    return this.http.get<Registration[]>(`${this.registrationsUrl}/${eventId}/waitlist`);
  }

  markAttendanceByQr(qrCode: string, verifiedBy?: string): Observable<AttendanceActionResponse> {
    return this.http.post<AttendanceActionResponse>(`${this.attendanceUrl}/qr`, {
      qrCode,
      verifiedBy
    });
  }

  getAttendanceQrInfo(qrCode: string): Observable<QrAttendanceInfo> {
    return this.http.get<QrAttendanceInfo>(`${this.attendanceUrl}/qr-info`, {
      params: { qrCode }
    });
  }

  markAttendance(
    registrationId: string,
    checkInMethod: 'qr' | 'manual' | 'admin' = 'manual',
    verifiedBy?: string
  ): Observable<AttendanceActionResponse> {
    return this.http.post<AttendanceActionResponse>(this.attendanceUrl, {
      registrationId,
      checkInMethod,
      verifiedBy
    });
  }

  markBulkAttendance(
    registrationIds: string[],
    checkInMethod: 'qr' | 'manual' | 'admin' = 'admin',
    verifiedBy?: string
  ): Observable<AttendanceActionResponse> {
    return this.http.post<AttendanceActionResponse>(`${this.attendanceUrl}/bulk`, {
      registrationIds,
      checkInMethod,
      verifiedBy
    });
  }

  getAttendanceReport(eventId: string): Observable<AttendanceReport> {
    return this.http.get<AttendanceReport>(`${this.attendanceUrl}/report`, {
      params: { eventId }
    });
  }

  getRoutines(): Observable<Routine[]> {
    return this.http.get<Routine[]>(this.routinesUrl);
  }

  getRoutine(id: string): Observable<Routine> {
    return this.http.get<Routine>(`${this.routinesUrl}/${id}`);
  }

  getRoutinesByTrainer(trainerId: string): Observable<Routine[]> {
    return this.http.get<Routine[]>(`${this.routinesUrl}/trainer/${trainerId}`);
  }

  createRoutine(payload: RoutineRequest): Observable<Routine> {
    return this.http.post<Routine>(this.routinesUrl, payload);
  }

  updateRoutine(id: string, payload: RoutineRequest): Observable<Routine> {
    return this.http.put<Routine>(`${this.routinesUrl}/${id}`, payload);
  }

  publishRoutine(id: string): Observable<Routine> {
    return this.http.post<Routine>(`${this.routinesUrl}/${id}/publish`, {});
  }

  getRoutineRegistrations(routineId: string): Observable<RoutineRegistration[]> {
    return this.http.get<RoutineRegistration[]>(`${this.routinesUrl}/${routineId}/registrations`);
  }

  registerToRoutine(userId: string, routineId: string): Observable<RoutineRegistration> {
    return this.http.post<RoutineRegistration>(this.routineRegistrationsUrl, { userId, routineId });
  }

  getRoutineRegistrationsByUser(userId: string): Observable<RoutineRegistration[]> {
    return this.http.get<RoutineRegistration[]>(`${this.routineRegistrationsUrl}/user/${userId}`);
  }
}
