import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config/api.config';
import { ChatHilo, ChatHiloDetalle, ChatResponse, ChatStreamEvent } from '../models/chat';
import { SessionService } from './session.service';

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
          const streamCaido = err instanceof TypeError || /^stream \d+/.test(msg);
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

  listarHilos(): Observable<{ conversaciones: ChatHilo[] }> {
    return this.http.get<{ conversaciones: ChatHilo[] }>(`${this.base}/conversaciones`);
  }

  obtenerHilo(conversacionId: string): Observable<ChatHiloDetalle> {
    return this.http.get<ChatHiloDetalle>(
      `${this.base}/conversaciones/${encodeURIComponent(conversacionId)}`
    );
  }

  borrarHilo(conversacionId: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(
      `${this.base}/conversaciones/${encodeURIComponent(conversacionId)}`
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
