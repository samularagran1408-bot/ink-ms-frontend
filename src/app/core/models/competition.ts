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

export interface CompetitionModeState {
  activo: boolean;
  objetivo?: string | null;
  semanas?: number | null;
  semana_actual?: number;
  plan_pct?: number;
  evento_objetivo?: CompetitionEventSnapshot | Record<string, unknown> | null;
  progreso_panel?: PanelProgressSnapshot;
  vista?: Record<string, unknown>;
}
