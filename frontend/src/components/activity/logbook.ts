// Pure helpers for the Logbook sheet (§9.6): the activity feed grouped by local day, newest first, with a
// departure-board code per line (what part of the trip it touched).
import { format } from 'date-fns';
import type { Activity } from '@/types';
import { isValidDate, parseServerDateTime, toISODate } from '@/lib/dates';

export interface LogLine {
  activity: Activity;
  at: Date;
  /** '21:04' */
  time: string;
  code: LogCode;
}

export interface LogDay {
  /** 'YYYY-MM-DD', or 'unknown' for rows without a usable timestamp. */
  iso: string;
  /** 'WED 14 OCT' (adds the year when it isn't this year) */
  label: string;
  lines: LogLine[];
}

export type LogCode = 'SPEND' | 'DAYS' | 'PACK' | 'NOTES' | 'FUND' | 'GENG' | 'TRIP' | 'LOG';

/** What a line touched, as a board code. Unknown future types still render, as LOG. */
export function logCode(actionType: string): LogCode {
  if (actionType.startsWith('expense_')) return 'SPEND';
  if (actionType.startsWith('itinerary_')) return 'DAYS';
  if (actionType.startsWith('packing_')) return 'PACK';
  if (actionType.startsWith('note_')) return 'NOTES';
  if (actionType.startsWith('fund_')) return 'FUND';
  if (actionType.startsWith('member_') || actionType === 'budgets_updated') return 'GENG';
  if (actionType.startsWith('trip_')) return 'TRIP';
  return 'LOG';
}

/** Spoken name of a code for screen readers. */
export const LOG_CODE_LABEL: Record<LogCode, string> = {
  SPEND: 'Ledger',
  DAYS: 'Days',
  PACK: 'Pack',
  NOTES: 'Notes',
  FUND: 'Fund',
  GENG: 'People',
  TRIP: 'Trip',
  LOG: 'Other',
};

/** Newest first (by time, then id), grouped by local calendar day. */
export function groupLogbook(activities: readonly Activity[], now: Date = new Date()): LogDay[] {
  const lines: LogLine[] = activities.map((a) => {
    const at = parseServerDateTime(a.createdAt);
    return { activity: a, at, time: isValidDate(at) ? format(at, 'HH:mm') : '', code: logCode(a.actionType) };
  });
  lines.sort((x, y) => {
    const tx = isValidDate(x.at) ? x.at.getTime() : -Infinity;
    const ty = isValidDate(y.at) ? y.at.getTime() : -Infinity;
    return ty - tx || y.activity.id - x.activity.id;
  });
  const days: LogDay[] = [];
  for (const line of lines) {
    const iso = isValidDate(line.at) ? toISODate(line.at) : 'unknown';
    let day = days[days.length - 1];
    if (!day || day.iso !== iso) {
      const label =
        iso === 'unknown'
          ? 'UNDATED'
          : format(line.at, line.at.getFullYear() === now.getFullYear() ? 'EEE d MMM' : 'EEE d MMM yyyy').toUpperCase();
      day = { iso, label, lines: [] };
      days.push(day);
    }
    day.lines.push(line);
  }
  return days;
}

/** Splits a server sentence so amounts ('MYR 1,234.00', 'JPY 3,200.00') can be set in mono. */
export function splitAmounts(text: string): Array<{ text: string; money: boolean }> {
  const re = /\b[A-Z]{3}\s[\d,]+(?:\.\d+)?\b/g;
  const out: Array<{ text: string; money: boolean }> = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i), money: false });
    out.push({ text: m[0], money: true });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), money: false });
  return out;
}
