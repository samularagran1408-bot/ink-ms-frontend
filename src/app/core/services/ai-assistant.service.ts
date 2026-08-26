import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config/api.config';

@Injectable({ providedIn: 'root' })
export class AiAssistantService {
  private readonly base = `${API_BASE_URL}/api/ai`;

  constructor(private http: HttpClient) {}

  generarRutina(body: {
    objetivo?: string;
    tipo?: string;
    duracion_minutos?: number;
  }): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(`${this.base}/rutinas/generar`, {
      objetivo: body.objetivo || 'general',
      tipo: body.tipo || 'general',
      duracion_minutos: body.duracion_minutos || 30
    });
  }

  evaluarRiesgo(body: {
    rpe_reciente?: number | null;
    dolor_reportado?: boolean;
    dias_sin_descanso?: number;
    limitacion?: string;
  }): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(`${this.base}/riesgo/evaluar`, {
      rpe_reciente: body.rpe_reciente ?? null,
      dolor_reportado: !!body.dolor_reportado,
      dias_sin_descanso: body.dias_sin_descanso || 0,
      limitacion: body.limitacion || undefined
    });
  }

  analizarCompetencia(): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`${this.base}/competencia/analizar`);
  }

  modoCompetencia(activar: boolean, objetivo?: string, semanas = 3): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(`${this.base}/competencia/modo`, {
      activar,
      objetivo: objetivo || undefined,
      semanas
    });
  }

  obtenerModo(): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`${this.base}/competencia/modo`);
  }

  dashboard(usuarioId?: string): Observable<Record<string, unknown>> {
    const path = usuarioId
      ? `${this.base}/dashboard/${encodeURIComponent(usuarioId)}`
      : `${this.base}/dashboard`;
    return this.http.get<Record<string, unknown>>(path);
  }
}
