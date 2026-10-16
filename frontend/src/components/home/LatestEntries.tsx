// "Latest entries" (§9.3): a dense Passbook of the newest spends and drop-ins across the live trips (at most 4
// trips fetched), each row led by its trip's ISO chip, amounts in that trip's currency, no running balance
// (the trips don't share one). A row opens that trip's ledger (or its fund, for drop-ins).
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import type { Trip } from '@/types';
import { expenseService } from '@/services/expenseService';
import { fundService } from '@/services/fundService';
import { queryKeys } from '@/lib/queryClient';
import { getErrorMessage } from '@/lib/axios';
import { Passbook, type PassbookRow } from '@/components/motifs';
import { CountryChip } from '@/components/glyphs';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { latestEntries } from '@/components/home/homeMath';
import { cn } from '@/lib/utils';

export interface LatestEntriesProps {
  /** Live trips in shelf order; only the first 4 are fetched. */
  trips: readonly Trip[];
  limit: number;
  className?: string;
}

const MAX_TRIPS = 4;

export function LatestEntries({ trips, limit, className }: LatestEntriesProps) {
  const navigate = useNavigate();
  const sources = useMemo(() => trips.slice(0, MAX_TRIPS), [trips]);
  const withFund = useMemo(() => sources.filter((t) => (t.savedAmount ?? 0) !== 0), [sources]);

  const expenseQs = useQueries({
    queries: sources.map((t) => ({
      queryKey: queryKeys.expenses(t.id),
      queryFn: () => expenseService.getExpensesByTrip(t.id),
    })),
  });
  const fundQs = useQueries({
    queries: withFund.map((t) => ({
      queryKey: queryKeys.fund(t.id),
      queryFn: () => fundService.get(t.id),
    })),
  });

  const loading = expenseQs.some((q) => q.isLoading) || fundQs.some((q) => q.isLoading);
  const failed = [...expenseQs, ...fundQs].filter((q) => q.isError);
  const allFailed = sources.length > 0 && expenseQs.every((q) => q.isError);

  // A handful of rows: cheap enough to rebuild on every render, and always in step with the query cache.
  const entries = latestEntries(
    sources.map((trip, i) => ({
      trip,
      expenses: expenseQs[i]?.data ?? null,
      fund: fundQs[withFund.findIndex((t) => t.id === trip.id)]?.data?.entries ?? null,
    })),
    limit,
  );
  const rows: PassbookRow[] = entries.map((e) => ({ ...e.row, glyph: <CountryChip code={e.code} size="sm" tone="muted" announce="none" /> }));
  const tripOf = new Map(entries.map((e) => [e.row.id, e.tripId]));

  return (
    <section aria-labelledby="home-latest" className={className}>
      <h2 id="home-latest" className="type-overline mb-2 text-ink-2">
        Latest entries
      </h2>
      {/* Wait for every source, so rows land together instead of printing in one query at a time. */}
      {loading ? (
        <Skeleton className={cn('w-full rounded-lg [--ledger-row:48px]', limit > 4 ? 'h-[288px]' : 'h-48')} />
      ) : allFailed ? (
        <div role="alert" className="flex flex-col items-start gap-3 border-l-[3px] border-stamp bg-stamp-tint px-4 py-3">
          <p className="type-body-s text-ink">{getErrorMessage(failed[0]?.error)}</p>
          <Button variant="secondary" size="sm" onClick={() => failed.forEach((q) => void q.refetch())}>
            Try again
          </Button>
        </div>
      ) : (
        <Passbook
          rows={rows}
          currency={sources[0]?.currency ?? 'MYR'}
          dense
          groupByDay={false}
          showBalance={false}
          newestFirst
          caption="Latest entries across your trips"
          empty={sources.length ? 'Nothing in the ledger yet. The first teh tarik counts too.' : 'No live trips, so no entries yet.'}
          onRowClick={(line) => {
            const id = tripOf.get(line.id);
            if (id) navigate(`/trips/${id}/${String(line.id).startsWith('f') ? 'fund' : 'ledger'}`);
          }}
        />
      )}
    </section>
  );
}
