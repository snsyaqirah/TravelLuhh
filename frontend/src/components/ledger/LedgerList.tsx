// The phone ledger (§5.4 Passbook, mobile layout, §9.6): two-line rows grouped under sticky day headers, with
// swipe-left to delete. Same maths as the Passbook motif (computePassbook / groupPassbookDays), so the BAKI on
// line 2 matches the desktop table to the sen. Newest day first.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { formatWeekdayDayMonth } from '@/lib/dates';
import {
  computePassbook,
  groupPassbookDays,
  tripDayOf,
  type PassbookDay,
  type PassbookLine,
  type PassbookRow,
} from '@/components/motifs/passbookMath';
import { PassbookDayHeader } from '@/components/motifs/PassbookDayHeader';
import { SwipeRow } from './SwipeRow';

export interface LedgerListProps {
  /** Oldest first (the BAKI order). */
  rows: readonly PassbookRow[];
  currency: string;
  showBalance: boolean;
  openingBalance?: number;
  tripStart?: string;
  tripEnd?: string;
  dailyAllowance?: number | null;
  onRowClick: (line: PassbookLine) => void;
  /** Rows that can be swiped away (expenses, for editors). */
  canDelete?: (line: PassbookLine) => boolean;
  onDelete?: (line: PassbookLine) => void;
  /** Accessible name for the whole list. */
  caption: string;
  className?: string;
}

/** New ids since the last render print in once (240ms print-in). */
function useFreshIds(ids: Array<string | number>): Set<string | number> {
  const known = useRef<Set<string | number> | null>(null);
  const seen = known.current;
  const fresh = seen ? new Set(ids.filter((id) => !seen.has(id))) : new Set<string | number>();
  useEffect(() => {
    known.current = new Set(ids);
  });
  return fresh;
}

const isForeign = (line: PassbookLine, currency: string) =>
  Boolean(line.originalCurrency && line.originalAmount != null && line.originalCurrency.toUpperCase() !== currency.toUpperCase());

function joinDots(parts: ReactNode[]): ReactNode[] {
  return parts.filter(Boolean).flatMap((p, i) => (i ? [' · ', p] : [p]));
}

export function LedgerList({
  rows,
  currency,
  showBalance,
  openingBalance = 0,
  tripStart,
  tripEnd,
  dailyAllowance,
  onRowClick,
  canDelete,
  onDelete,
  caption,
  className,
}: LedgerListProps) {
  const lines = useMemo(() => computePassbook(rows, openingBalance, currency), [rows, openingBalance, currency]);
  const days = useMemo<PassbookDay[]>(
    () =>
      groupPassbookDays(lines, currency)
        .reverse()
        .map((d) => ({ ...d, lines: d.lines.slice().reverse() })),
    [lines, currency],
  );
  const fresh = useFreshIds(lines.map((l) => l.id));
  const [openBundles, setOpenBundles] = useState<Set<string | number>>(() => new Set());
  const toggle = (id: string | number) =>
    setOpenBundles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className={cn('overflow-clip rounded-lg border border-rule bg-leaf', className)} role="region" aria-label={caption}>
      {days.map((day) => {
        const n = tripDayOf(day.date, tripStart, tripEnd);
        const onTrip = n !== 'before' && n !== 'after';
        const overBy =
          onTrip && dailyAllowance != null && dailyAllowance > 0 && day.spent > dailyAllowance + 0.005 ? day.spent - dailyAllowance : 0;
        return (
          <section key={day.date} aria-label={formatWeekdayDayMonth(day.date)}>
            <div className="sticky top-[var(--passbook-sticky-top,0px)] z-[2] flex min-h-9 items-center border-b border-rule bg-sunken px-4 py-1.5">
              <PassbookDayHeader date={day.date} day={n} spent={day.spent} currency={currency} overBy={overBy} />
            </div>
            <ol>
              {day.lines.map((line, idx) => {
                const foreign = isForeign(line, currency);
                const subs = line.isBundle ? (line.children ?? []) : [];
                const open = openBundles.has(line.id);
                const amount = line.out ? -line.out : (line.in ?? 0);
                const system = line.kind === 'system';
                const bg = idx % 2 === 1 ? 'bg-stripe' : 'bg-leaf';
                const deletable = Boolean(onDelete && canDelete?.(line));
                return (
                  <SwipeRow
                    key={line.id}
                    data-row={line.id}
                    enabled={deletable}
                    onDelete={() => onDelete?.(line)}
                    deleteLabel={`Delete "${line.label}"`}
                    className={cn('border-b border-rule last:border-b-0', fresh.has(line.id) && 'animate-print-in')}
                    surfaceClassName={cn(bg, 'active:bg-accent')}
                  >
                    <div className="flex min-h-14 flex-col justify-center px-4 py-2">
                      <div className="flex items-end gap-2.5">
                        <span aria-hidden="true" className="inline-flex h-6 w-6 shrink-0 items-center justify-center self-start text-ink-2">
                          {line.glyph}
                        </span>
                        <span className="flex min-w-0 items-end">
                          <button
                            type="button"
                            onClick={() => onRowClick(line)}
                            className="flex min-w-0 text-left outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-ring"
                          >
                            <span className={cn('line-clamp-2 min-w-0', system ? 'type-overline text-ink-2' : 'text-[15px] leading-5 text-ink')}>
                              {line.label}
                            </span>
                          </button>
                          {line.payerInitials ? (
                            <span className="ml-2 inline-flex h-5 shrink-0 items-center rounded-sm border border-rule-strong px-1 font-mono text-[11px] font-medium leading-none text-ink-2">
                              <span className="sr-only">paid by </span>
                              {line.payerInitials}
                            </span>
                          ) : null}
                          {subs.length ? (
                            <button
                              type="button"
                              onClick={() => toggle(line.id)}
                              aria-expanded={open}
                              aria-label={`${open ? 'Hide' : 'Show'} ${subs.length} items in ${line.label}`}
                              className="relative z-10 -my-2 ml-1 inline-flex h-11 shrink-0 items-center gap-0.5 rounded-sm px-1.5 font-mono text-[12px] text-ink-2 hover:bg-accent"
                            >
                              {subs.length}
                              <ChevronDown className={cn('h-4 w-4 transition-transform duration-micro', open && 'rotate-180')} strokeWidth={1.75} aria-hidden="true" />
                            </button>
                          ) : null}
                        </span>
                        <span aria-hidden="true" className="mb-1.5 min-w-3 flex-1 border-b border-dotted border-rule-strong" />
                        <span className={cn('type-ledger shrink-0 whitespace-nowrap', amount > 0 ? 'text-fund' : 'text-ink')}>
                          <span className="sr-only">{amount > 0 ? 'In ' : 'Out '}</span>
                          {foreign && line.out
                            ? `−${formatMoney(line.originalAmount ?? 0, line.originalCurrency ?? currency)}`
                            : formatMoney(amount, currency, { signed: amount > 0 })}
                        </span>
                      </div>
                      <div className="type-ledger mt-0.5 flex flex-wrap items-baseline gap-x-2 pl-[34px] text-[12px] leading-4 text-ink-3">
                        <span>
                          {joinDots([
                            line.sub ? <span key="s">{line.sub}</span> : null,
                            showBalance ? (
                              <span key="b">
                                <span className="sr-only">balance </span>
                                <span aria-hidden="true">BAKI </span>
                                <span className={cn('whitespace-nowrap', line.balance < 0 && 'text-stamp')}>
                                  {formatMoney(line.balance, currency)}
                                  {line.balance < 0 ? ' over' : ''}
                                </span>
                              </span>
                            ) : null,
                          ])}
                        </span>
                        {foreign && line.out ? <span className="ml-auto shrink-0 whitespace-nowrap">{formatMoney(line.out, currency, { approx: true })}</span> : null}
                      </div>
                    </div>
                    {open && subs.length ? (
                      <ul className="pb-2 pl-[50px] pr-4" aria-label={`Items in ${line.label}`}>
                        {subs.map((sub, i) => (
                          <li key={sub.id} className="flex items-baseline gap-2 py-0.5 text-[14px] text-ink-2">
                            <span aria-hidden="true" className="font-mono text-rule-strong">
                              {i === subs.length - 1 ? '└─' : '├─'}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{sub.label}</span>
                            {sub.amount != null ? <span className="type-ledger shrink-0 text-[13px]">{formatMoney(sub.amount, currency)}</span> : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </SwipeRow>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
