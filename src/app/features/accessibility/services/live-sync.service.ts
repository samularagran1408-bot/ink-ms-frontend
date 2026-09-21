import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

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

const ATTENDANCE_TYPES = new Set([
  'attendance_confirmed',
  'attendance_checkin',
  'admin_attendance_checkin'
]);

/** True si el tipo de notificación implica un check-in reciente. */
export function isAttendanceNotificationType(type?: string | null): boolean {
  if (!type) {
    return false;
  }
  const normalized = type.trim().toLowerCase();
  return ATTENDANCE_TYPES.has(normalized) || normalized.includes('attendance');
}

/**
 * Refresco en caliente de pantallas abiertas (sin F5).
 * Emite tras check-in local o al detectar/leer avisos de asistencia.
 */
@Injectable({ providedIn: 'root' })
export class LiveSyncService implements OnDestroy {
  private readonly pulseSubject = new Subject<LiveSyncPulse>();
  readonly pulse$ = this.pulseSubject.pipe(debounceTime(400));

  private started = false;

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
  }

  /** Avisa a las vistas suscritas para que recarguen datos en silencio. */
  emit(pulse: LiveSyncPulse): void {
    this.start();
    this.pulseSubject.next(pulse);
  }

  /** Atajo para check-ins (QR, manual o aviso recibido). */
  emitAttendance(eventId?: string | null, type?: string): void {
    this.emit({
      kind: 'attendance',
      type,
      eventId: eventId || undefined
    });
  }

  ngOnDestroy(): void {
    this.started = false;
    this.pulseSubject.complete();
  }
}
