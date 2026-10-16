// The Log spend form as plain data (spec §9.6 + §2.6). The sheet keeps an ExpenseDraft in state and turns it
// into a CreateExpenseInput here, so the conversion rules are tested without rendering anything:
//   - amount/currency always go out in the trip currency, with originalAmount/originalCurrency/fxRate;
//   - a manual rate wins over the live one (money-changer cash, or no rate today);
//   - bundle line items are converted with the same rate and the last line soaks up the rounding.
import type { CreateExpenseInput, CreateSubItemInput, Expense, Rates, Trip } from '@/types';
import { CATEGORY_META, isCategoryKey, type CategoryKey } from '@/data/categories';
import { currencyDecimals, formatMoney, formatRate, parseMoneyInput, rateBetween, roundMoney, toTripCurrency } from '@/lib/money';
import { addCalendarDays, isValidDate, parseLocalDate, toISODate } from '@/lib/dates';

export interface LineDraft {
  /** Stable React key; never sent. */
  key: string;
  description: string;
  /** As typed, in the currency the receipt was paid in. */
  amount: string;
  category: CategoryKey | '';
  /** Edit mode: the stored line (trip currency) and how its amount was shown, so an untouched line keeps it. */
  logged?: { amountText: string; amount: number };
}

export interface ExpenseDraft {
  /** As typed: '3,200', '12.50'. */
  amount: string;
  /** What was paid in (ISO code). */
  currency: string;
  category: CategoryKey | null;
  description: string;
  /** 'YYYY-MM-DD' */
  date: string;
  /** userId; null on solo trips (the server defaults to the caller). */
  paidBy: number | null;
  notes: string;
  /** Receipt line items open. */
  itemise: boolean;
  lines: LineDraft[];
  /** 'manual' uses manualRate instead of the live table. */
  rateMode: 'live' | 'manual';
  /** As typed, in the direction rateInverse says. */
  manualRate: string;
  /**
   * true: the manual field reads "1 MYR = [32.41] JPY" (foreign units per trip unit, how money changers quote
   * weak currencies). false: "1 SGD = [3.45] MYR" (trip units per foreign unit).
   */
  rateInverse: boolean;
  /**
   * Edit mode: the money exactly as it was logged. While amount, currency and rate are untouched the entry
   * keeps these figures to the sen, instead of re-deriving them from the 2-decimal rate on screen.
   */
  logged?: LoggedMoney;
}

export interface LoggedMoney {
  amountText: string;
  currency: string;
  rateText: string;
  rateInverse: boolean;
  /** Trip currency. */
  amount: number;
  originalAmount: number;
  /** Trip units per paid unit; undefined for a trip-currency entry. */
  fxRate?: number;
}

export type DraftField = 'amount' | 'currency' | 'category' | 'description' | 'date' | 'rate' | 'lines' | 'notes';
export type DraftErrors = Partial<Record<DraftField, string>>;

export const MAX_NOTES = 2000;
export const MAX_DESCRIPTION = 255;
/** 10 integer digits (backend @Digits). */
const MAX_AMOUNT = 9_999_999_999;

let lineSeq = 0;
export function newLine(partial: Partial<Omit<LineDraft, 'key'>> = {}): LineDraft {
  lineSeq += 1;
  return { key: `line-${lineSeq}`, description: '', amount: '', category: '', ...partial };
}

const up = (c: string | null | undefined) => (c ?? '').trim().toUpperCase();

/** Today when it falls inside the trip, otherwise the start date (pre-trip bookings can still pick any day). */
export function defaultExpenseDate(trip: Pick<Trip, 'startDate' | 'endDate'>, today: Date = new Date()): string {
  const t = toISODate(today);
  return t >= trip.startDate && t <= trip.endDate ? t : trip.startDate;
}

export function yesterdayOf(today: Date): string {
  return toISODate(addCalendarDays(today, -1));
}

export function isISODate(value: string | null | undefined): value is string {
  return Boolean(value) && /^\d{4}-\d{2}-\d{2}$/.test(value as string) && isValidDate(parseLocalDate(value as string));
}

/** Format a typed amount for display once the field loses focus: '3200' → '3,200', '12.5' → '12.50'. */
export function tidyAmount(text: string, currency: string): string {
  const n = parseMoneyInput(text, currency);
  if (n == null || n <= 0) return text;
  return formatMoney(n, currency).replace(/^[^\d]+/, '');
}

export interface NewDraftOptions {
  /** Current user id: the default payer on group trips. */
  me?: number | null;
  group?: boolean;
  today?: Date;
}

export function newDraft(trip: Pick<Trip, 'currency' | 'startDate' | 'endDate'>, opts: NewDraftOptions = {}): ExpenseDraft {
  return {
    amount: '',
    currency: up(trip.currency),
    category: null,
    description: '',
    date: defaultExpenseDate(trip, opts.today),
    paidBy: opts.group && opts.me != null ? opts.me : null,
    notes: '',
    itemise: false,
    lines: [],
    rateMode: 'live',
    manualRate: '',
    rateInverse: true,
  };
}

/** Plain number for an input ('3200', '12.5'), without grouping. */
function plain(n: number, currency: string): string {
  const d = currencyDecimals(currency);
  const r = roundMoney(n, currency);
  return d === 0 ? String(Math.round(r)) : r.toFixed(d).replace(/\.00$/, '');
}

/** Prefill for edit mode: the original receipt (currency, amount, rate as logged, line items back in that currency). */
export function draftFromExpense(expense: Expense, trip: Pick<Trip, 'currency'>, opts: { group?: boolean } = {}): ExpenseDraft {
  const tripCur = up(trip.currency);
  const origCur = up(expense.originalCurrency) || tripCur;
  const foreign = origCur !== tripCur;
  const origAmount = foreign && expense.originalAmount != null ? Number(expense.originalAmount) : Number(expense.amount);
  // Rate as logged: trip units per foreign unit. Derive it when the server didn't store one.
  const rate = foreign
    ? expense.fxRate && expense.fxRate > 0
      ? Number(expense.fxRate)
      : origAmount > 0
        ? Number(expense.amount) / origAmount
        : null
    : null;
  const inverse = rate != null ? rate < 1 : true;
  const subs = expense.subItems ?? [];
  const amountText = tidyAmount(plain(origAmount, origCur), origCur);
  const rateText = rate != null ? formatRate(inverse ? 1 / rate : rate).replace(/,/g, '') : '';
  return {
    amount: amountText,
    currency: origCur,
    category: isCategoryKey(expense.category) ? expense.category : 'other',
    description: expense.description ?? '',
    date: expense.expenseDate,
    paidBy: opts.group ? (expense.paidBy ?? expense.addedBy ?? null) : null,
    notes: expense.notes ?? '',
    itemise: subs.length > 0,
    lines: subs.map((s) => {
      // Sub-items are stored in the trip currency; show them in the receipt's currency again.
      const amountText = rate ? plain(Number(s.amount) / rate, origCur) : plain(Number(s.amount), origCur);
      return newLine({
        description: s.description,
        amount: amountText,
        category: isCategoryKey(s.category) ? s.category : '',
        logged: { amountText, amount: Number(s.amount) },
      });
    }),
    rateMode: rate != null ? 'manual' : 'live',
    manualRate: rateText,
    rateInverse: inverse,
    logged: {
      amountText,
      currency: origCur,
      rateText,
      rateInverse: inverse,
      amount: Number(expense.amount),
      originalAmount: origAmount,
      fxRate: rate ?? undefined,
    },
  };
}

/** True while the edit form still shows the money exactly as it was logged. */
export function moneyUnchanged(draft: ExpenseDraft): boolean {
  const l = draft.logged;
  if (!l) return false;
  if (draft.amount !== l.amountText || up(draft.currency) !== l.currency) return false;
  if (l.fxRate === undefined) return true;
  return draft.rateMode === 'manual' && draft.manualRate === l.rateText && draft.rateInverse === l.rateInverse;
}

/** The typed manual rate as trip units per 1 foreign unit, or null. The logged rate stays exact while untouched. */
export function manualRateValue(draft: Pick<ExpenseDraft, 'manualRate' | 'rateInverse' | 'logged'>): number | null {
  const l = draft.logged;
  if (l?.fxRate !== undefined && draft.manualRate === l.rateText && draft.rateInverse === l.rateInverse) return l.fxRate;
  const v = parseMoneyInput(draft.manualRate);
  if (v == null || !(v > 0)) return null;
  return draft.rateInverse ? 1 / v : v;
}

export interface RateInfo {
  /** Trip units per 1 paid unit; 1 when the currencies match; null when unknown. */
  rate: number | null;
  source: 'same' | 'live' | 'manual' | 'none';
  /** Is there a live rate for this pair at all (so "Use live rate" can be offered)? */
  liveAvailable: boolean;
}

export function rateFor(draft: ExpenseDraft, tripCurrency: string, rates: Rates | null | undefined): RateInfo {
  const from = up(draft.currency);
  const to = up(tripCurrency);
  if (from === to) return { rate: 1, source: 'same', liveAvailable: true };
  const live = rateBetween(from, to, rates);
  if (draft.rateMode === 'manual') {
    const m = manualRateValue(draft);
    return { rate: m, source: m != null ? 'manual' : 'none', liveAvailable: live != null };
  }
  if (live != null) return { rate: live, source: 'live', liveAvailable: true };
  return { rate: null, source: 'none', liveAvailable: false };
}

/** "1 MYR = 32.41 JPY" when the paid currency is the smaller unit, else "1 SGD = 3.45 MYR". */
export function rateLabel(tripPerForeign: number, tripCurrency: string, foreignCurrency: string): string {
  if (!(tripPerForeign > 0)) return '';
  return tripPerForeign < 1
    ? `1 ${up(tripCurrency)} = ${formatRate(1 / tripPerForeign)} ${up(foreignCurrency)}`
    : `1 ${up(foreignCurrency)} = ${formatRate(tripPerForeign)} ${up(tripCurrency)}`;
}

export interface LinesSummary {
  /** Σ typed line amounts, in the paid currency. */
  allocated: number;
  /** total − allocated (negative when the lines run over). */
  remaining: number;
  /** Lines that have an amount or a description. */
  filled: number;
}

export function summariseLines(draft: ExpenseDraft): LinesSummary {
  const cur = draft.currency;
  const total = parseMoneyInput(draft.amount, cur) ?? 0;
  let allocated = 0;
  let filled = 0;
  for (const l of draft.lines) {
    const a = parseMoneyInput(l.amount, cur);
    if (l.description.trim() || (a != null && a !== 0)) filled += 1;
    if (a != null && a > 0) allocated += a;
  }
  allocated = roundMoney(allocated, cur);
  return { allocated, remaining: roundMoney(total - allocated, cur), filled };
}

export interface BuildContext {
  trip: Pick<Trip, 'id' | 'currency'>;
  rates: Rates | null | undefined;
  /** Edit mode: an expense that already had line items needs `subItems: []` to drop them. */
  hadSubItems?: boolean;
}

// `errors`/`input` are present-but-undefined on the other branch so callers narrow without strictNullChecks.
export type BuildResult =
  | { ok: true; input: CreateExpenseInput; preview: { paid: string; label: string }; errors?: undefined }
  | { ok: false; errors: DraftErrors; input?: undefined; preview?: undefined };

/** Validate the draft and build the request body (trip currency + original + rate). */
export function buildExpenseInput(draft: ExpenseDraft, ctx: BuildContext): BuildResult {
  const errors: DraftErrors = {};
  const tripCur = up(ctx.trip.currency);
  const cur = up(draft.currency);
  const paid = parseMoneyInput(draft.amount, cur);

  if (!cur || !/^[A-Z]{3}$/.test(cur)) errors.currency = 'Pick the currency you paid in.';
  if (paid == null || draft.amount.trim() === '') errors.amount = 'Enter how much you paid.';
  else if (paid <= 0) errors.amount = 'The amount has to be more than 0.';
  else if (paid > MAX_AMOUNT) errors.amount = 'That amount is too large for the ledger.';

  if (!draft.category) errors.category = 'Pick a category.';
  if (!isISODate(draft.date)) errors.date = 'Pick the day you paid.';
  if (draft.description.trim().length > MAX_DESCRIPTION) errors.description = `Keep it under ${MAX_DESCRIPTION} characters.`;
  if (draft.notes.length > MAX_NOTES) errors.notes = `Notes can be up to ${MAX_NOTES.toLocaleString('en-MY')} characters.`;

  const info = rateFor(draft, tripCur, ctx.rates);
  if (cur !== tripCur && info.rate == null) {
    errors.rate =
      draft.rateMode === 'manual'
        ? `Enter the rate you got for ${cur}.`
        : `No live rate for ${cur} today. Enter the rate you got.`;
  }

  let money = null as ReturnType<typeof toTripCurrency>;
  if (paid != null && paid > 0 && !errors.rate && moneyUnchanged(draft) && draft.logged) {
    const l = draft.logged;
    money = {
      amount: l.amount,
      currency: tripCur,
      originalAmount: l.originalAmount,
      originalCurrency: cur,
      ...(l.fxRate !== undefined ? { fxRate: Number(l.fxRate.toPrecision(8)) } : {}),
    };
  } else if (paid != null && paid > 0 && !errors.rate) {
    money = toTripCurrency({ amount: paid, currency: cur }, tripCur, null, cur === tripCur ? null : info.rate);
    if (!money) errors.rate = `No live rate for ${cur} today. Enter the rate you got.`;
    else if (!(money.amount > 0)) errors.amount = `That comes to ${formatMoney(0, tripCur)}. Check the amount or the rate.`;
    else if (money.amount > MAX_AMOUNT) errors.amount = 'That amount is too large for the ledger.';
  }

  // Line items
  let subItems: CreateSubItemInput[] | undefined;
  if (draft.itemise) {
    const lines = draft.lines.filter((l) => l.description.trim() || l.amount.trim());
    const parsed = lines.map((l) => ({ line: l, amount: parseMoneyInput(l.amount, cur) }));
    const bad = parsed.find((p) => !p.line.description.trim() || p.amount == null || p.amount <= 0);
    if (bad) {
      errors.lines = !bad.line.description.trim() ? 'Every line needs a name.' : 'Every line needs an amount above 0.';
    } else if (paid != null && paid > 0) {
      const sum = roundMoney(
        parsed.reduce((s, p) => s + (p.amount ?? 0), 0),
        cur,
      );
      if (sum > paid + 1e-9) {
        errors.lines = `The lines come to ${formatMoney(sum, cur)}, more than the ${formatMoney(paid, cur)} paid.`;
      } else if (money) {
        const rate = cur === tripCur ? 1 : (money.fxRate ?? info.rate ?? 1);
        // Nothing about the money or the lines changed: keep the stored lines to the sen.
        const untouched =
          moneyUnchanged(draft) &&
          parsed.length > 0 &&
          parsed.every((p) => p.line.logged && p.line.amount === p.line.logged.amountText);
        const converted = parsed.map((p) => (untouched && p.line.logged ? p.line.logged.amount : roundMoney((p.amount ?? 0) * rate, tripCur)));
        // Fully allocated: the last line takes the rounding so the lines add up to the total exactly.
        if (!untouched && converted.length && Math.abs(sum - paid) < 1e-9) {
          const others = converted.slice(0, -1).reduce((s, a) => s + a, 0);
          converted[converted.length - 1] = roundMoney(money.amount - others, tripCur);
        }
        if (converted.some((a) => !(a > 0))) {
          errors.lines = `A line comes to less than ${formatMoney(0.01, tripCur)} after converting. Merge it with another line.`;
        } else {
          subItems = parsed.map((p, i) => ({
            description: p.line.description.trim(),
            amount: converted[i],
            ...(p.line.category ? { category: p.line.category } : {}),
          }));
        }
      }
    }
  }
  if (!draft.itemise && ctx.hadSubItems) subItems = [];
  if (draft.itemise && ctx.hadSubItems && subItems === undefined && !errors.lines) subItems = [];

  if (Object.keys(errors).length || !money || !draft.category) return { ok: false, errors };

  const description = draft.description.trim() || CATEGORY_META[draft.category].label;
  const notes = draft.notes.trim();
  const input: CreateExpenseInput = {
    tripId: ctx.trip.id,
    description,
    amount: money.amount,
    currency: money.currency,
    originalAmount: money.originalAmount,
    originalCurrency: money.originalCurrency,
    ...(money.fxRate != null ? { fxRate: money.fxRate } : {}),
    category: draft.category,
    expenseDate: draft.date,
    ...(notes ? { notes } : {}),
    ...(draft.paidBy != null ? { paidBy: draft.paidBy } : {}),
    ...(subItems !== undefined ? { subItems } : {}),
  };
  return {
    ok: true,
    input,
    preview: { paid: formatMoney(money.originalAmount, money.originalCurrency), label: CATEGORY_META[draft.category].label },
  };
}

/** First field to focus after a failed submit, in on-screen order. */
export const FIELD_ORDER: DraftField[] = ['amount', 'currency', 'rate', 'category', 'description', 'date', 'lines', 'notes'];
