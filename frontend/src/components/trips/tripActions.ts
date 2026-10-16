// Who may do what to a trip from a list, and the delete confirmation sentence (§11). Pure.
import type { Trip } from '@/types';

/** What the signed-in person may do to a trip from the list. */
export function tripPermissions(trip: Pick<Trip, 'myRole'>) {
  const role = trip.myRole ?? 'viewer';
  return { canEdit: role !== 'viewer', isOwner: role === 'owner' };
}

/** 'This removes the trip and all 38 entries for good.' (count unknown → no number). */
export function deleteTripSentence(count: number | null): string {
  if (count == null) return 'This removes the trip and everything in it for good.';
  if (count === 0) return 'This removes the trip for good. Its ledger is empty.';
  if (count === 1) return 'This removes the trip and its 1 entry for good.';
  return `This removes the trip and all ${count.toLocaleString('en-MY')} entries for good.`;
}
