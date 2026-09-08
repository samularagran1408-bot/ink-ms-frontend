import { EventItem } from '@features/sports-disabilities/models/sports';

const CANCELLED_VISIBLE_MS = 2 * 60 * 60 * 1000;

/** Un evento cancelado permanece visible 2 h; después se oculta. */
export function isEventVisible(event: Pick<EventItem, 'status' | 'cancelledAt'>, nowMs = Date.now()): boolean {
  const status = (event.status || '').toLowerCase();
  if (status !== 'cancelled') {
    return true;
  }
  if (!event.cancelledAt) {
    return false;
  }
  const cancelledMs = Date.parse(event.cancelledAt);
  if (Number.isNaN(cancelledMs)) {
    return false;
  }
  return nowMs - cancelledMs < CANCELLED_VISIBLE_MS;
}
