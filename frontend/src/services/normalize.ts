// Defensive shaping of API responses: money may arrive as a string from an older build, optional numbers may
// be missing. Pages then never see NaN.
import type { Expense, Trip } from '@/types';

export function num(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = num(value, NaN);
  return Number.isFinite(n) ? n : null;
}

export function normalizeTrip(raw: Trip): Trip {
  const spent = num(raw.spentAmount ?? raw.totalExpenses);
  return {
    ...raw,
    id: num(raw.id),
    ownerId: num(raw.ownerId),
    budget: num(raw.budget),
    budgetType: raw.budgetType ?? 'solo',
    isArchived: Boolean(raw.isArchived),
    totalExpenses: num(raw.totalExpenses ?? spent),
    spentAmount: spent,
    savedAmount: num(raw.savedAmount),
    remainingBudget: raw.remainingBudget == null ? num(raw.budget) - spent : num(raw.remainingBudget),
    memberCount: raw.memberCount ?? raw.members?.length ?? 1,
  };
}

export function normalizeExpense(raw: Expense): Expense {
  const amount = num(raw.amount);
  // Rows logged before the currency fix have original_amount = 0 and original_currency = 'USD' defaults.
  const original = numOrNull(raw.originalAmount);
  const hasOriginal = original !== null && original !== 0;
  return {
    ...raw,
    id: num(raw.id),
    tripId: num(raw.tripId),
    amount,
    originalAmount: hasOriginal ? original : amount,
    originalCurrency: (hasOriginal && raw.originalCurrency) || raw.currency,
    fxRate: numOrNull(raw.fxRate),
    paidBy: raw.paidBy ?? raw.addedBy ?? null,
    subItems: (raw.subItems ?? []).map((s) => ({ ...s, amount: num(s.amount) })),
  };
}
