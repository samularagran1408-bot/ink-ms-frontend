import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';

import { API_BASE_URL } from '@core/config/api.config';
import { SessionService } from '@core/services/session.service';
import { AppNotification } from '../models/accessibility-api';

/**
 * Canal SSE de notificaciones. EventSource nativo no envía Authorization,
 * así que se usa fetch + stream y reconexión automática.
 */
@Injectable({
  providedIn: 'root'
})
export class NotificationRealtimeService implements OnDestroy {
  private readonly incomingSubject = new Subject<AppNotification>();
  private readonly reconnectedSubject = new Subject<void>();

  readonly incoming$ = this.incomingSubject.asObservable();
  readonly reconnected$ = this.reconnectedSubject.asObservable();

  private started = false;
  private abort: AbortController | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = 1000;
  private everConnected = false;

  constructor(
    private session: SessionService,
    private zone: NgZone
  ) {}

  start(): void {
    if (this.started || !this.session.isAuthenticated()) {
      return;
    }
    this.started = true;
    this.backoffMs = 1000;
    void this.connect();
  }

  stop(): void {
    this.started = false;
    this.everConnected = false;
    this.backoffMs = 1000;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.abort?.abort();
    this.abort = null;
  }

  ngOnDestroy(): void {
    this.stop();
  }

  private async connect(): Promise<void> {
    if (!this.started || !this.session.isAuthenticated()) {
      return;
    }

    const token = this.session.getToken();
    if (!token) {
      this.scheduleReconnect();
      return;
    }

    this.abort?.abort();
    const controller = new AbortController();
    this.abort = controller;

    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/stream`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache'
        },
        cache: 'no-store',
        signal: controller.signal
      });

      if (response.status === 401 || response.status === 403) {
        this.started = false;
        return;
      }
      if (!response.ok || !response.body) {
        throw new Error(`SSE ${response.status}`);
      }

      this.backoffMs = 1000;
      if (this.everConnected) {
        this.zone.run(() => this.reconnectedSubject.next());
      }
      this.everConnected = true;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (this.started) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
        const parsed = this.consumeSse(buffer);
        buffer = parsed.rest;
        parsed.events.forEach((event) => this.handleEvent(event.name, event.data));
      }
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') {
        return;
      }
    }

    if (this.started) {
      this.scheduleReconnect();
    }
  }

  private handleEvent(name: string, data: string): void {
    if (!data || name === 'connected') {
      return;
    }
    try {
      const note = JSON.parse(data) as AppNotification;
      if (!note || typeof note !== 'object') {
        return;
      }
      if (!note.id && !note.title) {
        return;
      }
      this.zone.run(() => this.incomingSubject.next(note));
    } catch {
      // fragmento incompleto o no JSON
    }
  }

  private consumeSse(chunk: string): { rest: string; events: { name: string; data: string }[] } {
    const events: { name: string; data: string }[] = [];
    let rest = chunk;
    let separator = rest.indexOf('\n\n');
    while (separator >= 0) {
      const raw = rest.slice(0, separator);
      rest = rest.slice(separator + 2);
      let name = 'message';
      const dataLines: string[] = [];
      for (const line of raw.split('\n')) {
        if (!line || line.startsWith(':')) {
          continue;
        }
        if (line.startsWith('event:')) {
          name = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).replace(/^ /, ''));
        }
      }
      if (dataLines.length) {
        events.push({ name, data: dataLines.join('\n') });
      }
      separator = rest.indexOf('\n\n');
    }
    return { rest, events };
  }

  private scheduleReconnect(): void {
    if (!this.started || this.reconnectTimer) {
      return;
    }
    const wait = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, 15_000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, wait);
  }
}
