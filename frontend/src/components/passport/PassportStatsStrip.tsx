// The Passport's numbers as one ruled passbook strip (§9.7): TRIPS · COUNTRIES · DAYS AWAY · SPENT · BAKI ·
// AVG/DAY, in the home currency. One row of six on desktop, 2×3 on phones. When a currency has no rate the
// money cells list each currency on its own line and a note says why, instead of adding yen to ringgit.
import type { ReactNode } from 'react';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { MoneyTotal, PassportStats } from '@/components/passport/passportMath';

export interface PassportStatsStripProps {
  stats: PassportStats;
  /** e.g. "2026" or "all years": names the strip for screen readers. */
  scopeLabel: string;
  /** Rates haven't arrived yet (no cache): say so instead of "no rate". */
  ratesLoading?: boolean;
  className?: string;
}

const whole = (amount: number, currency: string, approx = false) => formatMoney(amount, currency, { approx, decimals: 'none' });

function MoneyValue({ value, home }: { value: MoneyTotal; home: string }) {
  if (value.total != null) return <>{whole(value.total, home, value.approx)}</>;
  // No sum: one line per currency, smaller so two fit in the cell.
  return (
    <span className="flex flex-col text-[15px] leading-5 lg:text-[16px]">
      {value.byCurrency.map((p) => (
        <span key={p.currency}>{whole(p.amount, p.currency)}</span>
      ))}
    </span>
  );
}

function Cell({ label, children, spoken }: { label: string; children: ReactNode; spoken?: string }) {
  return (
    <div className="flex min-h-[72px] flex-col justify-between gap-1 bg-background px-3 py-3 lg:px-4">
      <dt className="type-overline text-ink-3">{label}</dt>
      <dd className="font-mono text-[18px] font-medium leading-6 tabular-nums text-ink lg:text-[20px] lg:leading-7">
        {spoken ? (
          <>
            <span aria-hidden="true">{children}</span>
            <span className="sr-only">{spoken}</span>
          </>
        ) : (
          children
        )}
      </dd>
    </div>
  );
}

export function PassportStatsStrip({ stats, scopeLabel, ratesLoading, className }: PassportStatsStripProps) {
  const { home } = stats;
  const unsummed = stats.missing.length > 0;
  const note = unsummed
    ? ratesLoading
      ? 'Rates are still loading, so totals are shown per currency.'
      : `No rate for ${stats.missing.join(', ')} today, so totals are shown per currency.`
    : null;

  return (
    <section aria-label={`Totals for ${scopeLabel}`} className={className}>
      <dl className="grid grid-cols-2 gap-px border-y border-rule border-t-ink bg-rule [border-top-width:1.5px] sm:grid-cols-3 lg:grid-cols-6">
        <Cell label="Trips">{stats.trips}</Cell>
        <Cell label="Countries">{stats.countries}</Cell>
        <Cell label="Days away">{stats.daysAway}</Cell>
        <Cell label="Spent">
          <MoneyValue value={stats.spent} home={home} />
        </Cell>
        <Cell label="Baki">
          <MoneyValue value={stats.baki} home={home} />
        </Cell>
        <Cell label="Avg/day" spoken={stats.avgPerDay == null ? 'Not available' : undefined}>
          {stats.avgPerDay == null ? '—' : whole(stats.avgPerDay, home, stats.spent.approx)}
        </Cell>
      </dl>
      {note ? <p className={cn('type-body-s mt-2 text-ink-2')}>{note}</p> : null}
    </section>
  );
}
