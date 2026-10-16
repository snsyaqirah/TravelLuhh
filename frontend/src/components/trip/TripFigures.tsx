// Figures beside the stage (§9.6): what's left in the jar, spent and fund, the practical line, the rail, the
// saving line (Phase B) and a one-line FX quote. Every number comes from the same FundState as the scene.
import type { Trip } from '@/types';
import type { FundState } from '@/hooks/useFund';
import { useRates } from '@/hooks/useRates';
import { CoinRail, MoneyFigure } from '@/components/motifs';
import { formatShortDate } from '@/lib/dates';
import { formatRate, rateBetween } from '@/lib/money';
import { practicalLine } from '@/lib/fundCopy';
import { fxPair, savedLine } from '@/components/trip/tripCopy';
import { cn } from '@/lib/utils';

export interface TripFiguresProps {
  trip: Trip;
  fund: FundState;
  /** The viewer's home currency: the FX line's quote when the trip is already in the local currency. */
  homeCurrency?: string | null;
  className?: string;
}

function FxLine({ pair }: { pair: [string, string] }) {
  const [base, quote] = pair;
  const { rates, date, isStale, isLoading, error } = useRates(base);
  if (isLoading && !rates) return <p className="type-ledger h-5 text-ink-3" aria-hidden="true" />;
  const rate = rateBetween(base, quote, rates);
  if (error || rates === null) {
    return <p className="type-body-s text-ink-3">Live rates aren't loading right now.</p>;
  }
  if (rate == null) {
    return <p className="type-body-s text-ink-3">No rate for {quote} today.</p>;
  }
  return (
    <p className="type-ledger text-ink-2">
      1 {base} = {formatRate(rate)} {quote}
      {date ? <span className="text-ink-3"> · {formatShortDate(date)}</span> : null}
      {isStale ? <span className="text-ink-3"> · may be out of date</span> : null}
    </p>
  );
}

export function TripFigures({ trip, fund, homeCurrency, className }: TripFiguresProps) {
  const c = fund.currency;
  const isOver = fund.over > 0;
  const pair = fxPair(trip, homeCurrency);
  const practical = practicalLine(fund);

  return (
    <section aria-label="Fund figures" className={cn('flex flex-col gap-4', className)}>
      <div>
        <p className="type-overline text-ink-3">Left in jar</p>
        <MoneyFigure
          amount={isOver ? -fund.over : fund.inJar}
          currency={c}
          size="hero"
          tone={isOver ? 'stamp' : 'fund'}
          className="mt-1"
        />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 border-y border-rule py-3">
        <div className="min-w-0">
          <dt className="type-overline text-ink-3">Spent</dt>
          <dd className="mt-0.5 truncate">
            <MoneyFigure amount={fund.spent} currency={c} size="l" decimals="auto" />
          </dd>
        </div>
        <div className="min-w-0 border-l border-rule pl-4">
          <dt className="type-overline text-ink-3">Fund</dt>
          <dd className="mt-0.5 truncate">
            {fund.hasBudget ? (
              <MoneyFigure amount={fund.target} currency={c} size="l" decimals="auto" />
            ) : (
              <span className="type-body-s text-ink-2">Not set</span>
            )}
          </dd>
        </div>
      </dl>

      {practical ? <p className={cn('type-body', isOver ? 'text-stamp' : 'text-ink')}>{practical}</p> : null}

      <CoinRail
        target={fund.target}
        spent={fund.spent}
        currency={c}
        inJar={fund.mode === 'saving' ? fund.inJar : undefined}
      />

      {fund.mode === 'saving' ? <p className="type-body-s text-ink-2">{savedLine(fund)}</p> : null}

      {pair ? <FxLine pair={pair} /> : null}
    </section>
  );
}
