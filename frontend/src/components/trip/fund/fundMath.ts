// Numbers behind the Fund tab: the pace series, the category table, the weekly saving plan and the jars hint.
// Pure, so the chart, its table twin and the tests read the same figures.
import type { Expense, FundEntry } from '@/types';
import { CATEGORY_ORDER, type CategoryKey } from '@/design/tokens';
import { isCategoryKey } from '@/lib/categories';
import { eachDateISO, formatShortDate, parseLocalDate, isValidDate, calendarDaysBetween } from '@/lib/dates';
import { roundMoney } from '@/lib/money';
import { sentenceMoney } from '@/lib/fundCopy';
import type { Phase } from '@/lib/phase';

// ── Category table ─────────────────────────────────────────────────────────

export interface CategoryRow {
  key: CategoryKey;
  amount: number;
  /** Share of everything spent, 0..1. */
  share: number;
  count: number;
}

/** One row per category with spend, in the fixed category order. Unknown categories count as Other. */
export function categoryRows(expenses: readonly Pick<Expense, 'category' | 'amount'>[], currency: string): CategoryRow[] {
  const sums = new Map<CategoryKey, { amount: number; count: number }>();
  let total = 0;
  for (const e of expenses) {
    const amount = Number(e.amount) || 0;
    const key: CategoryKey = isCategoryKey(e.category) ? e.category : 'other';
    const cur = sums.get(key) ?? { amount: 0, count: 0 };
    cur.amount += amount;
    cur.count += 1;
    sums.set(key, cur);
    total += amount;
  }
  return CATEGORY_ORDER.filter((k) => sums.has(k)).map((key) => {
    const { amount, count } = sums.get(key) as { amount: number; count: number };
    return { key, amount: roundMoney(amount, currency), share: total > 0 ? amount / total : 0, count };
  });
}

/** '43%', or '<1%' for a sliver that isn't zero. */
export function sharePercent(share: number): string {
  if (!(share > 0)) return '0%';
  const p = Math.round(share * 100);
  return p === 0 ? '<1%' : `${p}%`;
}

/** The three biggest spends, biggest first; ties go to the newer entry. */
export function biggestSpends<T extends Pick<Expense, 'id' | 'amount' | 'expenseDate'>>(expenses: readonly T[], n = 3): T[] {
  return [...expenses]
    .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0) || b.expenseDate.localeCompare(a.expenseDate) || b.id - a.id)
    .slice(0, n);
}

// ── Pace ───────────────────────────────────────────────────────────────────

export interface PacePoint {
  date: string;
  /** 1-based trip day. */
  day: number;
  /** Cumulative spend through this day; null for days not lived yet. */
  spent: number | null;
  /** Even pace through this day (target × day / days); null without a budget. */
  even: number | null;
  isToday: boolean;
}

interface PaceInput {
  startDate: string;
  endDate: string;
  /** Trip-currency spend per 'YYYY-MM-DD' (useExpenses().totalsByDay or a sum of expenses). */
  byDay: Record<string, number>;
  target: number;
  phase: Phase;
  currency: string;
  /** 'YYYY-MM-DD' */
  today: string;
}

/**
 * Cumulative spend per trip day against an even line from 0 to the budget. Spends dated before the trip
 * (flights, deposits) count on day 1; spends after it on the last day, like the trip plot's stones.
 * Upcoming trips have no lived days, so every `spent` is null.
 */
export function buildPace({ startDate, endDate, byDay, target, phase, currency, today }: PaceInput): PacePoint[] {
  const dates = eachDateISO(startDate, endDate);
  if (!dates.length) return [];
  const first = dates[0];
  const last = dates[dates.length - 1];
  const perDay = new Map<string, number>();
  for (const [date, raw] of Object.entries(byDay)) {
    const amount = Number(raw) || 0;
    const d = date < first ? first : date > last ? last : date;
    perDay.set(d, (perDay.get(d) ?? 0) + amount);
  }
  const lived = phase === 'home' ? dates.length : phase === 'onTheRoad' ? Math.max(1, dates.indexOf(today) + 1 || dates.length) : 0;
  let running = 0;
  return dates.map((date, i) => {
    running += perDay.get(date) ?? 0;
    const day = i + 1;
    return {
      date,
      day,
      spent: day <= lived ? roundMoney(running, currency) : null,
      even: target > 0 ? roundMoney((target * day) / dates.length, currency) : null,
      isToday: phase === 'onTheRoad' && date === today,
    };
  });
}

/** Spend logged before the first day (bookings); shown under an upcoming trip's empty pace chart. */
export function spentBeforeTrip(byDay: Record<string, number>, startDate: string): number {
  return Object.entries(byDay).reduce((s, [d, v]) => (d < startDate ? s + (Number(v) || 0) : s), 0);
}

// ── Saving plan (Phase B) ──────────────────────────────────────────────────

export interface SavingPlan {
  perWeek: number;
  weeks: number;
  /** '18 Dec' */
  until: string;
}

/**
 * "Save RM 417 a week until 18 Dec": what's left to save, spread over the whole weeks before the trip starts,
 * rounded up to a whole unit so the target is met. Null once the trip has started or nothing is left to save.
 */
export function savingPlan(toSave: number, startDate: string, today: Date): SavingPlan | null {
  const start = parseLocalDate(startDate);
  if (!(toSave > 0) || !isValidDate(start)) return null;
  const days = calendarDaysBetween(today, start);
  if (days <= 0) return null;
  const weeks = Math.max(1, Math.ceil(days / 7));
  return { perWeek: Math.ceil(toSave / weeks), weeks, until: formatShortDate(start) };
}

/** The day the fund first reached the target (the CUKUP stamp's date), or null if it never has. */
export function fundedOn(entries: readonly Pick<FundEntry, 'amount' | 'entryDate' | 'id'>[], target: number): string | null {
  if (!(target > 0)) return null;
  let sum = 0;
  let reached: string | null = null;
  for (const e of [...entries].sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.id - b.id)) {
    sum += Number(e.amount) || 0;
    if (sum >= target - 0.005) reached ??= e.entryDate;
    else reached = null; // a withdrawal took it back under; the stamp is earned again later
  }
  return reached;
}

// ── Jars (separated trips) ─────────────────────────────────────────────────

export interface AllocationHint {
  tone: 'ok' | 'short' | 'over';
  text: string;
}

/**
 * How the jars add up against the trip budget. The server doesn't enforce it (B2), so this is a hint:
 * 'RM 1,500 in jars, the whole budget.' · 'RM 200 of the budget isn't in a jar yet.' · 'RM 100 more than the budget.'
 */
export function allocationHint(allocated: number, budget: number, currency: string): AllocationHint {
  const sum = roundMoney(allocated, currency);
  const b = roundMoney(budget, currency);
  const gap = roundMoney(b - sum, currency);
  if (b <= 0) return { tone: 'ok', text: `${sentenceMoney(sum, currency)} in jars. The trip has no budget to match.` };
  if (gap === 0) return { tone: 'ok', text: `${sentenceMoney(sum, currency)} in jars, the whole budget.` };
  if (gap > 0) return { tone: 'short', text: `${sentenceMoney(gap, currency)} of the ${sentenceMoney(b, currency)} budget isn't in a jar yet.` };
  return { tone: 'over', text: `${sentenceMoney(-gap, currency)} more than the ${sentenceMoney(b, currency)} budget.` };
}
