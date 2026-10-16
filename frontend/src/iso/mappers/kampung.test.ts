import { describe, expect, it } from 'vitest';
import type { Rates } from '@/types';
import { isoProject } from '@/iso/projection';
import {
  HOUSES_PER_ROW,
  KAMPUNG_LOT,
  houseFloors,
  houseFootprint,
  mapKampung,
  type KampungInput,
  type KampungTrip,
} from '@/iso/mappers/kampung';

const NB = ' ';
const TODAY = new Date(2026, 9, 15); // 15 Oct 2026

let nextId = 1;
function trip(o: Partial<KampungTrip> & { start: string; end: string }): KampungTrip {
  const id = o.id ?? nextId++;
  return {
    id,
    name: o.name ?? `Trip ${id}`,
    destinationCountry: o.destinationCountry ?? 'JP',
    startDate: o.start,
    endDate: o.end,
    budget: o.budget ?? 4000,
    currency: o.currency ?? 'MYR',
    totalExpenses: o.totalExpenses ?? 3000,
  };
}

const RATES: Rates = { base: 'MYR', date: '2026-10-15', rates: { JPY: 32, THB: 7.5, SGD: 0.29 } };

function input(trips: KampungTrip[], year: KampungInput['year'] = 2026, rates: Rates | null = RATES): KampungInput {
  return { trips, year, homeCurrency: 'MYR', rates, today: TODAY };
}

function expectSane(spec: ReturnType<typeof mapKampung>) {
  const { min, max } = spec.bounds;
  for (let i = 0; i < 3; i++) expect(min[i]).toBeLessThanOrEqual(max[i] + 1e-9);
  for (const h of spec.houses) {
    expect(h.floors).toBeGreaterThanOrEqual(1);
    expect(h.floors).toBeLessThanOrEqual(4);
    expect(h.footprint).toBeGreaterThanOrEqual(0.8);
    expect(h.footprint).toBeLessThanOrEqual(1.4 + 1e-9);
  }
  for (const j of spec.jars) {
    expect(j.fill).toBeGreaterThanOrEqual(0);
    expect(j.fill).toBeLessThanOrEqual(1);
  }
  expect(spec.summary).not.toMatch(/NaN|undefined|null/);
  for (const l of spec.labels) expect(l.text).not.toMatch(/NaN|undefined/);
}

describe('house rules', () => {
  it('footprint grows with days up to 14', () => {
    expect(houseFootprint(1)).toBeCloseTo(0.8 + 0.6 / 14, 9);
    expect(houseFootprint(9)).toBeCloseTo(0.8 + (0.6 * 9) / 14, 9);
    expect(houseFootprint(14)).toBeCloseTo(1.4, 9);
    expect(houseFootprint(60)).toBeCloseTo(1.4, 9);
  });

  it('floors = clamp(1 + round(3 × spent / max), 1, 4)', () => {
    expect(houseFloors(0, 1000)).toBe(1);
    expect(houseFloors(500, 1000)).toBe(3);
    expect(houseFloors(1000, 1000)).toBe(4);
    expect(houseFloors(100, 0)).toBe(1);
  });
});

describe('mapKampung', () => {
  it('one house per home trip in the year, in end-date order, 4 per row', () => {
    const trips = [
      trip({ name: 'Bangkok', start: '2026-03-01', end: '2026-03-04', destinationCountry: 'TH' }),
      trip({ name: 'Tokyo autumn', start: '2026-01-12', end: '2026-01-20' }),
      trip({ name: 'Seoul', start: '2026-05-01', end: '2026-05-06', destinationCountry: 'KR' }),
      trip({ name: 'Bali', start: '2026-06-01', end: '2026-06-05', destinationCountry: 'ID' }),
      trip({ name: 'Osaka', start: '2026-08-01', end: '2026-08-07' }),
      trip({ name: 'Upcoming', start: '2026-12-01', end: '2026-12-09' }),
      trip({ name: 'On the road', start: '2026-10-10', end: '2026-10-20' }),
      trip({ name: 'Last year', start: '2025-03-01', end: '2025-03-05' }),
    ];
    const spec = mapKampung(input(trips));
    expectSane(spec);
    expect(spec.houses.map((h) => h.name)).toEqual(['Tokyo autumn', 'Bangkok', 'Seoul', 'Bali', 'Osaka']);
    // row 1 runs along +X; the 5th house starts row 2 one lot back, staggered half a lot
    expect(spec.houses[1].at[0] - spec.houses[0].at[0]).toBe(KAMPUNG_LOT);
    expect(spec.houses[HOUSES_PER_ROW].at).toEqual([KAMPUNG_LOT / 2, 0, -KAMPUNG_LOT]);
    // the year's jar closes the front row
    expect(spec.jars).toHaveLength(1);
    expect(spec.jars[0].at).toEqual([HOUSES_PER_ROW * KAMPUNG_LOT, 0, 0]);
    // the plinth covers every house and the jar
    const { at, w, d } = spec.plinth;
    for (const h of spec.houses) {
      expect(h.at[0] + h.footprint / 2).toBeLessThanOrEqual(at[0] + w / 2);
      expect(h.at[2] - h.footprint / 2).toBeGreaterThanOrEqual(at[2] - d / 2);
    }
    expect(spec.roads).toHaveLength(0);
    expect(spec.summary.startsWith('5 trips home in 2026: Tokyo autumn (9 days, under budget), Bangkok (4 days, under budget)')).toBe(
      true,
    );
    expect(spec.summary).toContain(', and 1 more.');
  });

  it('first visit to a country is judged across all years', () => {
    const trips = [
      trip({ start: '2025-03-01', end: '2025-03-05', destinationCountry: 'JP' }),
      trip({ start: '2026-01-01', end: '2026-01-05', destinationCountry: 'JP' }),
      trip({ start: '2026-02-01', end: '2026-02-05', destinationCountry: 'TH' }),
    ];
    const spec = mapKampung(input(trips));
    expect(spec.houses.map((h) => [h.country, h.firstVisit])).toEqual([
      ['JP', false],
      ['TH', true],
    ]);
  });

  it('floors scale with home-currency spend; roof is stamp when over budget', () => {
    const trips = [
      trip({ start: '2026-01-01', end: '2026-01-09', currency: 'JPY', budget: 128000, totalExpenses: 96000 }), // RM 3,000
      trip({ start: '2026-02-01', end: '2026-02-04', currency: 'MYR', budget: 800, totalExpenses: 1000 }), // RM 1,000, over
      trip({ start: '2026-03-01', end: '2026-03-02', currency: 'MYR', budget: 0, totalExpenses: 0 }),
    ];
    const spec = mapKampung(input(trips));
    expectSane(spec);
    expect(spec.houses.map((h) => h.floors)).toEqual([4, 2, 1]);
    expect(spec.houses.map((h) => h.roof)).toEqual(['under', 'over', 'under']);
    expect(spec.summary).toContain('(4 days, over budget)');
    expect(spec.summary).toContain('(2 days, no budget)');
  });

  it("the year's jar holds Σ baki / Σ target in home currency", () => {
    const trips = [
      trip({ start: '2026-01-01', end: '2026-01-09', currency: 'JPY', budget: 128000, totalExpenses: 96000 }), // baki RM 1,000 of 4,000
      trip({ start: '2026-02-01', end: '2026-02-04', currency: 'MYR', budget: 1000, totalExpenses: 1500 }), // baki 0 of 1,000
    ];
    const spec = mapKampung(input(trips));
    expect(spec.jars[0].fill).toBeCloseTo(1000 / 5000, 9);
    expect(spec.labels.find((l) => l.id === 'jar-2026')).toMatchObject({ text: `≈${NB}RM${NB}1,000 baki in 2026`, tone: 'fund' });
    expect(spec.summary).toContain(`Baki ≈${NB}RM${NB}1,000.`);
  });

  it('all years: one band per year with a road between, jars per year', () => {
    const trips = [
      trip({ start: '2024-05-01', end: '2024-05-04' }),
      trip({ start: '2025-05-01', end: '2025-05-04' }),
      trip({ start: '2025-07-01', end: '2025-07-04' }),
      trip({ start: '2026-05-01', end: '2026-05-04' }),
    ];
    const spec = mapKampung(input(trips, 'all'));
    expectSane(spec);
    expect(spec.jars.map((j) => j.year)).toEqual([2024, 2025, 2026]);
    expect(spec.roads).toHaveLength(2);
    // later years sit further back (−Z), and roads lie between bands
    const z = spec.jars.map((j) => j.at[2]);
    expect(z[0]).toBeGreaterThan(z[1]);
    expect(z[1]).toBeGreaterThan(z[2]);
    expect(spec.roads[0].at[2]).toBeLessThan(z[0]);
    expect(spec.roads[0].at[2]).toBeGreaterThan(z[1]);
    expect(spec.summary).toMatch(/^4 trips home: /);
    expect(spec.summary).toContain(`over 3 years: 2024 RM${NB}1,000, 2025 RM${NB}2,000, 2026 RM${NB}1,000.`);
    // every jar opens its year
    expect(spec.targets.filter((t) => t.action?.type === 'selectYear').map((t) => (t.action?.payload as { year: number }).year)).toEqual([
      2024, 2025, 2026,
    ]);
  });

  it('FX missing: floors fall back to 2, jar names what was left out, summary says not to scale', () => {
    const trips = [
      trip({ start: '2026-01-01', end: '2026-01-09', currency: 'VND', budget: 20000000, totalExpenses: 15000000 }),
      trip({ start: '2026-02-01', end: '2026-02-04', currency: 'MYR', budget: 1000, totalExpenses: 600 }),
    ];
    const spec = mapKampung(input(trips));
    expectSane(spec);
    expect(spec.notToScale).toBe(true);
    expect(spec.houses.every((h) => h.floors === 2)).toBe(true);
    const jar = spec.labels.find((l) => l.id === 'jar-2026');
    expect(jar).toMatchObject({ text: `RM${NB}400 baki in 2026`, sub: 'VND not converted' });
    expect(spec.jars[0].fill).toBeCloseTo(0.4, 9);
    expect(spec.summary).toContain('House heights not to scale.');
  });

  it('no rates at all still draws same-currency trips', () => {
    const spec = mapKampung(input([trip({ start: '2026-01-01', end: '2026-01-03', budget: 500, totalExpenses: 200 })], 2026, null));
    expect(spec.notToScale).toBe(false);
    expect(spec.houses[0].floors).toBe(4);
    expect(spec.jars[0].fill).toBeCloseTo(0.6, 9);
  });

  it('1-day and 60-day trips', () => {
    const spec = mapKampung(
      input([trip({ start: '2026-01-01', end: '2026-01-01' }), trip({ start: '2026-03-01', end: '2026-04-29' })]),
    );
    expect(spec.houses.map((h) => h.days)).toEqual([1, 60]);
    expect(spec.houses[1].footprint).toBeCloseTo(1.4, 9);
    expect(spec.summary).toContain('(1 day,');
  });

  it('budget 0 everywhere: empty jar labelled honestly', () => {
    const spec = mapKampung(input([trip({ start: '2026-01-01', end: '2026-01-04', budget: 0, totalExpenses: 300 })]));
    expect(spec.jars[0].fill).toBe(0);
    expect(spec.labels.find((l) => l.id === 'jar-2026')).toMatchObject({ text: 'No budgets in 2026', tone: 'muted' });
    expect(spec.summary).not.toContain('Baki');
  });

  it('300% over: stamp roof, zero baki', () => {
    const spec = mapKampung(input([trip({ start: '2026-01-01', end: '2026-01-04', budget: 50, totalExpenses: 200 })]));
    expect(spec.houses[0].roof).toBe('over');
    expect(spec.jars[0].fill).toBe(0);
    expect(spec.labels.find((l) => l.id === 'jar-2026')?.text).toBe(`RM${NB}0 baki in 2026`);
  });

  it('empty: a sketch house and "No trips stamped yet."', () => {
    const spec = mapKampung(input([trip({ start: '2026-12-01', end: '2026-12-05' })], 'all'));
    expectSane(spec);
    expect(spec.houses).toHaveLength(0);
    expect(spec.ghost).not.toBeNull();
    expect(spec.labels[0]).toMatchObject({ text: 'No trips stamped yet.', tone: 'muted' });
    expect(spec.summary).toBe('No trips stamped yet.');
    expect(mapKampung(input([], 2025)).summary).toBe('No trips stamped in 2025.');
  });

  it('every house is a target that opens its ticket', () => {
    const spec = mapKampung(input([trip({ name: 'Tokyo autumn', start: '2026-01-12', end: '2026-01-20' })]));
    expect(spec.targets[0]).toMatchObject({
      id: spec.houses[0].id,
      action: { type: 'openTrip', payload: { tripId: spec.houses[0].tripId } },
    });
    expect(spec.targets[0].ariaLabel).toBe('Tokyo autumn, 12–20 JAN 2026, 9 days, under budget. Open ticket');
  });

  it('labels beyond the first four only exist when four are already showing', () => {
    const many = Array.from({ length: 9 }, (_, i) => trip({ start: `2026-0${i + 1}-01`, end: `2026-0${i + 1}-03`, destinationCountry: 'SG' }));
    const spec = mapKampung(input(many));
    expect(spec.labels[0].id).toBe('jar-2026');
    // either every house label rides along (four showing, the rest hover-only) or only what fits is kept
    if (spec.labels.length > 4) expect(spec.labels).toHaveLength(many.length + 1);
    else expect(spec.labels.length).toBeLessThan(4 + 1);
    expect(spec.labels.map((l) => l.priority)).toEqual(spec.labels.map((_, i) => i));
  });

  it('is deterministic', () => {
    const t = [trip({ start: '2026-01-01', end: '2026-01-04' }), trip({ start: '2025-01-01', end: '2025-01-04' })];
    expect(mapKampung(input(t, 'all'))).toEqual(mapKampung(input(t, 'all')));
  });
});


describe('panning start', () => {
  it('one year starts at the newest end, All starts at the first trip; later trips project further right', () => {
    const trips = [
      trip({ start: '2024-02-09', end: '2024-02-11' }),
      trip({ start: '2025-04-02', end: '2025-04-10' }),
      trip({ start: '2026-01-12', end: '2026-01-20' }),
      trip({ start: '2026-03-05', end: '2026-03-08' }),
      trip({ start: '2026-05-01', end: '2026-05-14' }),
      trip({ start: '2026-06-20', end: '2026-06-22' }),
      trip({ start: '2026-08-03', end: '2026-08-09' }),
    ];
    for (const year of [2026, 'all'] as const) {
      const spec = mapKampung(input(trips, year));
      expect(spec.panStart).toBe(year === 'all' ? 'start' : 'end');
      const byEnd = spec.houses.slice().sort((a, b) => a.tripId - b.tripId);
      const sx = (h: (typeof byEnd)[number]) => isoProject(h.at)[0];
      expect(sx(byEnd[byEnd.length - 1])).toBeGreaterThan(sx(byEnd[0]));
    }
  });
});
