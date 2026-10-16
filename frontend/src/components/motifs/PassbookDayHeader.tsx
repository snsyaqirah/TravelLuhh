// Day header for the Passbook and the Days tab (§5.4): 'DAY 3 · WED 14 NOV · RM 186.40', plus
// '· RM 42 over today' in stamp when the day ran past its share of the budget.
import { cn } from '@/lib/utils';
import { formatWeekdayDayMonth } from '@/lib/dates';
import { formatMoney } from '@/lib/money';

export interface PassbookDayHeaderProps {
  /** 'YYYY-MM-DD' */
  date: string;
  /** Trip day number, or where the date falls outside the trip (pre-trip bookings, late refunds). */
  day?: number | 'before' | 'after' | null;
  /** Σ out for the day, in `currency`. Hidden when 0. */
  spent?: number;
  currency: string;
  /** How far the day went past its allowance. 0 or undefined hides the note. */
  overBy?: number;
  className?: string;
}

const sentence = (n: number, c: string) => formatMoney(n, c, { decimals: Math.abs(n) >= 100 ? 'none' : undefined });

export function PassbookDayHeader({ date, day, spent = 0, currency, overBy, className }: PassbookDayHeaderProps) {
  const lead = day === 'before' ? 'BEFORE THE TRIP' : day === 'after' ? 'AFTER THE TRIP' : typeof day === 'number' ? `DAY ${day}` : '';
  const parts = [lead, formatWeekdayDayMonth(date), spent > 0 ? formatMoney(spent, currency) : ''].filter(Boolean);
  return (
    <span className={cn('type-overline text-ink-2', className)}>
      {parts.join(' · ')}
      {overBy && overBy > 0 ? <span className="text-stamp"> · {sentence(overBy, currency)} over today</span> : null}
    </span>
  );
}
