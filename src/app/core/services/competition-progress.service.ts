import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { CompetitionEventSnapshot, CompetitionModeState, PanelProgressSnapshot } from '../models/competition';
import { AiAssistantService } from './ai-assistant.service';

@Injectable({ providedIn: 'root' })
export class CompetitionProgressService {
  private readonly stateSubject = new BehaviorSubject<CompetitionModeState | null>(null);
  readonly state$ = this.stateSubject.asObservable();
  private readonly rawSubject = new BehaviorSubject<Record<string, unknown> | null>(null);
  readonly raw$ = this.rawSubject.asObservable();

  constructor(private ai: AiAssistantService) {}

  get snapshot(): CompetitionModeState | null {
    return this.stateSubject.value;
  }

  refresh(): Observable<CompetitionModeState> {
    return this.ai.obtenerModo().pipe(
      tap((raw) => this.publish(raw)),
      map(() => this.snapshot || { activo: false }),
      catchError(() => {
        const empty: CompetitionModeState = { activo: false };
        this.stateSubject.next(empty);
        return of(empty);
      })
    );
  }

  publish(raw: Record<string, unknown> | CompetitionModeState): void {
    const record = raw as Record<string, unknown>;
    this.rawSubject.next(record);
    this.stateSubject.next(this.normalize(record));
  }

  marcarChecklist(itemId: string, hecho: boolean): Observable<CompetitionModeState> {
    return this.ai.marcarChecklist(itemId, hecho).pipe(
      tap((raw) => this.publish(raw)),
      map(() => this.snapshot || { activo: false })
    );
  }

  registrarSesion(routineId: string): Observable<CompetitionModeState> {
    return this.ai.registrarSesion(routineId).pipe(
      tap((raw) => this.publish(raw)),
      map(() => this.snapshot || { activo: false })
    );
  }

  private normalize(raw: Record<string, unknown>): CompetitionModeState {
    const vista = (raw['vista'] && typeof raw['vista'] === 'object')
      ? raw['vista'] as Record<string, unknown>
      : {};
    const panelRaw = (raw['progreso_panel'] || vista['progreso_panel']) as PanelProgressSnapshot | undefined;
    const eventoRaw = raw['evento_objetivo'] || vista['evento_objetivo'];
    return {
      activo: !!(raw['activo'] || vista['activo']),
      objetivo: (raw['objetivo'] as string) || (vista['objetivo'] as string) || null,
      semanas: Number(raw['semanas'] ?? vista['semanas'] ?? 0) || null,
      semana_actual: Number(raw['semana_actual'] ?? vista['semana_actual'] ?? 0) || 0,
      plan_pct: Number(raw['plan_pct'] ?? vista['plan_pct'] ?? 0) || 0,
      checklist_pct: Number(raw['checklist_pct'] ?? vista['checklist_pct'] ?? 0) || 0,
      sesiones_pct: Number(raw['sesiones_pct'] ?? vista['sesiones_pct'] ?? 0) || 0,
      checklist_hechos: Number(raw['checklist_hechos'] ?? vista['checklist_hechos'] ?? 0) || 0,
      checklist_total: Number(raw['checklist_total'] ?? vista['checklist_total'] ?? 0) || 0,
      sesiones_hechas: Number(raw['sesiones_hechas'] ?? vista['sesiones_hechas'] ?? 0) || 0,
      sesiones_objetivo: Number(raw['sesiones_objetivo'] ?? vista['sesiones_objetivo'] ?? 0) || 0,
      evento_objetivo: this.normalizeEvento(eventoRaw),
      progreso_panel: panelRaw && typeof panelRaw === 'object' ? panelRaw : undefined,
      vista
    };
  }

  private normalizeEvento(value: unknown): CompetitionEventSnapshot | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const row = value as Record<string, unknown>;
    const titulo = String(row['titulo'] || row['nombre'] || row['eventName'] || '').trim();
    if (!titulo) {
      return null;
    }
    const meta = Array.isArray(row['meta']) ? row['meta'].map(String) : [];
    return {
      titulo,
      subtitulo: String(row['subtitulo'] || row['deporte'] || row['sportName'] || ''),
      meta,
      id: String(row['id'] || row['eventId'] || '')
    };
  }
}
