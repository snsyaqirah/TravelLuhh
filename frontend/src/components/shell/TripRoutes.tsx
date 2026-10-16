import type { ReactNode } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useTrip } from '@/hooks/useTrips';
import { getPhase } from '@/lib/phase';
import { AppSkeleton } from '@/components/shell/AppSkeleton';
import { defaultTabForPhase, isTripTab, withParam } from '@/components/shell/routeMeta';

/**
 * /trips/:tripId → the tab that fits the trip's phase (upcoming → days, on the road → ledger, home → fund).
 * /trips/:tripId/edit renders this with sheet="edit", so the edit sheet opens over that tab (?sheet=edit).
 * A missing or forbidden trip still goes to /fund, where TripDetail shows its own not-found state.
 */
export function TripIndexRedirect({ sheet }: { sheet?: string }) {
  const { tripId = '' } = useParams<{ tripId: string }>();
  const { search, hash } = useLocation();
  const { trip, isLoading } = useTrip(tripId);

  if (isLoading && !trip) return <AppSkeleton />;

  const tab = trip ? defaultTabForPhase(getPhase(trip)) : 'fund';
  return (
    <Navigate
      replace
      to={{
        pathname: `/trips/${encodeURIComponent(tripId)}/${tab}`,
        search: sheet ? withParam(search, 'sheet', sheet) : search,
        hash,
      }}
    />
  );
}

/** /trips/:tripId/:tab with an unknown tab → the fund tab, keeping the query (?day, ?cat, ?sheet). */
export function TripTabGuard({ children }: { children: ReactNode }) {
  const { tripId = '', tab } = useParams<{ tripId: string; tab: string }>();
  const { search, hash } = useLocation();
  if (!isTripTab(tab)) {
    return <Navigate replace to={{ pathname: `/trips/${encodeURIComponent(tripId)}/fund`, search, hash }} />;
  }
  return <>{children}</>;
}
