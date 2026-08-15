import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config/api.config';
import { ChatHilo, ChatResponse } from '../models/chat';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly base = `${API_BASE_URL}/api/ai/chat`;

  constructor(private http: HttpClient) {}

  enviar(mensaje: string, conversacionId?: string | null): Observable<ChatResponse> {
    const body: { mensaje: string; conversacion_id?: string } = { mensaje };
    if (conversacionId) {
      body.conversacion_id = conversacionId;
    }
    return this.http.post<ChatResponse>(`${this.base}/`, body);
  }

  describirMcp(): Observable<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(`${this.base}/mcp`);
  }

  listarHilos(): Observable<{ conversaciones: ChatHilo[] }> {
    return this.http.get<{ conversaciones: ChatHilo[] }>(`${this.base}/conversaciones`);
  }

  nueva(): Observable<{ conversacion_id: string }> {
    return this.http.post<{ conversacion_id: string }>(`${this.base}/nueva`, {});
  }
}
