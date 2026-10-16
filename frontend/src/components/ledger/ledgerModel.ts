// Ledger rows as data (spec §9.6, §5.4 Passbook). Expenses become KELUAR rows; the money that went into the
// tabung becomes MASUK rows so the running BAKI is honest:
//   - budget mode (Phase A, no fund entries): one printed "Fund set" row worth the budget;
//   - saving mode (Phase B): every fund entry, withdrawals as money out.
// Filters (?day=, ?cat=, search) are applied here too, so the tab and the tests agree.
import type { ReactNode } from 'react';
import type { Expense, FundEntry, Trip } from '@/types';
import { computePassbook, type PassbookRow, type PassbookSubRow } from '@/components/motifs/passbookMath';
import { categoryMeta, type CategoryKey } from '@/data/categories';
import { roundMoney } from '@/lib/money';
import { isGroupTrip } from '@/components/motifs/tripMeta';

export type LedgerKind = 'expense' | 'fund' | 'fundSet';

export interface LedgerEntry {
  kind: LedgerKind;
  row: PassbookRow;
  expense?: Expense;
  fund?: FundEntry;
  /** Lower-cased text the search box matches against. */
  haystack: string;
}

export interface LedgerGlyphs {
  expense?: (category: CategoryKey) => ReactNode;
  sub?: (category: CategoryKey | null | undefined) => ReactNode;
  fund?: () => ReactNode;
}

export interface BuildLedgerInput {
  trip: Pick<Trip, 'id' | 'budget' | 'currency' | 'budgetType' | 'createdAt' | 'startDate'>;
  expenses: readonly Expense[];
  /** saving mode: the trip's fund entries (any order). null/undefined in budget mode. */
  fundEntries?: readonly FundEntry[] | null;
  mode: 'budget' | 'saving';
  glyphs?: LedgerGlyphs;
}

/** 'Siti Aisyah' → 'SA', 'Syaqirah' → 'S'. */
export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
}

export function payerOf(e: Expense): { id: number | null; name: string } {
  const user = e.paidByUser ?? e.addedByUser ?? null;
  return { id: e.paidBy ?? e.addedBy ?? user?.id ?? null, name: user?.name ?? '' };
}

const dateOnly = (ts: string | null | undefined) => (ts ?? '').slice(0, 10);

/** FUND SET sits before everything else: the trip's creation day, or the first entry if that came earlier. */
function fundSetDate(trip: BuildLedgerInput['trip'], expenses: readonly Expense[]): string {
  const candidates = [dateOnly(trip.createdAt), ...expenses.map((e) => e.expenseDate)].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (!candidates.length) return trip.startDate;
  return candidates.reduce((min, d) => (d < min ? d : min));
}

function expenseRow(e: Expense, group: boolean, glyphs?: LedgerGlyphs): PassbookRow {
  const meta = categoryMeta(e.category);
  const subs = e.subItems ?? [];
  const foreign = Boolean(e.originalCurrency && e.originalCurrency.toUpperCase() !== (e.currency ?? '').toUpperCase());
  const children: PassbookSubRow[] = subs.map((s) => ({
    id: s.id,
    label: s.description,
    amount: Number(s.amount),
    glyph: glyphs?.sub?.(s.category ?? null),
  }));
  return {
    id: e.id,
    date: e.expenseDate,
    label: e.description,
    glyph: glyphs?.expense?.(meta.key),
    out: Number(e.amount) || 0,
    sub: meta.code,
    originalAmount: foreign ? Number(e.originalAmount) : null,
    originalCurrency: foreign ? e.originalCurrency : null,
    payerInitials: group ? initialsOf(payerOf(e).name) || undefined : undefined,
    isBundle: children.length > 0,
    children: children.length ? children : undefined,
    kind: 'entry',
  };
}

function fundRow(f: FundEntry, group: boolean, glyphs?: LedgerGlyphs): PassbookRow {
  const amount = Number(f.amount) || 0;
  const label = f.note?.trim() || (amount >= 0 ? 'Into the tabung' : 'Out of the tabung');
  return {
    id: `fund-${f.id}`,
    date: f.entryDate,
    label,
    glyph: glyphs?.fund?.(),
    // A withdrawal leaves the tabung like a spend does; it is money out in the passbook.
    ...(amount >= 0 ? { in: amount } : { out: -amount }),
    sub: 'FUND',
    payerInitials: group && f.userName ? initialsOf(f.userName) || undefined : undefined,
    kind: 'entry',
  };
}

/** Every ledger entry, oldest first (the order the BAKI is computed in). */
export function buildLedger({ trip, expenses, fundEntries, mode, glyphs }: BuildLedgerInput): LedgerEntry[] {
  const group = isGroupTrip(trip);
  type Sortable = LedgerEntry & { at: string; rank: number; tie: number };
  const out: Sortable[] = [];

  if (mode === 'saving') {
    for (const f of fundEntries ?? []) {
      out.push({
        kind: 'fund',
        row: fundRow(f, group, glyphs),
        fund: f,
        haystack: [f.note, f.userName, 'fund tabung'].filter(Boolean).join(' ').toLowerCase(),
        at: f.createdAt ?? '',
        rank: 0,
        tie: f.id,
      });
    }
  } else if (Number(trip.budget) > 0) {
    out.push({
      kind: 'fundSet',
      row: { id: 'fund-set', date: fundSetDate(trip, expenses), label: 'Fund set', in: Number(trip.budget), kind: 'system', glyph: glyphs?.fund?.() },
      haystack: 'fund set budget',
      at: '',
      rank: -1,
      tie: 0,
    });
  }

  for (const e of expenses) {
    const meta = categoryMeta(e.category);
    out.push({
      kind: 'expense',
      row: expenseRow(e, group, glyphs),
      expense: e,
      haystack: [
        e.description,
        e.notes,
        meta.label,
        meta.code,
        payerOf(e).name,
        e.addedByUser?.name,
        e.originalCurrency,
        ...(e.subItems ?? []).map((s) => s.description),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
      at: e.createdAt ?? '',
      rank: 1,
      tie: e.id,
    });
  }

  out.sort((a, b) => a.row.date.localeCompare(b.row.date) || a.rank - b.rank || a.at.localeCompare(b.at) || a.tie - b.tie);
  return out.map(({ kind, row, expense, fund, haystack }) => ({ kind, row, expense, fund, haystack }));
}

export interface LedgerFilters {
  /** 'YYYY-MM-DD' */
  day?: string | null;
  cat?: CategoryKey | null;
  q?: string | null;
}

export const hasFilters = (f: LedgerFilters) => Boolean(f.day || f.cat || (f.q ?? '').trim());

export interface FilteredLedger {
  /** Rows to render, oldest first. */
  rows: PassbookRow[];
  entries: LedgerEntry[];
  /** BAKI before the first row (a day filter keeps the real running balance). */
  openingBalance: number;
  /** A category or search filter leaves gaps, so a running balance would lie: hide it. */
  showBalance: boolean;
  /** Expenses shown and their total (trip currency). */
  count: number;
  total: number;
  /** Every expense in the ledger. */
  totalCount: number;
}

export function filterLedger(
  entries: readonly LedgerEntry[],
  filters: LedgerFilters,
  opts: { currency: string; balance: boolean },
): FilteredLedger {
  const q = (filters.q ?? '').trim().toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);
  const totalCount = entries.filter((e) => e.kind === 'expense').length;

  const matched = entries.filter((e) => {
    if (filters.day && e.row.date !== filters.day) return false;
    if (filters.cat && (e.kind !== 'expense' || categoryMeta(e.expense?.category).key !== filters.cat)) return false;
    if (terms.length && !terms.every((t) => e.haystack.includes(t))) return false;
    return true;
  });

  let openingBalance = 0;
  const gaps = Boolean(filters.cat || terms.length);
  if (filters.day && !gaps && opts.balance) {
    const all = computePassbook(
      entries.map((e) => e.row),
      0,
      opts.currency,
    );
    const first = entries.findIndex((e) => e.row.date === filters.day);
    openingBalance = first > 0 ? all[first - 1].balance : 0;
  }

  const expensesShown = matched.filter((e) => e.kind === 'expense');
  return {
    rows: matched.map((e) => e.row),
    entries: matched,
    openingBalance,
    showBalance: opts.balance && !gaps,
    count: expensesShown.length,
    total: roundMoney(
      expensesShown.reduce((s, e) => s + (e.row.out ?? 0), 0),
      opts.currency,
    ),
    totalCount,
  };
}

/** Expenses per category (for the filter chips' counts). */
export function countByCategory(expenses: readonly Expense[]): Partial<Record<CategoryKey, number>> {
  const counts: Partial<Record<CategoryKey, number>> = {};
  for (const e of expenses) {
    const k = categoryMeta(e.category).key;
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}
