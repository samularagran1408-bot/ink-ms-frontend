export interface CrewDominio {
  id: string;
  via: string;
  descripcion: string;
}

export interface CrewWritesInfo {
  crew: string;
  chat: string;
  nota: string;
}

export interface CrewDominiosResponse {
  dominios: CrewDominio[];
  auto: string;
  chat: string;
  rol?: string;
  writes?: CrewWritesInfo;
}

export interface InformeCrew {
  resumen: string;
  tools_usadas: string[];
  via_mcp: boolean;
  via_sandbox: boolean;
  fuente_tools: string;
  hallazgos: string;
  pendiente_confirmacion?: boolean;
}

export interface CrewRunResponse {
  dominio: string;
  dominio_origen: string;
  intencion?: string | null;
  confianza?: number | null;
  fuente: string;
  informe: InformeCrew;
}

export interface CrewErrorBody {
  usar_chat?: boolean;
  endpoint?: string;
  dominio?: string;
  dominios?: string[];
  intencion?: string | null;
  confianza?: number | null;
  mensaje?: string;
}
