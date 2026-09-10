import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { API_BASE_URL } from '@core/config/api.config';
import {
  ChatCupoHora,
  ChatErrorInfo,
  ChatHilo,
  ChatHiloDetalle,
  ChatLimites,
  ChatMensajeGuardado,
  ChatMensajeUi,
  ChatResponse,
  ChatStreamEvent
} from '../models/chat';
import { SessionService } from '@core/services/session.service';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly base = `${API_BASE_URL}/api/ai/chat`;

  constructor(
    private http: HttpClient,
    private session: SessionService
  ) {}

  enviar(mensaje: string, conversacionId?: string | null, limitacion?: string | null): Observable<ChatResponse> {
    const body: { mensaje: string; conversacion_id?: string; limitacion?: string } = { mensaje };
    if (conversacionId) {
      body.conversacion_id = conversacionId;
    }
    const lim = (limitacion || '').trim();
    if (lim) {
      body.limitacion = lim;
    }
    return this.http.post<ChatResponse>(`${this.base}/`, body);
  }

  enviarConProgreso(
    mensaje: string,
    conversacionId: string | null | undefined,
    onEvento: (evento: ChatStreamEvent) => void,
    limitacion?: string | null
  ): Observable<ChatResponse> {
    return new Observable<ChatResponse>((subscriber) => {
      const controller = new AbortController();
      this.leerStream(mensaje, conversacionId, onEvento, controller.signal, limitacion)
        .then((res) => {
          subscriber.next(res);
          subscriber.complete();
        })
        .catch((err) => {
          if (controller.signal.aborted) {
            subscriber.complete();
            return;
          }
          const msg = err instanceof Error ? err.message : '';
          const streamCaido =
            err instanceof TypeError ||
            /^stream \d+/.test(msg) ||
            msg === 'stream incompleto' ||
            /failed to fetch|networkerror|load failed|fetch failed/i.test(msg);
          if (!streamCaido) {
            subscriber.error(err);
            return;
          }
          this.enviar(mensaje, conversacionId, limitacion).subscribe({
            next: (res) => subscriber.next(res),
            error: (fallbackErr) => subscriber.error(fallbackErr),
            complete: () => subscriber.complete()
          });
        });
      return () => controller.abort();
    });
  }

  describirMcp(): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`${this.base}/mcp`);
  }

  listarHilos(): Observable<{ conversaciones: ChatHilo[]; limites: ChatLimites }> {
    return this.http.get<unknown>(`${this.base}/conversaciones`, { params: { limite: 50 } }).pipe(
      map((res) => ({
        conversaciones: this.extraerHilos(res)
          .map((hilo) => this.normalizarHilo(hilo))
          .filter((hilo) => !!this.idDeHilo(hilo)),
        limites: this.extraerLimites(res)
      }))
    );
  }

  obtenerHilo(conversacionId: string): Observable<ChatHiloDetalle> {
    return this.http.get<unknown>(
      `${this.base}/conversaciones/${encodeURIComponent(conversacionId)}`
    ).pipe(map((res) => this.normalizarDetalle(res, conversacionId)));
  }

  idDeHilo(hilo: ChatHilo | Record<string, unknown> | null | undefined): string {
    if (!hilo || typeof hilo !== 'object') {
      return '';
    }
    const row = hilo as Record<string, unknown>;
    const raw =
      row['conversacion_id'] ??
      row['session_id'] ??
      row['conversacionId'] ??
      row['sessionId'] ??
      row['id'];
    return raw == null ? '' : String(raw).trim();
  }

  normalizarHilo(hilo: ChatHilo): ChatHilo {
    const id = this.idDeHilo(hilo);
    return {
      ...hilo,
      conversacion_id: id || hilo.conversacion_id,
      session_id: hilo.session_id || id
    };
  }

  mapearMensajes(detalle: ChatHiloDetalle | unknown): ChatMensajeUi[] {
    return this.extraerMensajes(detalle).map((m) => ({
      remitente: m.remitente === 'usuario' ? 'usuario' : 'asistente',
      texto: m.mensaje || '',
      cards: Array.isArray(m.cards) ? m.cards : [],
      sugerencias: Array.isArray(m.sugerencias) ? m.sugerencias : [],
      fuente: m.fuente,
      cuerpo: m.cuerpo || null
    }));
  }

  idNuevo(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private extraerHilos(res: unknown): ChatHilo[] {
    const candidatos = this.listasCandidatas(res);
    return candidatos.filter((item): item is ChatHilo => !!item && typeof item === 'object');
  }

  private listasCandidatas(res: unknown): unknown[] {
    if (Array.isArray(res)) {
      return res;
    }
    const fuente = this.desenvolver(res);
    if (!fuente) {
      return [];
    }
    if (Array.isArray(fuente)) {
      return fuente;
    }
    for (const clave of ['conversaciones', 'sessions', 'hilos', 'items', 'data']) {
      const valor = fuente[clave];
      if (Array.isArray(valor)) {
        return valor;
      }
      if (valor && typeof valor === 'object') {
        const anidado = valor as Record<string, unknown>;
        for (const sub of ['conversaciones', 'sessions', 'hilos', 'items']) {
          if (Array.isArray(anidado[sub])) {
            return anidado[sub] as unknown[];
          }
        }
      }
    }
    return [];
  }

  private extraerMensajes(detalle: unknown): ChatMensajeGuardado[] {
    const fuente = this.desenvolver(detalle);
    if (!fuente) {
      return [];
    }
    if (Array.isArray(fuente)) {
      return fuente.filter((item): item is ChatMensajeGuardado => !!item && typeof item === 'object');
    }
    const raw = fuente['mensajes'] ?? fuente['messages'] ?? fuente['historial'];
    return Array.isArray(raw)
      ? raw.filter((item): item is ChatMensajeGuardado => !!item && typeof item === 'object')
      : [];
  }

  private normalizarDetalle(res: unknown, fallbackId: string): ChatHiloDetalle {
    const fuente = this.desenvolver(res);
    const base = (fuente && !Array.isArray(fuente) ? fuente : {}) as unknown as ChatHiloDetalle;
    const hilo = this.normalizarHilo(base);
    const id = this.idDeHilo(hilo) || fallbackId;
    return {
      ...hilo,
      conversacion_id: id,
      session_id: hilo.session_id || id,
      titulo: hilo.titulo || 'Conversación',
      estado: hilo.estado || 'activa',
      mensajes: this.extraerMensajes(fuente ?? res),
      limites: this.extraerLimites(fuente ?? res)
    };
  }

  extraerLimites(res: unknown): ChatLimites {
    const fuente = this.desenvolver(res);
    const raw =
      fuente && !Array.isArray(fuente) && fuente['limites'] && typeof fuente['limites'] === 'object'
        ? (fuente['limites'] as Record<string, unknown>)
        : {};
    const maxMensajes = Number(
      raw['max_mensajes_por_conversacion'] ?? raw['max_mensajes_guardados'] ?? 40
    );
    const maxChats = Number(raw['max_conversaciones_activas'] ?? 10);
    const maxHora = Number(raw['max_mensajes_por_hora'] ?? 20);
    const esperaSeg = Number(raw['espera_limite_segundos'] ?? 3600);
    const usadosHora = Number(raw['usados_hora'] ?? 0);
    return {
      maxMensajesPorChat: maxMensajes > 0 ? maxMensajes : 40,
      maxChatsActivos: maxChats > 0 ? maxChats : 10,
      maxMensajesPorHora: maxHora > 0 ? maxHora : 20,
      esperaMinutos: esperaSeg > 0 ? Math.round(esperaSeg / 60) : 60,
      esperaHoras: esperaSeg > 0 ? Math.max(1, Math.round(esperaSeg / 3600)) : 1,
      usadosHora: usadosHora >= 0 ? usadosHora : 0,
      aviso: typeof raw['aviso'] === 'string' ? raw['aviso'] : null
    };
  }

  extraerCupo(res: ChatResponse | unknown): ChatCupoHora | null {
    const raw =
      res && typeof res === 'object'
        ? ((res as ChatResponse).cupo
          || ((res as ChatResponse).datos && (res as ChatResponse).datos!['cupo']))
        : null;
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    const row = raw as Record<string, unknown>;
    const maximo = Number(row['maximo'] ?? 20);
    const usados = Number(row['usados'] ?? 0);
    const restantes = Number(row['restantes'] ?? Math.max(0, maximo - usados));
    const aviso = typeof row['aviso'] === 'string' ? row['aviso'] : null;
    const retry = row['retry_after_segundos'];
    return {
      usados,
      maximo: maximo > 0 ? maximo : 20,
      restantes: restantes >= 0 ? restantes : 0,
      esperaSegundos: Number(row['espera_segundos'] ?? 3600),
      aviso,
      retryAfterSegundos: typeof retry === 'number' ? retry : null
    };
  }

  parsearError(err: unknown): ChatErrorInfo {
    const http = err as { status?: number; error?: { detail?: unknown }; message?: string };
    const detail = http?.error?.detail;
    if (detail && typeof detail === 'object') {
      const row = detail as Record<string, unknown>;
      const mensaje =
        (typeof row['mensaje'] === 'string' && row['mensaje'].trim())
        || (typeof row['detail'] === 'string' && row['detail'].trim())
        || '';
      const retry = Number(row['retry_after_segundos'] ?? 0);
      const codigo = typeof row['codigo'] === 'string' ? row['codigo'] : '';
      if (mensaje) {
        return { mensaje, codigo, retryAfterSegundos: retry > 0 ? retry : 0 };
      }
    }
    if (typeof detail === 'string' && detail.trim()) {
      return {
        mensaje: detail,
        codigo: http?.status === 429 ? 'chat_ocupado' : '',
        retryAfterSegundos: 0
      };
    }
    if (typeof http?.message === 'string' && http.message.trim()) {
      return { mensaje: http.message, codigo: '', retryAfterSegundos: 0 };
    }
    return { mensaje: 'No se pudo contactar al asistente.', codigo: '', retryAfterSegundos: 0 };
  }

  private desenvolver(res: unknown): Record<string, unknown> | unknown[] | null {
    if (!res || typeof res !== 'object') {
      return null;
    }
    if (Array.isArray(res)) {
      return res;
    }
    const row = res as Record<string, unknown>;
    const nested = row['data'];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return { ...row, ...(nested as Record<string, unknown>) };
    }
    return row;
  }

  borrarHilo(conversacionId: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(
      `${this.base}/conversaciones/${encodeURIComponent(conversacionId)}`
    );
  }

  borrarTodos(): Observable<{ ok: boolean; borradas?: number }> {
    return this.http.delete<{ ok: boolean; borradas?: number }>(
      `${this.base}/conversaciones`,
      { params: { confirmar: 'true' } }
    );
  }

  nueva(): Observable<{ conversacion_id: string }> {
    return this.http.post<{ conversacion_id: string }>(`${this.base}/nueva`, {});
  }

  private async leerStream(
    mensaje: string,
    conversacionId: string | null | undefined,
    onEvento: (evento: ChatStreamEvent) => void,
    signal: AbortSignal,
    limitacion?: string | null
  ): Promise<ChatResponse> {
    const token = this.session.getToken();
    const body: { mensaje: string; conversacion_id?: string; limitacion?: string } = { mensaje };
    if (conversacionId) {
      body.conversacion_id = conversacionId;
    }
    const lim = (limitacion || '').trim();
    if (lim) {
      body.limitacion = lim;
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${this.base}/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal
    });
    if (!response.ok || !response.body) {
      if (response.status === 429) {
        let payload: { detail?: unknown } | undefined;
        try {
          payload = await response.json() as { detail?: unknown };
        } catch {
          payload = undefined;
        }
        const info = this.parsearError({ status: 429, error: payload });
        throw Object.assign(new Error(info.mensaje), {
          status: 429,
          error: payload,
          retryAfterSegundos: info.retryAfterSegundos
        });
      }
      throw new Error(`stream ${response.status}`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalRespuesta: ChatResponse | null = null;
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const partes = buffer.split(/\n\n/);
      buffer = partes.pop() || '';
      for (const parte of partes) {
        const linea = parte
          .split('\n')
          .map((l) => l.replace(/\r$/, ''))
          .find((l) => l.startsWith('data: '));
        if (!linea) {
          continue;
        }
        try {
          const evento = JSON.parse(linea.slice(6)) as ChatStreamEvent;
          if (evento.evento === 'error') {
            throw new Error(evento.detalle || 'Error en el asistente');
          }
          onEvento(evento);
          if (evento.evento === 'respuesta' && evento.datos) {
            finalRespuesta = evento.datos;
          }
        } catch (err) {
          if (err instanceof SyntaxError) {
            continue;
          }
          throw err;
        }
      }
    }
    if (!finalRespuesta) {
      throw new Error('stream incompleto');
    }
    return finalRespuesta;
  }
}
