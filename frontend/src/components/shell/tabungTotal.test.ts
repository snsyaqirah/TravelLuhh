import { describe, expect, it } from 'vitest';
import type { Rates } from '@/types';
import { sumInTabung } from '@/components/shell/tabungTotal';

const today = new Date(2026, 9, 15); // 15 Oct 2026, local

const trip = (o: { budget: number; spent?: number; currency: string; start: string; end: string }) => ({
  budget: o.budget,
  totalExpenses: o.spent ?? 0,
  currency: o.currency,
  startDate: o.start,
  endDate: o.end,
});

const tokyo = trip({ budget: 4000, spent: 0, currency: 'MYR', start: '2026-11-12', end: '2026-11-20' });
const bangkok = trip({ budget: 2000, spent: 500, currency: 'MYR', start: '2026-10-12', end: '2026-10-18' });
const pastBali = trip({ budget: 3000, spent: 100, currency: 'MYR', start: '2026-08-01', end: '2026-08-05' });
const seoulKrw = trip({ budget: 1_000_000, spent: 0, currency: 'KRW', start: '2026-12-01', end: '2026-12-08' });

const rates: Rates = { base: 'MYR', date: '2026-10-15', rates: { KRW: 312.5, JPY: 32.4 } };

describe('sumInTabung', () => {
  it('adds what is left in upcoming and on-the-road jars, skipping trips already home', () => {
    expect(sumInTabung([tokyo, bangkok, pastBali], today, 'MYR', null)).toEqual({
      amount: 5500,
      currency: 'MYR',
      approx: false,
      trips: 2,
    });
  });

  it('converts other currencies to home at today\'s rate and marks the sum approximate', () => {
    const total = sumInTabung([tokyo, seoulKrw], today, 'MYR', rates);
    expect(total?.approx).toBe(true);
    expect(total?.amount).toBeCloseTo(4000 + 1_000_000 / 312.5, 6);
  });

  it('shows no total when a rate is missing rather than a sum that drops a trip', () => {
    expect(sumInTabung([tokyo, seoulKrw], today, 'MYR', null)).toBeNull();
    expect(sumInTabung([tokyo, seoulKrw], today, 'MYR', { ...rates, rates: { JPY: 32.4 } })).toBeNull();
  });

  it('has nothing to show with no live trips', () => {
    expect(sumInTabung([], today, 'MYR', rates)).toBeNull();
    expect(sumInTabung([pastBali], today, 'MYR', rates)).toBeNull();
  });

  it('never counts an overspent jar as negative', () => {
    const over = trip({ budget: 1000, spent: 1400, currency: 'MYR', start: '2026-10-14', end: '2026-10-16' });
    expect(sumInTabung([over, tokyo], today, 'myr', null)?.amount).toBe(4000);
  });
});
