// "All rates" (§9.3): a sheet off Home's rates board. A converter on top (any two currencies, crossed through one
// Frankfurter table based on the home currency, so it's one fetch) and every rate below as a ruled mono list,
// searchable, with a pin to choose the three that show on Home. Bottom sheet on phones, right drawer from 768px.
import { useId, useMemo, useState } from 'react';
import { ArrowDownUp, Search } from 'lucide-react';
import { useRates } from '@/hooks/useRates';
import { currencyService } from '@/services/currencyService';
import { CURRENCIES, getCurrencyName } from '@/lib/currency';
import { convertMoney, formatMoney, formatRate, parseMoneyInput, rateBetween } from '@/lib/money';
import { formatShortDate } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/components/shell/useMediaQuery';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MoneyInput } from '@/components/trips/fields/MoneyInput';
import { FieldLabel } from '@/components/trips/fields/FieldBits';

export const HOME_RATES_COUNT = 3;

export interface CurrencyConverterProps {
  /** Home currency: the rates table's base. */
  base: string;
  defaultFrom?: string;
  defaultTo?: string;
  className?: string;
}

function CurrencySelect({ value, onChange, label, codes }: { value: string; onChange: (c: string) => void; label: string; codes: string[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="h-11 w-[112px] shrink-0 font-mono">
        <SelectValue>{value}</SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {codes.map((c) => (
          <SelectItem key={c} value={c} className="font-mono">
            {c} <span className="ml-1 font-sans text-[13px] text-ink-2">{getCurrencyName(c)}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Two-currency converter. Never falls back to 1:1: a missing rate says so. */
export function CurrencyConverter({ base, defaultFrom, defaultTo, className }: CurrencyConverterProps) {
  const b = base.toUpperCase();
  const { rates, isLoading, error, date } = useRates(b);
  const [amount, setAmount] = useState('100');
  const [from, setFrom] = useState((defaultFrom ?? b).toUpperCase());
  const [to, setTo] = useState((defaultTo ?? (b === 'JPY' ? 'MYR' : 'JPY')).toUpperCase());
  const amountId = useId();
  const codes = useMemo(() => {
    const known = CURRENCIES.map((c) => c.code);
    return rates ? known.filter((c) => c === b || rates.rates[c] != null) : known;
  }, [rates, b]);

  const n = parseMoneyInput(amount, from);
  const result = n != null ? convertMoney(n, from, to, rates) : null;
  const rate = rateBetween(from, to, rates);

  return (
    <div className={cn('rounded-lg border border-rule bg-leaf p-4', className)}>
      <FieldLabel htmlFor={amountId}>Convert</FieldLabel>
      <div className="mt-1.5 flex items-end gap-2">
        <MoneyInput id={amountId} size="l" className="min-w-0 flex-1" value={amount} onChange={setAmount} currency={from} ariaLabel="Amount" />
        <CurrencySelect value={from} onChange={setFrom} label="From currency" codes={codes} />
      </div>
      <div className="my-2 flex items-center gap-2">
        <span aria-hidden="true" className="h-px flex-1 bg-rule" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Swap: convert ${to} to ${from}`}
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
        >
          <ArrowDownUp aria-hidden="true" />
        </Button>
        <span aria-hidden="true" className="h-px flex-1 bg-rule" />
      </div>
      <div className="flex items-center gap-2">
        <output className="flex h-11 min-w-0 flex-1 items-center bg-sunken px-3" aria-live="polite">
          {result != null ? (
            <span className="type-money-l truncate text-ink">{formatMoney(result, to, { approx: from !== to })}</span>
          ) : (
            <span className="type-body-s text-ink-2">
              {n == null ? 'Type an amount' : isLoading ? "Getting today's rate…" : error ?? `No rate for ${to} today.`}
            </span>
          )}
        </output>
        <CurrencySelect value={to} onChange={setTo} label="To currency" codes={codes} />
      </div>
      <p className="type-ledger mt-2 text-[12px] leading-4 text-ink-2">
        {rate != null && from !== to ? `1 ${from} = ${formatRate(rate)} ${to}` : ' '}
        {date ? ` · rates from ${formatShortDate(date)}` : ''}
      </p>
    </div>
  );
}

export interface AllRatesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Home currency. */
  base: string;
  /** Codes pinned to Home's board. */
  favorites: string[];
  onFavoritesChange: (codes: string[]) => void;
}

export function AllRatesSheet({ open, onOpenChange, base, favorites, onFavoritesChange }: AllRatesSheetProps) {
  const wide = useMediaQuery('(min-width: 768px)');
  const b = base.toUpperCase();
  const { rates, isLoading, error, isStale, date, refetch } = useRates(open ? b : null);
  const [q, setQ] = useState('');
  const searchId = useId();

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return CURRENCIES.filter((c) => c.code !== b)
      .map((c) => ({ ...c, rate: rates?.rates[c.code] }))
      .filter((c) => c.rate != null || !rates)
      .filter((c) => !query || c.code.toLowerCase().includes(query) || c.name.toLowerCase().includes(query));
  }, [q, rates, b]);

  const toggle = (code: string) => {
    const on = favorites.includes(code);
    const next = on ? favorites.filter((c) => c !== code) : [...favorites, code].slice(0, HOME_RATES_COUNT);
    currencyService.saveFavorites(next);
    onFavoritesChange(next);
  };
  const full = favorites.length >= HOME_RATES_COUNT;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={wide ? 'right' : 'bottom'}
        className={cn('flex flex-col gap-0 overflow-hidden p-0', wide ? 'w-full sm:max-w-[480px]' : 'h-[calc(100dvh-8px)] max-h-none')}
      >
        <SheetHeader className="border-b border-rule px-5 pb-4 pt-5">
          <SheetTitle>All rates</SheetTitle>
          <SheetDescription>
            1 {b} in other money{date ? `, rates from ${formatShortDate(date)}` : ''}. Frankfurter, updated once a working day.
          </SheetDescription>
        </SheetHeader>
        <div className="relative flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
          <CurrencyConverter base={b} />

          <div>
            <div className="flex items-end justify-between gap-3">
              <FieldLabel htmlFor={searchId}>Every rate</FieldLabel>
              <span className="type-ledger text-[12px] text-ink-2">
                On Home {favorites.length}/{HOME_RATES_COUNT}
              </span>
            </div>
            <div className="relative mt-1.5">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-3" strokeWidth={1.75} />
              <Input id={searchId} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Yen, SGD, euro…" className="pl-10" autoComplete="off" />
            </div>
            {isStale ? <p className="type-body-s mt-2 text-ink-2">These rates are from {date ? formatShortDate(date) : 'earlier'}. Live rates aren't loading right now.</p> : null}
            {error && !rates ? (
              <div role="alert" className="mt-3 flex flex-col items-start gap-2 border-l-[3px] border-stamp bg-stamp-tint px-3 py-3">
                <p className="type-body-s text-ink">{error}</p>
                <Button variant="secondary" size="sm" onClick={refetch}>
                  Try again
                </Button>
              </div>
            ) : (
              <ul className="mt-3 overflow-hidden rounded-lg border border-rule bg-leaf" aria-busy={isLoading || undefined}>
                {list.map((c, i) => {
                  const pinned = favorites.includes(c.code);
                  // Home always keeps at least one rate; it holds three at most.
                  const locked = pinned ? favorites.length <= 1 : full;
                  return (
                    <li key={c.code} className={cn('flex min-h-12 items-center gap-3 pl-4 pr-1', i > 0 && 'border-t border-rule', i % 2 === 1 && 'bg-stripe')}>
                      <span className="w-12 shrink-0 font-mono text-[14px] font-semibold tracking-[0.06em] text-ink">{c.code}</span>
                      <span className="type-body-s min-w-0 flex-1 truncate text-ink-2">{c.name}</span>
                      <span className="type-ledger shrink-0 text-ink">{c.rate != null ? formatRate(c.rate) : '—'}</span>
                      <button
                        type="button"
                        aria-pressed={pinned}
                        disabled={locked}
                        onClick={() => toggle(c.code)}
                        title={locked ? (pinned ? 'Home shows at least one rate' : 'Unpin one to add another') : undefined}
                        className={cn(
                          'ml-1 inline-flex h-11 min-w-[76px] shrink-0 items-center justify-center rounded-sm px-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em] transition-colors duration-micro',
                          pinned ? 'text-fund hover:bg-fund-tint' : 'text-ink-2 hover:bg-accent hover:text-ink',
                          'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
                        )}
                      >
                        {pinned ? 'On Home' : 'Pin'}
                        <span className="sr-only"> {c.code} to Home</span>
                      </button>
                    </li>
                  );
                })}
                {!list.length ? <li className="type-body-s px-4 py-3 text-ink-2">No currency matches “{q.trim()}”.</li> : null}
              </ul>
            )}
            {full ? <p className="type-body-s mt-2 text-ink-2">Home shows three. Unpin one to pin another.</p> : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
