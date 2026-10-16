// Pure helpers for the Days tab (§9.6): the day strip, the default day and the timeline split.
// Dates are plain 'YYYY-MM-DD' calendar days; never parse them with new Date('YYYY-MM-DD').
import { format } from 'date-fns';
import type { ItineraryItem, Trip } from '@/types';
import { eachDateISO, isValidDate, parseLocalDate, toISODate } from '@/lib/dates';
import { getPhase } from '@/lib/phase';

type TripDates = Pick<Trip, 'startDate' | 'endDate'>;

export interface DayStub {
  /** 'YYYY-MM-DD' */
  iso: string;
  /** 1-based day of the trip; null for a day outside the trip that still has stops. */
  index: number | null;
  /** 'D3', or 'BEFORE' / 'AFTER' for stops left outside the dates after the trip was moved. */
  overline: string;
  /** 'WED 14' */
  label: string;
  /** 'Wednesday 14 October', for screen readers and the day header. */
  long: string;
  isToday: boolean;
}

/** Days longer than this are still listed, but a broken range can't hang the strip. */
const MAX_DAYS = 400;

const upper = (s: string) => s.toUpperCase();

function stubFor(iso: string, index: number | null, overline: string, todayIso: string): DayStub {
  const d = parseLocalDate(iso);
  return {
    iso,
    index,
    overline,
    label: isValidDate(d) ? upper(format(d, 'EEE d')) : iso,
    long: isValidDate(d) ? format(d, 'EEEE d MMMM') : iso,
    isToday: iso === todayIso,
  };
}

/**
 * Every day of the trip as a stub, in order. Stops that sit outside the trip dates (the trip was moved after
 * they were added; the server lets them keep their date) get their own BEFORE/AFTER stubs so they never vanish.
 */
export function tripDayStubs(trip: TripDates, today: Date = new Date(), itemDates: Iterable<string> = []): DayStub[] {
  const todayIso = toISODate(today);
  const days = eachDateISO(trip.startDate, trip.endDate, MAX_DAYS);
  const inTrip = new Set(days);
  const before: string[] = [];
  const after: string[] = [];
  for (const iso of new Set(itemDates)) {
    if (inTrip.has(iso) || !isValidDate(parseLocalDate(iso))) continue;
    (iso < trip.startDate ? before : after).push(iso);
  }
  before.sort();
  after.sort();
  return [
    ...before.map((iso) => stubFor(iso, null, 'BEFORE', todayIso)),
    ...days.map((iso, i) => stubFor(iso, i + 1, `D${i + 1}`, todayIso)),
    ...after.map((iso) => stubFor(iso, null, 'AFTER', todayIso)),
  ];
}

/** Today while the trip is on the road, otherwise its first day. */
export function defaultSelectedDay(trip: TripDates, today: Date = new Date()): string {
  return getPhase(trip, today) === 'onTheRoad' ? toISODate(today) : trip.startDate;
}

/** The day to show: the requested one when it's in the strip, else the default. */
export function resolveSelectedDay(
  trip: TripDates,
  requested: string | null | undefined,
  stubs: readonly DayStub[],
  today: Date = new Date()
): string {
  if (requested && stubs.some((s) => s.iso === requested)) return requested;
  const fallback = defaultSelectedDay(trip, today);
  if (stubs.some((s) => s.iso === fallback)) return fallback;
  return stubs[0]?.iso ?? trip.startDate;
}

/** '11:40:00' or '11:40' → '11:40'; empty for no time. */
export function hhmm(t: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec((t ?? '').trim());
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
}

/** Scheduled stops in time order, then the ones without a start time ("Unscheduled", at the bottom). */
export function splitDayItems(items: readonly ItineraryItem[]): { scheduled: ItineraryItem[]; unscheduled: ItineraryItem[] } {
  const scheduled: ItineraryItem[] = [];
  const unscheduled: ItineraryItem[] = [];
  for (const it of items) (hhmm(it.startTime) ? scheduled : unscheduled).push(it);
  scheduled.sort(
    (a, b) => hhmm(a.startTime).localeCompare(hhmm(b.startTime)) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id
  );
  unscheduled.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id);
  return { scheduled, unscheduled };
}

/**
 * Whether a stop has already happened: every stop on a past day, and today's stops whose start time has
 * passed. Drawn as a filled station on the transit line; upcoming ones stay hollow.
 */
export function isStopPast(itemDate: string, startTime: string | null | undefined, now: Date = new Date()): boolean {
  const todayIso = toISODate(now);
  if (itemDate < todayIso) return true;
  if (itemDate > todayIso) return false;
  const t = hhmm(startTime);
  if (!t) return false;
  const nowHm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return t <= nowHm;
}

/** "1 stop" / "3 stops" */
export const stopCount = (n: number) => `${n} ${n === 1 ? 'stop' : 'stops'}`;


/** id of a day stub (tab) in the strip, for aria-labelledby on the day panel. */
export const dayTabId = (idBase: string, iso: string) => `${idBase}-day-${iso}`;
