import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { API_BASE_URL } from '@core/config/api.config';
import {
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
    return {
      maxMensajesPorChat: maxMensajes > 0 ? maxMensajes : 40,
      maxChatsActivos: maxChats > 0 ? maxChats : 10
    };
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
        let detail = 'Ya hay una respuesta en curso. Espera un momento.';
        try {
          const body = await response.json() as { detail?: unknown };
          if (typeof body?.detail === 'string' && body.detail.trim()) {
            detail = body.detail;
          }
        } catch {
          /* cuerpo no JSON */
        }
        throw new Error(detail);
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
