import type { ReactNode } from 'react';
import type { Role, Trip } from '@/types';
import { roleAtLeast } from '@/components/trip/tripTabs';

interface PermissionGateProps {
  /** The trip as the API returns it; its `myRole` is the caller's role. */
  trip: Pick<Trip, 'myRole'> | null | undefined;
  /** Lowest role that sees the children. Writes need 'editor'; members, archive and delete need 'owner'. */
  need: Role;
  children: ReactNode;
  /** Shown instead (default: nothing). A write control a viewer can't use is left out, not disabled. */
  fallback?: ReactNode;
}

/** Renders children only when the caller's role on the trip is at least `need` (server rules, API.md). */
export function PermissionGate({ trip, need, children, fallback = null }: PermissionGateProps) {
  return <>{roleAtLeast(trip?.myRole, need) ? children : fallback}</>;
}
