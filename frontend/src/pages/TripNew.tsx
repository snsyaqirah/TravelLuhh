// Create: "Start a tabung" (§9.5). Five steps (Where to? → When? → Who's in? → How much? → Check your ticket),
// each validated before Next, with the S2 TripPlot drawing the draft as it fills in: sticky beside the form on
// desktop (420px), a 160px strip above it on phones. The draft lives in sessionStorage so a refresh keeps it.
// Enter = Next. On "Open tabung" the trip is created, any "already saved" amount goes in as the first fund
// entry, and we land on the new trip.
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useTrips } from '@/hooks/useTrips';
import { useRates } from '@/hooks/useRates';
import { useToday } from '@/hooks/useToday';
import { fundService } from '@/services/fundService';
import { getErrorMessage } from '@/lib/axios';
import { queryKeys } from '@/lib/queryClient';
import { toISODate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { useShellChrome } from '@/components/shell/chrome';
import { Button } from '@/components/ui/button';
import { SceneSummary } from '@/components/motifs';
import { IsoStage } from '@/iso/IsoStage';
import { mapTripPlotDraft } from '@/iso/mappers/tripPlot';
import { getCountryByCode } from '@/data/countries';
import {
  clearDraft,
  draftBudget,
  draftCurrency,
  draftSaved,
  EMPTY_DRAFT,
  firstInvalidStep,
  isDraftTouched,
  loadDraft,
  resumeStep,
  saveDraft,
  STEP_COUNT,
  STEP_META,
  toCreateRequest,
  validateStep,
  type CreateDraft,
  type CreateStep,
} from '@/components/trips/create/createDraft';
import { StepHowMuch, StepReview, StepWhen, StepWhere, StepWho } from '@/components/trips/create/steps';

function initialDraft(home: string): CreateDraft {
  const stored = loadDraft();
  if (!stored) return EMPTY_DRAFT;
  return { ...stored, step: resumeStep(stored, home) };
}

export default function TripNew() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const home = (user?.currency || 'MYR').toUpperCase();
  const homeCountry = (user?.country || 'MY').toUpperCase();
  const today = useToday();
  const { createTrip } = useTrips({ enabled: false });
  const fx = useRates(home);

  const [draft, setDraft] = useState<CreateDraft>(() => initialDraft(home));
  // Steps where Next was pressed: their errors show (and update live) from then on.
  const [tried, setTried] = useState<ReadonlySet<CreateStep>>(() => new Set());
  const [submitting, setSubmitting] = useState(false);
  const [focusTick, setFocusTick] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const firstRender = useRef(true);

  useShellChrome({ hideBottomBar: true, title: 'Start a tabung', backTo: '/trips', backLabel: 'Back to Trips' });

  const step = draft.step;
  const update = useCallback((fn: (d: CreateDraft) => CreateDraft) => setDraft((d) => fn(d)), []);

  // Persist every change (only once there's something worth keeping).
  useEffect(() => {
    if (isDraftTouched(draft)) saveDraft(draft);
  }, [draft]);

  // Moving between steps puts focus on the new step's heading, so screen readers hear where they are.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [step]);

  // After a failed Next, focus the first field with a problem.
  useEffect(() => {
    if (!focusTick) return;
    const el = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    el?.focus();
  }, [focusTick]);

  const errors = useMemo(() => (tried.has(step) ? validateStep(draft, step, home) : {}), [tried, step, draft, home]);

  const goTo = (s: CreateStep) => setDraft((d) => ({ ...d, step: s }));

  const submit = async () => {
    const bad = firstInvalidStep(draft, home);
    if (bad) {
      setTried((t) => new Set(t).add(bad));
      goTo(bad);
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      const trip = await createTrip(toCreateRequest(draft, home));
      const saved = draftSaved(draft, home);
      if (saved) {
        try {
          await fundService.add(trip.id, { amount: saved, entryDate: toISODate(today), note: 'Already saved' });
          void qc.invalidateQueries({ queryKey: queryKeys.tripsAll });
          void qc.invalidateQueries({ queryKey: queryKeys.trip(trip.id) });
          void qc.invalidateQueries({ queryKey: queryKeys.fund(trip.id) });
        } catch (e) {
          toast.error(
            `The tabung is open, but the ${formatMoney(saved, trip.currency)} you'd saved didn't go in. Drop it in from the trip.`,
            { description: getErrorMessage(e) },
          );
        }
      }
      clearDraft();
      toast.success('Tabung opened. Jom!');
      navigate(`/trips/${trip.id}`, { replace: true });
    } catch (e) {
      setSubmitting(false);
      toast.error(getErrorMessage(e, "The tabung didn't open. Try again."));
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (step === STEP_COUNT) {
      void submit();
      return;
    }
    const errs = validateStep(draft, step, home);
    if (Object.keys(errs).length) {
      setTried((t) => new Set(t).add(step));
      setFocusTick((n) => n + 1);
      return;
    }
    goTo((step + 1) as CreateStep);
  };

  const onBack = () => {
    if (step === 1) {
      clearDraft();
      navigate('/trips');
      return;
    }
    goTo((step - 1) as CreateStep);
  };

  // The scene follows the form. Only the fields it draws are dependencies, so typing a name doesn't rebuild it.
  const budget = draftBudget(draft, home);
  const currency = draftCurrency(draft, home);
  const spec = useMemo(
    () =>
      mapTripPlotDraft(
        {
          destinationCountry: draft.destinationCountry,
          startDate: draft.startDate,
          endDate: draft.endDate,
          budget,
          currency,
          budgetType: draft.budgetType,
          people: 3,
        },
        step,
        { homeCountry },
      ),
    [draft.destinationCountry, draft.startDate, draft.endDate, budget, currency, draft.budgetType, step, homeCountry],
  );

  const stepProps = { draft, update, errors, home, homeCountry, today };
  const meta = STEP_META[step];
  const place = getCountryByCode(draft.destinationCountry);

  return (
    <div className="pb-24 md:pb-0">
      <div className="lg:grid lg:grid-cols-12 lg:gap-x-6">
        {/* S2 draft: a strip above the form on phones, sticky beside it on desktop */}
        <div className="-mx-4 mb-6 border-b border-rule bg-paper px-4 pb-3 md:-mx-6 md:px-6 lg:sticky lg:top-10 lg:order-2 lg:col-span-7 lg:col-start-6 lg:mx-0 lg:mb-0 lg:self-start lg:border-b-0 lg:px-0 lg:pb-0">
          <IsoStage
            spec={spec}
            mode="draft"
            draftStep={step}
            height={{ base: 160, lg: 420 }}
            footer={<SceneSummary spec={spec} className="mt-1 line-clamp-1 lg:mt-2 lg:line-clamp-none" />}
          />
        </div>

        <form ref={formRef} onSubmit={onSubmit} noValidate className="lg:order-1 lg:col-span-5 lg:row-start-1" aria-labelledby="create-step-title">
          <p className="type-overline text-ink-2">
            Step {step} of {STEP_COUNT} · {meta.key}
            {place && step > 1 ? <span className="text-ink-3"> · {place.capital.toUpperCase()}</span> : null}
          </p>
          <ol className="mt-2 flex gap-1" aria-hidden="true">
            {Array.from({ length: STEP_COUNT }, (_, i) => (
              <li key={i} className={cn('h-1 flex-1', i < step ? 'bg-fund' : 'bg-rule')} />
            ))}
          </ol>
          <h1 id="create-step-title" ref={headingRef} tabIndex={-1} className="type-display-2 mt-4 text-ink outline-none">
            {meta.title}
          </h1>

          <div className="mt-6">
            {step === 1 ? <StepWhere {...stepProps} /> : null}
            {step === 2 ? <StepWhen {...stepProps} /> : null}
            {step === 3 ? <StepWho {...stepProps} /> : null}
            {step === 4 ? <StepHowMuch {...stepProps} rates={fx.rates} ratesLoading={fx.isLoading} ratesError={fx.error} /> : null}
            {step === 5 ? <StepReview {...stepProps} goTo={goTo} /> : null}
          </div>

          {/* Back | Next: a sticky bar on phones, inline from tablet up */}
          <div className="fixed inset-x-0 bottom-0 z-30 flex gap-3 border-t border-rule bg-paper px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 md:static md:mt-10 md:border-0 md:bg-transparent md:p-0">
            <Button type="button" variant="ghost" onClick={onBack} disabled={submitting} className="shrink-0 px-3">
              {step === 1 ? 'Cancel' : 'Back'}
            </Button>
            <Button type="submit" className="flex-1 md:flex-none md:px-8" disabled={submitting}>
              {step === STEP_COUNT ? (submitting ? 'Opening…' : 'Open tabung') : 'Next'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
