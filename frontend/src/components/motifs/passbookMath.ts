// Running balance and day groups for the Passbook (spec §5.4). Pure, so the Ledger, Home and Fund tab agree
// with the tests on every BAKI figure.
import type { ReactNode } from 'react';
import { calendarDaysBetween, isValidDate, parseLocalDate } from '@/lib/dates';
import { roundMoney } from '@/lib/money';

/** One sub-item of a bundle (receipt line items). */
export interface PassbookSubRow {
  id: string | number;
  label: string;
  amount?: number;
  glyph?: ReactNode;
}

export interface PassbookRow {
  id: string | number;
  /** 'YYYY-MM-DD' */
  date: string;
  label: string;
  /** Category glyph (E5 IsoGlyph) or a trip's ISO chip on mixed lists. Decorative; the label carries meaning. */
  glyph?: ReactNode;
  /** KELUAR: money out, positive number, in the passbook (trip) currency. */
  out?: number;
  /** MASUK: money in (FUND SET, fund entries), positive number. */
  in?: number;
  /** Short code for line 2 and the details cell, e.g. 'FNB'. */
  sub?: string;
  /** What was really paid when it differs from the trip currency (§2.6). */
  originalAmount?: number | null;
  originalCurrency?: string | null;
  /** Payer initials on group trips, e.g. 'SA'. */
  payerInitials?: string;
  isBundle?: boolean;
  children?: PassbookSubRow[];
  /** Printed rows (FUND SET, brought forward) set the label in mono capitals. */
  kind?: 'entry' | 'system';
  /** Overrides the passbook currency for this row (Home's mixed-trip list). */
  currency?: string;
}

export interface PassbookLine extends PassbookRow {
  /** BAKI after this row. */
  balance: number;
}

/**
 * Running BAKI in the order given (oldest first): balance = opening + Σ(in − out). Rounded to the currency's
 * minor unit at every step so long ledgers don't drift.
 */
export function computePassbook(rows: readonly PassbookRow[], opening = 0, currency = 'MYR'): PassbookLine[] {
  let balance = roundMoney(opening, currency);
  return rows.map((row) => {
    balance = roundMoney(balance + (row.in ?? 0) - (row.out ?? 0), row.currency ?? currency);
    return { ...row, balance };
  });
}

export interface PassbookDay {
  date: string;
  lines: PassbookLine[];
  /** Σ out for the day. */
  spent: number;
}

/** Consecutive rows sharing a date become one day group (input order is kept). */
export function groupPassbookDays(lines: readonly PassbookLine[], currency = 'MYR'): PassbookDay[] {
  const days: PassbookDay[] = [];
  for (const line of lines) {
    const last = days[days.length - 1];
    if (last && last.date === line.date) {
      last.lines.push(line);
      last.spent = roundMoney(last.spent + (line.out ?? 0), currency);
    } else {
      days.push({ date: line.date, lines: [line], spent: roundMoney(line.out ?? 0, currency) });
    }
  }
  return days;
}

/**
 * Trip day number for a date: 1 on the start date. Dates outside the trip return 'before' / 'after', so
 * bookings made months ahead still group sensibly.
 */
export function tripDayOf(date: string, start?: string | null, end?: string | null): number | 'before' | 'after' | null {
  if (!start) return null;
  const d = parseLocalDate(date);
  const s = parseLocalDate(start);
  if (!isValidDate(d) || !isValidDate(s)) return null;
  const n = calendarDaysBetween(s, d) + 1;
  if (n < 1) return 'before';
  if (end) {
    const e = parseLocalDate(end);
    if (isValidDate(e) && calendarDaysBetween(e, d) > 0) return 'after';
  }
  return n;
}
