// "In tabung" (§9.3): what's still in the jars of every upcoming and on-the-road trip, as one hero figure in the
// home currency (≈ when anything was converted) with one combined CoinRail. When a rate is missing there is no
// total at all: one ledger line per currency instead, and the reason.
import type { Rates, Trip } from '@/types';
import { CoinRail, MoneyFigure } from '@/components/motifs';
import { formatShortDate } from '@/lib/dates';
import { sentenceMoney } from '@/lib/fundCopy';
import { cn } from '@/lib/utils';
import { inTabung } from '@/components/home/homeMath';

export interface InTabungPanelProps {
  trips: readonly Trip[];
  today: Date;
  home: string;
  rates: Rates | null;
  ratesLoading?: boolean;
  className?: string;
}

const tripsWord = (n: number) => `${n} ${n === 1 ? 'trip' : 'trips'}`;

export function InTabungPanel({ trips, today, home, rates, ratesLoading, className }: InTabungPanelProps) {
  const sum = inTabung(trips, today, home, rates);
  if (!sum) return null;

  return (
    <section aria-labelledby="home-in-tabung" className={cn('border-t border-rule pt-4', className)}>
      <h2 id="home-in-tabung" className="type-overline text-ink-2">
        In tabung
      </h2>
      {sum.total ? (
        <>
          <p className="mt-1">
            <MoneyFigure size="hero" amount={sum.total.amount} currency={sum.total.currency} approx={sum.total.approx} tone="fund" />
          </p>
          <CoinRail
            className="mt-3"
            target={sum.total.target}
            spent={sum.total.spent}
            inJar={sum.total.amount}
            currency={sum.total.currency}
            labels={false}
            ariaLabel={`In tabung across ${tripsWord(sum.trips)}`}
          />
          <p className="type-body-s mt-2 text-ink-2">
            {sum.total.approx
              ? `≈ across ${tripsWord(sum.trips)} at today's rate${rates?.date ? `, rates from ${formatShortDate(rates.date)}` : ''}.`
              : `Across ${tripsWord(sum.trips)}, of ${sentenceMoney(sum.total.target, sum.total.currency)} planned.`}
          </p>
        </>
      ) : (
        <>
          <ul className="mt-2 flex flex-col">
            {sum.lines.map((l) => (
              <li key={l.currency} className="flex min-h-10 items-baseline justify-between gap-3 border-b border-rule py-2">
                <span className="type-ledger text-ink-2">
                  {l.currency} · {tripsWord(l.trips)}
                </span>
                <MoneyFigure size="ledger" amount={l.inJar} currency={l.currency} tone="fund" />
              </li>
            ))}
          </ul>
          <p className="type-body-s mt-2 text-ink-2">
            {ratesLoading
              ? "Getting today's rates. Totals are shown per currency for now."
              : `No rate for ${sum.missing.join(', ')} today, so totals are shown per currency.`}
          </p>
        </>
      )}
    </section>
  );
}
