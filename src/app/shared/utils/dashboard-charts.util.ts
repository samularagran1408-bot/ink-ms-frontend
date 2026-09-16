export interface DashBar {
  label: string;
  value: number;
  height: number;
  highlight: 'peak' | 'accent' | 'default';
}

export interface DashSlice {
  label: string;
  value: number;
  percent: number;
  color: string;
}

export interface WeeklyItem {
  eventDate?: string;
  sessionDate?: string;
  createdAt?: string;
  maxCapacity?: number;
  availableCapacity?: number;
  sportName?: string;
  disabilityFocus?: string;
}

export interface WeeklyExtra {
  registrationDate?: string;
  createdAt?: string;
  enrolledAt?: string;
  registeredAt?: string;
}

const SLICE_COLORS = ['#A30D11', '#1D4ED8', '#0F766E', '#B45309', '#7C3AED', '#0369A1'];

export function trendHasActivity(trend?: Record<string, number> | null): boolean {
  return Object.values(trend || {}).some((value) => Number(value) > 0);
}

export function buildWeeklyBars(trend?: Record<string, number> | null): DashBar[] {
  const entries = Object.entries(trend || {}).sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) {
    return [];
  }
  const values = entries.map(([, value]) => Number(value) || 0);
  const max = Math.max(...values, 1);
  const peak = Math.max(...values);
  return entries.map(([date, value], index) => {
    const num = Number(value) || 0;
    const day = new Date(`${date}T00:00:00`);
    const label = Number.isNaN(day.getTime())
      ? date.slice(5)
      : day.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '');
    let highlight: DashBar['highlight'] = 'default';
    if (num === peak && peak > 0) {
      highlight = 'peak';
    } else if (index === entries.length - 1 && num > 0) {
      highlight = 'accent';
    }
    return {
      label,
      value: num,
      height: Math.max(num > 0 ? 14 : 6, Math.round((num / max) * 100)),
      highlight
    };
  });
}

export function buildCountBars(counts?: Record<string, number> | null, limit = 6): DashBar[] {
  const entries = Object.entries(counts || {})
    .map(([label, value]) => [label, Number(value) || 0] as [string, number])
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
  if (!entries.length) {
    return [];
  }
  const max = Math.max(...entries.map(([, value]) => value), 1);
  const peak = Math.max(...entries.map(([, value]) => value));
  return entries.map(([label, value], index) => ({
    label,
    value,
    height: Math.max(value > 0 ? 14 : 6, Math.round((value / max) * 100)),
    highlight: value === peak && peak > 0 ? 'peak' : index === 0 ? 'accent' : 'default'
  }));
}

export function buildSlices(counts?: Record<string, number> | null): DashSlice[] {
  const entries = Object.entries(counts || {})
    .map(([label, value]) => [label, Number(value) || 0] as [string, number])
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1;
  return entries.map(([label, value], index) => ({
    label,
    value,
    percent: Math.round((value / total) * 100),
    color: SLICE_COLORS[index % SLICE_COLORS.length]
  }));
}

export function countByKey(
  items: Array<Record<string, unknown> | object>,
  key: string,
  fallback = '—'
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const raw = (item as Record<string, unknown>)[key];
    let label = raw == null ? fallback : String(raw);
    if (!label.trim() || label.toLowerCase() === 'null') {
      label = fallback;
    }
    counts[label] = (counts[label] || 0) + 1;
  }
  return counts;
}

export function resolveWeeklyTrend(
  backend?: Record<string, number> | null,
  items: WeeklyItem[] = [],
  extras: WeeklyExtra[] = []
): Record<string, number> {
  if (trendHasActivity(backend)) {
    return backend || {};
  }
  return computeWeeklyTrend(items, extras);
}

export function computeWeeklyTrend(items: WeeklyItem[] = [], extras: WeeklyExtra[] = []): Record<string, number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const past = fillWeek(addDays(today, -6), items, extras);
  if (trendHasActivity(past)) {
    return past;
  }
  const next = fillWeek(today, items, extras);
  if (trendHasActivity(next)) {
    return next;
  }
  const densest = densestWeekStart(items, extras);
  return densest ? fillWeek(densest, items, extras) : past;
}

function fillWeek(start: Date, items: WeeklyItem[], extras: WeeklyExtra[]): Record<string, number> {
  const trend: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    trend[toIso(addDays(start, i))] = 0;
  }
  for (const item of items) {
    const eventDay = parseDay(item.eventDate || item.sessionDate);
    if (eventDay && eventDay in trend) {
      trend[eventDay] += 1 + occupied(item);
    }
    const created = parseDay(item.createdAt);
    if (created && created in trend && created !== eventDay) {
      trend[created] += eventDay ? 1 : 1 + occupied(item);
    }
  }
  for (const row of extras) {
    const day = parseDay(row.registrationDate || row.createdAt || row.enrolledAt || row.registeredAt);
    if (day && day in trend) {
      trend[day] += 1;
    }
  }
  return trend;
}

function densestWeekStart(items: WeeklyItem[], extras: WeeklyExtra[]): Date | null {
  const days: Date[] = [];
  for (const item of items) {
    const eventDay = parseDay(item.eventDate || item.sessionDate);
    if (eventDay) {
      days.push(fromIso(eventDay));
    }
    const created = parseDay(item.createdAt);
    if (created) {
      days.push(fromIso(created));
    }
  }
  for (const row of extras) {
    const day = parseDay(row.registrationDate || row.createdAt || row.enrolledAt || row.registeredAt);
    if (day) {
      days.push(fromIso(day));
    }
  }
  if (!days.length) {
    return null;
  }
  days.sort((a, b) => a.getTime() - b.getTime());
  const min = days[0];
  const max = days[days.length - 1];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let best = min;
  let bestScore = -1;
  let bestDist = Number.MAX_SAFE_INTEGER;
  for (let start = new Date(min); start.getTime() <= max.getTime(); start = addDays(start, 1)) {
    const end = addDays(start, 6);
    const score = days.filter((day) => day.getTime() >= start.getTime() && day.getTime() <= end.getTime()).length;
    const dist = Math.abs((start.getTime() - today.getTime()) / 86_400_000);
    if (score > bestScore || (score === bestScore && dist < bestDist)) {
      bestScore = score;
      bestDist = dist;
      best = new Date(start);
    }
  }
  return bestScore <= 0 ? null : best;
}

function occupied(item: WeeklyItem): number {
  const max = Number(item.maxCapacity || 0);
  const available = item.availableCapacity == null ? max : Number(item.availableCapacity);
  return Math.max(max - available, 0);
}

function parseDay(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const raw = String(value).trim();
  if (!raw || raw.toLowerCase() === 'null' || raw.length < 10) {
    return null;
  }
  return raw.slice(0, 10);
}

function toIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fromIso(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}
