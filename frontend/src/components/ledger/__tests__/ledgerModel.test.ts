import { describe, expect, it } from 'vitest';
import type { Expense, FundEntry, Trip } from '@/types';
import { computePassbook } from '@/components/motifs/passbookMath';
import { buildLedger, countByCategory, filterLedger, initialsOf } from '../ledgerModel';

const trip = {
  id: 2,
  budget: 4000,
  currency: 'MYR',
  budgetType: 'shared',
  createdAt: '2026-07-01T10:00:00',
  startDate: '2026-10-12',
  endDate: '2026-10-20',
} as Trip;

const siti = { id: 2, name: 'Siti Aisyah', email: 's@x' };
const aiman = { id: 1, name: 'Aiman Hakim', email: 'a@x' };

function exp(id: number, date: string, p: Partial<Expense> = {}): Expense {
  return {
    id,
    tripId: 2,
    description: `Entry ${id}`,
    amount: 10,
    currency: 'MYR',
    originalAmount: 10,
    originalCurrency: 'MYR',
    category: 'food',
    expenseDate: date,
    createdAt: `${date}T12:00:00`,
    updatedAt: `${date}T12:00:00`,
    ...p,
  };
}

const expenses: Expense[] = [
  exp(13, '2026-10-12', { description: 'Ichiran Shinjuku', amount: 98.73, originalAmount: 3200, originalCurrency: 'JPY', fxRate: 0.03085467, paidBy: 2, paidByUser: siti }),
  exp(11, '2026-10-12', { description: 'Hotel Gracery Shinjuku', amount: 1260, originalAmount: 1260, category: 'accommodation', paidBy: 1, paidByUser: aiman, notes: "Paid on Aiman's card" }),
  exp(18, '2026-10-14', { description: 'Tobu Nikko pass x3', amount: 429.5, category: 'transportation', paidBy: 1, paidByUser: aiman }),
  exp(19, '2026-10-14', { description: 'Yuba lunch set', amount: 129.59 }),
  exp(22, '2026-10-15', {
    description: 'Don Quijote haul',
    amount: 241.9,
    category: 'bundle',
    subItems: [
      { id: 5, description: 'KitKat matcha, 3 boxes', amount: 74.06, category: 'shopping' },
      { id: 7, description: 'Tokyo Banana', amount: 167.84, category: 'food' },
    ],
  }),
];

const fund: FundEntry[] = [
  { id: 11, tripId: 2, userId: 3, userName: 'Syaqirah', amount: -250, note: 'Took some out for the Nikko pass', entryDate: '2026-10-05', createdAt: '2026-10-05T21:00:00' },
  { id: 7, tripId: 2, userId: 3, userName: 'Syaqirah', amount: 3000, note: null, entryDate: '2026-09-01', createdAt: '2026-09-01T08:00:00' },
];

describe('initialsOf', () => {
  it('takes up to two initials', () => {
    expect(initialsOf('Siti Aisyah')).toBe('SA');
    expect(initialsOf('Syaqirah')).toBe('S');
    expect(initialsOf('  ')).toBe('');
  });
});

describe('buildLedger', () => {
  it('budget mode opens with a FUND SET row worth the budget, then expenses oldest first', () => {
    const entries = buildLedger({ trip, expenses, mode: 'budget' });
    expect(entries.map((e) => e.row.id)).toEqual(['fund-set', 11, 13, 18, 19, 22]);
    expect(entries[0].row).toMatchObject({ label: 'Fund set', in: 4000, kind: 'system', date: '2026-07-01' });
    const lines = computePassbook(
      entries.map((e) => e.row),
      0,
      'MYR',
    );
    // BAKI ends at budget − spent
    expect(lines[lines.length - 1].balance).toBe(1840.28);
  });

  it('marks foreign rows, payers on group trips and bundles', () => {
    const entries = buildLedger({ trip, expenses, mode: 'budget' });
    const ramen = entries.find((e) => e.row.id === 13)!.row;
    expect(ramen).toMatchObject({ out: 98.73, originalAmount: 3200, originalCurrency: 'JPY', payerInitials: 'SA', sub: 'FNB' });
    const hotel = entries.find((e) => e.row.id === 11)!.row;
    expect(hotel.originalCurrency).toBeNull();
    const donki = entries.find((e) => e.row.id === 22)!.row;
    expect(donki.isBundle).toBe(true);
    expect(donki.children?.map((c) => c.label)).toEqual(['KitKat matcha, 3 boxes', 'Tokyo Banana']);
    // solo trips carry no payer chips
    const solo = buildLedger({ trip: { ...trip, budgetType: 'solo' }, expenses, mode: 'budget' });
    expect(solo.every((e) => !e.row.payerInitials)).toBe(true);
  });

  it('saving mode prints fund entries instead (withdrawals as money out), so BAKI = saved − spent', () => {
    const entries = buildLedger({ trip, expenses, fundEntries: fund, mode: 'saving' });
    expect(entries.map((e) => e.row.id)).toEqual(['fund-7', 'fund-11', 11, 13, 18, 19, 22]);
    expect(entries[0].row).toMatchObject({ in: 3000, label: 'Into the tabung', sub: 'FUND' });
    expect(entries[1].row).toMatchObject({ out: 250, label: 'Took some out for the Nikko pass' });
    const lines = computePassbook(
      entries.map((e) => e.row),
      0,
      'MYR',
    );
    expect(lines[lines.length - 1].balance).toBe(590.28);
  });

  it('no budget and no fund: no FUND SET row', () => {
    const entries = buildLedger({ trip: { ...trip, budget: 0 }, expenses, mode: 'budget' });
    expect(entries.some((e) => e.kind === 'fundSet')).toBe(false);
  });
});

describe('filterLedger', () => {
  const entries = buildLedger({ trip, expenses, mode: 'budget' });
  const opts = { currency: 'MYR', balance: true };

  it('no filter: every row with the running balance', () => {
    const f = filterLedger(entries, {}, opts);
    expect(f.rows).toHaveLength(6);
    expect(f).toMatchObject({ showBalance: true, openingBalance: 0, count: 5, totalCount: 5, total: 2159.72 });
  });

  it('?day= keeps the real BAKI by opening at the balance before that day', () => {
    const f = filterLedger(entries, { day: '2026-10-14' }, opts);
    expect(f.rows.map((r) => r.id)).toEqual([18, 19]);
    expect(f.showBalance).toBe(true);
    expect(f.openingBalance).toBe(4000 - 1260 - 98.73);
    expect(f.total).toBe(559.09);
    const lines = computePassbook(f.rows, f.openingBalance, 'MYR');
    const full = computePassbook(
      entries.map((e) => e.row),
      0,
      'MYR',
    );
    expect(lines[1].balance).toBe(full.find((l) => l.id === 19)!.balance);
  });

  it('?cat= keeps only that category and hides the running balance', () => {
    const f = filterLedger(entries, { cat: 'food' }, opts);
    expect(f.rows.map((r) => r.id)).toEqual([13, 19]);
    expect(f).toMatchObject({ showBalance: false, count: 2, total: 228.32 });
  });

  it('search matches descriptions, notes, payers, sub-items and category names, all terms', () => {
    expect(filterLedger(entries, { q: 'kitkat' }, opts).rows.map((r) => r.id)).toEqual([22]);
    expect(filterLedger(entries, { q: 'aiman' }, opts).rows.map((r) => r.id)).toEqual([11, 18]);
    expect(filterLedger(entries, { q: 'card' }, opts).rows.map((r) => r.id)).toEqual([11]);
    expect(filterLedger(entries, { q: 'transport nikko' }, opts).rows.map((r) => r.id)).toEqual([18]);
    expect(filterLedger(entries, { q: 'JPY' }, opts).rows.map((r) => r.id)).toEqual([13]);
    expect(filterLedger(entries, { q: 'zzz' }, opts).rows).toHaveLength(0);
  });

  it('filters combine', () => {
    const f = filterLedger(entries, { day: '2026-10-14', cat: 'food' }, opts);
    expect(f.rows.map((r) => r.id)).toEqual([19]);
    expect(f.showBalance).toBe(false);
    expect(filterLedger(entries, { day: '2026-10-13' }, opts).rows).toHaveLength(0);
  });

  it('counts per category for the chips', () => {
    expect(countByCategory(expenses)).toEqual({ food: 2, accommodation: 1, transportation: 1, bundle: 1 });
  });
});
