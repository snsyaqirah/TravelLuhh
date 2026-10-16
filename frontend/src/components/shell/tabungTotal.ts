// "IN TABUNG ≈ RM 7,880" on the desktop rail: what is still in the jars of upcoming and on-the-road trips,
// in the home currency. A missing rate means no total at all, never a sum that quietly drops a trip.
import { useMemo } from 'react';
import type { Rates, Trip } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useTrips } from '@/hooks/useTrips';
import { useRates } from '@/hooks/useRates';
import { useToday } from '@/hooks/useToday';
import { computeFund } from '@/hooks/useFund';
import { getPhase } from '@/lib/phase';
import { toHome } from '@/lib/money';

export interface TabungTotal {
  amount: number;
  currency: string;
  /** True when any trip was converted at today's rate. */
  approx: boolean;
  trips: number;
}

type TotalTrip = Pick<Trip, 'budget' | 'currency' | 'startDate' | 'endDate'> &
  Partial<Pick<Trip, 'totalExpenses' | 'spentAmount' | 'savedAmount'>>;

const norm = (code: string | null | undefined) => (code ?? '').trim().toUpperCase();

/** Trips whose jar still matters: not back home yet. */
export function liveTrips<T extends TotalTrip>(trips: readonly T[], today: Date): T[] {
  return trips.filter((t) => getPhase(t, today) !== 'home');
}

/** null when there is nothing to total or any trip's rate is missing. */
export function sumInTabung(
  trips: readonly TotalTrip[],
  today: Date,
  home: string,
  rates: Rates | null | undefined
): TabungTotal | null {
  const live = liveTrips(trips, today);
  if (live.length === 0) return null;
  const currency = norm(home);
  let amount = 0;
  let approx = false;
  for (const trip of live) {
    const inJar = computeFund(trip, today).inJar;
    if (norm(trip.currency) !== currency) approx = true;
    const converted = toHome(inJar, norm(trip.currency), rates, currency);
    if (converted == null) return null;
    amount += converted;
  }
  return { amount, currency, approx, trips: live.length };
}

/** Pass enabled = false to skip the trips and rates fetches (the rail block is desktop only). */
export function useTabungTotal(enabled = true): TabungTotal | null {
  const { user } = useAuth();
  const home = norm(user?.currency) || 'MYR';
  const today = useToday();
  const { trips, isLoading } = useTrips({ enabled });
  const needsRates = useMemo(
    () => liveTrips(trips, today).some((t) => norm(t.currency) !== home),
    [trips, today, home]
  );
  const { rates } = useRates(enabled && needsRates ? home : null);

  return useMemo(
    () => (!enabled || isLoading ? null : sumInTabung(trips, today, home, rates)),
    [enabled, isLoading, trips, today, home, rates]
  );
}
