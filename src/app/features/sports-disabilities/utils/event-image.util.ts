const DEFAULT_EVENT_IMAGE = 'assets/events/default.png';

const SPORT_IMAGES: Record<string, string> = {
  futbol: 'assets/events/futbol-sala.png',
  football: 'assets/events/futbol-sala.png',
  soccer: 'assets/events/futbol-sala.png',
  baloncesto: 'assets/events/baloncesto-silla.png',
  basket: 'assets/events/baloncesto-silla.png',
  natacion: 'assets/events/natacion.png',
  swim: 'assets/events/natacion.png'
};

function normalizeSport(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase();
}

/** Resuelve la portada de un evento (API o fallback por deporte). */
export function resolveEventImage(event: {
  imageUrl?: string | null;
  sportName?: string | null;
  sportId?: number | null;
}): string {
  if (event.imageUrl && event.imageUrl.trim()) {
    return event.imageUrl.trim();
  }
  const name = event.sportName ? normalizeSport(event.sportName) : '';
  for (const [key, path] of Object.entries(SPORT_IMAGES)) {
    if (name.includes(key)) {
      return path;
    }
  }
  if (event.sportId === 1) return SPORT_IMAGES['futbol'];
  if (event.sportId === 2) return SPORT_IMAGES['baloncesto'];
  if (event.sportId === 3) return SPORT_IMAGES['natacion'];
  return DEFAULT_EVENT_IMAGE;
}
