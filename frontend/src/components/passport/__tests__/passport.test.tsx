// Passport numbers: home trips only, archived merged in, years, stamps, and — the important one — a missing
// exchange rate never gets summed: the strip lists each currency and says which rate is missing.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { Rates } from '@/types';
import {
  computePassportStats,
  countryStamps,
  homeTrips,
  lifetimeFill,
  mergeTrips,
  nextHomecoming,
  parseYearParam,
  passportYears,
  tripsInYear,
  visitNumber,
  type PassportTrip,
} from '@/components/passport/passportMath';
import { PassportStatsStrip } from '@/components/passport/PassportStatsStrip';

afterEach(cleanup);

const TODAY = new Date(2026, 9, 16); // 16 Oct 2026

function trip(over: Partial<PassportTrip> & Pick<PassportTrip, 'id' | 'name'>): PassportTrip {
  return {
    destinationCountry: 'TH',
    startDate: '2026-08-14',
    endDate: '2026-08-17',
    budget: 1800,
    currency: 'MYR',
    totalExpenses: 1488,
    isArchived: false,
    ...over,
  };
}

const bangkok = trip({ id: 1, name: 'Bangkok 4D3N' });
const langkawi = trip({
  id: 5,
  name: 'Langkawi long weekend',
  destinationCountry: 'MY',
  startDate: '2025-12-05',
  endDate: '2025-12-07',
  budget: 900,
  totalExpenses: 820,
  isArchived: true,
});
const osaka = trip({
  id: 7,
  name: 'Osaka makan',
  destinationCountry: 'JP',
  startDate: '2026-03-01',
  endDate: '2026-03-05',
  budget: 100000,
  currency: 'JPY',
  totalExpenses: 90000,
});
const tokyo = trip({
  id: 2,
  name: 'Tokyo autumn',
  destinationCountry: 'JP',
  startDate: '2026-10-12',
  endDate: '2026-10-20',
  budget: 4000,
  totalExpenses: 2868.45,
});

const MYR_RATES: Rates = { base: 'MYR', date: '2026-10-15', rates: { MYR: 1, THB: 7.7 } };
const WITH_JPY: Rates = { base: 'MYR', date: '2026-10-15', rates: { MYR: 1, JPY: 33 } };

describe('passportMath', () => {
  it('keeps only trips that are home, newest homecoming first, archived ones included', () => {
    const all = mergeTrips([bangkok, tokyo], [langkawi]);
    const home = homeTrips(all, TODAY);
    expect(home.map((t) => t.id)).toEqual([1, 5]);
    expect(passportYears(home)).toEqual([2026, 2025]);
    expect(tripsInYear(home, 2025).map((t) => t.id)).toEqual([5]);
    expect(nextHomecoming(all, TODAY)?.id).toBe(2);
  });

  it('reads ?year= as a year we have, all, or the newest year', () => {
    expect(parseYearParam('2025', [2026, 2025])).toBe(2025);
    expect(parseYearParam('all', [2026, 2025])).toBe('all');
    expect(parseYearParam('2019', [2026, 2025])).toBe(2026);
    expect(parseYearParam(null, [])).toBe('all');
  });

  it('sums spent and baki in the home currency when every rate is there', () => {
    const s = computePassportStats([bangkok, langkawi], 'MYR', MYR_RATES, TODAY);
    expect(s.trips).toBe(2);
    expect(s.countries).toBe(2);
    expect(s.daysAway).toBe(7);
    expect(s.spent.total).toBe(2308);
    expect(s.baki.total).toBe(392);
    expect(s.spent.approx).toBe(false);
    expect(s.avgPerDay).toBeCloseTo(2308 / 7);
    expect(s.missing).toEqual([]);
  });

  it('converts a foreign-currency trip and marks the total approximate', () => {
    const s = computePassportStats([bangkok, osaka], 'MYR', WITH_JPY, TODAY);
    expect(s.spent.total).toBeCloseTo(1488 + 90000 / 33, 2);
    expect(s.spent.approx).toBe(true);
  });

  it('refuses to add yen to ringgit when the JPY rate is missing', () => {
    const s = computePassportStats([bangkok, osaka], 'MYR', MYR_RATES, TODAY);
    expect(s.spent.total).toBeNull();
    expect(s.baki.total).toBeNull();
    expect(s.avgPerDay).toBeNull();
    expect(s.missing).toEqual(['JPY']);
    expect(s.spent.byCurrency).toEqual([
      { currency: 'MYR', amount: 1488 },
      { currency: 'JPY', amount: 90000 },
    ]);
    expect(lifetimeFill([bangkok, osaka], 'MYR', MYR_RATES, TODAY)).toBe(0);
  });

  it('stamps each country once, in the order first visited, and numbers repeat visits', () => {
    const again = trip({ id: 9, name: 'Bangkok again', startDate: '2026-09-01', endDate: '2026-09-04' });
    const stamps = countryStamps([again, bangkok, langkawi]);
    expect(stamps.map((s) => s.code)).toEqual(['MY', 'TH']);
    const th = stamps[1];
    expect(th.visits).toBe(2);
    expect(th.first).toBe('2026-08-14');
    expect(th.last).toBe('2026-09-04');
    expect(th.region).toBe('asia');
    expect(visitNumber(again, [again, bangkok, langkawi])).toBe(2);
    expect(visitNumber(bangkok, [again, bangkok, langkawi])).toBe(1);
  });
});

describe('PassportStatsStrip', () => {
  it('shows one home-currency figure per cell when it can sum', () => {
    const s = computePassportStats([bangkok, langkawi], 'MYR', MYR_RATES, TODAY);
    render(<PassportStatsStrip stats={s} scopeLabel="every year" />);
    const strip = screen.getByRole('region', { name: 'Totals for every year' });
    expect(within(strip).getByText('RM 2,308')).toBeInTheDocument();
    expect(within(strip).getByText('RM 392')).toBeInTheDocument();
    expect(screen.queryByText(/shown per currency/)).not.toBeInTheDocument();
  });

  it('lists each currency and names the missing rate instead of a fake total', () => {
    const s = computePassportStats([bangkok, osaka], 'MYR', MYR_RATES, TODAY);
    render(<PassportStatsStrip stats={s} scopeLabel="2026" />);
    expect(screen.getByText('No rate for JPY today, so totals are shown per currency.')).toBeInTheDocument();
    expect(screen.getByText('RM 1,488')).toBeInTheDocument();
    expect(screen.getByText('¥ 90,000')).toBeInTheDocument();
    // No converted sum anywhere, and the average says it isn't available.
    expect(screen.queryByText(/≈/)).not.toBeInTheDocument();
    expect(screen.getByText('Not available')).toBeInTheDocument();
  });

  it('says rates are loading rather than missing before the first table arrives', () => {
    const s = computePassportStats([osaka], 'MYR', null, TODAY);
    render(<PassportStatsStrip stats={s} scopeLabel="2026" ratesLoading />);
    expect(screen.getByText('Rates are still loading, so totals are shown per currency.')).toBeInTheDocument();
  });
});
