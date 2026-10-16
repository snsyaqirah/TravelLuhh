// Trip phase from LOCAL calendar dates (spec §0.1). trips.status on the server is not date-driven, so it is
// ignored here. A trip stays onTheRoad for the whole of its last day, until local midnight.
import type { Trip } from '@/types';
import {
  calendarDaysBetween,
  formatDayMonth,
  isValidDate,
  parseLocalDate,
} from '@/lib/dates';

export type Phase = 'upcoming' | 'onTheRoad' | 'home';

type TripDates = Pick<Trip, 'startDate' | 'endDate'>;

/** Start and end as local dates; a reversed or missing end collapses to the start. */
function bounds(trip: TripDates): { start: Date; end: Date } | null {
  const start = parseLocalDate(trip.startDate);
  if (!isValidDate(start)) return null;
  let end = parseLocalDate(trip.endDate);
  if (!isValidDate(end) || end < start) end = start;
  return { start, end };
}

/** today < start → upcoming; start ≤ today ≤ end → onTheRoad; after end → home. */
export function getPhase(trip: TripDates, today: Date = new Date()): Phase {
  const b = bounds(trip);
  if (!b) return 'upcoming';
  if (calendarDaysBetween(today, b.start) > 0) return 'upcoming';
  if (calendarDaysBetween(b.end, today) > 0) return 'home';
  return 'onTheRoad';
}

/** Inclusive day count: end − start + 1, at least 1. */
export function tripDays(trip: TripDates): number {
  const b = bounds(trip);
  if (!b) return 1;
  return calendarDaysBetween(b.start, b.end) + 1;
}

/** '9D8N'; a 1-day trip is '1D'. */
export function durationLabel(days: number): string {
  const d = Number.isFinite(days) ? Math.max(1, Math.round(days)) : 1;
  return d === 1 ? '1D' : `${d}D${d - 1}N`;
}

/** 1-based day number while onTheRoad, otherwise null. */
export function dayIndex(trip: TripDates, today: Date = new Date()): number | null {
  if (getPhase(trip, today) !== 'onTheRoad') return null;
  const b = bounds(trip);
  return b ? calendarDaysBetween(b.start, today) + 1 : null;
}

/** Days until the trip starts (0 on the start day, negative once started). */
export function daysUntilStart(trip: TripDates, today: Date = new Date()): number {
  const b = bounds(trip);
  return b ? calendarDaysBetween(today, b.start) : 0;
}

/**
 * PhaseTag text: 'UPCOMING · 28 DAYS' · 'ON THE ROAD · DAY 3/9' · 'HOME · 21 NOV'.
 * `saving` swaps UPCOMING for SAVING (Phase B, once the trip has a fund entry).
 */
export function phaseLabel(trip: TripDates, today: Date = new Date(), o: { saving?: boolean } = {}): string {
  const phase = getPhase(trip, today);
  if (phase === 'onTheRoad') {
    return `ON THE ROAD · DAY ${dayIndex(trip, today)}/${tripDays(trip)}`;
  }
  if (phase === 'home') {
    const b = bounds(trip);
    return b ? `HOME · ${formatDayMonth(b.end)}` : 'HOME';
  }
  const n = Math.max(0, daysUntilStart(trip, today));
  const word = o.saving ? 'SAVING' : 'UPCOMING';
  return `${word} · ${n} ${n === 1 ? 'DAY' : 'DAYS'}`;
}

/** Group trips on the road get light polling so everyone sees each other's spends. */
export function isLiveTrip(
  trip: Pick<Trip, 'startDate' | 'endDate' | 'budgetType' | 'memberCount'> | null | undefined,
  today: Date = new Date()
): boolean {
  if (!trip) return false;
  const group = trip.budgetType !== 'solo' || (trip.memberCount ?? 1) > 1;
  return group && getPhase(trip, today) === 'onTheRoad';
}
