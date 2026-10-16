// Trip page tabs and roles. Pure, so routing, the header menu and the tests agree.
import type { Role, Trip } from '@/types';
import { TRIP_TABS, type TripTab } from '@/components/shell/routeMeta';

export { TRIP_TABS, type TripTab };

export const TAB_LABELS: Record<TripTab, string> = {
  fund: 'Fund',
  ledger: 'Ledger',
  days: 'Days',
  pack: 'Pack',
  notes: 'Notes',
};

/**
 * Query string for moving to another tab. Sheets close; ?cat only means something in the ledger; ?day is the
 * stage's selected stone, so it stays for the tabs that draw the trip plot (ledger, days, notes).
 */
export function searchForTab(search: string, tab: TripTab): string {
  const p = new URLSearchParams(search);
  p.delete('sheet');
  p.delete('id');
  if (tab !== 'ledger') p.delete('cat');
  if (tab === 'fund' || tab === 'pack') p.delete('day');
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Path for a tab of a trip, with an optional query (no leading '?' needed). */
export function tabPath(tripId: number | string, tab: TripTab, query?: Record<string, string>): string {
  const p = new URLSearchParams(query);
  const s = p.toString();
  return `/trips/${tripId}/${tab}${s ? `?${s}` : ''}`;
}

const RANK: Record<Role, number> = { viewer: 1, editor: 2, owner: 3 };

/** True when `role` is at least `need`. An unknown role (older API) is treated as a viewer. */
export function roleAtLeast(role: Role | null | undefined, need: Role): boolean {
  return RANK[role ?? 'viewer'] >= RANK[need];
}

/** Owners and editors write trip content (expenses, fund, itinerary, packing, notes, trip fields). */
export const canEditTrip = (trip: Pick<Trip, 'myRole'> | null | undefined) => roleAtLeast(trip?.myRole, 'editor');

/** Members, allocations, archive and delete are owner-only. */
export const isTripOwner = (trip: Pick<Trip, 'myRole'> | null | undefined) => trip?.myRole === 'owner';

/** Sheets that write; a viewer who lands on one by URL gets it closed. */
export const WRITE_SHEETS = new Set(['log-spend', 'edit', 'drop-in']);
