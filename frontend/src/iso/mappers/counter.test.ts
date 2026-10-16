import { describe, expect, it } from 'vitest';
import { CATEGORY_ORDER } from '@/design/tokens';
import { computeFund } from '@/hooks/useFund';
import { visibleLabels } from '@/iso/overlay';
import { isoProject, projectBounds } from '@/iso/projection';
import { BLOCK } from '@/iso/shapes';
import type { Vec3 } from '@/iso/specs';
import {
  COUNTER_CLAMP,
  COUNTER_FULL,
  dashSegments,
  fitScreenBounds,
  labelRect,
  mapCounter,
  nominalZoom,
  rectsOverlap,
  sceneMoney,
  screenRect,
  STAGE_SLOT,
  zigzagBand,
  type CounterInput,
} from '@/iso/mappers/counter';

const NB = ' ';
const TODAY = new Date(2026, 10, 14); // 14 Nov 2026

type Spend = Partial<Record<string, number>>;

function input(o: { budget: number; spend?: Spend; currency?: string; start?: string; end?: string; id?: number }): CounterInput {
  const byCategory = o.spend ?? {};
  const spent = Object.values(byCategory).reduce<number>((s, v) => s + (v ?? 0), 0);
  const trip = {
    budget: o.budget,
    currency: o.currency ?? 'MYR',
    startDate: o.start ?? '2026-11-12',
    endDate: o.end ?? '2026-11-20',
    totalExpenses: spent,
  };
  return { tripId: o.id ?? 7, fund: computeFund(trip, TODAY), byCategory };
}

/** 200 expenses spread over every category, as useExpenses would total them. */
function twoHundred(): Spend {
  const out: Record<string, number> = {};
  for (let i = 0; i < 200; i++) {
    const k = CATEGORY_ORDER[i % CATEGORY_ORDER.length];
    out[k] = (out[k] ?? 0) + 37.5 + (i % 9) * 11;
  }
  return out;
}

function expectSane(spec: ReturnType<typeof mapCounter>) {
  const { min, max } = spec.bounds;
  for (let i = 0; i < 3; i++) {
    expect(Number.isFinite(min[i]) && Number.isFinite(max[i])).toBe(true);
    expect(min[i]).toBeLessThanOrEqual(max[i] + 1e-9);
  }
  for (const b of spec.blocks) {
    expect(b.height).toBeGreaterThanOrEqual(BLOCK.minH);
    expect(b.height).toBeLessThanOrEqual(COUNTER_CLAMP);
    expect(Number.isFinite(b.amount)).toBe(true);
  }
  expect(spec.summary).not.toMatch(/NaN|undefined|Infinity/);
  for (const l of spec.labels) expect(l.text).not.toMatch(/NaN|undefined/);
  expect(spec.jar.fill).toBeGreaterThanOrEqual(0);
  expect(spec.jar.fill).toBeLessThanOrEqual(1);
}

describe('mapCounter', () => {
  it('keeps jar contents + blocks = budget while under budget', () => {
    const spec = mapCounter(input({ budget: 4000, spend: { accommodation: 720, transportation: 410, food: 330, other: 200 } }));
    expectSane(spec);
    const blocks = spec.blocks.reduce((s, b) => s + b.height, 0);
    expect(spec.jar.fill * COUNTER_FULL + blocks).toBeCloseTo(COUNTER_FULL, 6);
    expect(spec.blocks.map((b) => b.category)).toEqual(['accommodation', 'transportation', 'food', 'other']);
    expect(spec.blocks[0].height).toBeCloseTo((3 * 720) / 4000, 6);
    expect(spec.summary).toBe(
      `Spent RM${NB}1,660 of RM${NB}4,000: Stay RM${NB}720, Transport RM${NB}410, Food RM${NB}330, Other RM${NB}200.`,
    );
    expect(spec.labels[0]).toMatchObject({ id: 'jar', text: `RM${NB}2,340 left`, tone: 'fund' });
    expect(spec.unitChip).toBe(`Dashed line = RM${NB}4,000`);
    expect(spec.budgetLine?.tone).toBe('ink3');
    expect(spec.jar.lid).toBe('closed');
  });

  it('closes gaps: blocks sit side by side on one baseline along +X', () => {
    const spec = mapCounter(input({ budget: 50000, spend: twoHundred() }));
    expectSane(spec);
    expect(spec.blocks).toHaveLength(7);
    expect(spec.blocks.map((b) => b.category)).toEqual([...CATEGORY_ORDER]);
    for (let i = 1; i < spec.blocks.length; i++) {
      expect(spec.blocks[i].at[0] - spec.blocks[i - 1].at[0]).toBeCloseTo(BLOCK.w, 9);
      expect(spec.blocks[i].at[1]).toBe(0);
      expect(spec.blocks[i].at[2]).toBe(spec.blocks[0].at[2]);
    }
    // block row starts right of the jar, never under it
    expect(spec.blocks[0].at[0] - BLOCK.w / 2).toBeGreaterThan(spec.jar.at[0] + 1.4);
  });

  it('budget 0: compare mode, tallest block = 3.0, no budget line, says so', () => {
    const spec = mapCounter(input({ budget: 0, spend: { accommodation: 300, food: 150 } }));
    expectSane(spec);
    expect(spec.mode).toBe('compare');
    expect(spec.budgetLine).toBeNull();
    expect(spec.blocks[0].height).toBeCloseTo(COUNTER_FULL, 9);
    expect(spec.blocks[1].height).toBeCloseTo(1.5, 9);
    expect(spec.jar.fill).toBe(0);
    expect(spec.jar.lid).toBe('closed');
    expect(spec.labels[0]).toMatchObject({ text: 'No budget set', tone: 'muted' });
    expect(spec.summary).toBe(`Spent RM${NB}450: Stay RM${NB}300, Food RM${NB}150. No budget, heights compare categories only.`);
    expect(spec.unitChip).toBeUndefined();
  });

  it('budget 0 and nothing spent', () => {
    const spec = mapCounter(input({ budget: 0 }));
    expectSane(spec);
    expect(spec.blocks).toHaveLength(0);
    expect(spec.ghostBlock).not.toBeNull();
    expect(spec.summary).toBe('Nothing spent yet. No budget set for this trip.');
  });

  it('RM 50 budget with one small expense keeps cents', () => {
    const spec = mapCounter(input({ budget: 50, spend: { food: 12.5 } }));
    expectSane(spec);
    expect(spec.blocks[0].height).toBeCloseTo(0.75, 9);
    expect(spec.jar.fill).toBeCloseTo(0.75, 9);
    expect(spec.labels[0].text).toBe(`RM${NB}37.50 left`);
    expect(spec.summary).toBe(`Spent RM${NB}12.50 of RM${NB}50: Food RM${NB}12.50.`);
  });

  it('0 expenses: full jar, a sketch block, no targets', () => {
    const spec = mapCounter(input({ budget: 4000 }));
    expectSane(spec);
    expect(spec.jar.fill).toBe(1);
    expect(spec.blocks).toHaveLength(0);
    expect(spec.targets).toHaveLength(0);
    expect(spec.ghostBlock?.at).toEqual(spec.slots[0]);
    expect(spec.summary).toBe(`Nothing spent yet. RM${NB}4,000 in the jar.`);
  });

  it('a tiny category still gets the minimum block height', () => {
    const spec = mapCounter(input({ budget: 50000, spend: { shopping: 1 } }));
    expect(spec.blocks[0].height).toBe(BLOCK.minH);
  });

  it('300% over: jar empty, lid off, stamp budget line, clamped block marked ▲', () => {
    const spec = mapCounter(input({ budget: 50, spend: { food: 150 } }));
    expectSane(spec);
    expect(spec.over).toBe(true);
    expect(spec.jar.fill).toBe(0);
    expect(spec.jar.lid).toBe('off');
    expect(spec.budgetLine?.tone).toBe('over');
    expect(spec.blocks[0]).toMatchObject({ clamped: true, height: COUNTER_CLAMP });
    expect(spec.labels[0]).toMatchObject({ text: `Over RM${NB}100`, tone: 'stamp' });
    expect(spec.labels.find((l) => l.id === 'cat-food')?.text).toBe(`▲ RM${NB}150`);
    expect(spec.summary).toBe(`Spent RM${NB}150 of RM${NB}50, RM${NB}100 over: Food RM${NB}150.`);
  });

  it('a block between 3.0 and 4.5 is drawn true to scale', () => {
    const spec = mapCounter(input({ budget: 100, spend: { accommodation: 140 } }));
    expect(spec.blocks[0]).toMatchObject({ clamped: false });
    expect(spec.blocks[0].height).toBeCloseTo(4.2, 9);
  });

  it('lid colour follows the phase: 1-day, 9-day and 60-day trips', () => {
    const upcoming = mapCounter(input({ budget: 500, start: '2026-12-01', end: '2026-12-01' }));
    const road = mapCounter(input({ budget: 4000, start: '2026-11-12', end: '2026-11-20' }));
    const home = mapCounter(input({ budget: 9000, start: '2026-08-01', end: '2026-09-29' }));
    expect(upcoming.jar.lidColor).toBe('lidUpcoming');
    expect(road.jar.lidColor).toBe('lidOnTheRoad');
    expect(home.jar.lidColor).toBe('lidHome');
    // framing never depends on how long the trip is
    expect(upcoming.plinth).toEqual(home.plinth);
  });

  it('framing is fixed: a new category never rescales the jar', () => {
    const a = mapCounter(input({ budget: 4000, spend: { food: 100 } }));
    const b = mapCounter(input({ budget: 4000, spend: twoHundred() }));
    expect(a.plinth).toEqual(b.plinth);
    expect(a.jar.at).toEqual(b.jar.at);
    expect(a.slots).toEqual(b.slots);
  });

  it('mixed currencies: works in the trip currency only, JPY without decimals, no rates needed', () => {
    const spec = mapCounter(input({ budget: 120000, currency: 'JPY', spend: { food: 3200, transportation: 18400 } }));
    expectSane(spec);
    expect(spec.labels[0].text).toBe(`¥${NB}98,400 left`);
    expect(spec.summary).toContain(`Transport ¥${NB}18,400`);
  });

  it('ignores junk: unknown keys count as Other, NaN and negatives drop out', () => {
    const spec = mapCounter(input({ budget: 1000, spend: { snacks: 40, other: 10, food: Number.NaN, shopping: -5 } }));
    expect(spec.blocks.map((b) => [b.category, b.amount])).toEqual([['other', 50]]);
  });

  it('targets link to the ledger filtered by category and stay ≥ 36px apart', () => {
    const spec = mapCounter(input({ budget: 4000, spend: { accommodation: 1200, food: 900, shopping: 400 } }));
    expect(spec.targets.length).toBeGreaterThan(0);
    for (const t of spec.targets) {
      expect(t.href).toMatch(/^\/trips\/7\/ledger\?cat=(accommodation|food|shopping)$/);
      expect(t.ariaLabel).toMatch(/% of spent\. Open in ledger$/);
    }
  });

  it('compact: block labels only for ≥ 8% of spend, and visible labels never overlap', () => {
    const spend = { accommodation: 2000, transportation: 1900, activities: 60, food: 1700, shopping: 50 };
    const spec = mapCounter(input({ budget: 8000, spend }), { compact: true });
    const ids = spec.labels.map((l) => l.id);
    expect(ids).not.toContain('cat-activities');
    expect(ids).not.toContain('cat-shopping');
    const visible = visibleLabels(spec.labels);
    const zoom = 22;
    for (let i = 0; i < visible.length; i++)
      for (let j = i + 1; j < visible.length; j++)
        expect(rectsOverlap(labelRect(visible[i], zoom), labelRect(visible[j], zoom))).toBe(false);
  });

  it('no visible label covers the jar, whatever the spend', () => {
    const cases = [
      input({ budget: 4000, spend: { accommodation: 720, transportation: 410, food: 330, other: 200 } }),
      input({ budget: 50000, spend: twoHundred() }),
      input({ budget: 50, spend: { food: 150, transportation: 30 } }),
      input({ budget: 0, spend: { accommodation: 300, food: 150 } }),
    ];
    for (const compact of [true, false]) {
      for (const c of cases) {
        const spec = mapCounter(c, { compact });
        const zoom = nominalZoom(spec.bounds, compact ? STAGE_SLOT.compact : STAGE_SLOT.wide);
        const { at, height } = spec.jar;
        const r = 1.47;
        const jar = screenRect([
          [at[0] - r * Math.SQRT1_2, height, at[2] + r * Math.SQRT1_2],
          [at[0] + r * Math.SQRT1_2, height, at[2] - r * Math.SQRT1_2],
          [at[0] + r, 0, at[2] + r],
        ]);
        for (const l of visibleLabels(spec.labels).filter((x) => x.id !== 'jar')) {
          expect(rectsOverlap(labelRect(l, zoom), jar)).toBe(false);
        }
        // and each block label names its category
        for (const l of spec.labels.filter((x) => x.id.startsWith('cat-'))) expect(l.sub).toBeTruthy();
      }
    }
  });

  it('a chip that does not fit rides along as focusOnly on its own block, never in a visible slot', () => {
    const spec = mapCounter(input({ budget: 50000, spend: twoHundred() }), { compact: true });
    const reveal = spec.labels.filter((l) => l.focusOnly);
    const shown = visibleLabels(spec.labels);
    expect(shown.some((l) => l.id === 'jar')).toBe(true);
    for (const l of reveal) {
      expect(shown).not.toContain(l);
      expect(l.id.startsWith('cat-')).toBe(true);
      // only kept when a DOM target can reveal it
      expect(spec.targets.some((t) => t.id === l.id)).toBe(true);
      expect(visibleLabels(spec.labels, 4, l.id)).toContain(l);
    }
    // every label shipped is either visible now or reachable through its target
    expect(shown.length + reveal.length).toBe(spec.labels.length);
  });

  it('is deterministic', () => {
    const i = input({ budget: 50000, spend: twoHundred() });
    expect(mapCounter(i)).toEqual(mapCounter(i));
  });
});

describe('counter helpers', () => {
  it('fitScreenBounds projects to exactly the content extent', () => {
    const pts: Vec3[] = [
      [0, 0, 0],
      [10, 0, 3.5],
      [2, 3.9, 1.75],
      [5, 5.1, 1.75],
      [0, -0.4, 3.5],
    ];
    const b = fitScreenBounds(pts);
    const real = projectBounds({ min: [0, -0.4, 0], max: [10, 5.1, 3.5] });
    const fit = projectBounds(b);
    // never taller than the naive box, and tight on every side
    expect(fit.maxY - fit.minY).toBeLessThan(real.maxY - real.minY);
    expect(fit.minX).toBeCloseTo(-3.5 * Math.SQRT1_2, 3);
    expect(fit.maxX).toBeCloseTo(6.5 * Math.SQRT1_2, 3);
    const ys = pts.map((p) => isoProject(p)[1]);
    expect(fit.minY).toBeCloseTo(Math.min(...ys), 3);
    expect(fit.maxY).toBeCloseTo(Math.max(...ys), 3);
  });

  it('fitScreenBounds handles flat content and a single point', () => {
    const flat = fitScreenBounds([
      [0, 0, 0],
      [20, 0, -20],
    ]);
    expect(flat.min[1]).toBeLessThanOrEqual(flat.max[1]);
    const one = fitScreenBounds([[1, 2, 3]]);
    expect(one.min).toEqual(one.max);
  });

  it('dash segments cover the line without running past it', () => {
    const segs = dashSegments(1.0, 0.16, 0.1);
    expect(segs[0]).toEqual([0, 0.16]);
    expect(segs[segs.length - 1][1]).toBeLessThanOrEqual(1.0);
  });

  it('zig-zag band is a closed strip with the right number of points', () => {
    const poly = zigzagBand(0.8, 0.1, 4, 0.06);
    expect(poly).toHaveLength(18);
    expect(Math.min(...poly.map((p) => p[0]))).toBeCloseTo(-0.4, 9);
  });

  it('scene money: whole units from 100, cents below', () => {
    expect(sceneMoney(2340.4, 'MYR')).toBe(`RM${NB}2,340`);
    expect(sceneMoney(12.5, 'MYR')).toBe(`RM${NB}12.50`);
    expect(sceneMoney(50, 'MYR')).toBe(`RM${NB}50`);
    expect(sceneMoney(1240, 'MYR', { approx: true })).toBe(`≈${NB}RM${NB}1,240`);
  });
});
