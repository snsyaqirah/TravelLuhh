// Fund tab (§9.6): where the money went (category table), the pace, the biggest spends, the travel fund
// (Phase B), and for group trips Kongsi and the jars. Desktop: spend on the left (7 cols), the fund and the
// people on the right (5 cols). Phones stack them; before the trip the travel fund comes first.
import { useMemo, type ReactNode } from 'react';
import type { Trip } from '@/types';
import type { FundState } from '@/hooks/useFund';
import { useExpenses } from '@/hooks/useExpenses';
import { useToday } from '@/hooks/useToday';
import { GhostOutline } from '@/components/motifs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { KongsiSection } from '@/components/settlement/KongsiSection';
import { BudgetAllocationPanel } from '@/components/members/BudgetAllocationPanel';
import { CategoryTable } from '@/components/trip/fund/CategoryTable';
import { PaceSection } from '@/components/trip/fund/PaceSection';
import { BiggestSpends } from '@/components/trip/fund/BiggestSpends';
import { TravelFundSection } from '@/components/trip/fund/TravelFundSection';
import { buildPace, categoryRows, spentBeforeTrip } from '@/components/trip/fund/fundMath';
import { useTripSheet } from '@/components/trip/useTripSheet';
import { isTripOwner } from '@/components/trip/tripTabs';
import { isLiveTrip } from '@/lib/phase';
import { toISODate } from '@/lib/dates';
import { cn } from '@/lib/utils';

export interface FundTabProps {
  trip: Trip;
  fund: FundState;
  canEdit: boolean;
}

export function FundTab({ trip, fund, canEdit }: FundTabProps) {
  const today = useToday();
  const live = isLiveTrip(trip, today);
  const { expenses, isLoading, error, refetch, spentByDay, totalSpent } = useExpenses(trip.id, { live });
  const { open } = useTripSheet();
  const c = trip.currency;
  const group = trip.budgetType !== 'solo';

  const rows = useMemo(() => categoryRows(expenses, c), [expenses, c]);
  const points = useMemo(
    () =>
      buildPace({
        startDate: trip.startDate,
        endDate: trip.endDate,
        byDay: spentByDay,
        target: fund.target,
        phase: fund.phase,
        currency: c,
        today: toISODate(today),
      }),
    [trip.startDate, trip.endDate, spentByDay, fund.target, fund.phase, c, today]
  );
  const spentBefore = useMemo(() => spentBeforeTrip(spentByDay, trip.startDate), [spentByDay, trip.startDate]);

  const travelFund = (
    <TravelFundSection trip={trip} fund={fund} canEdit={canEdit} today={today} onDropIn={() => open('drop-in')} />
  );

  let spend: ReactNode;
  if (isLoading) {
    spend = (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading the fund">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  } else if (error) {
    spend = (
      <div className="flex flex-col items-start gap-3 border-y border-rule py-4">
        <p className="type-body text-ink">{error}</p>
        <Button variant="secondary" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  } else if (!expenses.length) {
    spend = (
      <section aria-labelledby="fund-where" className="flex flex-col gap-3">
        <h2 id="fund-where" className="type-title text-ink">
          Where it went
        </h2>
        <div className="flex items-center gap-4 border-y border-rule py-4">
          <GhostOutline kind="jar" height={72} />
          <p className="type-body text-ink-2">
            Nothing spent yet. The first teh tarik counts too.
            {canEdit ? ' Log a spend and it lands here by category.' : ''}
          </p>
        </div>
      </section>
    );
  } else {
    spend = (
      <>
        <section id="categories" aria-labelledby="fund-where" className="flex scroll-mt-28 flex-col gap-3">
          <h2 id="fund-where" className="type-title text-ink">
            Where it went
          </h2>
          <CategoryTable tripId={trip.id} rows={rows} total={totalSpent} count={expenses.length} currency={c} />
        </section>
        <PaceSection fund={fund} points={points} spentBefore={spentBefore} />
        <BiggestSpends trip={trip} expenses={expenses} onOpen={(id) => open('expense', { id })} />
      </>
    );
  }

  const fundFirst = fund.phase === 'upcoming';

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-x-6 lg:gap-y-12">
      <div className={cn('flex min-w-0 flex-col gap-8 lg:col-span-7 lg:gap-12', fundFirst && 'order-2 lg:order-none')}>
        {spend}
      </div>
      <div className={cn('flex min-w-0 flex-col gap-8 lg:col-span-5 lg:gap-12', fundFirst && 'order-1 lg:order-none')}>
        {travelFund}
        {group ? <KongsiSection trip={trip} live={live} /> : null}
        {trip.budgetType === 'separated' ? (
          <BudgetAllocationPanel trip={trip} canManage={isTripOwner(trip)} phase={fund.phase} />
        ) : null}
      </div>
    </div>
  );
}
