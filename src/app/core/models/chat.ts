export type ChatCardTipo =
  | 'evento'
  | 'deporte'
  | 'rutina'
  | 'ejercicio'
  | 'adaptacion'
  | 'quiz'
  | 'confirmacion'
  | 'usuario'
  | 'kpi'
  | 'alerta'
  | 'reporte';

export type ChatCtaAccion =
  | 'ver_eventos'
  | 'ver_deportes'
  | 'ver_sesiones'
  | 'ver_discapacidades'
  | 'ver_quiz'
  | 'confirmar_write'
  | 'ver_perfil'
  | 'ver_estadisticas'
  | 'ver_competencia'
  | 'ver_usuarios'
  | 'descargar_pdf';

export interface ChatCardCta {
  accion: ChatCtaAccion;
  label: string;
  id?: string;
  url?: string;
  filename?: string;
  kind?: string;
  method?: string;
}

export interface ChatCard {
  tipo: ChatCardTipo;
  tool?: string;
  titulo: string;
  subtitulo?: string | null;
  meta?: string[];
  cta?: ChatCardCta;
}

export interface ChatMcp {
  protocolo: string;
  estilo: string;
  llm_eligio_tools: boolean;
  tools_usadas: string[];
  tools_disponibles: string[];
  modelo?: string | null;
  fuente: string;
  fallback_si_falla: string;
  nota?: string;
}

export interface ChatResponse {
  conversacion_id: string;
  respuesta: string;
  intencion: string;
  adaptada: boolean;
  confianza: number;
  fuente: string;
  agente: string;
  sugerencias: string[];
  datos?: Record<string, unknown> | null;
  herramientas_usadas: string[];
  cards: ChatCard[];
  mcp?: ChatMcp | null;
}

export interface ChatHilo {
  conversacion_id: string;
  titulo: string;
  estado: string;
  creada_en?: string;
  ultima_interaccion?: string;
  total_mensajes?: number;
  tiene_resumen?: boolean;
}

export interface ChatMensajeGuardado {
  mensaje: string;
  remitente: 'usuario' | 'asistente' | string;
  intencion?: string;
  fuente?: string;
  fecha?: string;
  cards?: ChatCard[];
  sugerencias?: string[];
}

export interface ChatHiloDetalle extends ChatHilo {
  resumen?: string | null;
  mensajes: ChatMensajeGuardado[];
}

export interface ChatMensajeUi {
  remitente: 'usuario' | 'asistente';
  texto: string;
  cards: ChatCard[];
  sugerencias: string[];
  fuente?: string;
  mcp?: ChatMcp | null;
  herramientas?: string[];
  pasos?: ChatPasoActividad[];
}

export interface ChatPasoActividad {
  tipo: 'estado' | 'herramienta';
  code: string;
  estado?: 'ejecutando' | 'listo';
  mensaje?: string;
}

export interface ChatStreamEvent {
  evento: string;
  detalle?: string;
  estado?: string;
  mensaje?: string;
  datos?: ChatResponse;
  conversacion_id?: string;
}
