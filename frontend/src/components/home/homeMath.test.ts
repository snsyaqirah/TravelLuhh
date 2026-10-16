import { describe, expect, it } from 'vitest';
import type { Expense, FundEntry, Rates, Trip } from '@/types';
import { sumInTabung } from '@/components/shell/tabungTotal';
import { inTabung, latestEntries, passportLine, passportStats, statusTrip } from './homeMath';

const today = new Date(2026, 9, 16); // Fri 16 Oct 2026

function trip(p: Partial<Trip> & Pick<Trip, 'id' | 'name' | 'startDate' | 'endDate'>): Trip {
  return {
    ownerId: 1,
    destinationCountry: 'JP',
    budget: 4000,
    currency: 'MYR',
    budgetType: 'solo',
    isArchived: false,
    createdAt: '2026-09-01T10:00:00',
    updatedAt: '2026-09-01T10:00:00',
    totalExpenses: 0,
    savedAmount: 0,
    ...p,
  };
}

const tokyo = trip({ id: 2, name: 'Tokyo autumn', startDate: '2026-10-12', endDate: '2026-10-20', budget: 4000, totalExpenses: 1660 });
const penang = trip({ id: 3, name: 'Penang makan trip', destinationCountry: 'MY', startDate: '2026-11-20', endDate: '2026-11-23', budget: 1500, totalExpenses: 387, savedAmount: 550 });
// Seoul is budgeted in won: 1,800,000 KRW, 600,000 saved.
const seoul = trip({ id: 4, name: 'Seoul winter', destinationCountry: 'KR', startDate: '2026-12-18', endDate: '2026-12-24', budget: 1_800_000, currency: 'KRW', savedAmount: 600_000 });
const bangkok = trip({ id: 1, name: 'Bangkok 4D3N', destinationCountry: 'TH', startDate: '2026-08-14', endDate: '2026-08-17', budget: 1800, totalExpenses: 1488, savedAmount: 1800 });
const langkawi = trip({ id: 5, name: 'Langkawi long weekend', destinationCountry: 'MY', startDate: '2025-12-05', endDate: '2025-12-07', budget: 900, totalExpenses: 820, isArchived: true });

const withKrw: Rates = { base: 'MYR', date: '2026-10-15', rates: { MYR: 1, KRW: 300, JPY: 38.76 } };
const noKrw: Rates = { base: 'MYR', date: '2026-10-15', rates: { MYR: 1, JPY: 38.76 } };

describe('inTabung', () => {
  it('sums what is in the live jars in the home currency, ≈ when anything was converted', () => {
    const s = inTabung([tokyo, penang, seoul, bangkok], today, 'MYR', withKrw);
    expect(s?.trips).toBe(3);
    // Tokyo 4000 − 1660 = 2340; Penang saving 550 − 387 = 163; Seoul 600,000 / 300 = 2,000
    expect(s?.total).toEqual({ amount: 4503, target: 4000 + 1500 + 6000, spent: 1660 + 387, currency: 'MYR', approx: true });
    expect(s?.missing).toEqual([]);
  });

  it('gives no total at all when a rate is missing, only per-currency lines', () => {
    const s = inTabung([tokyo, penang, seoul], today, 'MYR', noKrw);
    expect(s?.total).toBeNull();
    expect(s?.missing).toEqual(['KRW']);
    expect(s?.lines).toEqual([
      { currency: 'MYR', inJar: 2503, target: 5500, spent: 2047, trips: 2 },
      { currency: 'KRW', inJar: 600_000, target: 1_800_000, spent: 0, trips: 1 },
    ]);
    // the same rule as the rail's total: no fake sum
    expect(sumInTabung([tokyo, penang, seoul], today, 'MYR', noKrw)).toBeNull();
  });

  it('needs no rates when every trip is in the home currency', () => {
    const s = inTabung([tokyo, penang], today, 'MYR', null);
    expect(s?.total).toEqual({ amount: 2503, target: 5500, spent: 2047, currency: 'MYR', approx: false });
    expect(s?.total?.amount).toBe(sumInTabung([tokyo, penang], today, 'MYR', null)?.amount);
  });

  it('is null without live trips, and ignores archived ones', () => {
    expect(inTabung([bangkok], today, 'MYR', withKrw)).toBeNull();
    expect(inTabung([{ ...penang, isArchived: true }], today, 'MYR', withKrw)).toBeNull();
  });
});

describe('statusTrip', () => {
  it('prefers the trip on the road, else the soonest upcoming one', () => {
    expect(statusTrip([seoul, penang, tokyo, bangkok], today)?.id).toBe(2);
    expect(statusTrip([seoul, penang, bangkok], today)?.id).toBe(3);
    expect(statusTrip([bangkok], today)).toBeNull();
  });
});

describe('latestEntries', () => {
  const exp = (id: number, tripId: number, date: string, description: string, amount: number, extra: Partial<Expense> = {}): Expense => ({
    id,
    tripId,
    description,
    amount,
    currency: 'MYR',
    category: 'food',
    expenseDate: date,
    createdAt: `${date}T12:00:00`,
    updatedAt: `${date}T12:00:00`,
    ...extra,
  });
  const fund = (id: number, tripId: number, date: string, amount: number, note?: string): FundEntry => ({
    id,
    tripId,
    amount,
    note,
    entryDate: date,
    createdAt: `${date}T09:00:00`,
  });

  it('keeps the newest entries across trips, oldest first, with each trip\'s currency and code', () => {
    const rows = latestEntries(
      [
        {
          trip: tokyo,
          expenses: [
            exp(10, 2, '2026-10-14', 'Ichiran Shinjuku', 98.73, { originalAmount: 3200, originalCurrency: 'JPY' }),
            exp(11, 2, '2026-10-15', 'Blue Bottle coffee', 37.03),
            exp(12, 2, '2026-10-12', 'Narita Express', 120),
          ],
        },
        { trip: seoul, expenses: [], fund: [fund(20, 4, '2026-10-15', 300_000, 'Gaji Oktober'), fund(21, 4, '2026-10-01', -50_000)] },
      ],
      3,
    );
    expect(rows.map((r) => r.row.id)).toEqual(['e10', 'f20', 'e11']);
    expect(rows[0]).toMatchObject({ tripId: 2, code: 'JP', row: { out: 98.73, originalAmount: 3200, originalCurrency: 'JPY', currency: 'MYR', sub: 'FNB' } });
    expect(rows[1]).toMatchObject({ tripId: 4, code: 'KR', row: { in: 300_000, label: 'Gaji Oktober', currency: 'KRW', sub: 'FUND' } });
  });

  it('labels drop-ins without a note and turns withdrawals into money out', () => {
    const rows = latestEntries([{ trip: seoul, fund: [fund(21, 4, '2026-10-01', -50_000), fund(22, 4, '2026-10-02', 10_000)] }], 5);
    expect(rows[0].row).toMatchObject({ label: 'Out of the tabung', out: 50_000 });
    expect(rows[1].row).toMatchObject({ label: 'Into the tabung', in: 10_000 });
  });
});

describe('passportStats', () => {
  it('counts trips that are home, archived ones included, with baki in the home currency', () => {
    const s = passportStats([tokyo, bangkok, langkawi], today, 'MYR', withKrw);
    // Bangkok 1800 saved − 1488 = 312; Langkawi 900 − 820 = 80
    expect(s).toEqual({ trips: 2, countries: 2, daysAway: 4 + 3, baki: 392, approx: false, currency: 'MYR' });
    // formatMoney joins prefix and number with a no-break space
    expect(passportLine(s)).toBe('2 TRIPS · 2 COUNTRIES · 7 DAYS AWAY · RM\u00A0392 BAKI');
  });

  it('drops the baki rather than guess when a rate is missing', () => {
    const krwHome = trip({ id: 9, name: 'Busan', destinationCountry: 'KR', startDate: '2026-03-01', endDate: '2026-03-05', budget: 1_000_000, currency: 'KRW', totalExpenses: 900_000 });
    const s = passportStats([bangkok, krwHome], today, 'MYR', noKrw);
    expect(s.baki).toBeNull();
    expect(passportLine(s)).toBe('2 TRIPS · 2 COUNTRIES · 9 DAYS AWAY');
    const ok = passportStats([bangkok, krwHome], today, 'MYR', withKrw);
    expect(ok).toMatchObject({ baki: 645.33, approx: true });
  });

  it('has a line for a passport with no stamps', () => {
    expect(passportLine(passportStats([tokyo], today, 'MYR', null))).toBe('NO STAMPS YET · YOUR FIRST BALIK IS WAITING');
  });
});
