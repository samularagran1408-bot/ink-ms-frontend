import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { AppNotification } from '../models/accessibility-api';
import { NotificationRealtimeService } from './notification-realtime.service';

export type LiveSyncKind =
  | 'attendance'
  | 'registration'
  | 'routine'
  | 'event'
  | 'reconnect'
  | 'generic';

export interface LiveSyncPulse {
  kind: LiveSyncKind;
  type?: string;
  eventId?: string;
}

/**
 * Reutiliza el canal SSE de notificaciones para refrescar pantallas
 * (asistencias, inscripciones, paneles) sin recargar la página.
 */
@Injectable({ providedIn: 'root' })
export class LiveSyncService implements OnDestroy {
  private readonly pulseSubject = new Subject<LiveSyncPulse>();
  readonly pulse$ = this.pulseSubject.pipe(debounceTime(400));

  private started = false;
  private readonly subs = new Subscription();

  constructor(private realtime: NotificationRealtimeService) {}

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.realtime.start();
    this.subs.add(
      this.realtime.incoming$.subscribe((note) => this.pulseSubject.next(this.fromNote(note)))
    );
    this.subs.add(
      this.realtime.reconnected$.subscribe(() => this.pulseSubject.next({ kind: 'reconnect' }))
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  private fromNote(note: AppNotification): LiveSyncPulse {
    const type = (note.type || '').toLowerCase();
    const eventId = note.eventId;
    if (
      type.includes('attendance')
      || type.includes('checkin')
      || type.includes('asist')
    ) {
      return { kind: 'attendance', type, eventId };
    }
    if (
      type.includes('waitlist')
      || type.includes('registration')
      || type.includes('inscrip')
      || type.includes('event_full')
    ) {
      return { kind: 'registration', type, eventId };
    }
    if (type.includes('routine') || type.includes('rutina')) {
      return { kind: 'routine', type, eventId };
    }
    if (type.includes('event') || type.includes('evento')) {
      return { kind: 'event', type, eventId };
    }
    return { kind: 'generic', type, eventId };
  }
}
