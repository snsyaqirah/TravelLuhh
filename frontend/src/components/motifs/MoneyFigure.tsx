// A money amount set by the §4 rules. `hero` is the big Newsreader figure with a small mono prefix and small
// decimals (RM 2,340.50); `l` and `ledger` are Plex Mono, ledger right-aligned for columns.
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { formatMoney, splitMoney } from '@/lib/money';

export type MoneyTone = 'ink' | 'fund' | 'stamp';

export interface MoneyFigureProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  amount: number;
  currency: string;
  size?: 'hero' | 'l' | 'ledger';
  /** '≈ ' prefix for converted figures. */
  approx?: boolean;
  /** '+' on positive amounts (passbook IN). */
  signed?: boolean;
  /** 'stamp' appends "over" to a negative amount, so colour is never the only cue. */
  tone?: MoneyTone;
  /** Hero defaults to 'auto' (drop .00 from 1,000 up); others to the currency's decimals. */
  decimals?: 'auto' | 'none';
}

const TONE: Record<MoneyTone, string> = {
  ink: 'text-ink',
  fund: 'text-fund',
  stamp: 'text-stamp',
};

const MINUS = '−';

export function MoneyFigure({
  amount,
  currency,
  size = 'l',
  approx,
  signed,
  tone = 'ink',
  decimals,
  className,
  ...rest
}: MoneyFigureProps) {
  const over = tone === 'stamp' && amount < 0;
  const full = formatMoney(amount, currency, {
    approx,
    signed,
    decimals: decimals ?? (size === 'hero' ? 'auto' : undefined),
  });

  if (size !== 'hero') {
    return (
      <span
        className={cn(
          'whitespace-nowrap tabular-nums',
          size === 'ledger' ? 'type-ledger block text-right' : 'type-money-l',
          TONE[tone],
          className,
        )}
        {...rest}
      >
        {full}
        {over ? <span className="type-overline ml-1.5 align-middle">over</span> : null}
      </span>
    );
  }

  const parts = splitMoney(amount, currency, { decimals: decimals ?? 'auto' });
  const sign = parts.negative ? MINUS : signed && amount > 0 ? '+' : '';
  return (
    <span className={cn('type-money-hero inline-block whitespace-nowrap', TONE[tone], className)} {...rest}>
      <span className="sr-only">
        {full}
        {over ? ' over' : ''}
      </span>
      <span aria-hidden="true">
        {approx ? <span className="mr-[0.12em] text-[0.5em] text-ink-3">≈</span> : null}
        {sign ? <span>{sign}</span> : null}
        {parts.prefix ? (
          <span className="mr-[0.25em] align-[0.95em] font-mono text-[0.32em] font-medium tracking-normal text-ink-3">
            {parts.prefix}
          </span>
        ) : null}
        <span>{parts.int}</span>
        {parts.dec ? <span className="text-[0.6em]">{parts.dec}</span> : null}
        {over ? <span className="type-overline ml-2 align-[0.35em]">over</span> : null}
      </span>
    </span>
  );
}
