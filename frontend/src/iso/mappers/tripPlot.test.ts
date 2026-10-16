import { createElement } from 'react';
import { act, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Rates } from '@/types';
import { computeFund } from '@/hooks/useFund';
import { addCalendarDays, parseLocalDate, toISODate } from '@/lib/dates';
import { isoProject, projectBounds } from '@/iso/projection';
import { IsoSvgFrame } from '@/iso/svg/IsoSvg';
import { TripPlotSvg } from '@/iso/svg/TripPlotSvg';
import {
  DEMO_ACTS,
  DEMO_DAILY,
  DEMO_TRIP,
  PLOT,
  balikKey,
  calendarStones,
  mapTripPlot,
  mapTripPlotDemo,
  mapTripPlotDraft,
  markBalikSeen,
  readBalikSeen,
  stoneIndexForDate,
  useBalikMoment,
  useTripPlotDemo,
  type DemoFrame,
  type TripPlotExpense,
  type TripPlotSpec,
  type TripPlotTrip,
} from './tripPlot';

const nb = (s: string) => s.replace(/\u00A0/g, ' ');
const D = (y: number, m: number, d: number, h = 15) => new Date(y, m - 1, d, h);
const day3 = D(2026, 11, 14);

const tokyo: TripPlotTrip = {
  id: 101,
  name: 'Tokyo autumn',
  destinationCountry: 'JP',
  startDate: '2026-11-12', // a Thursday
  endDate: '2026-11-20',
  budget: 4000,
  currency: 'MYR',
  budgetType: 'solo',
};
const e = (expenseDate: string, amount: number, currency?: string): TripPlotExpense => ({ expenseDate, amount, currency });
const days3 = [e('2026-11-12', 480), e('2026-11-12', 240), e('2026-11-13', 520), e('2026-11-13', 234), e('2026-11-14', 186)];
const allDays = DEMO_DAILY.map((a, i) => e(toISODate(addCalendarDays(parseLocalDate('2026-11-12'), i)), a));
const total = (xs: readonly TripPlotExpense[]) => xs.reduce((n, x) => n + x.amount, 0);

function live(trip: TripPlotTrip, expenses: TripPlotExpense[], today: Date, opts: Parameters<typeof mapTripPlot>[1] = {}, rates?: Rates | null) {
  const fund = computeFund({ ...trip, totalExpenses: total(expenses.filter((x) => !x.currency)) }, today);
  return mapTripPlot({ trip, expenses, today, fund, homeCountry: 'MY', rates }, opts);
}

/** Every drawn thing must be inside the frame IsoStage builds from spec.bounds. */
function expectFramed(spec: TripPlotSpec) {
  const pb = projectBounds(spec.bounds);
  const pts = [
    ...spec.stones.map((s) => s.at),
    ...spec.jars.map((j) => [j.at[0], j.height, j.at[2]] as const),
    [0, 0, 0],
    [spec.plinth.w, -0.4, spec.plinth.d],
    [0, 0, spec.plinth.d],
    [spec.plinth.w, 0, 0],
  ];
  for (const p of pts) {
    const [x, y] = isoProject([p[0], p[1], p[2]]);
    expect(x).toBeGreaterThanOrEqual(pb.minX - 1e-9);
    expect(x).toBeLessThanOrEqual(pb.maxX + 1e-9);
    expect(y).toBeGreaterThanOrEqual(pb.minY - 1e-9);
    expect(y).toBeLessThanOrEqual(pb.maxY + 1e-9);
  }
}

describe('calendar layout', () => {
  it('lays a 9-day trip on weekday columns from its first week', () => {
    const { stones, rows, daysPerStone } = calendarStones('2026-11-12', '2026-11-20');
    expect(daysPerStone).toBe(1);
    expect(rows).toBe(2);
    expect(stones.map((s) => [s.col, s.row])).toEqual([
      [3, 0], [4, 0], [5, 0], [6, 0],
      [0, 1], [1, 1], [2, 1], [3, 1], [4, 1],
    ]);
  });

  it('1-day trip: one stone on its weekday', () => {
    const { stones, rows } = calendarStones('2026-11-14', '2026-11-14');
    expect(stones).toEqual([{ from: '2026-11-14', to: '2026-11-14', days: 1, col: 5, row: 0 }]);
    expect(rows).toBe(1);
  });

  it('42 days from a Sunday take 7 rows; 43+ days switch to several days per stone', () => {
    expect(calendarStones('2026-11-01', '2026-12-12')).toMatchObject({ rows: 7, daysPerStone: 1 });
    const sixty = calendarStones('2026-10-01', '2026-11-29');
    expect(sixty.daysPerStone).toBe(2);
    expect(sixty.stones).toHaveLength(30);
    expect(sixty.rows).toBe(5);
    expect(sixty.stones[0]).toMatchObject({ from: '2026-10-01', to: '2026-10-02', col: 0, row: 0 });
    expect(sixty.stones.every((s) => s.days === 2)).toBe(true);
    const long = calendarStones('2026-05-01', '2026-08-28'); // 120 days
    expect(long.daysPerStone).toBe(3);
    expect(long.stones.length).toBeLessThanOrEqual(PLOT.maxStones);
  });

  it('survives reversed and broken dates', () => {
    expect(calendarStones('2026-11-20', '2026-11-12').stones).toHaveLength(1);
    expect(calendarStones('nope', '2026-11-12').stones).toHaveLength(0);
  });

  it('puts out-of-trip dates on the first or last stone', () => {
    const { stones } = calendarStones('2026-11-12', '2026-11-20');
    expect(stoneIndexForDate(stones, '2026-10-01')).toBe(0);
    expect(stoneIndexForDate(stones, '2026-11-12')).toBe(0);
    expect(stoneIndexForDate(stones, '2026-11-16T10:00:00')).toBe(4);
    expect(stoneIndexForDate(stones, '2026-12-25')).toBe(8);
    expect(stoneIndexForDate([], '2026-11-12')).toBe(-1);
    const sixty = calendarStones('2026-10-01', '2026-11-29').stones;
    expect(stoneIndexForDate(sixty, '2026-10-02')).toBe(0);
    expect(stoneIndexForDate(sixty, '2026-10-03')).toBe(1);
  });
});

describe('mapTripPlot · live', () => {
  it('on the road (ink): past, today, future stones, day stacks and the spec summary', () => {
    const spec = live(tokyo, days3, day3);
    expect(spec.kind).toBe('tripPlot');
    expect(spec.mode).toBe('live');
    expect(spec.tripId).toBe(101);
    expect(spec.renderState).toBe('ink');
    expect(spec.stones.map((s) => s.state)).toEqual(['past', 'past', 'today', 'future', 'future', 'future', 'future', 'future', 'future']);
    // maxDaySpend 754 → unit niceUnit(75.4) = 100
    expect(spec.coinUnit).toBe(100);
    expect(spec.stones.slice(0, 3).map((s) => s.coins)).toEqual([7, 8, 2]);
    expect(spec.stones.slice(0, 3).map((s) => s.over)).toEqual([true, true, false]); // allowance 444.44
    expect(nb(spec.unitChip!)).toBe('1 coin = RM 100');
    expect(nb(spec.summary)).toBe('Tokyo autumn: RM 2,340 of RM 4,000 left. Day 3 of 9. RM 186 spent today.');
    const jar = spec.jars[0];
    expect(jar).toMatchObject({ at: [1.4, 0, 1.4], height: 2.4, lid: 'closed', lidColor: 'lidOnTheRoad', slots: 1 });
    expect(jar.fill).toBeCloseTo(2340 / 4000, 9);
    expect(spec.labels.map((l) => [l.id, nb(l.text)])).toEqual([
      ['jar', 'RM 2,340 left'],
      ['sign', 'MY → JP'],
    ]);
    expect(spec.plinth).toEqual({ w: 8.45, d: 2.8, at: [4.225, 0, 1.4] });
    expect(spec.signpost!.at).toEqual([2.8 + 5 * 0.75, 0, 1.25]); // the cell after Friday
    expectFramed(spec);
  });

  it('upcoming (sketch): every stone a ghost, no stacks, fund lid', () => {
    const spec = live(tokyo, [], D(2026, 10, 15));
    expect(spec.renderState).toBe('sketch');
    expect(spec.stones.every((s) => s.state === 'future' && s.coins === 0)).toBe(true);
    expect(spec.unitChip).toBeUndefined();
    expect(spec.jars[0].lidColor).toBe('lidUpcoming');
    expect(spec.jars[0].fill).toBe(1);
    expect(nb(spec.labels[0].text)).toBe('RM 4,000 in jar');
    expect(nb(spec.summary)).toBe('Tokyo autumn: RM 4,000 in the jar for 9 days. Starts in 28 days.');
  });

  it('home (chop): all stones solid, baki label, BALIK at the signpost, stamp plays only on first view', () => {
    const spec = live(tokyo, allDays, D(2026, 11, 25), { balikSeen: false });
    expect(spec.renderState).toBe('chop');
    expect(spec.stones.every((s) => s.state === 'past')).toBe(true);
    expect(spec.stones.map((s) => s.coins)).toEqual([4, 4, 4, 4, 5, 3, 5, 4, 4]); // unit 100
    expect(spec.jars[0].lidColor).toBe('lidHome');
    expect(nb(spec.labels[0].text)).toBe('RM 312 baki');
    const sign = spec.labels.find((l) => l.id === 'sign')!;
    expect(sign.text).toBe('BALIK');
    expect(sign.tone).toBe('stamp');
    expect(sign.sub).toBe('MY → JP · 20 NOV');
    expect(spec.stamp).toMatchObject({ text: 'BALIK', play: true });
    expect(live(tokyo, allDays, D(2026, 11, 25), { balikSeen: true }).stamp!.play).toBe(false);
    expect(live(tokyo, allDays, D(2026, 11, 25)).stamp!.play).toBe(false); // unknown → don't replay
    const quiet = live(tokyo, allDays, D(2026, 11, 25), { stampLabel: false });
    expect(quiet.labels.find((l) => l.id === 'sign')!.text).toBe('MY → JP');
    expect(nb(spec.summary)).toBe('Tokyo autumn: back with RM 312 baki of RM 4,000. 9D8N, home since 20 Nov.');
  });

  it('budget 0: empty jar, closed lid, no rims, "No budget set"', () => {
    const spec = live({ ...tokyo, budget: 0 }, days3, day3);
    expect(spec.jars[0]).toMatchObject({ fill: 0, lid: 'closed' });
    expect(spec.stones.some((s) => s.over)).toBe(false);
    expect(spec.labels[0]).toMatchObject({ text: 'No budget set', tone: 'muted' });
    expect(spec.iou).toBeNull();
    expect(nb(spec.summary)).toBe('Tokyo autumn: no budget set, RM 1,660 spent. Day 3 of 9. RM 186 spent today.');
  });

  it('RM 50, 300% over: tilted lid, IOU slip, room on the plinth, stamp label', () => {
    const kl = { ...tokyo, id: 102, name: 'KL weekend', budget: 50, startDate: '2026-11-13', endDate: '2026-11-15' };
    const spec = live(kl, [e('2026-11-13', 120), e('2026-11-14', 80)], day3);
    expect(spec.jars[0]).toMatchObject({ fill: 0, lid: 'tilted', lidYaw: PLOT.overLidYaw });
    expect(spec.iou).not.toBeNull();
    expect(spec.plinth.d).toBeGreaterThanOrEqual(PLOT.overDepth);
    expect(spec.labels[0]).toMatchObject({ tone: 'stamp' });
    expect(nb(spec.labels[0].text)).toBe('Over RM 150');
    expect(spec.stones.map((s) => s.over)).toEqual([true, true, false]);
    expect(nb(spec.summary)).toMatch(/^KL weekend: over by RM 150 on RM 50\.00\./);
    expectFramed(spec);
  });

  it('RM 50,000 with one expense', () => {
    const trip = { ...tokyo, id: 106, name: 'Antarctica', budget: 50000, startDate: '2026-11-10', endDate: '2026-11-21' };
    const spec = live(trip, [e('2026-11-10', 12400)], day3);
    expect(spec.coinUnit).toBe(2000);
    expect(spec.stones[0].coins).toBe(6);
    expect(spec.stones.filter((s) => s.coins > 0)).toHaveLength(1);
    expect(nb(spec.summary)).toContain('Nothing spent today.');
  });

  it('0, 1 and 200 expenses: stacks never pass 10 coins and all money lands on a stone', () => {
    const empty = live(tokyo, [], day3);
    expect(empty.stones.every((s) => s.coins === 0)).toBe(true);
    expect(empty.coinUnit).toBeNull();
    const one = live(tokyo, [e('2026-11-13', 42)], day3);
    expect(one.coinUnit).toBe(5); // niceUnit(42 / 10)
    expect(one.stones[1].coins).toBe(8); // round(42 / 5)
    const many: TripPlotExpense[] = Array.from({ length: 200 }, (_, i) =>
      e(toISODate(addCalendarDays(parseLocalDate('2026-10-25'), i % 40)), 10 + (i % 17) * 7),
    );
    const sixty = { ...tokyo, startDate: '2026-10-01', endDate: '2026-11-29' };
    const spec = live(sixty, many, day3);
    expect(spec.daysPerStone).toBe(2);
    expect(spec.stones.every((s) => s.coins <= 10)).toBe(true);
    expect(spec.stones.reduce((n, s) => n + s.spend, 0)).toBeCloseTo(total(many), 6);
    expect(spec.unplaced).toBe(0);
    expect(nb(spec.unitChip!)).toMatch(/^1 coin = RM \d+ · 1 stone = 2 days$/);
    expectFramed(spec);
  });

  it('puts spend outside the trip dates on the end stones', () => {
    const spec = live(tokyo, [e('2026-09-01', 900), e('2026-12-31', 50)], D(2026, 11, 25));
    expect(spec.stones[0].spend).toBe(900);
    expect(spec.stones[8].spend).toBe(50);
  });

  it('mixed currencies: legacy rows convert when a rate exists, otherwise stay off the stones', () => {
    const rates: Rates = { base: 'MYR', date: '2026-10-15', rates: { JPY: 32 } };
    const spec = live(tokyo, [...days3, e('2026-11-13', 3200, 'JPY'), e('2026-11-14', 50000, 'VND')], day3, {}, rates);
    expect(spec.stones[1].spend).toBeCloseTo(754 + 100, 6);
    expect(spec.unplaced).toBe(1);
    expect(spec.summary).toContain("1 entry has no rate or date, so it isn't on the day stones.");
    // FX entirely missing: both foreign rows stay off
    const noFx = live(tokyo, [...days3, e('2026-11-13', 3200, 'JPY')], day3, {}, null);
    expect(noFx.stones[1].spend).toBe(754);
    expect(noFx.unplaced).toBe(1);
  });

  it('Days tab selection rings that stone; stones target the ledger for their day', () => {
    const spec = live(tokyo, days3, day3, { selectedDate: '2026-11-13' });
    expect(spec.stones.map((s) => s.selected)).toEqual([false, true, false, false, false, false, false, false, false]);
    expect(spec.targets).toHaveLength(9);
    expect(spec.targets[1]).toMatchObject({ id: 'day-2026-11-13', href: '/trips/101/ledger?day=2026-11-13', sizePx: 32 });
    expect(nb(spec.targets[1].ariaLabel)).toBe('Day 2, Fri 13 Nov: RM 754 spent');
    expect(spec.targets[5].ariaLabel).toBe('Day 6, Tue 17 Nov: nothing yet');
  });

  it('shared trips get the 3-slot lid; the signpost follows the home country', () => {
    const spec = mapTripPlot({ trip: { ...tokyo, budgetType: 'shared' }, today: day3, homeCountry: 'sg' });
    expect(spec.jars[0].slots).toBe(3);
    expect(spec.labels.find((l) => l.id === 'sign')!.text).toBe('SG → JP');
    expect(mapTripPlot({ trip: tokyo, today: day3 }).labels.find((l) => l.id === 'sign')!.text).toBe('MY → JP');
  });

  it('keeps the layout key when a new spend tips the trip over budget', () => {
    const under = live(tokyo, days3, day3);
    const over = live(tokyo, [...days3, e('2026-11-14', 3000)], day3);
    expect(over.plinth.d).toBeGreaterThan(under.plinth.d);
    expect(over.layoutKey).toBe(under.layoutKey);
  });

  it('is deterministic and keeps stack seeds stable per trip and date', () => {
    expect(live(tokyo, days3, day3)).toEqual(live(tokyo, days3, day3));
    expect(live(tokyo, days3, day3).stones[0].seed).toBe('101|2026-11-12');
  });

  it('1-day trip', () => {
    const spec = live({ ...tokyo, startDate: '2026-11-14', endDate: '2026-11-14' }, [e('2026-11-14', 96)], day3);
    expect(spec.stones).toHaveLength(1);
    expect(spec.stones[0]).toMatchObject({ state: 'today', col: 5, row: 0, coins: 10 });
    expect(nb(spec.summary)).toContain('Day 1 of 1.');
  });
});

describe('mapTripPlotDraft', () => {
  const draft = { destinationCountry: 'JP', name: 'Tokyo 9D8N', startDate: '2026-11-12', endDate: '2026-11-20', budget: 4000, currency: 'MYR' } as const;

  it('step 1: plinth, signpost with the route, a sketched jar', () => {
    const spec = mapTripPlotDraft({ destinationCountry: 'JP' }, 1, { homeCountry: 'MY' });
    expect(spec.mode).toBe('draft');
    expect(spec.draftStep).toBe(1);
    expect(spec.stones).toHaveLength(0);
    expect(spec.jars).toEqual([expect.objectContaining({ ghost: true })]);
    expect(spec.labels.map((l) => l.text)).toEqual(['MY → JP']);
    expect(spec.targets).toEqual([]);
    expect(spec.summary).toBe('A tabung for JP.');
  });

  it('step 2: the dates lay down sketched stones', () => {
    const spec = mapTripPlotDraft(draft, 2);
    expect(spec.stones).toHaveLength(9);
    expect(spec.stones.every((s) => s.state === 'future' && s.coins === 0)).toBe(true);
    expect(spec.jars[0].ghost).toBe(true);
    expect(spec.summary).toBe('Tokyo 9D8N. 9 days from 12 Nov.');
  });

  it('step 3: solo, shared and separated jars, open and empty', () => {
    const solo = mapTripPlotDraft({ ...draft, budgetType: 'solo' }, 3);
    expect(solo.jars).toEqual([expect.objectContaining({ ghost: false, slots: 1, fill: 0, lid: 'off', height: 2.4 })]);
    const shared = mapTripPlotDraft({ ...draft, budgetType: 'shared' }, 3);
    expect(shared.jars).toEqual([expect.objectContaining({ slots: 3 })]);
    const sep = mapTripPlotDraft({ ...draft, budgetType: 'separated', people: 9 }, 3);
    expect(sep.jars).toHaveLength(4);
    expect(sep.jars.every((j) => j.height === PLOT.separatedHeight && !j.ghost)).toBe(true);
    expect(mapTripPlotDraft({ ...draft, budgetType: 'separated' }, 3).jars).toHaveLength(3);
    expect(sep.summary).toContain('Geng, own money: a jar each.');
  });

  it('step 4: the jar fills to the brim and shows the daily amount; no budget leaves it empty', () => {
    const spec = mapTripPlotDraft(draft, 4);
    expect(spec.jars[0]).toMatchObject({ fill: 1, lid: 'off' });
    const jar = spec.labels.find((l) => l.id === 'jar')!;
    expect(nb(jar.text)).toBe('≈ RM 444 / day');
    expect(nb(jar.sub!)).toBe('RM 4,000 · 9 days');
    const none = mapTripPlotDraft({ ...draft, budget: 0 }, 4);
    expect(none.jars[0].fill).toBe(0);
    expect(none.summary).toContain('Set a target to fill the jar.');
  });

  it('step 5: lids close', () => {
    const spec = mapTripPlotDraft({ ...draft, budgetType: 'separated' }, 5);
    expect(spec.jars.every((j) => j.lid === 'closed' && j.fill === 1)).toBe(true);
    expect(spec.summary).toMatch(/Ready to open\.$/);
  });

  it('keeps one layout key across steps once the dates are set (so step 3–5 animate)', () => {
    const keys = [2, 3, 4, 5].map((s) => mapTripPlotDraft(draft, s).layoutKey);
    expect(new Set(keys).size).toBe(1);
    expect(mapTripPlotDraft(draft, 1).layoutKey).not.toBe(keys[0]);
    for (const s of [1, 2, 3, 4, 5]) expectFramed(mapTripPlotDraft({ ...draft, budgetType: 'separated' }, s));
  });

  it('a 60-day draft says what a stone means', () => {
    expect(mapTripPlotDraft({ ...draft, endDate: '2027-01-10' }, 2).unitChip).toBe('1 stone = 2 days');
  });
});

describe('mapTripPlotDemo', () => {
  it('fixture adds up: RM 1,212 by day 3, RM 312 baki at the end', () => {
    expect(DEMO_DAILY.slice(0, 3).reduce((a, b) => a + b, 0)).toBe(1212);
    expect(4000 - DEMO_DAILY.reduce((a, b) => a + b, 0)).toBe(312);
    expect(Math.round((4000 - 1212) / 7)).toBe(398);
    expect(DEMO_TRIP.budget).toBe(4000);
  });

  it('act 1 ISI: empty open jar, then full, then the lid goes on', () => {
    const empty = mapTripPlotDemo('isi-empty');
    expect(empty.jars[0]).toMatchObject({ fill: 0, lid: 'off' });
    expect(empty.labels.find((l) => l.id === 'jar')).toBeUndefined();
    expect(mapTripPlotDemo('isi-full').jars[0]).toMatchObject({ fill: 1, lid: 'off' });
    expect(mapTripPlotDemo('isi-closed').jars[0]).toMatchObject({ fill: 1, lid: 'closed' });
    expect(empty.renderState).toBe('sketch');
    expect(empty.tripId).toBeNull();
    expect(empty.targets).toEqual([]);
  });

  it('act 2 JALAN: day by day the stones ink in and stacks grow', () => {
    const d1 = mapTripPlotDemo('jalan-1');
    const d3 = mapTripPlotDemo('jalan-3');
    expect(d1.stones.map((s) => s.state).slice(0, 3)).toEqual(['today', 'future', 'future']);
    expect(d3.stones.map((s) => s.state).slice(0, 3)).toEqual(['past', 'past', 'today']);
    expect(d3.stones.slice(0, 3).map((s) => s.coins)).toEqual([9, 8, 7]); // unit 50 throughout
    expect(d3.jars[0].fill).toBeCloseTo((4000 - 1212) / 4000, 9);
    expect(nb(d3.summary)).toBe('Tokyo autumn, 9D8N, RM 4,000. Day 3 · RM 1,212 spent · ≈ RM 398 a day left.');
    expect(d1.layoutKey).toBe(d3.layoutKey);
  });

  it('act 3 BALIK: chop, baki and the stamp', () => {
    const spec = mapTripPlotDemo('balik');
    expect(spec.renderState).toBe('chop');
    expect(nb(spec.labels[0].text)).toBe('RM 312 baki');
    expect(spec.stamp!.play).toBe(true);
    expect(spec.demo).toEqual({ act: 3, frame: 'balik' });
    expect(spec.layoutKey).toBe(mapTripPlotDemo('isi-empty').layoutKey);
  });

  it('acts and captions match the spec copy', () => {
    expect(DEMO_ACTS.map((a) => [a.chip, a.caption])).toEqual([
      ['01 ISI fill it', 'RM 4,000 in the jar'],
      ['02 JALAN spend through it', 'Day 3 · RM 1,212 spent · ≈ RM 398 a day left'],
      ['03 BALIK keep the receipt', 'Back with RM 312 baki'],
    ]);
    for (const a of DEMO_ACTS) for (const f of a.frames) expectFramed(mapTripPlotDemo(f.frame as DemoFrame));
  });
});

describe('useTripPlotDemo', () => {
  afterEach(() => vi.useRealTimers());

  /** Advance in small steps so React commits and schedules each next timer, as it does in real time. */
  const advance = (ms: number) => {
    for (let t = 0; t < ms; t += 100) act(() => void vi.advanceTimersByTime(Math.min(100, ms - t)));
  };

  it('plays the frames of each act and advances every 6 s until someone picks an act', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTripPlotDemo({ reducedMotion: false }));
    expect(result.current).toMatchObject({ act: 1, frame: 'isi-empty', auto: true });
    advance(600);
    expect(result.current.frame).toBe('isi-full');
    advance(1100);
    expect(result.current.frame).toBe('isi-closed');
    advance(6000 - 1700);
    expect(result.current).toMatchObject({ act: 2, frame: 'jalan-1' });
    advance(6000);
    expect(result.current).toMatchObject({ act: 3, frame: 'balik', caption: 'Back with RM 312 baki' });
    advance(6000);
    expect(result.current.act).toBe(1); // loops
    act(() => result.current.select(2));
    expect(result.current).toMatchObject({ act: 2, frame: 'jalan-1', auto: false });
    advance(30000);
    expect(result.current).toMatchObject({ act: 2, frame: 'jalan-3', auto: false });
    expect(result.current.spec.demo).toEqual({ act: 2, frame: 'jalan-3' });
  });

  it('stop() keeps the act and ends auto-advance', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTripPlotDemo({ reducedMotion: false }));
    act(() => result.current.stop());
    advance(20000);
    expect(result.current).toMatchObject({ act: 1, frame: 'isi-closed', auto: false });
  });

  it('reduced motion: act 3 final frame, never advances; picking an act shows its last frame', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTripPlotDemo({ reducedMotion: true }));
    expect(result.current).toMatchObject({ act: 3, frame: 'balik', auto: false });
    advance(20000);
    expect(result.current.act).toBe(3);
    act(() => result.current.select(1));
    expect(result.current.frame).toBe('isi-closed');
    act(() => result.current.select(2));
    expect(result.current.frame).toBe('jalan-3');
  });
});

describe('BALIK first view', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('reads and writes travelluhh_balik_seen_<tripId>', () => {
    expect(balikKey(7)).toBe('travelluhh_balik_seen_7');
    expect(readBalikSeen(7)).toBe(false);
    markBalikSeen(7);
    expect(readBalikSeen(7)).toBe(true);
  });

  it('survives blocked storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readBalikSeen(7)).toBe(false);
    expect(() => markBalikSeen(7)).not.toThrow();
  });

  it('plays once per trip, only when eligible', () => {
    const { result, rerender } = renderHook(({ id, ok }) => useBalikMoment(id, ok), { initialProps: { id: 5, ok: false } });
    expect(result.current).toBe(false);
    rerender({ id: 5, ok: true });
    expect(result.current).toBe(true);
    expect(readBalikSeen(5)).toBe(true);
    const again = renderHook(() => useBalikMoment(5, true));
    expect(again.result.current).toBe(false);
  });
});

describe('TripPlotSvg twin', () => {
  it('renders live, draft and demo fixtures in both themes', () => {
    const fixtures = [
      live(tokyo, days3, day3, { selectedDate: '2026-11-13' }),
      live({ ...tokyo, budget: 50 }, days3, day3),
      live(tokyo, allDays, D(2026, 11, 25)),
      mapTripPlotDraft({ destinationCountry: 'JP', startDate: '2026-11-12', endDate: '2026-11-20', budget: 4000, budgetType: 'separated' }, 4),
      mapTripPlotDraft({}, 1),
      mapTripPlotDemo('jalan-3'),
    ];
    for (const spec of fixtures) {
      for (const theme of ['light', 'dark'] as const) {
        const { container, unmount } = render(
          createElement(IsoSvgFrame, { bounds: spec.bounds, theme, size: { w: 343, h: 220 } }, createElement(TripPlotSvg, { spec, theme })),
        );
        expect(container.querySelectorAll('polygon, path, ellipse').length).toBeGreaterThan(10);
        unmount();
      }
    }
  });
});
