// The Create flow's state (§9.5): one draft object that the five steps edit, validated per step, kept in
// sessionStorage so a refresh doesn't lose it. Pure; the page owns React state and side effects.
import type { BudgetType, CreateTripRequest, Season } from '@/types';
import { getCountryByCode } from '@/data/countries';
import { calendarDaysBetween, formatShortDate, isValidDate, parseLocalDate } from '@/lib/dates';
import { durationLabel, tripDays } from '@/lib/phase';
import { getSeason } from '@/lib/season';
import { parseMoneyInput, roundMoney } from '@/lib/money';

export type CreateStep = 1 | 2 | 3 | 4 | 5;
export const STEP_COUNT = 5;

export const STEP_META: Record<CreateStep, { title: string; key: string }> = {
  1: { title: 'Where to?', key: 'WHERE' },
  2: { title: 'When?', key: 'WHEN' },
  3: { title: "Who's in?", key: 'WHO' },
  4: { title: 'How much?', key: 'HOW MUCH' },
  5: { title: 'Check your ticket', key: 'CHECK' },
};

export interface CreateDraft {
  v: 1;
  step: CreateStep;
  /** ISO alpha-2. */
  destinationCountry: string | null;
  /** 'YYYY-MM-DD' */
  startDate: string | null;
  endDate: string | null;
  name: string;
  /** Once the traveller types a name we stop suggesting one. */
  nameEdited: boolean;
  /** null = derived from destination and start date. */
  season: Season | null;
  budgetType: BudgetType | null;
  /** Trip currency; null = the home currency (chosen on step 4). */
  currency: string | null;
  /** Raw text of the money inputs, parsed on validation. */
  budget: string;
  saved: string;
}

export const EMPTY_DRAFT: CreateDraft = {
  v: 1,
  step: 1,
  destinationCountry: null,
  startDate: null,
  endDate: null,
  name: '',
  nameEdited: false,
  season: null,
  budgetType: null,
  currency: null,
  budget: '',
  saved: '',
};

export const NAME_MAX = 100;
export const MAX_TRIP_DAYS = 365;
/** DECIMAL(12,2): at most 10 integer digits. */
const MONEY_MAX = 9_999_999_999.99;

// ---------------------------------------------------------------- derived values

/** The place a name or countdown uses: the capital, else the country name. */
export function placeName(code: string | null | undefined): string {
  const c = getCountryByCode(code);
  return c?.capital ?? c?.name ?? (code ?? '').toUpperCase();
}

/** 'Tokyo 9D8N' once there are dates, 'Tokyo' before. */
export function suggestName(code: string | null, start: string | null, end: string | null): string {
  if (!code) return '';
  const place = placeName(code);
  if (!start) return place;
  return `${place} ${durationLabel(tripDays({ startDate: start, endDate: end ?? start }))}`;
}

/** Inclusive days of the draft's range, or 0 without a start date. */
export function draftDays(d: Pick<CreateDraft, 'startDate' | 'endDate'>): number {
  if (!d.startDate) return 0;
  return tripDays({ startDate: d.startDate, endDate: d.endDate ?? d.startDate });
}

/** '9 days, 8 nights' · '1 day'. */
export function daysNightsLabel(days: number): string {
  if (days <= 0) return '';
  if (days === 1) return '1 day';
  const nights = days - 1;
  return `${days} days, ${nights} ${nights === 1 ? 'night' : 'nights'}`;
}

export function draftSeason(d: Pick<CreateDraft, 'season' | 'destinationCountry' | 'startDate'>): Season | null {
  if (d.season) return d.season;
  if (!d.destinationCountry || !d.startDate) return null;
  return getSeason(d.destinationCountry, d.startDate);
}

/** The trip currency the draft will be opened in. */
export function draftCurrency(d: Pick<CreateDraft, 'currency'>, home: string): string {
  return (d.currency ?? home).toUpperCase();
}

/** Parsed budget, or null when empty or unreadable. */
export function draftBudget(d: Pick<CreateDraft, 'budget' | 'currency'>, home: string): number | null {
  return parseMoneyInput(d.budget, draftCurrency(d, home));
}

/** Parsed "already saved", or null when empty, unreadable or zero. */
export function draftSaved(d: Pick<CreateDraft, 'saved' | 'currency'>, home: string): number | null {
  const n = parseMoneyInput(d.saved, draftCurrency(d, home));
  return n != null && n > 0 ? n : null;
}

// ---------------------------------------------------------------- edits

/** Picking a place also refreshes the suggested name, unless the traveller wrote their own. */
export function withDestination(d: CreateDraft, code: string): CreateDraft {
  const next = { ...d, destinationCountry: code.toUpperCase() };
  // A currency that was the old destination's no longer makes sense; fall back to home.
  const oldLocal = getCountryByCode(d.destinationCountry)?.currency;
  if (d.currency && oldLocal && d.currency === oldLocal) next.currency = null;
  if (!d.nameEdited) next.name = suggestName(next.destinationCountry, d.startDate, d.endDate);
  return next;
}

export function withDates(d: CreateDraft, start: string | null, end: string | null): CreateDraft {
  const next = { ...d, startDate: start, endDate: end ?? start };
  if (!d.nameEdited) next.name = suggestName(d.destinationCountry, next.startDate, next.endDate);
  return next;
}

export function withName(d: CreateDraft, name: string): CreateDraft {
  return { ...d, name, nameEdited: name.trim().length > 0 };
}

// ---------------------------------------------------------------- validation

export type DraftField = 'destinationCountry' | 'dates' | 'name' | 'budgetType' | 'budget' | 'saved';
export type DraftErrors = Partial<Record<DraftField, string>>;

function validateMoney(raw: string, currency: string, o: { required: boolean }): string | null {
  const text = raw.trim();
  if (!text) return o.required ? "Enter how much you'll set aside for this trip." : null;
  const n = parseMoneyInput(text, currency);
  if (n == null) return "That doesn't look like an amount. Use numbers, like 3000 or 3,000.50.";
  if (n < 0) return o.required ? 'The budget has to be more than zero.' : "Enter what you've saved, or leave it empty.";
  if (o.required && roundMoney(n, currency) <= 0) return 'The budget has to be more than zero.';
  if (n > MONEY_MAX) return "That's more than we can count. Try a smaller amount.";
  return null;
}

/** Errors for one step. Empty object = the step is complete. */
export function validateStep(d: CreateDraft, step: CreateStep, home: string): DraftErrors {
  const e: DraftErrors = {};
  if (step === 1) {
    if (!d.destinationCountry || !getCountryByCode(d.destinationCountry)) e.destinationCountry = "Pick where you're going.";
  }
  if (step === 2) {
    const s = d.startDate ? parseLocalDate(d.startDate) : null;
    const en = d.endDate ? parseLocalDate(d.endDate) : s;
    if (!s || !isValidDate(s)) e.dates = 'Pick your first day, then your last day.';
    else if (!en || !isValidDate(en) || calendarDaysBetween(s, en) < 0) e.dates = 'The last day has to be on or after the first day.';
    else if (calendarDaysBetween(s, en) + 1 > MAX_TRIP_DAYS) e.dates = 'A trip can be up to a year long. Split longer ones into two.';
    const name = d.name.trim();
    if (!name) e.name = 'Give the trip a name.';
    else if (name.length > NAME_MAX) e.name = `Keep the name under ${NAME_MAX} characters.`;
  }
  if (step === 3) {
    if (!d.budgetType) e.budgetType = "Pick who's coming along.";
  }
  if (step === 4) {
    const c = draftCurrency(d, home);
    const budget = validateMoney(d.budget, c, { required: true });
    if (budget) e.budget = budget;
    const saved = validateMoney(d.saved, c, { required: false });
    if (saved) e.saved = saved;
  }
  return e;
}

/** The first step with a problem, for the final "Open tabung" check. */
export function firstInvalidStep(d: CreateDraft, home: string): CreateStep | null {
  for (const s of [1, 2, 3, 4] as CreateStep[]) {
    if (Object.keys(validateStep(d, s, home)).length) return s;
  }
  return null;
}

/** Where a restored draft picks up: its saved step, but never past a step whose inputs are missing. */
export function resumeStep(d: CreateDraft, home: string): CreateStep {
  const bad = firstInvalidStep(d, home);
  return bad != null && bad < d.step ? bad : d.step;
}

export function toCreateRequest(d: CreateDraft, home: string): CreateTripRequest {
  const currency = draftCurrency(d, home);
  return {
    name: d.name.trim(),
    destinationCountry: (d.destinationCountry ?? '').toUpperCase(),
    startDate: d.startDate ?? '',
    endDate: d.endDate ?? d.startDate ?? '',
    budget: draftBudget(d, home) ?? 0,
    currency,
    budgetType: d.budgetType ?? 'solo',
    season: draftSeason(d),
  };
}

// ---------------------------------------------------------------- saving plan

export interface SavingPlan {
  perWeek: number;
  weeks: number;
  /** 'YYYY-MM-DD': the first day of the trip. */
  until: string;
  currency: string;
}

/**
 * "Save RM 175 a week until 12 Nov": only when the trip starts more than two weeks from today and there is
 * still money to put aside. Rounded up to a whole unit so the plan never falls short.
 */
export function savingPlan(d: CreateDraft, home: string, today: Date): SavingPlan | null {
  if (!d.startDate) return null;
  const start = parseLocalDate(d.startDate);
  if (!isValidDate(start)) return null;
  const daysAway = calendarDaysBetween(today, start);
  if (daysAway <= 14) return null;
  const budget = draftBudget(d, home);
  if (budget == null || budget <= 0) return null;
  const remaining = budget - (draftSaved(d, home) ?? 0);
  if (remaining <= 0) return null;
  const weeks = Math.max(2, Math.floor(daysAway / 7));
  return { perWeek: Math.ceil(remaining / weeks), weeks, until: d.startDate, currency: draftCurrency(d, home) };
}

export function savingPlanUntil(plan: SavingPlan): string {
  return formatShortDate(plan.until);
}

// ---------------------------------------------------------------- persistence

export const DRAFT_KEY = 'travelluhh_create_draft';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function sessionStore(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const isStrOrNull = (v: unknown): v is string | null => v === null || typeof v === 'string';
const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter', 'tropical'];
const TYPES: readonly BudgetType[] = ['solo', 'shared', 'separated'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A stored draft, or null when there is none, it is from another version, or it doesn't parse. */
export function loadDraft(storage: StorageLike | null = sessionStore()): CreateDraft | null {
  if (!storage) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!o || typeof o !== 'object' || o.v !== 1) return null;
    const step = Number(o.step);
    if (![1, 2, 3, 4, 5].includes(step)) return null;
    if (!isStrOrNull(o.destinationCountry) || !isStrOrNull(o.startDate) || !isStrOrNull(o.endDate)) return null;
    if (!isStr(o.name) || !isStr(o.budget) || !isStr(o.saved) || !isStrOrNull(o.currency)) return null;
    if (o.startDate && !DATE_RE.test(o.startDate)) return null;
    if (o.endDate && !DATE_RE.test(o.endDate)) return null;
    const draft: CreateDraft = {
      v: 1,
      step: step as CreateStep,
      destinationCountry: o.destinationCountry && getCountryByCode(o.destinationCountry) ? o.destinationCountry.toUpperCase() : null,
      startDate: o.startDate,
      endDate: o.endDate,
      name: o.name.slice(0, 300),
      nameEdited: o.nameEdited === true,
      season: SEASONS.includes(o.season as Season) ? (o.season as Season) : null,
      budgetType: TYPES.includes(o.budgetType as BudgetType) ? (o.budgetType as BudgetType) : null,
      currency: o.currency && /^[A-Za-z]{3}$/.test(o.currency) ? o.currency.toUpperCase() : null,
      budget: o.budget.slice(0, 40),
      saved: o.saved.slice(0, 40),
    };
    return draft;
  } catch {
    return null;
  }
}

export function saveDraft(d: CreateDraft, storage: StorageLike | null = sessionStore()): void {
  if (!storage) return;
  try {
    storage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    // quota or blocked storage: the draft just won't survive a refresh
  }
}

export function clearDraft(storage: StorageLike | null = sessionStore()): void {
  if (!storage) return;
  try {
    storage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

/** True when the draft holds anything worth keeping (used to skip writing an untouched draft). */
export function isDraftTouched(d: CreateDraft): boolean {
  return Boolean(d.destinationCountry || d.startDate || d.name.trim() || d.budgetType || d.budget.trim() || d.saved.trim() || d.step > 1);
}
