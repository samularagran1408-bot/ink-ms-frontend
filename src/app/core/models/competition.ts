export interface PanelProgressSnapshot {
  asistencia_pct: number;
  asistidos: number;
  confirmados: number;
  inscripciones?: number;
  rutinas: number;
  lista_espera: number;
}

export interface CompetitionEventSnapshot {
  titulo: string;
  subtitulo?: string;
  meta?: string[];
  id?: string;
}

export interface CompetitionChecklistItem {
  id: string;
  texto: string;
  hecho: boolean;
}

export interface CompetitionModeState {
  activo: boolean;
  objetivo?: string | null;
  semanas?: number | null;
  semana_actual?: number;
  plan_pct?: number;
  checklist_pct?: number;
  sesiones_pct?: number;
  checklist_hechos?: number;
  checklist_total?: number;
  sesiones_hechas?: number;
  sesiones_objetivo?: number;
  evento_objetivo?: CompetitionEventSnapshot | Record<string, unknown> | null;
  progreso_panel?: PanelProgressSnapshot;
  vista?: Record<string, unknown>;
}
