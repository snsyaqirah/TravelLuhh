// The jar's numbers (spec §0.1 FundState). Pure computeFund is what scenes, tickets and tests use; useFund
// memoises it and rolls over at local midnight.
//
// Two modes:
//  - 'budget' (no fund entries yet): the budget counts as already set aside; the jar starts full and drains.
//  - 'saving' (savedAmount > 0, §2.3 Phase B): the jar holds what was really dropped in, minus spend.
// `over` is always measured against the target (budget).
import { useMemo } from 'react';
import type { Trip } from '@/types';
import { dayIndex, getPhase, tripDays, type Phase } from '@/lib/phase';
import { useToday } from '@/hooks/useToday';

export interface FundState {
  /** trip.budget */
  target: number;
  /** trip.totalExpenses (trip currency) */
  spent: number;
  /** SUM of fund entries (trip.savedAmount). 0 in budget mode. */
  saved: number;
  mode: 'budget' | 'saving';
  /** budget mode: max(0, target − spent). saving mode: max(0, saved − spent). */
  inJar: number;
  /** saving mode: max(0, target − saved). Always 0 in budget mode. */
  toSave: number;
  /** max(0, spent − target) */
  over: number;
  /** target > 0 ? clamp(inJar / target, 0, 1) : 0 */
  fill: number;
  /** spent / target (unclamped; 0 without a budget). Drives the 75/90/100% notices. */
  usedRatio: number;
  hasBudget: boolean;
  currency: string;
  phase: Phase;
  daysTotal: number;
  /** Days lived so far, today included (0 before the trip, daysTotal after). */
  daysElapsed: number;
  /** Days still to spend, today included (daysTotal before the trip, 0 after). */
  daysLeft: number;
  /** onTheRoad: inJar / daysLeft · upcoming: target / daysTotal · home: null. null without a budget. */
  dailyAllowance: number | null;
  /** onTheRoad with a budget: spent / daysElapsed × daysTotal; delta = projected − target. */
  pace: { projected: number; delta: number } | null;
}

export interface ComputeFundOptions {
  /** Override spent, e.g. a sum of the expenses list while the trip query catches up. */
  spent?: number;
  /** Override saved, e.g. from the fund summary. */
  saved?: number;
}

type FundTrip = Pick<Trip, 'budget' | 'currency' | 'startDate' | 'endDate'> &
  Partial<Pick<Trip, 'totalExpenses' | 'spentAmount' | 'savedAmount'>>;

function finite(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? v : 0;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

export function computeFund(trip: FundTrip, today: Date = new Date(), opts: ComputeFundOptions = {}): FundState {
  const target = Math.max(0, finite(trip.budget));
  const spent = Math.max(0, finite(opts.spent ?? trip.totalExpenses ?? trip.spentAmount ?? 0));
  const saved = Math.max(0, finite(opts.saved ?? trip.savedAmount ?? 0));
  const mode: FundState['mode'] = saved > 0 ? 'saving' : 'budget';
  const hasBudget = target > 0;

  const inJar = Math.max(0, (mode === 'saving' ? saved : target) - spent);
  const toSave = mode === 'saving' ? Math.max(0, target - saved) : 0;
  const over = Math.max(0, spent - target);
  const fill = hasBudget ? clamp01(inJar / target) : 0;
  const usedRatio = hasBudget ? spent / target : 0;

  const phase = getPhase(trip, today);
  const daysTotal = Math.max(1, tripDays(trip));
  let daysElapsed: number;
  let daysLeft: number;
  if (phase === 'onTheRoad') {
    const day = dayIndex(trip, today) ?? 1;
    daysElapsed = Math.min(Math.max(day, 1), daysTotal);
    daysLeft = Math.max(1, daysTotal - daysElapsed + 1);
  } else if (phase === 'upcoming') {
    daysElapsed = 0;
    daysLeft = daysTotal;
  } else {
    daysElapsed = daysTotal;
    daysLeft = 0;
  }

  let dailyAllowance: number | null = null;
  if (phase === 'onTheRoad' && (hasBudget || saved > 0)) dailyAllowance = inJar / daysLeft;
  else if (phase === 'upcoming' && hasBudget) dailyAllowance = target / daysTotal;

  let pace: FundState['pace'] = null;
  if (phase === 'onTheRoad' && hasBudget) {
    const projected = (spent / daysElapsed) * daysTotal;
    pace = { projected, delta: projected - target };
  }

  return {
    target,
    spent,
    saved,
    mode,
    inJar,
    toSave,
    over,
    fill,
    usedRatio,
    hasBudget,
    currency: trip.currency,
    phase,
    daysTotal,
    daysElapsed,
    daysLeft,
    dailyAllowance,
    pace,
  };
}

export function useFund(trip: FundTrip, opts?: ComputeFundOptions): FundState;
export function useFund(trip: FundTrip | null | undefined, opts?: ComputeFundOptions): FundState | null;
export function useFund(trip: FundTrip | null | undefined, opts: ComputeFundOptions = {}): FundState | null {
  const today = useToday();
  const { spent, saved } = opts;
  return useMemo(
    () => (trip ? computeFund(trip, today, { spent, saved }) : null),
    [trip, today, spent, saved]
  );
}
