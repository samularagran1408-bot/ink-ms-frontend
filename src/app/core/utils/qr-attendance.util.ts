/** Ruta pública de la encuesta de asistencia (la cámara del celular debe abrir una URL). */
export const ATTENDANCE_CHECKIN_PATH = '/asistencia';

export function isSafeReturnUrl(url: string | null | undefined): boolean {
  if (!url) {
    return false;
  }
  return url.startsWith('/') && !url.startsWith('//') && !url.includes('://');
}

export function buildAttendanceCheckinUrl(qrCode: string, eventId?: string | null): string {
  const origin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : '';
  const url = new URL(ATTENDANCE_CHECKIN_PATH, origin || 'http://localhost');
  url.searchParams.set('code', qrCode);
  if (eventId) {
    url.searchParams.set('eventId', eventId);
  }
  return url.toString();
}

/** Acepta el código crudo o la URL completa que ahora va impresa en el QR. */
export function extractQrCode(raw: string | null | undefined): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) {
    return '';
  }

  try {
    const url = new URL(trimmed);
    const code = url.searchParams.get('code')
      || url.searchParams.get('qr')
      || url.searchParams.get('qrCode');
    if (code?.trim()) {
      return code.trim();
    }
  } catch {
    // No era una URL absoluta.
  }

  return trimmed;
}

export function eventDateTimeMs(eventDate?: string | number[] | null, eventTime?: string | number[] | null): number | null {
  const date = normalizeDatePart(eventDate);
  if (!date) {
    return null;
  }
  const time = normalizeTimePart(eventTime);
  const parsed = new Date(date.year, date.month - 1, date.day, time.hour, time.minute, time.second);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function normalizeDatePart(value?: string | number[] | null): { year: number; month: number; day: number } | null {
  if (Array.isArray(value) && value.length >= 3) {
    return { year: Number(value[0]), month: Number(value[1]), day: Number(value[2]) };
  }
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return null;
  }
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function normalizeTimePart(value?: string | number[] | null): { hour: number; minute: number; second: number } {
  if (Array.isArray(value) && value.length >= 2) {
    return {
      hour: Number(value[0]) || 0,
      minute: Number(value[1]) || 0,
      second: Number(value[2]) || 0
    };
  }
  const text = String(value || '00:00:00').trim();
  const parts = text.substring(0, 8).split(':');
  return {
    hour: Number(parts[0]) || 0,
    minute: Number(parts[1]) || 0,
    second: Number(parts[2]) || 0
  };
}
