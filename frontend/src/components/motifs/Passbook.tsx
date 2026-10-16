// The bank passbook (§5.4): every entry printed with the running BAKI after it. A semantic table when there's room
// (bilingual mono header, glyphs in the margin gutter), a two-line list when narrow. Rows are given oldest
// first; the balance is always computed in that order, even when `newestFirst` flips the display.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDayMonth, formatWeekdayDayMonth } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import {
  computePassbook,
  groupPassbookDays,
  tripDayOf,
  type PassbookDay,
  type PassbookLine,
  type PassbookRow,
} from '@/components/motifs/passbookMath';
import { PassbookDayHeader } from '@/components/motifs/PassbookDayHeader';

export interface PassbookProps {
  /** Oldest first. */
  rows: readonly PassbookRow[];
  /** The passbook (trip) currency: OUT, IN and BAKI are in it. */
  currency: string;
  showBalance?: boolean;
  groupByDay?: boolean;
  /** 40px rows (dense desktop ledger, Home's latest entries). */
  dense?: boolean;
  onRowClick?: (row: PassbookLine) => void;
  /** BAKI before the first row (e.g. a dense extract of a longer ledger). */
  openingBalance?: number;
  /** Show the newest day (and row) first. The balance is still computed oldest first. */
  newestFirst?: boolean;
  /** For "DAY 3" headers and the over-allowance note. */
  tripStart?: string;
  tripEnd?: string;
  /** A day whose spend passes this gets "· RM 42 over today" in its header. */
  dailyAllowance?: number | null;
  /** 'auto' = two-line list while the passbook is narrower than 640px, table from there up. */
  layout?: 'auto' | 'table' | 'list';
  /** Screen-reader caption, e.g. "Tokyo autumn ledger". */
  caption?: string;
  empty?: ReactNode;
  className?: string;
}

/** New ids since the last render get the print-in animation once. */
function useFreshIds(ids: Array<string | number>): Set<string | number> {
  const known = useRef<Set<string | number> | null>(null);
  const seen = known.current;
  const fresh = seen ? new Set(ids.filter((id) => !seen.has(id))) : new Set<string | number>();
  useEffect(() => {
    known.current = new Set(ids);
  });
  return fresh;
}

const money = (n: number, c: string, o?: { signed?: boolean }) => formatMoney(n, c, o);

function isForeign(row: PassbookRow, currency: string) {
  return Boolean(row.originalCurrency && row.originalAmount != null && row.originalCurrency.toUpperCase() !== (row.currency ?? currency).toUpperCase());
}

/** 'a · b · c', skipping empty parts. */
function joinDots(parts: ReactNode[]): ReactNode[] {
  return parts.filter(Boolean).flatMap((p, i) => (i ? [' · ', p] : [p]));
}

function OverMark() {
  return <span className="type-stamp ml-1.5 inline-block border border-stamp px-1 py-px align-[1px] text-[9px] text-stamp">over</span>;
}

function Balance({ value, currency }: { value: number; currency: string }) {
  const negative = value < 0;
  return (
    <span className={cn('whitespace-nowrap', negative ? 'text-stamp' : 'text-ink')}>
      {money(value, currency)}
      {negative ? <OverMark /> : null}
    </span>
  );
}

function PayerChip({ initials }: { initials: string }) {
  return (
    <span className="ml-2 inline-flex h-5 shrink-0 items-center rounded-sm border border-rule-strong px-1 font-mono text-[11px] font-medium leading-none text-ink-2">
      <span className="sr-only">paid by </span>
      {initials}
    </span>
  );
}

function RowLabel({
  line,
  onRowClick,
  wrap,
}: {
  line: PassbookLine;
  onRowClick?: (row: PassbookLine) => void;
  /** Phones: two lines before truncating, so "Hotel Gracery Shinjuku" survives. */
  wrap?: boolean;
}) {
  const system = line.kind === 'system';
  const text = (
    <span className={cn('min-w-0', wrap ? 'line-clamp-2' : 'truncate', system ? 'type-overline text-ink-2' : 'text-[15px] leading-5 text-ink')}>
      {line.label}
    </span>
  );
  if (!onRowClick) return text;
  return (
    <button
      type="button"
      onClick={() => onRowClick(line)}
      // stretched over the whole row; the bundle toggle sits above it
      className="flex min-w-0 text-left outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-ring"
    >
      {text}
    </button>
  );
}

function BundleToggle({ open, count, onToggle, label }: { open: boolean; count: number; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={`${open ? 'Hide' : 'Show'} ${count} items in ${label}`}
      className="relative z-10 ml-2 inline-flex h-7 shrink-0 items-center gap-0.5 rounded-sm px-1 font-mono text-[12px] text-ink-2 hover:bg-accent"
    >
      {count}
      <ChevronDown className={cn('h-4 w-4 transition-transform duration-micro', open && 'rotate-180')} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}

const headLabel = (ms: string, en: string, align: 'left' | 'right' = 'left') => (
  <>
    <span aria-hidden="true" className={cn('block leading-[14px]', align === 'right' && 'text-right')}>
      <span className="block text-ink-2">{ms}</span>
      <span className="block text-ink-3">{en}</span>
    </span>
    <span className="sr-only">{en.charAt(0) + en.slice(1).toLowerCase()}</span>
  </>
);

export function Passbook({
  rows,
  currency,
  showBalance = true,
  groupByDay = true,
  dense,
  onRowClick,
  openingBalance = 0,
  newestFirst,
  tripStart,
  tripEnd,
  dailyAllowance,
  layout = 'auto',
  caption,
  empty,
  className,
}: PassbookProps) {
  const lines = useMemo(() => computePassbook(rows, openingBalance, currency), [rows, openingBalance, currency]);
  const days = useMemo<PassbookDay[]>(() => {
    const grouped = groupByDay ? groupPassbookDays(lines, currency) : [{ date: '', lines: [...lines], spent: 0 }];
    if (!newestFirst) return grouped;
    return grouped.reverse().map((d) => ({ ...d, lines: d.lines.slice().reverse() }));
  }, [lines, groupByDay, newestFirst, currency]);
  const fresh = useFreshIds(lines.map((l) => l.id));
  const [openBundles, setOpenBundles] = useState<Set<string | number>>(() => new Set());
  const toggleBundle = (id: string | number) =>
    setOpenBundles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const hasIn = lines.some((l) => (l.in ?? 0) > 0);

  if (!lines.length) {
    return (
      <div
        className={cn('ledger-rule min-h-36 rounded-lg border border-rule bg-leaf px-4 [--ledger-row:48px]', className)}
      >
        {/* two 24px lines fit the first 48px ruled row */}
        <p className="type-body-s flex min-h-12 items-center py-1 leading-5 text-ink-2">{empty ?? 'Nothing in the ledger yet. The first teh tarik counts too.'}</p>
      </div>
    );
  }

  const dayHeader = (day: PassbookDay) => {
    const n = tripDayOf(day.date, tripStart, tripEnd);
    // Bookings made before (or refunds after) the trip aren't a day's spending, so they never read "over today".
    const onTrip = n !== 'before' && n !== 'after';
    const overBy =
      onTrip && dailyAllowance != null && dailyAllowance > 0 && day.spent > dailyAllowance + 0.005 ? day.spent - dailyAllowance : 0;
    return <PassbookDayHeader date={day.date} day={n} spent={day.spent} currency={currency} overBy={overBy} />;
  };

  const shared = { days, currency, showBalance, groupByDay, dense, onRowClick, fresh, openBundles, toggleBundle, hasIn, dayHeader, caption };

  if (layout === 'table') return <PassbookTable {...shared} className={className} />;
  if (layout === 'list') return <PassbookList {...shared} className={className} />;
  // The switch follows the passbook's own width, not the viewport: a half-column on desktop still gets the list.
  return (
    <div className={cn('[container-type:inline-size]', className)}>
      <PassbookList {...shared} className="[@container(min-width:640px)]:hidden" />
      <PassbookTable {...shared} className="hidden [@container(min-width:640px)]:block" />
    </div>
  );
}

interface ViewProps {
  days: PassbookDay[];
  currency: string;
  showBalance: boolean;
  groupByDay: boolean;
  dense?: boolean;
  onRowClick?: (row: PassbookLine) => void;
  fresh: Set<string | number>;
  openBundles: Set<string | number>;
  toggleBundle: (id: string | number) => void;
  hasIn: boolean;
  dayHeader: (day: PassbookDay) => ReactNode;
  caption?: string;
  className?: string;
}

function PassbookTable({
  days,
  currency,
  showBalance,
  groupByDay,
  dense,
  onRowClick,
  fresh,
  openBundles,
  toggleBundle,
  hasIn,
  dayHeader,
  caption,
  className,
}: ViewProps) {
  const cols = 4 + (hasIn ? 1 : 0) + (showBalance ? 1 : 0);
  const rowH = dense ? 'h-10' : 'h-12';
  let stripe = 0;
  return (
    <div className={cn('relative overflow-clip rounded-lg border border-rule bg-leaf', className)}>
      {/* Margin line (§5.2): 2px stamp at 35%, 44px in, desktop only. Drawn over the row fills. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-11 z-[2] hidden w-0.5 bg-stamp/35 lg:block" />
      <table className="w-full table-fixed border-collapse font-mono text-[14px] leading-5 tabular-nums lg:text-[15px]">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <colgroup>
          <col className="w-11" />
          <col className="w-[76px]" />
          <col />
          <col className="w-[124px]" />
          {hasIn ? <col className="w-[124px]" /> : null}
          {showBalance ? <col className="w-[148px]" /> : null}
        </colgroup>
        <thead className="type-overline border-b border-rule-strong bg-leaf">
          <tr className="h-12">
            <th scope="col" className="font-medium">
              <span className="sr-only">Category</span>
            </th>
            <th scope="col" className="pl-3 text-left font-medium">
              {headLabel('TARIKH', 'DATE')}
            </th>
            <th scope="col" className="pl-3 text-left font-medium">
              {headLabel('BUTIRAN', 'DETAILS')}
            </th>
            <th scope="col" className="pr-3 text-right font-medium">
              {headLabel('KELUAR', 'OUT', 'right')}
            </th>
            {hasIn ? (
              <th scope="col" className="pr-3 text-right font-medium">
                {headLabel('MASUK', 'IN', 'right')}
              </th>
            ) : null}
            {showBalance ? (
              <th scope="col" className="pr-4 text-right font-medium">
                {headLabel('BAKI', 'BALANCE', 'right')}
              </th>
            ) : null}
          </tr>
        </thead>
        {days.map((day) => (
          <tbody key={day.date || 'all'}>
            {groupByDay ? (
              <tr>
                <th
                  scope="colgroup"
                  colSpan={cols}
                  className="sticky top-[var(--passbook-sticky-top,0px)] z-[1] h-9 border-b border-rule bg-sunken pl-14 text-left font-normal"
                >
                  {dayHeader(day)}
                </th>
              </tr>
            ) : null}
            {day.lines.map((line) => {
              const foreign = isForeign(line, currency);
              const c = line.currency ?? currency;
              const open = openBundles.has(line.id);
              const subs = line.isBundle ? (line.children ?? []) : [];
              const striped = stripe++ % 2 === 1;
              return [
                <tr
                  key={line.id}
                  data-row={line.id}
                  className={cn(
                    'relative border-b border-rule last:border-b-0',
                    striped ? 'bg-stripe' : 'bg-leaf',
                    onRowClick && 'cursor-pointer hover:bg-accent',
                    fresh.has(line.id) && 'animate-print-in',
                  )}
                >
                  <td className={cn(rowH, 'text-center align-middle')}>
                    <span aria-hidden="true" className="inline-flex h-6 w-6 items-center justify-center text-ink-2">
                      {line.glyph}
                    </span>
                  </td>
                  <td className="pl-3 align-middle text-ink-2">{formatDayMonth(line.date)}</td>
                  <td className="py-1.5 pl-3 align-middle font-sans">
                    <span className="flex min-w-0 items-center">
                      <RowLabel line={line} onRowClick={onRowClick} />
                      {line.sub ? <span className="ml-2 shrink-0 font-mono text-[12px] text-ink-3">{line.sub}</span> : null}
                      {line.payerInitials ? <PayerChip initials={line.payerInitials} /> : null}
                      {subs.length ? <BundleToggle open={open} count={subs.length} onToggle={() => toggleBundle(line.id)} label={line.label} /> : null}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-right align-middle">
                    {line.out ? (
                      foreign ? (
                        <>
                          <span className="block whitespace-nowrap text-ink">{money(line.originalAmount ?? 0, line.originalCurrency ?? c)}</span>
                          <span className="block whitespace-nowrap text-[12px] leading-4 text-ink-3">{formatMoney(line.out, c, { approx: true })}</span>
                        </>
                      ) : (
                        <span className="whitespace-nowrap text-ink">{money(line.out, c)}</span>
                      )
                    ) : null}
                  </td>
                  {hasIn ? (
                    <td className="pr-3 text-right align-middle">
                      {line.in ? <span className="whitespace-nowrap text-fund">{money(line.in, c)}</span> : null}
                    </td>
                  ) : null}
                  {showBalance ? (
                    <td className="pr-4 text-right align-middle">
                      <Balance value={line.balance} currency={c} />
                    </td>
                  ) : null}
                </tr>,
                ...(open
                  ? subs.map((sub, i) => (
                      <tr key={`${line.id}:${sub.id}`} className={cn('border-b border-rule', striped ? 'bg-stripe' : 'bg-leaf')}>
                        <td className="h-9 text-center align-middle">
                          <span aria-hidden="true" className="inline-flex h-5 w-5 items-center justify-center text-ink-3">
                            {sub.glyph}
                          </span>
                        </td>
                        <td />
                        <td className="pl-3 align-middle font-sans text-[14px] text-ink-2">
                          <span aria-hidden="true" className="mr-2 font-mono text-rule-strong">
                            {i === subs.length - 1 ? '└─' : '├─'}
                          </span>
                          {sub.label}
                        </td>
                        <td className="pr-3 text-right align-middle text-ink-2">{sub.amount != null ? money(sub.amount, c) : null}</td>
                        {hasIn ? <td /> : null}
                        {showBalance ? <td /> : null}
                      </tr>
                    ))
                  : []),
              ];
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function PassbookList({
  days,
  currency,
  showBalance,
  groupByDay,
  dense,
  onRowClick,
  fresh,
  openBundles,
  toggleBundle,
  dayHeader,
  caption,
  className,
}: ViewProps) {
  return (
    <div className={cn('overflow-clip rounded-lg border border-rule bg-leaf', className)} role="region" aria-label={caption}>
      {days.map((day) => (
        <section key={day.date || 'all'} aria-label={groupByDay ? formatWeekdayDayMonth(day.date) : undefined}>
          {groupByDay ? (
            <div className="sticky top-[var(--passbook-sticky-top,0px)] z-[1] flex min-h-9 items-center border-b border-rule bg-sunken px-4 py-1.5">
              {dayHeader(day)}
            </div>
          ) : null}
          <ol>
            {day.lines.map((line, idx) => {
              const foreign = isForeign(line, currency);
              const c = line.currency ?? currency;
              const subs = line.isBundle ? (line.children ?? []) : [];
              const open = openBundles.has(line.id);
              const amount = line.out ? -line.out : (line.in ?? 0);
              return (
                <li
                  key={line.id}
                  data-row={line.id}
                  className={cn(
                    'relative border-b border-rule last:border-b-0',
                    idx % 2 === 1 ? 'bg-stripe' : 'bg-leaf',
                    onRowClick && 'active:bg-accent',
                    fresh.has(line.id) && 'animate-print-in',
                  )}
                >
                  <div className={cn('flex flex-col justify-center px-4', dense ? 'min-h-12 py-1.5' : 'min-h-14 py-2')}>
                    {/* line 1: glyph, description ··· signed amount (on the description's last line) */}
                    <div className="flex items-end gap-2.5">
                      <span aria-hidden="true" className="inline-flex h-6 w-6 shrink-0 items-center justify-center self-start text-ink-2">
                        {line.glyph}
                      </span>
                      <span className="flex min-w-0 items-end">
                        <RowLabel line={line} onRowClick={onRowClick} wrap />
                        {line.payerInitials ? <PayerChip initials={line.payerInitials} /> : null}
                        {subs.length ? <BundleToggle open={open} count={subs.length} onToggle={() => toggleBundle(line.id)} label={line.label} /> : null}
                      </span>
                      <span aria-hidden="true" className="mb-1.5 min-w-3 flex-1 border-b border-dotted border-rule-strong" />
                      <span className={cn('type-ledger shrink-0 whitespace-nowrap', amount > 0 ? 'text-fund' : 'text-ink')}>
                        <span className="sr-only">{amount > 0 ? 'In ' : 'Out '}</span>
                        {foreign && line.out
                          ? `−${money(line.originalAmount ?? 0, line.originalCurrency ?? c)}`
                          : money(amount, c, { signed: amount > 0 })}
                      </span>
                    </div>
                    {/* line 2: [date ·] code · baki, and the converted amount. The day header already
                        carries the date when grouped. Wraps rather than cutting the balance off. */}
                    <div className="type-ledger mt-0.5 flex flex-wrap items-baseline gap-x-2 pl-[34px] text-[12px] leading-4 text-ink-3">
                      <span>
                        {joinDots([
                          groupByDay ? null : (
                            <span key="d">
                              <span className="sr-only">Date </span>
                              {formatDayMonth(line.date)}
                            </span>
                          ),
                          line.sub ? <span key="s">{line.sub}</span> : null,
                          showBalance ? (
                            <span key="b">
                              <span className="sr-only">balance </span>
                              <span aria-hidden="true">BAKI </span>
                              <span className={cn('whitespace-nowrap', line.balance < 0 && 'text-stamp')}>
                                {money(line.balance, c)}
                                {line.balance < 0 ? ' over' : ''}
                              </span>
                            </span>
                          ) : null,
                        ])}
                      </span>
                      {foreign && line.out ? <span className="ml-auto shrink-0 whitespace-nowrap">{formatMoney(line.out, c, { approx: true })}</span> : null}
                    </div>
                  </div>
                  {open && subs.length ? (
                    <ul className="pb-2 pl-[50px] pr-4">
                      {subs.map((sub, i) => (
                        <li key={sub.id} className="flex items-baseline gap-2 py-0.5 text-[14px] text-ink-2">
                          <span aria-hidden="true" className="font-mono text-rule-strong">
                            {i === subs.length - 1 ? '└─' : '├─'}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{sub.label}</span>
                          {sub.amount != null ? <span className="type-ledger shrink-0 text-[13px]">{money(sub.amount, c)}</span> : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
