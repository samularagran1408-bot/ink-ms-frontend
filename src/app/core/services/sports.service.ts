import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config/api.config';
import {
  Disability,
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
  private readonly routinesUrl = `${API_BASE_URL}/api/routines`;
  private readonly routineRegistrationsUrl = `${API_BASE_URL}/api/routine-registrations`;

  constructor(private http: HttpClient) {}

  getSports(): Observable<Sport[]> {
    return this.http.get<Sport[]>(this.sportsUrl);
  }

  getActiveSports(): Observable<Sport[]> {
    return this.http.get<Sport[]>(`${this.sportsUrl}/active`);
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

  createEvent(payload: EventRequest): Observable<EventItem> {
    return this.http.post<EventItem>(this.eventsUrl, payload);
  }

  updateEvent(id: string, payload: Partial<EventRequest>): Observable<EventItem> {
    return this.http.put<EventItem>(`${this.eventsUrl}/${id}`, payload);
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

  createDisability(payload: DisabilityRequest): Observable<Disability> {
    return this.http.post<Disability>(this.disabilitiesUrl, payload);
  }

  updateDisability(id: number, payload: DisabilityRequest): Observable<Disability> {
    return this.http.put<Disability>(`${this.disabilitiesUrl}/${id}`, payload);
  }

  deleteDisability(id: number): Observable<void> {
    return this.http.delete<void>(`${this.disabilitiesUrl}/${id}`);
  }

  getSportDisabilities(sportId: number): Observable<SportDisability[]> {
    return this.http.get<SportDisability[]>(`${this.sportDisabilitiesUrl}/sport/${sportId}`);
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
