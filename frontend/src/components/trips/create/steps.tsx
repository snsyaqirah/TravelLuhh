// The five Create steps (§9.5). Each step only edits the draft; the page validates, persists and submits.
import { useId, useMemo, type ReactNode } from 'react';
import type { Rates } from '@/types';
import { CountrySearch } from '@/components/trips/fields/CountrySearch';
import { DateRangeField } from '@/components/trips/fields/DateRangeField';
import { SeasonPicker } from '@/components/trips/fields/SeasonPicker';
import { PartyOptions } from '@/components/trips/fields/PartyOptions';
import { CurrencySwitch, MoneyInput } from '@/components/trips/fields/MoneyInput';
import { partyTitle, tidyMoneyText } from '@/components/trips/fields/fieldText';
import { FieldError, FieldLabel, HelperLine } from '@/components/trips/fields/FieldBits';
import { Input } from '@/components/ui/input';
import { TripTicket } from '@/components/motifs';
import { getCountryByCode } from '@/data/countries';
import { formatRange } from '@/lib/dates';
import { durationLabel } from '@/lib/phase';
import { getSeason } from '@/lib/season';
import { convertMoney, currencyDecimals, formatMoney, rateBetween } from '@/lib/money';
import { sentenceMoney } from '@/lib/fundCopy';
import { cn } from '@/lib/utils';
import {
  daysNightsLabel,
  draftBudget,
  draftCurrency,
  draftDays,
  draftSaved,
  draftSeason,
  NAME_MAX,
  savingPlan,
  savingPlanUntil,
  withDates,
  withDestination,
  withName,
  type CreateDraft,
  type CreateStep,
  type DraftErrors,
} from '@/components/trips/create/createDraft';

export interface StepProps {
  draft: CreateDraft;
  update: (fn: (d: CreateDraft) => CreateDraft) => void;
  errors: DraftErrors;
  home: string;
  homeCountry: string;
  today: Date;
}

// ---------------------------------------------------------------- 1 · Where to?

export function StepWhere({ draft, update, errors, homeCountry }: StepProps) {
  return (
    <CountrySearch
      value={draft.destinationCountry}
      onChange={(code) => update((d) => withDestination(d, code))}
      homeCountry={homeCountry}
      error={errors.destinationCountry}
      autoFocus={!draft.destinationCountry}
    />
  );
}

// ---------------------------------------------------------------- 2 · When?

export function StepWhen({ draft, update, errors }: StepProps) {
  const datesErr = useId();
  const nameErr = useId();
  const nameId = useId();
  const derived = draft.destinationCountry && draft.startDate ? getSeason(draft.destinationCountry, draft.startDate) : null;
  const season = draftSeason(draft);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <DateRangeField
          start={draft.startDate}
          end={draft.endDate}
          onChange={(s, e) => update((d) => withDates(d, s, e))}
          invalid={Boolean(errors.dates)}
          errorId={errors.dates ? datesErr : undefined}
        />
        <FieldError id={datesErr}>{errors.dates}</FieldError>
      </div>

      {season ? (
        <div>
          <FieldLabel>Season</FieldLabel>
          <SeasonPicker
            className="mt-1.5"
            season={season}
            picked={draft.season}
            derived={derived}
            country={draft.destinationCountry}
            onPick={(s) => update((d) => ({ ...d, season: s }))}
          />
        </div>
      ) : null}

      <div>
        <FieldLabel htmlFor={nameId}>Trip name</FieldLabel>
        <Input
          id={nameId}
          className="mt-1.5"
          value={draft.name}
          maxLength={NAME_MAX + 20}
          autoComplete="off"
          enterKeyHint="next"
          placeholder={draft.destinationCountry ? undefined : 'Tokyo 9D8N'}
          onChange={(e) => update((d) => withName(d, e.target.value))}
          aria-invalid={Boolean(errors.name) || undefined}
          aria-describedby={errors.name ? nameErr : `${nameId}-hint`}
        />
        {errors.name ? (
          <FieldError id={nameErr}>{errors.name}</FieldError>
        ) : (
          <p id={`${nameId}-hint`} className="type-body-s mt-1.5 text-ink-2">
            {draft.nameEdited ? 'Your name for it. Change it any time.' : 'We suggested one from the place and the days. Make it yours.'}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 3 · Who's in?

export function StepWho({ draft, update, errors }: StepProps) {
  const errId = useId();
  return (
    <div>
      <PartyOptions
        hideLegend
        value={draft.budgetType}
        onChange={(v) => update((d) => ({ ...d, budgetType: v }))}
        invalid={Boolean(errors.budgetType)}
        errorId={errors.budgetType ? errId : undefined}
      />
      <FieldError id={errId}>{errors.budgetType}</FieldError>
    </div>
  );
}

// ---------------------------------------------------------------- 4 · How much?

const QUICK_HOME = [1500, 3000, 5000, 8000];

/** 53,214 → 53,000: two significant figures, for quick chips in a foreign currency. */
function roundNice(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  const k = Math.pow(10, Math.max(0, Math.floor(Math.log10(n)) - 1));
  return Math.round(n / k) * k;
}

export interface StepHowMuchProps extends StepProps {
  rates: Rates | null;
  ratesLoading: boolean;
  ratesError: string | null;
}

export function StepHowMuch({ draft, update, errors, home, today, rates, ratesLoading, ratesError }: StepHowMuchProps) {
  const budgetId = useId();
  const budgetErr = useId();
  const savedId = useId();
  const savedErr = useId();
  const local = getCountryByCode(draft.destinationCountry)?.currency ?? home;
  const options = useMemo(() => Array.from(new Set([home, local])), [home, local]);
  const currency = draftCurrency(draft, home);
  const budget = draftBudget(draft, home);
  const days = draftDays(draft);
  const plan = savingPlan(draft, home, today);
  // The figure the helper converts to: the destination's money, or home when the trip is already in it.
  const other = currency === local ? home : local;

  const quick = useMemo(() => {
    if (currency === home) return QUICK_HOME;
    const r = rateBetween(home, currency, rates);
    return r == null ? [] : QUICK_HOME.map((n) => roundNice(n * r));
  }, [currency, home, rates]);

  const switchCurrency = (next: string) => {
    update((d) => {
      const from = draftCurrency(d, home);
      if (from === next) return d;
      // Carry the typed amounts across at today's rate so "3,000" doesn't silently turn into ¥ 3,000.
      const move = (text: string) => {
        const n = draftBudget({ budget: text, currency: from }, home);
        if (n == null) return text;
        const c = convertMoney(n, from, next, rates);
        if (c == null) return text;
        const d0 = currencyDecimals(next);
        return tidyMoneyText(String(d0 === 0 ? Math.round(c) : Math.round(c * 100) / 100), next);
      };
      return { ...d, currency: next === home ? null : next, budget: move(d.budget), saved: move(d.saved) };
    });
  };

  let fx: ReactNode = null;
  if (budget != null && budget > 0 && other !== currency) {
    const conv = convertMoney(budget, currency, other, rates);
    if (conv != null) fx = `${formatMoney(conv, other, { approx: true, decimals: Math.abs(conv) >= 100 ? 'none' : undefined })} at today's rate`;
    else if (ratesLoading) fx = "Getting today's rate…";
    else fx = ratesError ?? `No rate for ${other} today.`;
  }
  const perDay = budget != null && budget > 0 && days > 0 ? `${sentenceMoney(budget / days, currency, { approx: true })} a day for ${days} ${days === 1 ? 'day' : 'days'}` : null;

  return (
    <div className="flex flex-col gap-7">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <FieldLabel htmlFor={budgetId}>The jar holds</FieldLabel>
          <CurrencySwitch options={options} value={currency} onChange={switchCurrency} label="Trip currency" />
        </div>
        <MoneyInput
          id={budgetId}
          className="mt-2"
          value={draft.budget}
          currency={currency}
          ariaLabel="Budget"
          onChange={(v) => update((d) => ({ ...d, budget: v }))}
          invalid={Boolean(errors.budget)}
          describedBy={[errors.budget ? budgetErr : null, `${budgetId}-help`].filter(Boolean).join(' ')}
        />
        <FieldError id={budgetErr}>{errors.budget}</FieldError>
        <div id={`${budgetId}-help`} className="mt-2 flex flex-col gap-0.5" aria-live="polite">
          <HelperLine>{fx}</HelperLine>
          <HelperLine>{perDay}</HelperLine>
        </div>
        {quick.length ? (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Quick amounts">
            {quick.map((n) => {
              const text = tidyMoneyText(String(n), currency);
              const on = budget === n;
              return (
                <li key={n}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => update((d) => ({ ...d, budget: text }))}
                    className={cn(
                      'pressable inline-flex h-11 items-center rounded-sm border px-3 font-mono text-[14px] tabular-nums transition-colors duration-micro',
                      on ? 'border-fund bg-fund text-on-fund' : 'border-rule-strong bg-leaf text-ink hover:border-ink',
                    )}
                  >
                    {formatMoney(n, currency, { decimals: 'none' })}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        <p className="type-body-s mt-3 text-ink-2">
          {currency === home
            ? `Everything on this trip is counted in ${currency === 'MYR' ? 'ringgit' : currency}. Spends in other money get converted when you log them.`
            : `Everything on this trip is counted in ${currency}. You can't switch once there are entries.`}
        </p>
      </div>

      <div className="border-t border-rule pt-6">
        <FieldLabel htmlFor={savedId}>Already saved? (optional)</FieldLabel>
        <MoneyInput
          id={savedId}
          size="l"
          className="mt-2 max-w-[280px]"
          value={draft.saved}
          currency={currency}
          ariaLabel="Already saved"
          onChange={(v) => update((d) => ({ ...d, saved: v }))}
          invalid={Boolean(errors.saved)}
          describedBy={[errors.saved ? savedErr : null, `${savedId}-help`].filter(Boolean).join(' ')}
        />
        <FieldError id={savedErr}>{errors.saved}</FieldError>
        <p id={`${savedId}-help`} className="type-body-s mt-2 text-ink-2">
          It goes in the jar as your first entry, so the tabung starts saving.
        </p>
        {plan ? (
          <p className="type-ledger mt-3 border-l-[3px] border-fund pl-2 text-[14px] leading-5 text-ink" aria-live="polite">
            Save {formatMoney(plan.perWeek, plan.currency, { decimals: 'none' })} a week until {savingPlanUntil(plan)}.
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 5 · Check your ticket

export interface StepReviewProps extends StepProps {
  goTo: (step: CreateStep) => void;
}

export function StepReview({ draft, home, homeCountry, today, goTo }: StepReviewProps) {
  const currency = draftCurrency(draft, home);
  const budget = draftBudget(draft, home) ?? 0;
  const saved = draftSaved(draft, home);
  const days = draftDays(draft);
  const country = getCountryByCode(draft.destinationCountry);
  const season = draftSeason(draft);
  const ticketTrip = {
    name: draft.name.trim() || 'Your trip',
    destinationCountry: draft.destinationCountry ?? '',
    startDate: draft.startDate ?? '',
    endDate: draft.endDate ?? draft.startDate ?? '',
    budget,
    currency,
    budgetType: draft.budgetType ?? 'solo',
    savedAmount: saved ?? 0,
  };

  const rows: { step: CreateStep; label: string; value: string }[] = [
    { step: 1, label: 'Where', value: country ? `${country.name} · ${country.capital}` : '' },
    {
      step: 2,
      label: 'When',
      value: draft.startDate
        ? `${formatRange(draft.startDate, draft.endDate ?? draft.startDate)} · ${durationLabel(days)}${season ? ` · ${season.toUpperCase()}` : ''}`
        : '',
    },
    { step: 3, label: "Who's in", value: partyTitle(draft.budgetType) },
    {
      step: 4,
      label: 'Fund',
      value: `${sentenceMoney(budget, currency)}${saved ? ` · ${sentenceMoney(saved, currency)} saved` : ''}`,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <TripTicket variant="review" trip={ticketTrip} homeCountry={homeCountry} today={today} headingLevel={2} />
      <dl className="overflow-hidden rounded-lg border border-rule bg-leaf">
        {rows.map((r, i) => (
          <div key={r.step} className={cn('flex min-h-12 items-center gap-3 px-4 py-2', i > 0 && 'border-t border-rule')}>
            <dt className="type-overline w-20 shrink-0 text-ink-3">{r.label}</dt>
            <dd className="min-w-0 flex-1 text-[15px] leading-5 text-ink">{r.value}</dd>
            <dd className="shrink-0">
              <button
                type="button"
                onClick={() => goTo(r.step)}
                className="inline-flex min-h-11 items-center px-1 text-[14px] text-ink underline decoration-rule-strong underline-offset-[3px] hover:decoration-ink"
              >
                Change<span className="sr-only"> {r.label.toLowerCase()}</span>
              </button>
            </dd>
          </div>
        ))}
      </dl>
      <p className="type-body-s text-ink-2">
        {daysNightsLabel(days) ? `${daysNightsLabel(days)}. ` : ''}
        You can change any of this later from the trip.
      </p>
    </div>
  );
}
