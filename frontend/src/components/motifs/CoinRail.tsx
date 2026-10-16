// The jar as a flat rail (§5.4): solid fund for what's still in the jar, the spent hatch after it. Over budget
// the rail is all hatch with a stamp notch past the end, and the label says "over", never colour alone.
import { cn } from '@/lib/utils';
import { roundMoney } from '@/lib/money';
import { sentenceMoney } from '@/lib/fundCopy';

export interface CoinRailProps {
  target: number;
  spent: number;
  currency: string;
  /** Visible labels under the rail (default true). The meter keeps its aria values either way. */
  labels?: boolean;
  /**
   * What's in the jar when it isn't simply target − spent (saving mode: saved − spent). The rest of the track
   * up to the target stays empty (fund-tint): money not dropped in yet.
   */
  inJar?: number;
  /** Accessible name of the meter. */
  ariaLabel?: string;
  className?: string;
}

// Sentence rule: whole units from 100 up ('RM 2,340 left'), cents below ('RM 82.50 left').
const fmt = (n: number, c: string) => sentenceMoney(n, c);

const pct = (part: number, whole: number) => (whole > 0 ? Math.min(100, Math.max(0, (part / whole) * 100)) : 0);

export function CoinRail({
  target,
  spent,
  currency,
  labels = true,
  inJar: inJarProp,
  ariaLabel = 'Left in the jar',
  className,
}: CoinRailProps) {
  const t = Number.isFinite(target) ? Math.max(0, target) : 0;
  const s = Number.isFinite(spent) ? Math.max(0, spent) : 0;

  if (t <= 0) {
    // Nothing to measure against, so no meter: a dashed empty track and words.
    return (
      <div className={cn('w-full', className)} data-state="nobudget">
        <div aria-hidden="true" className="h-2.5 w-full border border-dashed border-ink-3" />
        <div className="type-ledger mt-1.5 flex items-baseline justify-between gap-3 text-[13px] leading-4">
          <span className="text-ink-2">No budget set</span>
          {s > 0 ? <span className="text-ink-3">{fmt(s, currency)} spent</span> : null}
        </div>
      </div>
    );
  }

  const over = roundMoney(Math.max(0, s - t), currency);
  const inJar = roundMoney(Math.max(0, inJarProp ?? t - s), currency);
  const isOver = over > 0;
  const jarPct = isOver ? 0 : pct(inJar, t);
  // A sliver of jar never rounds away to nothing.
  const jarWidth = inJar > 0 ? Math.max(jarPct, 1) : 0;
  const spentWidth = isOver ? 100 : Math.min(100 - jarWidth, pct(s, t));

  const valueText = isOver
    ? `${fmt(over, currency)} over a budget of ${fmt(t, currency)}`
    : `${fmt(inJar, currency)} left of ${fmt(t, currency)}`;

  return (
    <div className={cn('w-full', className)} data-state={isOver ? 'over' : 'ok'}>
      <div
        role="meter"
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={roundMoney(t, currency)}
        aria-valuenow={inJar}
        aria-valuetext={valueText}
        className="relative flex h-2.5 items-center"
      >
        <div className={cn('relative flex h-full overflow-hidden bg-fund-tint', isOver ? 'w-[calc(100%-12px)]' : 'w-full')}>
          <div className="h-full bg-fund transition-[width] duration-ui ease-out" style={{ width: `${jarWidth}%` }} />
          <div className="hatch h-full transition-[width] duration-ui ease-out" style={{ width: `${spentWidth}%` }} />
        </div>
        {isOver ? <div aria-hidden="true" className="h-4 w-3 shrink-0 bg-stamp" /> : null}
      </div>
      {labels ? (
        <div aria-hidden="true" className="type-ledger mt-1.5 flex items-baseline justify-between gap-3 text-[13px] leading-4">
          {isOver ? (
            <span className="text-stamp">{fmt(over, currency)} over</span>
          ) : (
            <span className="text-fund">{fmt(inJar, currency)} left</span>
          )}
          <span className="text-ink-3">of {fmt(t, currency)}</span>
        </div>
      ) : null}
    </div>
  );
}
