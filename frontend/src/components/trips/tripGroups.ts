// Trips page grouping (§9.4): ON THE ROAD, then UPCOMING (start ascending), then HOME (end descending). The
// phase always comes from the dates (lib/phase), never from trips.status. Pure, so the page and tests agree.
import type { Trip } from '@/types';
import { getPhase, type Phase } from '@/lib/phase';

/** URL values of ?filter= (spec §6.1). */
export type TripFilter = 'all' | 'upcoming' | 'road' | 'home';

export const TRIP_FILTERS: readonly TripFilter[] = ['all', 'upcoming', 'road', 'home'];

export function parseTripFilter(value: string | null | undefined): TripFilter {
  return TRIP_FILTERS.includes(value as TripFilter) ? (value as TripFilter) : 'all';
}

const PHASE_OF_FILTER: Record<Exclude<TripFilter, 'all'>, Phase> = {
  upcoming: 'upcoming',
  road: 'onTheRoad',
  home: 'home',
};

export interface TripGroup<T extends GroupTrip = Trip> {
  phase: Phase;
  /** Overline section head. */
  label: 'ON THE ROAD' | 'UPCOMING' | 'HOME';
  trips: T[];
}

type GroupTrip = Pick<Trip, 'id' | 'startDate' | 'endDate'>;

const LABEL: Record<Phase, TripGroup['label']> = { onTheRoad: 'ON THE ROAD', upcoming: 'UPCOMING', home: 'HOME' };
const ORDER: readonly Phase[] = ['onTheRoad', 'upcoming', 'home'];

const byStartAsc = (a: GroupTrip, b: GroupTrip) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate) || a.id - b.id;
const byEndDesc = (a: GroupTrip, b: GroupTrip) => b.endDate.localeCompare(a.endDate) || b.startDate.localeCompare(a.startDate) || b.id - a.id;

/** Every phase, in page order, each sorted; empty groups included. */
export function groupTrips<T extends GroupTrip>(trips: readonly T[], today: Date): TripGroup<T>[] {
  const buckets: Record<Phase, T[]> = { onTheRoad: [], upcoming: [], home: [] };
  for (const t of trips) buckets[getPhase(t, today)].push(t);
  buckets.onTheRoad.sort(byStartAsc);
  buckets.upcoming.sort(byStartAsc);
  buckets.home.sort(byEndDesc);
  return ORDER.map((phase) => ({ phase, label: LABEL[phase], trips: buckets[phase] }));
}

export type TripFilterCounts = Record<TripFilter, number>;

export function filterCounts(groups: readonly TripGroup<GroupTrip>[]): TripFilterCounts {
  const n = (p: Phase) => groups.find((g) => g.phase === p)?.trips.length ?? 0;
  const road = n('onTheRoad');
  const upcoming = n('upcoming');
  const home = n('home');
  return { all: road + upcoming + home, upcoming, road, home };
}

/** The non-empty groups a filter shows, in page order. */
export function visibleGroups<T extends GroupTrip>(groups: readonly TripGroup<T>[], filter: TripFilter): TripGroup<T>[] {
  const wanted = filter === 'all' ? null : PHASE_OF_FILTER[filter];
  return groups.filter((g) => g.trips.length > 0 && (wanted === null || g.phase === wanted));
}

/** Copy for a filter with nothing in it (the whole list isn't empty). */
export const EMPTY_FILTER_COPY: Record<TripFilter, string> = {
  all: 'No trips yet. Your passport\'s looking very clean.',
  upcoming: 'Nothing coming up. Pick a place, we\'ll start the tabung.',
  road: 'Nothing on the road right now.',
  home: 'No trips home yet. The first BALIK stamp is still out there.',
};

export const FILTER_LABELS: Record<TripFilter, string> = {
  all: 'All',
  upcoming: 'Upcoming',
  road: 'On the road',
  home: 'Home',
};

/** Two-digit mono count for the header: (07), (12), (124). */
export function paddedCount(n: number): string {
  return `(${String(Math.max(0, n)).padStart(2, '0')})`;
}
