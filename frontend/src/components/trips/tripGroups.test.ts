import { describe, expect, it } from 'vitest';
import { EMPTY_FILTER_COPY, filterCounts, groupTrips, paddedCount, parseTripFilter, visibleGroups } from './tripGroups';

const today = new Date(2026, 9, 16); // Fri 16 Oct 2026
const t = (id: number, startDate: string, endDate: string) => ({ id, startDate, endDate });

const trips = [
  t(1, '2026-08-14', '2026-08-17'), // home (Bangkok)
  t(2, '2026-10-12', '2026-10-20'), // on the road (Tokyo, day 5)
  t(3, '2026-11-20', '2026-11-23'), // upcoming (Penang)
  t(4, '2026-12-18', '2026-12-24'), // upcoming (Seoul)
  t(5, '2025-12-05', '2025-12-07'), // home (Langkawi)
  t(6, '2026-10-16', '2026-10-16'), // on the road: a day trip today
  t(7, '2026-10-15', '2026-10-15'), // home since yesterday
  t(8, '2026-10-17', '2026-10-30'), // upcoming tomorrow
];

describe('groupTrips', () => {
  it('puts ON THE ROAD first, then UPCOMING soonest first, then HOME latest first', () => {
    const g = groupTrips(trips, today);
    expect(g.map((x) => x.label)).toEqual(['ON THE ROAD', 'UPCOMING', 'HOME']);
    expect(g[0].trips.map((x) => x.id)).toEqual([2, 6]);
    expect(g[1].trips.map((x) => x.id)).toEqual([8, 3, 4]);
    expect(g[2].trips.map((x) => x.id)).toEqual([7, 1, 5]);
  });

  it('does not mutate the input', () => {
    const copy = trips.map((x) => ({ ...x }));
    groupTrips(trips, today);
    expect(trips).toEqual(copy);
  });

  it('counts per filter', () => {
    expect(filterCounts(groupTrips(trips, today))).toEqual({ all: 8, upcoming: 3, road: 2, home: 3 });
    expect(filterCounts(groupTrips([], today))).toEqual({ all: 0, upcoming: 0, road: 0, home: 0 });
  });
});

describe('filters', () => {
  it('parses ?filter= and falls back to all', () => {
    expect(parseTripFilter('road')).toBe('road');
    expect(parseTripFilter('upcoming')).toBe('upcoming');
    expect(parseTripFilter('home')).toBe('home');
    expect(parseTripFilter('ongoing')).toBe('all');
    expect(parseTripFilter(null)).toBe('all');
  });

  it('shows only non-empty groups for the filter', () => {
    const g = groupTrips(trips, today);
    expect(visibleGroups(g, 'all').map((x) => x.phase)).toEqual(['onTheRoad', 'upcoming', 'home']);
    expect(visibleGroups(g, 'road').map((x) => x.phase)).toEqual(['onTheRoad']);
    expect(visibleGroups(g, 'home').map((x) => x.phase)).toEqual(['home']);
    const onlyHome = groupTrips([trips[0]], today);
    expect(visibleGroups(onlyHome, 'road')).toEqual([]);
    expect(visibleGroups(onlyHome, 'all').map((x) => x.phase)).toEqual(['home']);
  });

  it('has the spec copy for an empty filter', () => {
    expect(EMPTY_FILTER_COPY.road).toBe('Nothing on the road right now.');
  });

  it('pads the header count', () => {
    expect(paddedCount(7)).toBe('(07)');
    expect(paddedCount(0)).toBe('(00)');
    expect(paddedCount(124)).toBe('(124)');
  });
});
