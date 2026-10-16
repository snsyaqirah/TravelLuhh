// Pace: the sentence, then the chart on a leaf card, with a "Table" twin of the same numbers.
import { lazy, Suspense, useState } from 'react';
import type { FundState } from '@/hooks/useFund';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/lib/money';
import { formatWeekdayDayMonth } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { PacePoint } from '@/components/trip/fund/fundMath';
import { paceLine } from '@/components/trip/tripCopy';

const PaceChart = lazy(() => import('@/components/trip/fund/PaceChart'));

export interface PaceSectionProps {
  fund: FundState;
  points: PacePoint[];
  /** Spend dated before day 1 (bookings), for the upcoming-trip line. */
  spentBefore: number;
}

export function PaceSection({ fund, points, spentBefore }: PaceSectionProps) {
  const [table, setTable] = useState(false);
  const lived = points.some((p) => p.spent != null);
  const line = paceLine(fund, spentBefore);
  const c = fund.currency;

  return (
    <section aria-labelledby="fund-pace" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="fund-pace" className="type-title text-ink">
          Pace
        </h2>
        {lived ? (
          <button
            type="button"
            aria-pressed={table}
            onClick={() => setTable((v) => !v)}
            className="type-label -mr-2 inline-flex h-11 items-center px-2 text-ink underline decoration-rule-strong underline-offset-[3px] hover:decoration-ink"
          >
            {table ? 'Chart' : 'Table'}
          </button>
        ) : null}
      </div>
      <p className={cn('type-body', fund.pace && fund.pace.delta > 0.5 ? 'text-stamp' : 'text-ink')}>{line}</p>

      {lived ? (
        <div className="rounded-lg border border-rule bg-card p-4">
          {table ? (
            <div className="max-h-[320px] overflow-auto">
              <table className="w-full border-collapse">
                <caption className="sr-only">Spend by day against an even pace</caption>
                <thead className="type-overline sticky top-0 bg-card text-ink-3">
                  <tr className="border-b border-rule">
                    <th scope="col" className="h-8 text-left font-medium">
                      Day
                    </th>
                    <th scope="col" className="text-right font-medium">
                      Spent so far
                    </th>
                    <th scope="col" className="text-right font-medium">
                      Even pace
                    </th>
                  </tr>
                </thead>
                <tbody className="type-ledger">
                  {points.map((p, i) => (
                    <tr key={p.date} className={cn('h-10 border-b border-rule last:border-b-0', i % 2 === 1 && 'bg-stripe')}>
                      <th scope="row" className="text-left font-normal text-ink-2">
                        D{p.day} · {formatWeekdayDayMonth(p.date)}
                        {p.isToday ? <span className="type-overline ml-1.5 text-brass-ink">Today</span> : null}
                      </th>
                      <td className="text-right text-ink">{p.spent != null ? formatMoney(p.spent, c) : '—'}</td>
                      <td className="text-right text-ink-2">{p.even != null ? formatMoney(p.even, c) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Suspense fallback={<Skeleton className="h-[248px] w-full" />}>
              <PaceChart points={points} currency={c} summary={line} />
            </Suspense>
          )}
        </div>
      ) : null}
    </section>
  );
}
