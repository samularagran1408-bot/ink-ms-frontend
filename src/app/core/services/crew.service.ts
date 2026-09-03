import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, timeout } from 'rxjs';


import { API_BASE_URL } from '../config/api.config';
import { CrewDominiosResponse, CrewErrorBody, CrewRunResponse } from '../models/crew';

/** Un poco más que CREW_TIMEOUT_SEGUNDOS (180) del asistente. */
const CREW_HTTP_TIMEOUT_MS = 200_000;

@Injectable({ providedIn: 'root' })
export class CrewService {
  private readonly base = `${API_BASE_URL}/api/ai/crew`;

  constructor(private http: HttpClient) {}

  dominios(): Observable<CrewDominiosResponse> {
    return this.http.get<CrewDominiosResponse>(`${this.base}/dominios`);
  }

  run(mensaje: string, dominio: string = 'auto'): Observable<CrewRunResponse> {
    return this.http
      .post<CrewRunResponse>(`${this.base}/run`, { mensaje, dominio })
      .pipe(timeout({ first: CREW_HTTP_TIMEOUT_MS }));
  }

  unwrapError(err: HttpErrorResponse): CrewErrorBody {
    const raw = err.error as { detail?: unknown } | string | null;
    if (!raw || typeof raw !== 'object') {
      return { mensaje: typeof raw === 'string' ? raw : err.message };
    }
    const detail = raw.detail;
    if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
      return detail as CrewErrorBody;
    }
    if (typeof detail === 'string') {
      return { mensaje: detail };
    }
    return raw as CrewErrorBody;
  }
}
