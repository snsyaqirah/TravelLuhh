// Stage fixtures for the dev kit: one real mapper output per scene kind, so the kit exercises the same
// spec shapes the pages will pass to IsoStage. Inputs mirror the E7/E8 harnesses (src/dev/e7.tsx, e8.tsx),
// where the full fixture matrix lives. Built lazily: a mapper bug should break the kit section, not the import.
import type { Rates } from '@/types';
import { computeFund } from '@/hooks/useFund';
import type { SceneSpecBase } from '@/iso/specs';
import { mapCounter } from '@/iso/mappers/counter';
import { mapKampung, type KampungTrip } from '@/iso/mappers/kampung';
import { mapShelf, type ShelfTrip } from '@/iso/mappers/shelf';
import { mapSuitcase } from '@/iso/mappers/suitcase';
import { mapTripPlot, type TripPlotTrip } from '@/iso/mappers/tripPlot';

export interface StageFixture {
  spec: SceneSpecBase;
  height: { base: number; lg: number };
}

// Day 3 of a 9-day Tokyo trip.
const TODAY = new Date(2026, 10, 14, 15);
const RATES: Rates = {
  base: 'MYR',
  date: '2026-11-14',
  rates: { JPY: 32.4, THB: 7.6, SGD: 0.29, KRW: 296, IDR: 3500, AUD: 0.33, VND: 5600 },
};

const TOKYO: TripPlotTrip = {
  id: 101,
  name: 'Tokyo autumn',
  destinationCountry: 'JP',
  startDate: '2026-11-12',
  endDate: '2026-11-20',
  budget: 4000,
  currency: 'MYR',
  budgetType: 'solo',
};

const TOKYO_DAYS = [
  { expenseDate: '2026-11-12', amount: 480 },
  { expenseDate: '2026-11-12', amount: 240 },
  { expenseDate: '2026-11-13', amount: 520 },
  { expenseDate: '2026-11-13', amount: 234 },
  { expenseDate: '2026-11-14', amount: 186 },
];

const shelfTrip = (t: Partial<ShelfTrip> & Pick<ShelfTrip, 'id' | 'name'>): ShelfTrip => ({
  destinationCountry: 'JP',
  startDate: '2026-12-01',
  endDate: '2026-12-09',
  budget: 4000,
  currency: 'MYR',
  ...t,
});

const kampungTrip = (id: number, name: string, cc: string, start: string, end: string, budget: number, spent: number, currency = 'MYR'): KampungTrip => ({
  id,
  name,
  destinationCountry: cc,
  startDate: start,
  endDate: end,
  budget,
  currency,
  totalExpenses: spent,
});

const PACK_CATS = ['documents', 'clothing', 'personal', 'health', 'electronics', 'gear', 'work', 'food', 'religious', 'general'];

function tripPlotFixture(): SceneSpecBase {
  const spent = TOKYO_DAYS.reduce((n, x) => n + x.amount, 0);
  const fund = computeFund({ ...TOKYO, totalExpenses: spent }, TODAY);
  return mapTripPlot({ trip: TOKYO, expenses: TOKYO_DAYS, today: TODAY, fund, homeCountry: 'MY' });
}

function shelfFixture(): SceneSpecBase {
  const trips = [
    shelfTrip({ id: 1, name: 'Tokyo autumn', startDate: '2026-11-12', endDate: '2026-11-20', totalExpenses: 1660 }),
    shelfTrip({ id: 2, name: 'Seoul in spring', destinationCountry: 'KR', startDate: '2027-04-02', endDate: '2027-04-08', budget: 2500000, currency: 'KRW', totalExpenses: 0 }),
    shelfTrip({ id: 3, name: 'Bangkok shopping', destinationCountry: 'TH', startDate: '2026-12-20', endDate: '2026-12-24', budget: 12000, currency: 'THB', totalExpenses: 3500 }),
  ];
  return mapShelf({ trips, rates: RATES, homeCurrency: 'MYR', today: TODAY });
}

function counterFixture(): SceneSpecBase {
  const byCategory = { accommodation: 720, transportation: 410, food: 330, other: 200 };
  const fund = computeFund({ ...TOKYO, totalExpenses: 1660 }, TODAY);
  return mapCounter({ tripId: TOKYO.id, fund, byCategory });
}

function suitcaseFixture(): SceneSpecBase {
  const items = Array.from({ length: 31 }, (_, i) => ({
    id: i + 1,
    category: PACK_CATS[(i * 7) % PACK_CATS.length],
    isChecked: i < 23,
  }));
  return mapSuitcase({ tripId: TOKYO.id, items });
}

function kampungFixture(): SceneSpecBase {
  const trips = [
    kampungTrip(201, 'Tokyo autumn', 'JP', '2026-01-12', '2026-01-20', 128000, 112000, 'JPY'),
    kampungTrip(202, 'Bangkok', 'TH', '2026-03-05', '2026-03-08', 1500, 1720),
    kampungTrip(203, 'Perth', 'AU', '2026-05-01', '2026-05-14', 7000, 5200),
    kampungTrip(204, 'Langkawi', 'MY', '2026-06-20', '2026-06-22', 900, 610),
    kampungTrip(205, 'Osaka', 'JP', '2026-08-03', '2026-08-09', 4000, 3500),
  ];
  return mapKampung({ trips, year: 2026, homeCurrency: 'MYR', rates: RATES, today: new Date(2026, 9, 15) });
}

let cached: StageFixture[] | null = null;

export function stageFixtures(): StageFixture[] {
  cached ??= [
    { height: { base: 220, lg: 320 }, spec: tripPlotFixture() },
    { height: { base: 240, lg: 360 }, spec: shelfFixture() },
    { height: { base: 220, lg: 320 }, spec: counterFixture() },
    { height: { base: 220, lg: 320 }, spec: suitcaseFixture() },
    { height: { base: 320, lg: 520 }, spec: kampungFixture() },
  ];
  return cached;
}
