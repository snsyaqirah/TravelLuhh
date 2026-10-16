// The Edit sheet's form state and its partial PUT (pure, so the rules are tested): only changed fields are
// sent, a season that matches the dates stays automatic, and server errors map back onto the fields.
import type { BudgetType, Season, Trip, UpdateTripInput } from '@/types';
import { getFieldErrors } from '@/lib/axios';
import { getSeason } from '@/lib/season';
import { parseMoneyInput, roundMoney } from '@/lib/money';
import { tidyMoneyText } from '@/components/trips/fields/fieldText';
import type { CreateDraft, DraftErrors } from '@/components/trips/create/createDraft';

export interface EditState {
  destinationCountry: string;
  startDate: string;
  endDate: string;
  name: string;
  /** null = derive from place and dates */
  season: Season | null;
  budgetType: BudgetType;
  currency: string;
  budget: string;
}

export type EditErrors = DraftErrors & { currency?: string; form?: string };

export function fromTrip(trip: Trip): EditState {
  const c = trip.currency.toUpperCase();
  return {
    destinationCountry: trip.destinationCountry.toUpperCase(),
    startDate: trip.startDate,
    endDate: trip.endDate,
    name: trip.name,
    // A stored season that matches the dates counts as automatic, so moving the dates moves the season.
    season: trip.season && trip.season !== getSeason(trip.destinationCountry, trip.startDate) ? trip.season : null,
    budgetType: trip.budgetType,
    currency: c,
    budget: tidyMoneyText(String(roundMoney(trip.budget, c)), c),
  };
}

export function asDraft(s: EditState): CreateDraft {
  return {
    v: 1,
    step: 5,
    destinationCountry: s.destinationCountry,
    startDate: s.startDate,
    endDate: s.endDate,
    name: s.name,
    nameEdited: true,
    season: s.season,
    budgetType: s.budgetType,
    currency: s.currency,
    budget: s.budget,
    saved: '',
  };
}

/** The partial PUT: only what changed. */
export function editChanges(trip: Trip, s: EditState): UpdateTripInput {
  const out: UpdateTripInput = { id: trip.id };
  const derived = getSeason(s.destinationCountry, s.startDate);
  const season = s.season ?? derived;
  const budget = parseMoneyInput(s.budget, s.currency);
  if (s.name.trim() !== trip.name) out.name = s.name.trim();
  if (s.destinationCountry !== trip.destinationCountry.toUpperCase()) out.destinationCountry = s.destinationCountry;
  if (s.startDate !== trip.startDate) out.startDate = s.startDate;
  if (s.endDate !== trip.endDate) out.endDate = s.endDate;
  // A trip saved without a season keeps none unless the person picks one.
  if (season !== (trip.season ?? null) && (trip.season != null || s.season != null)) out.season = season;
  if (s.budgetType !== trip.budgetType) out.budgetType = s.budgetType;
  if (s.currency !== trip.currency.toUpperCase()) out.currency = s.currency;
  if (budget != null && roundMoney(budget, s.currency) !== roundMoney(trip.budget, trip.currency)) out.budget = budget;
  else if (out.currency && budget != null) out.budget = budget;
  return out;
}

/** Server field names → the sheet's fields. */
export function mapServerErrors(e: unknown, message: string): EditErrors {
  const fe = getFieldErrors(e) ?? {};
  const out: EditErrors = {};
  for (const [k, v] of Object.entries(fe)) {
    if (k === 'name') out.name = v;
    else if (k === 'budget') out.budget = v;
    else if (k === 'currency') out.currency = v;
    else if (k === 'startDate' || k === 'endDate') out.dates = v;
    else if (k === 'destinationCountry') out.destinationCountry = v;
    else if (k === 'budgetType') out.budgetType = v;
  }
  if (!Object.keys(out).length) {
    if (/currency/i.test(message)) out.currency = message;
    else if (/day|date/i.test(message)) out.dates = message;
    else out.form = message;
  }
  return out;
}

/** Server errors stay until the next save attempt. */
export function pickServer(e: EditErrors): EditErrors {
  const out: EditErrors = {};
  if (e.currency) out.currency = e.currency;
  if (e.form) out.form = e.form;
  for (const k of ['name', 'budget', 'dates', 'destinationCountry', 'budgetType'] as const) if (e[k]) out[k] = e[k];
  return out;
}
