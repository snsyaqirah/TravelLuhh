// Edit a trip (§9.5 "Edit"): the Create fields on one page, in a sheet (right drawer 480px from 768px, a
// full-height bottom sheet on phones). Opened by the trip page through ?sheet=edit. Only changed fields are
// sent, so an editor's save never trips the owner-only budgetType rule, and an unchanged currency never hits
// the currency lock. Who's in is owner-only; the currency locks once the trip has entries.
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { Trip } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useTrips } from '@/hooks/useTrips';
import { useRates } from '@/hooks/useRates';
import { getErrorMessage } from '@/lib/axios';
import { formatRange } from '@/lib/dates';
import { durationLabel } from '@/lib/phase';
import { getSeason } from '@/lib/season';
import { convertMoney, currencyDecimals, parseMoneyInput } from '@/lib/money';
import { cn } from '@/lib/utils';
import { getCountryByCode } from '@/data/countries';
import { useMediaQuery } from '@/components/shell/useMediaQuery';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CountryChip } from '@/components/glyphs';
import { CountrySearch } from '@/components/trips/fields/CountrySearch';
import { DateRangeField } from '@/components/trips/fields/DateRangeField';
import { SeasonPicker } from '@/components/trips/fields/SeasonPicker';
import { PartyOptions } from '@/components/trips/fields/PartyOptions';
import { CurrencySwitch, MoneyInput } from '@/components/trips/fields/MoneyInput';
import { tidyMoneyText } from '@/components/trips/fields/fieldText';
import { FieldError, FieldLabel } from '@/components/trips/fields/FieldBits';
import { daysNightsLabel, draftDays, NAME_MAX, validateStep } from '@/components/trips/create/createDraft';
import { asDraft, editChanges, fromTrip, mapServerErrors, pickServer, type EditErrors, type EditState } from '@/components/trips/editTrip';

export interface TripEditSheetProps {
  trip: Trip;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Disclosure({
  label,
  summary,
  open,
  onToggle,
  children,
  invalid,
}: {
  label: string;
  summary: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  invalid?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className={cn('mt-1.5 flex min-h-12 items-center gap-3 border-b-[1.5px] pb-1', invalid ? 'border-stamp' : 'border-rule')}>
        <div className="min-w-0 flex-1">{summary}</div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
          className="inline-flex min-h-11 shrink-0 items-center px-1 text-[14px] text-ink underline decoration-rule-strong underline-offset-[3px] hover:decoration-ink"
        >
          {open ? 'Done' : 'Change'}
          <span className="sr-only"> {label.toLowerCase()}</span>
        </button>
      </div>
      <div id={id} hidden={!open} className="pt-3">
        {open ? children : null}
      </div>
    </div>
  );
}

export function TripEditSheet({ trip, open, onOpenChange }: TripEditSheetProps) {
  const wide = useMediaQuery('(min-width: 768px)');
  const { user } = useAuth();
  const home = (user?.currency || 'MYR').toUpperCase();
  const { updateTrip } = useTrips({ enabled: false });
  const fx = useRates(home);
  const [state, setState] = useState<EditState>(() => fromTrip(trip));
  const [errors, setErrors] = useState<EditErrors>({});
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openPart, setOpenPart] = useState<'where' | 'when' | null>(null);
  const nameId = useId();
  const nameErr = useId();
  const budgetId = useId();
  const budgetErr = useId();
  const currencyErr = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [focusTick, setFocusTick] = useState(0);

  // After a failed save, bring the first field with a problem into view and focus it.
  useEffect(() => {
    if (!focusTick) return;
    const el = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    el?.scrollIntoView({ block: 'center' });
    el?.focus({ preventScroll: true });
  }, [focusTick]);

  const role = trip.myRole ?? 'viewer';
  const canEdit = role !== 'viewer';
  const isOwner = role === 'owner';
  const hasEntries = (trip.totalExpenses ?? trip.spentAmount ?? 0) > 0 || (trip.savedAmount ?? 0) > 0;

  // Fresh copy of the trip every time the sheet opens.
  useEffect(() => {
    if (open) {
      setState(fromTrip(trip));
      setErrors({});
      setTried(false);
      setOpenPart(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (patch: Partial<EditState>) => {
    setState((s) => ({ ...s, ...patch }));
  };

  const liveErrors: EditErrors = useMemo(() => {
    if (!tried) return errors;
    const d = asDraft(state);
    return { ...validateStep(d, 1, home), ...validateStep(d, 2, home), ...validateStep(d, 4, home), ...pickServer(errors) };
  }, [tried, state, home, errors]);

  const changes = editChanges(trip, state);
  // Any edit to the form enables Save (even one that won't parse, so the error can say why).
  const initial = useMemo(() => fromTrip(trip), [trip]);
  const dirty = JSON.stringify(state) !== JSON.stringify(initial);
  const hasChanges = Object.keys(changes).length > 1;

  const local = getCountryByCode(state.destinationCountry)?.currency ?? home;
  const currencyOptions = Array.from(new Set([trip.currency.toUpperCase(), home, local]));
  const derivedSeason = state.destinationCountry && state.startDate ? getSeason(state.destinationCountry, state.startDate) : null;
  const country = getCountryByCode(state.destinationCountry);
  const days = draftDays(state);

  const switchCurrency = (next: string) => {
    setErrors((e) => ({ ...e, currency: undefined }));
    setState((s) => {
      if (s.currency === next) return s;
      const n = parseMoneyInput(s.budget, s.currency);
      const c = n == null ? null : convertMoney(n, s.currency, next, fx.rates);
      const budget =
        c == null ? s.budget : tidyMoneyText(String(currencyDecimals(next) === 0 ? Math.round(c) : Math.round(c * 100) / 100), next);
      return { ...s, currency: next, budget };
    });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canEdit || saving) return;
    setTried(true);
    setErrors({});
    const d = asDraft(state);
    const errs = { ...validateStep(d, 1, home), ...validateStep(d, 2, home), ...validateStep(d, 4, home) };
    if (Object.keys(errs).length) {
      if (errs.destinationCountry) setOpenPart('where');
      else if (errs.dates) setOpenPart('when');
      setFocusTick((n) => n + 1);
      return;
    }
    if (!hasChanges) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      await updateTrip(changes);
      toast.success('Changes saved.');
      setSaving(false);
      onOpenChange(false);
    } catch (err) {
      setSaving(false);
      const msg = getErrorMessage(err, "Changes didn't save. Try again.");
      setErrors(mapServerErrors(err, msg));
      setFocusTick((n) => n + 1);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <SheetContent
        side={wide ? 'right' : 'bottom'}
        className={cn('flex flex-col gap-0 overflow-hidden p-0', wide ? 'w-full sm:max-w-[480px]' : 'h-[calc(100dvh-8px)] max-h-none')}
      >
        <SheetHeader className="border-b border-rule px-5 pb-4 pt-5">
          <SheetTitle>Edit trip</SheetTitle>
          <SheetDescription>{trip.name}</SheetDescription>
        </SheetHeader>

        {!canEdit ? (
          <div className="px-5 py-6">
            <p className="type-body text-ink">Viewers can't change this trip. Ask the owner to make you an editor.</p>
          </div>
        ) : (
          <form ref={formRef} onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
            {/* relative: sr-only children are positioned against this scroller, not the fixed sheet */}
            <div className="relative flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto px-5 py-5">
              <Disclosure
                label="Where"
                open={openPart === 'where'}
                onToggle={() => setOpenPart((p) => (p === 'where' ? null : 'where'))}
                invalid={Boolean(liveErrors.destinationCountry)}
                summary={
                  country ? (
                    <span className="flex items-center gap-2">
                      <CountryChip code={country.code} announce="none" />
                      <span className="text-[16px] text-ink">{country.name}</span>
                    </span>
                  ) : (
                    <span className="text-ink-2">Pick a place</span>
                  )
                }
              >
                <CountrySearch
                  value={state.destinationCountry}
                  onChange={(code) => {
                    set({ destinationCountry: code });
                    setOpenPart(null);
                  }}
                  homeCountry={user?.country}
                  error={liveErrors.destinationCountry}
                />
              </Disclosure>

              <Disclosure
                label="When"
                open={openPart === 'when'}
                onToggle={() => setOpenPart((p) => (p === 'when' ? null : 'when'))}
                invalid={Boolean(liveErrors.dates)}
                summary={
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="type-ledger text-[15px] text-ink">{formatRange(state.startDate, state.endDate)}</span>
                    <span className="type-ledger text-[13px] text-ink-2">
                      {durationLabel(days)} · {daysNightsLabel(days)}
                    </span>
                  </span>
                }
              >
                <DateRangeField start={state.startDate} end={state.endDate} onChange={(s, en) => set({ startDate: s ?? '', endDate: en ?? s ?? '' })} hideSummary invalid={Boolean(liveErrors.dates)} />
              </Disclosure>
              {liveErrors.dates ? <FieldError className="-mt-5">{liveErrors.dates}</FieldError> : null}

              <div>
                <FieldLabel htmlFor={nameId}>Trip name</FieldLabel>
                <Input
                  id={nameId}
                  className="mt-1.5"
                  value={state.name}
                  maxLength={NAME_MAX + 20}
                  autoComplete="off"
                  onChange={(e) => set({ name: e.target.value })}
                  aria-invalid={Boolean(liveErrors.name) || undefined}
                  aria-describedby={liveErrors.name ? nameErr : undefined}
                />
                <FieldError id={nameErr}>{liveErrors.name}</FieldError>
              </div>

              {derivedSeason ? (
                <div>
                  <FieldLabel>Season</FieldLabel>
                  <SeasonPicker
                    className="mt-1.5"
                    season={state.season ?? derivedSeason}
                    picked={state.season}
                    derived={derivedSeason}
                    country={state.destinationCountry}
                    onPick={(s) => set({ season: s })}
                  />
                </div>
              ) : null}

              <div>
                <PartyOptions
                  value={state.budgetType}
                  onChange={(v) => set({ budgetType: v })}
                  disabled={!isOwner}
                  legend="Who's in"
                  invalid={Boolean(liveErrors.budgetType)}
                />
                {!isOwner ? <p className="type-body-s mt-1 text-ink-2">Only the owner can change who's in.</p> : null}
                <FieldError>{liveErrors.budgetType}</FieldError>
              </div>

              <div>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <FieldLabel htmlFor={budgetId}>The jar holds</FieldLabel>
                  {hasEntries ? null : <CurrencySwitch options={currencyOptions} value={state.currency} onChange={switchCurrency} label="Trip currency" />}
                </div>
                <MoneyInput
                  id={budgetId}
                  size="l"
                  className="mt-2"
                  value={state.budget}
                  currency={state.currency}
                  ariaLabel="Budget"
                  onChange={(v) => set({ budget: v })}
                  invalid={Boolean(liveErrors.budget)}
                  describedBy={[liveErrors.budget ? budgetErr : null, liveErrors.currency ? currencyErr : null].filter(Boolean).join(' ') || undefined}
                />
                <FieldError id={budgetErr}>{liveErrors.budget}</FieldError>
                <FieldError id={currencyErr}>{liveErrors.currency}</FieldError>
                {hasEntries ? (
                  <p className="type-body-s mt-2 text-ink-2">
                    Counted in {trip.currency.toUpperCase()}. The currency is locked because the trip already has entries.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-rule bg-card px-5 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3">
              <FieldError className="mt-0">{liveErrors.form}</FieldError>
              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving} className="px-3">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={saving || !dirty}>
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
