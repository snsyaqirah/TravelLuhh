// Amount first (§9.6 step 1–2): a 48px Newsreader figure with its currency prefix, the currency chips, and the
// live "≈ RM 38.40" in the trip currency. When there is no rate (or the traveller changed money at a booth)
// a manual rate field takes over instead of blocking the entry.
import { useId, useMemo, useState, type RefObject } from 'react';
import { ArrowLeftRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Trip } from '@/types';
import type { RatesState } from '@/hooks/useRates';
import { CURRENCIES, getCurrencyName } from '@/lib/currency';
import { currencyPrefix, formatMoney, parseMoneyInput, toTripCurrency } from '@/lib/money';
import { formatShortDate } from '@/lib/dates';
import { getCountryByCode } from '@/data/countries';
import { Input } from '@/components/ui/input';
import { ChoiceChips } from './ChoiceChips';
import { chipClass } from './ledgerUi';
import { rateFor, rateLabel, tidyAmount, type DraftErrors, type ExpenseDraft } from './expenseDraft';

export interface MoneyEntryProps {
  draft: ExpenseDraft;
  patch: (p: Partial<ExpenseDraft>) => void;
  trip: Pick<Trip, 'currency' | 'destinationCountry'>;
  rates: Pick<RatesState, 'rates' | 'date' | 'isStale' | 'isLoading'>;
  amountRef: RefObject<HTMLInputElement>;
  errors: DraftErrors;
}

const up = (c: string | null | undefined) => (c ?? '').toUpperCase();

/** Keep what someone can type into a money field: digits, one separator style, no letters. */
function cleanAmount(text: string): string {
  return text.replace(/[^\d.,]/g, '').slice(0, 18);
}

export function MoneyEntry({ draft, patch, trip, rates, amountRef, errors }: MoneyEntryProps) {
  const uid = useId();
  const ids = {
    amount: `${uid}-amount`,
    amountErr: `${uid}-amount-err`,
    currencyLabel: `${uid}-cur-label`,
    converted: `${uid}-converted`,
    picker: `${uid}-picker`,
    search: `${uid}-search`,
    rate: `${uid}-rate`,
    rateErr: `${uid}-rate-err`,
  };
  const tripCur = up(trip.currency);
  const cur = up(draft.currency);
  const destCur = up(getCountryByCode(trip.destinationCountry)?.currency);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');

  const options = useMemo(() => {
    const codes = [tripCur];
    if (destCur && destCur !== tripCur) codes.push(destCur);
    if (cur && !codes.includes(cur)) codes.push(cur);
    return codes.map((code) => ({ value: code, label: <span className="font-mono">{code}</span>, ariaLabel: `${code}, ${getCurrencyName(code)}` }));
  }, [tripCur, destCur, cur]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = CURRENCIES.filter((c) => !q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
    return list.slice(0, 60);
  }, [query]);

  const setCurrency = (code: string) => {
    if (code === cur) return;
    // A rate typed for one currency means nothing for another.
    patch({ currency: code, amount: tidyAmount(draft.amount, code), rateMode: 'live', manualRate: '', rateInverse: true });
    setPickerOpen(false);
    setQuery('');
  };

  const info = rateFor(draft, tripCur, rates.rates);
  const paid = parseMoneyInput(draft.amount, cur);
  const converted =
    cur !== tripCur && paid != null && paid > 0 && info.rate != null
      ? toTripCurrency({ amount: paid, currency: cur }, tripCur, null, info.rate)
      : null;
  const liveRate = cur !== tripCur ? rateFor({ ...draft, rateMode: 'live' }, tripCur, rates.rates).rate : null;
  const manual = cur !== tripCur && (draft.rateMode === 'manual' || (!info.liveAvailable && !rates.isLoading));
  // Which way the manual field reads. Money changers quote the smaller unit per ringgit.
  const [lhs, rhs] = draft.rateInverse ? [tripCur, cur] : [cur, tripCur];

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label htmlFor={ids.amount} className="type-overline text-ink-2">
          Amount
        </label>
        <div
          className={cn(
            'mt-1 flex items-start gap-2 border-b-[1.5px] pb-1 transition-colors duration-micro',
            errors.amount ? 'border-stamp' : 'border-field focus-within:border-fund',
          )}
        >
          <span aria-hidden="true" className="mt-2.5 shrink-0 font-mono text-[16px] font-medium leading-none text-ink-3">
            {currencyPrefix(cur)}
          </span>
          <input
            ref={amountRef}
            id={ids.amount}
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            placeholder="0"
            value={draft.amount}
            onChange={(e) => patch({ amount: cleanAmount(e.target.value) })}
            onBlur={() => patch({ amount: tidyAmount(draft.amount, cur) })}
            aria-invalid={errors.amount ? true : undefined}
            aria-describedby={[errors.amount ? ids.amountErr : null, converted ? ids.converted : null].filter(Boolean).join(' ') || undefined}
            className="min-w-0 flex-1 bg-transparent font-display text-[48px] font-medium leading-[56px] text-ink [font-variant-numeric:lining-nums_tabular-nums] placeholder:text-ink-3 focus-visible:outline-none"
          />
          <span className="sr-only">{getCurrencyName(cur)}</span>
        </div>
        {errors.amount ? (
          <p id={ids.amountErr} className="type-body-s mt-1.5 text-stamp">
            {errors.amount}
          </p>
        ) : null}
      </div>

      <div>
        <span id={ids.currencyLabel} className="sr-only">
          Paid in
        </span>
        <ChoiceChips
          options={options}
          value={cur}
          onChange={setCurrency}
          labelledBy={ids.currencyLabel}
          trailing={
            <button
              type="button"
              aria-expanded={pickerOpen}
              aria-controls={ids.picker}
              onClick={() => setPickerOpen((o) => !o)}
              className={chipClass(false, 'text-ink')}
            >
              Other currency
            </button>
          }
        />
        {pickerOpen ? (
          <div id={ids.picker} className="mt-2 rounded-md border border-rule bg-leaf p-2" data-vaul-no-drag>
            <label htmlFor={ids.search} className="sr-only">
              Find a currency
            </label>
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" strokeWidth={1.75} />
              <Input
                id={ids.search}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (matches[0]) setCurrency(matches[0].code);
                  } else if (e.key === 'Escape') {
                    e.stopPropagation();
                    setPickerOpen(false);
                  }
                }}
                placeholder="Code or name, e.g. VND"
                className="pl-9"
                autoComplete="off"
              />
            </div>
            <ul className="mt-2 max-h-52 overflow-y-auto" aria-label="Currencies">
              {matches.map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => setCurrency(c.code)}
                    aria-current={c.code === cur ? 'true' : undefined}
                    className={cn(
                      'flex h-11 w-full items-center gap-3 rounded-sm px-2 text-left hover:bg-accent',
                      c.code === cur && 'bg-fund-tint',
                    )}
                  >
                    <span className="w-10 shrink-0 font-mono text-[14px] font-medium text-ink">{c.code}</span>
                    <span className="type-body-s truncate text-ink-2">{c.name}</span>
                  </button>
                </li>
              ))}
              {!matches.length ? <li className="type-body-s px-2 py-3 text-ink-2">No currency matches "{query}".</li> : null}
            </ul>
          </div>
        ) : null}
      </div>

      {cur !== tripCur ? (
        <div className="flex flex-col gap-1.5" aria-live="polite">
          <p id={ids.converted} className="font-mono text-[16px] leading-6 text-ink">
            {converted ? (
              <>
                <span className="sr-only">About </span>
                {formatMoney(converted.amount, tripCur, { approx: true })}
              </>
            ) : (
              <span className="text-ink-3">{`≈ ${currencyPrefix(tripCur)} —`}</span>
            )}
          </p>
          {!manual ? (
            <p className="type-body-s flex flex-wrap items-baseline gap-x-2 text-ink-2">
              {liveRate != null ? (
                <span className="font-mono text-[13px]">
                  {rateLabel(liveRate, tripCur, cur)}
                  {rates.date ? `${rates.isStale ? ' · rates from ' : ' · '}${formatShortDate(rates.date)}` : ''}
                </span>
              ) : rates.isLoading ? (
                <span>Getting today's rate…</span>
              ) : null}
              <button
                type="button"
                onClick={() =>
                  patch({
                    rateMode: 'manual',
                    rateInverse: liveRate != null ? liveRate < 1 : true,
                    manualRate: '',
                  })
                }
                className="inline-flex min-h-11 items-center text-ink underline decoration-rule-strong underline-offset-[3px] hover:decoration-ink"
              >
                Use the rate I got
              </button>
              {errors.rate ? (
                <span id={ids.rateErr} className="basis-full text-stamp">
                  {errors.rate}
                </span>
              ) : null}
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {!info.liveAvailable && draft.rateMode !== 'manual' ? (
                <p className="type-body-s text-ink-2">No rate for {cur} today, so enter the one you got.</p>
              ) : null}
              {rates.isStale && rates.date ? (
                <p className="type-body-s text-ink-2">Rates from {formatShortDate(rates.date)}. Live rates aren't loading right now.</p>
              ) : null}
              <div className="flex items-center gap-2">
                <label htmlFor={ids.rate} className="shrink-0 font-mono text-[14px] text-ink-2">
                  1 {lhs} =
                </label>
                <Input
                  id={ids.rate}
                  inputMode="decimal"
                  autoComplete="off"
                  value={draft.manualRate}
                  onChange={(e) => patch({ manualRate: cleanAmount(e.target.value), rateMode: 'manual' })}
                  aria-invalid={errors.rate ? true : undefined}
                  aria-describedby={errors.rate ? ids.rateErr : undefined}
                  placeholder={liveRate != null ? (draft.rateInverse ? (1 / liveRate).toFixed(2) : liveRate.toFixed(2)) : '0.00'}
                  className="h-11 w-32 font-mono"
                />
                <span className="font-mono text-[14px] text-ink-2">{rhs}</span>
                <button
                  type="button"
                  onClick={() => {
                    const v = parseMoneyInput(draft.manualRate);
                    patch({
                      rateInverse: !draft.rateInverse,
                      manualRate: v && v > 0 ? String(Number((1 / v).toPrecision(6))) : draft.manualRate,
                    });
                  }}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-2 hover:bg-accent hover:text-ink"
                  aria-label={`Swap to 1 ${rhs} = ${lhs}`}
                >
                  <ArrowLeftRight className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                </button>
              </div>
              {info.liveAvailable && draft.rateMode === 'manual' ? (
                <button
                  type="button"
                  onClick={() => patch({ rateMode: 'live', manualRate: '' })}
                  className="type-body-s inline-flex min-h-11 items-center self-start text-ink underline decoration-rule-strong underline-offset-[3px] hover:decoration-ink"
                >
                  Use today's rate{liveRate != null ? ` (${rateLabel(liveRate, tripCur, cur)})` : ''}
                </button>
              ) : null}
              {errors.rate ? (
                <p id={ids.rateErr} className="type-body-s text-stamp">
                  {errors.rate}
                </p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
