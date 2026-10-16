// Calendar-date helpers. Trip dates are plain 'YYYY-MM-DD' days with no timezone, so they are always parsed
// as LOCAL midnight. new Date('YYYY-MM-DD') would give UTC midnight, which in Malaysia (UTC+8) flips a trip
// to "home" at 08:00 on its last day and, west of UTC, shows every date a day early.
import { format } from 'date-fns';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?/;

/** 'YYYY-MM-DD' (or anything starting with it) → local Date at 00:00. Invalid input → Invalid Date. */
export function parseLocalDate(value: string | Date | null | undefined): Date {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const m = typeof value === 'string' ? DATE_RE.exec(value.trim()) : null;
  if (!m) return new Date(NaN);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // Reject rollovers such as 2026-02-31.
  if (d.getMonth() !== Number(m[2]) - 1) return new Date(NaN);
  return d;
}

/**
 * Backend timestamps ('2026-10-15T21:04:00', no offset) → local Date. An explicit offset or Z is honoured.
 * Falls back to parseLocalDate for date-only strings.
 */
export function parseServerDateTime(value: string | null | undefined): Date {
  if (!value) return new Date(NaN);
  const s = value.trim();
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s);
  const m = DATETIME_RE.exec(s);
  if (!m) return parseLocalDate(s);
  const ms = m[7] ? Math.round(Number(`0.${m[7]}`) * 1000) : 0;
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6] ?? 0),
    ms
  );
}

export function isValidDate(d: Date): boolean {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

/** Local calendar date → 'YYYY-MM-DD'. */
export function toISODate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Whole calendar days from a to b (b − a), ignoring the time of day and DST. */
export function calendarDaysBetween(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86_400_000);
}

export function addCalendarDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

/** Every date of a range, inclusive, as 'YYYY-MM-DD'. Capped to keep a bad range from hanging the UI. */
export function eachDateISO(start: string, end: string, max = 400): string[] {
  const s = parseLocalDate(start);
  const e = parseLocalDate(end);
  if (!isValidDate(s) || !isValidDate(e)) return [];
  const n = Math.min(Math.max(calendarDaysBetween(s, e), 0), max - 1);
  const out: string[] = [];
  for (let i = 0; i <= n; i++) out.push(toISODate(addCalendarDays(s, i)));
  return out;
}

const upper = (s: string) => s.toUpperCase();

/**
 * Mono date range for ticket fields:
 * same month '12–20 NOV 2026', across months '28 NOV – 3 DEC 2026', across years '28 DEC 2026 – 3 JAN 2027',
 * single day '12 NOV 2026'.
 */
export function formatRange(start: string | Date, end: string | Date): string {
  const s = parseLocalDate(start);
  const e = parseLocalDate(end);
  if (!isValidDate(s) && !isValidDate(e)) return '';
  if (!isValidDate(e)) return upper(format(s, 'd MMM yyyy'));
  if (!isValidDate(s)) return upper(format(e, 'd MMM yyyy'));
  const [a, b] = s <= e ? [s, e] : [e, s];
  if (a.getTime() === b.getTime()) return upper(format(a, 'd MMM yyyy'));
  if (a.getFullYear() !== b.getFullYear()) {
    return upper(`${format(a, 'd MMM yyyy')} – ${format(b, 'd MMM yyyy')}`);
  }
  if (a.getMonth() !== b.getMonth()) {
    return upper(`${format(a, 'd MMM')} – ${format(b, 'd MMM yyyy')}`);
  }
  return upper(`${format(a, 'd')}–${format(b, 'd MMM yyyy')}`);
}

/** '14 NOV' */
export function formatDayMonth(d: string | Date): string {
  const x = typeof d === 'string' ? parseLocalDate(d) : d;
  return isValidDate(x) ? upper(format(x, 'd MMM')) : '';
}

/** 'WED 14 NOV' */
export function formatWeekdayDayMonth(d: string | Date): string {
  const x = typeof d === 'string' ? parseLocalDate(d) : d;
  return isValidDate(x) ? upper(format(x, 'EEE d MMM')) : '';
}

/** 'THU 15 OCT 2026' (Home overline) */
export function formatOverlineDate(d: Date = new Date()): string {
  return isValidDate(d) ? upper(format(d, 'EEE d MMM yyyy')) : '';
}

/** '15 Oct' for sentences such as "Rates from 15 Oct". */
export function formatShortDate(d: string | Date): string {
  const x = typeof d === 'string' ? parseLocalDate(d) : d;
  return isValidDate(x) ? format(x, 'd MMM') : '';
}

/** '21:04' */
export function formatTime(d: Date): string {
  return isValidDate(d) ? format(d, 'HH:mm') : '';
}

export type Greeting = 'Pagi' | 'Petang' | 'Malam';

/** Pagi before 12:00, Petang 12:00–18:59, Malam from 19:00. */
export function greeting(now: Date = new Date()): Greeting {
  const h = now.getHours();
  if (h < 12) return 'Pagi';
  if (h < 19) return 'Petang';
  return 'Malam';
}
