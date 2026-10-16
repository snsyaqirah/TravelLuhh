import { createElement } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Rates } from '@/types';
import { labelCap, visibleLabels } from '@/iso/overlay';
import { fitZoom, isoProject, projectBounds } from '@/iso/projection';
import { JAR_MAX_R, JAR_REF_HEIGHT } from '@/iso/shapes';
import { IsoSvgFrame } from '@/iso/svg/IsoSvg';
import { ShelfSvg } from '@/iso/svg/ShelfSvg';
import {
  LABEL_FONT,
  LID_LEAN_RIGHT,
  SHELF_YAW,
  boundsForScreenRect,
  compactMoney,
  jarHeights,
  mapShelf,
  screenRectOf,
  truncateName,
  type ShelfSpec,
  type ShelfTrip,
} from './shelf';

const nb = (s: string) => s.replace(/\u00A0/g, ' ');
const today = new Date(2026, 10, 14, 15, 0); // day 3 of Tokyo

const trip = (t: Partial<ShelfTrip> & Pick<ShelfTrip, 'id' | 'name'>): ShelfTrip => ({
  destinationCountry: 'JP',
  startDate: '2026-12-01',
  endDate: '2026-12-09',
  budget: 4000,
  currency: 'MYR',
  ...t,
});

const tokyo = trip({ id: 1, name: 'Tokyo autumn', startDate: '2026-11-12', endDate: '2026-11-20', totalExpenses: 1660 });
const seoul = trip({ id: 2, name: 'Seoul in spring', destinationCountry: 'KR', startDate: '2027-04-02', endDate: '2027-04-08', budget: 2_500_000, currency: 'KRW' });
const bangkok = trip({ id: 3, name: 'Bangkok shopping', destinationCountry: 'TH', startDate: '2026-12-20', endDate: '2026-12-24', budget: 12000, currency: 'THB', totalExpenses: 3500 });
const bali = trip({ id: 4, name: 'Bali with the geng', destinationCountry: 'ID', startDate: '2027-01-10', endDate: '2027-01-15', budget: 50, totalExpenses: 200 });
const penang = trip({ id: 5, name: 'Penang makan', destinationCountry: 'MY', startDate: '2026-11-28', endDate: '2026-11-30', budget: 0, totalExpenses: 120 });
const big = trip({ id: 6, name: 'Antarctica', destinationCountry: 'AQ', startDate: '2027-02-01', endDate: '2027-03-01', budget: 50_000 });
const oneDay = trip({ id: 7, name: 'Melaka day trip', destinationCountry: 'MY', startDate: '2026-11-14', endDate: '2026-11-14', budget: 300, totalExpenses: 96 });
const sixty = trip({ id: 8, name: 'Europe long haul', destinationCountry: 'FR', startDate: '2026-10-01', endDate: '2026-11-29', budget: 18000, totalExpenses: 15964 });
const done = trip({ id: 9, name: 'Old Hanoi trip', destinationCountry: 'VN', startDate: '2026-03-01', endDate: '2026-03-07' });
const archived = trip({ id: 10, name: 'Shelved idea', isArchived: true });

const rates: Rates = { base: 'MYR', date: '2026-10-15', rates: { KRW: 310.5, THB: 7.62, JPY: 32.41, EUR: 0.2 } };

const map = (trips: ShelfTrip[], r: Rates | null = rates, opts: Parameters<typeof mapShelf>[1] = {}) =>
  mapShelf({ trips, rates: r, homeCurrency: 'MYR', today }, opts);

/** Every jar's silhouette (body and lid) projected, for "is it in frame" checks. */
function jarScreenPoints(spec: ShelfSpec): Array<[number, number]> {
  return spec.jars.flatMap((j) => {
    const s = j.height / JAR_REF_HEIGHT;
    return [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].flatMap((a) => [
      isoProject([j.at[0] + Math.cos(a) * JAR_MAX_R * s, s, j.at[2] + Math.sin(a) * JAR_MAX_R * s]),
      isoProject([j.at[0], (JAR_REF_HEIGHT + 0.22) * s, j.at[2]]),
    ]);
  });
}

describe('framing helpers', () => {
  it('builds a box whose projected corners span exactly the requested rect', () => {
    const rect = { minX: -3, maxX: 5, minY: -2.5, maxY: 4 };
    const pb = projectBounds(boundsForScreenRect(rect));
    expect(pb.minX).toBeCloseTo(rect.minX, 9);
    expect(pb.maxX).toBeCloseTo(rect.maxX, 9);
    expect(pb.minY).toBeCloseTo(rect.minY, 9);
    expect(pb.maxY).toBeCloseTo(rect.maxY, 9);
  });

  it('keeps a too-flat rect centred inside a taller box', () => {
    const rect = { minX: -5, maxX: 5, minY: 0, maxY: 1 };
    const pb = projectBounds(boundsForScreenRect(rect));
    expect(pb.minX).toBeCloseTo(-5, 9);
    expect(pb.maxX).toBeCloseTo(5, 9);
    expect(pb.minY).toBeLessThan(0);
    expect(pb.maxY).toBeGreaterThan(1);
    expect((pb.minY + pb.maxY) / 2).toBeCloseTo(0.5, 9);
  });

  it('truncates names on a word boundary when it can', () => {
    expect(truncateName('Tokyo autumn', 14)).toBe('Tokyo autumn');
    expect(truncateName('Tokyo autumn', 9)).toBe('Tokyo…');
    expect(truncateName('Kualalumpurmalaysia', 8)).toBe('Kualalu…');
    expect(truncateName('  Bali   with the geng ', 40)).toBe('Bali with the geng');
  });

  it('shortens big amounts only as a last resort', () => {
    expect(nb(compactMoney(2_500_000, 'KRW'))).toBe('₩ 2.5M');
    expect(nb(compactMoney(340_000, 'JPY'))).toBe('¥ 340K');
    expect(nb(compactMoney(2340, 'MYR'))).toBe('RM 2,340');
  });

  it('leans a tilted lid along the plank', () => {
    expect(LID_LEAN_RIGHT).toBeGreaterThan(Math.PI / 2);
    expect(LID_LEAN_RIGHT).toBeLessThan(Math.PI);
  });
});

describe('jar heights (√ of target in home currency)', () => {
  it('scales by √(targetHome / maxTargetHome) across currencies', () => {
    const { heights, toScale } = jarHeights([tokyo, seoul, bangkok], rates, 'MYR');
    expect(toScale).toBe(true);
    const seoulHome = 2_500_000 / 310.5;
    expect(heights[1]).toBeCloseTo(2.4, 9);
    expect(heights[0]).toBeCloseTo(1.6 + 0.8 * Math.sqrt(4000 / seoulHome), 9);
    expect(heights[2]).toBeCloseTo(1.6 + 0.8 * Math.sqrt(12000 / 7.62 / seoulHome), 9);
  });

  it('RM 50 next to RM 50,000 stays at the 1.6 floor, RM 50,000 at 2.4', () => {
    const { heights } = jarHeights([bali, big], rates, 'MYR');
    expect(heights[0]).toBeCloseTo(1.6 + 0.8 * Math.sqrt(50 / 50000), 9);
    expect(heights[1]).toBeCloseTo(2.4, 9);
  });

  it('draws every jar at 2.0 when any rate is missing', () => {
    expect(jarHeights([tokyo, seoul], null, 'MYR')).toEqual({ heights: [2, 2], toScale: false });
    expect(jarHeights([tokyo, trip({ id: 20, name: 'Hanoi', currency: 'VND', budget: 9_000_000 })], rates, 'MYR').toScale).toBe(false);
  });

  it('a no-budget trip needs no rate, and an all-zero shelf is uniform', () => {
    const r = jarHeights([penang, trip({ id: 21, name: 'x', currency: 'VND', budget: 0 })], null, 'MYR');
    expect(r).toEqual({ heights: [2, 2], toScale: true });
    expect(jarHeights([tokyo, penang], null, 'MYR').toScale).toBe(true);
    expect(jarHeights([tokyo, penang], null, 'MYR').heights[1]).toBeCloseTo(1.6, 9);
  });
});

describe('mapShelf', () => {
  it('keeps upcoming and on-the-road trips, on the road first, then by start date', () => {
    const spec = map([seoul, done, bangkok, archived, tokyo]);
    expect(spec.jars.map((j) => j.tripId)).toEqual([1, 3, 2]);
    expect(spec.total).toBe(3);
    expect(spec.more).toBe(0);
    expect(spec.jars[0].phase).toBe('onTheRoad');
    expect(spec.jars[0].lidColor).toBe('lidOnTheRoad');
    expect(spec.jars[1].lidColor).toBe('lidUpcoming');
  });

  it('caps at 3 jars on mobile and 5 on desktop, counting the rest', () => {
    const all = [tokyo, seoul, bangkok, bali, penang, big, oneDay];
    const m = map(all);
    expect(m.jars).toHaveLength(3);
    expect(m.more).toBe(4);
    expect(m.summary).toMatch(/^7 trips on your shelf\./);
    const d = map(all, rates, { layout: 'desktop' });
    expect(d.jars).toHaveLength(5);
    expect(d.more).toBe(2);
  });

  it('raises the label cap so all five desktop jars keep their chip; mobile keeps the default', () => {
    const all = [tokyo, seoul, bangkok, bali, penang, big, oneDay];
    const d = map(all, rates, { layout: 'desktop' });
    expect(d.labels).toHaveLength(5);
    expect(d.maxLabels).toBe(5);
    expect(visibleLabels(d.labels, labelCap(undefined, d.maxLabels))).toHaveLength(5);
    expect(map(all).maxLabels).toBeUndefined();
  });

  it('fills each jar to its fund and writes the summary in each trip currency', () => {
    const spec = map([tokyo, seoul, bangkok]);
    expect(spec.jars[0].fill).toBeCloseTo(2340 / 4000, 9);
    expect(spec.jars[1].fill).toBeCloseTo(8500 / 12000, 9);
    expect(spec.jars[2].fill).toBe(1);
    expect(nb(spec.summary)).toBe(
      '3 trips on your shelf. Tokyo autumn: RM 2,340 of RM 4,000 left. Bangkok shopping: ฿ 8,500 of ฿ 12,000 left. Seoul in spring: ₩ 2,500,000 of ₩ 2,500,000 left.',
    );
    expect(spec.toScale).toBe(true);
  });

  it('says "Jar sizes not to scale" when rates are missing', () => {
    const spec = map([tokyo, seoul], null);
    expect(spec.toScale).toBe(false);
    expect(spec.jars.every((j) => j.height === 2)).toBe(true);
    expect(spec.summary).toMatch(/Jar sizes not to scale\.$/);
  });

  it('over budget (300%): no coins, tilted lid leaning along the plank, IOU slip, stamp label', () => {
    const spec = map([tokyo, bali], rates, { slot: { w: 900, h: 360 } });
    const j = spec.jars[1];
    expect(j.over).toBe(true);
    expect(j.fill).toBe(0);
    expect(j.lid).toBe('tilted');
    expect(j.lidYaw).toBe(LID_LEAN_RIGHT);
    expect(j.iou).not.toBeNull();
    const label = spec.labels.find((l) => l.id === j.id)!;
    expect(label.tone).toBe('stamp');
    expect(nb(label.text)).toBe('Over RM 150');
    expect(nb(spec.summary)).toContain('Bali with the geng: over by RM 150.');
    // The plank runs on past the last jar so the leaning lid has somewhere to rest.
    expect(spec.shelf.length).toBeGreaterThan(2 * 2.6 + 0.4);
  });

  it('no budget: empty jar, closed lid, "No budget" label', () => {
    const spec = map([penang]);
    const j = spec.jars[0];
    expect(j.hasBudget).toBe(false);
    expect(j.fill).toBe(0);
    expect(j.lid).toBe('closed');
    expect(j.iou).toBeNull();
    expect(spec.labels[0].text).toMatch(/^No budget/);
    expect(spec.labels[0].tone).toBe('muted');
    expect(spec.summary).toContain('Penang makan: no budget set.');
  });

  it('handles 1-day and 60-day trips on the road', () => {
    expect(map([oneDay, sixty]).jars.map((j) => j.tripId)).toEqual([8, 7]);
    // A lone jar has the whole slot for its label, so the phase fits on the sub line.
    expect(map([oneDay]).labels[0].sub).toBe('MY Melaka day… · DAY 1/1'); // names cut at 14 (§8)
    expect(map([sixty]).labels[0].sub).toBe('FR Europe long… · DAY 45/60');
    expect(map([seoul]).labels[0].sub).toBe('KR Seoul in… · IN 139 DAYS');
  });

  it('empty shelf: a sketched jar, a way to start one, the empty copy', () => {
    for (const trips of [[], [done], [archived]]) {
      const spec = map(trips);
      expect(spec.jars).toHaveLength(0);
      expect(spec.ghost).not.toBeNull();
      expect(spec.targets).toEqual([expect.objectContaining({ href: '/trips/new', ariaLabel: 'Start a tabung' })]);
      expect(spec.summary).toBe("Your shelf's empty. Pick a place, we'll start the tabung.");
      expect(spec.labels).toEqual([]);
    }
  });

  it('targets every jar at /trips/:id with a touch-sized button', () => {
    const spec = map([tokyo, seoul, bangkok]);
    expect(spec.targets.map((t) => t.href)).toEqual(['/trips/1', '/trips/3', '/trips/2']);
    for (const t of spec.targets) expect(t.sizePx).toBeGreaterThanOrEqual(44);
    expect(nb(spec.targets[0].ariaLabel)).toBe('Open Tokyo autumn: RM 2,340 of RM 4,000 left');
  });

  it('lines jars up along the screen without overlapping', () => {
    for (const layout of ['mobile', 'desktop'] as const) {
      const spec = map([tokyo, seoul, bangkok, bali, penang], rates, { layout });
      const xs = spec.jars.map((j) => isoProject(j.at));
      xs.forEach(([, y]) => expect(y).toBeCloseTo(xs[0][1], 9)); // same screen row
      for (let i = 1; i < spec.jars.length; i++) {
        const a = spec.jars[i - 1];
        const b = spec.jars[i];
        const gap = xs[i][0] - xs[i - 1][0] - JAR_MAX_R * (a.height / JAR_REF_HEIGHT) - JAR_MAX_R * (b.height / JAR_REF_HEIGHT);
        expect(gap).toBeGreaterThan(0.2);
      }
    }
    expect(SHELF_YAW).toBeCloseTo(Math.PI / 4, 12);
  });

  it('frames every jar inside the bounds and keeps label chips narrower than their column', () => {
    for (const [layout, slot] of [
      ['mobile', { w: 343, h: 240 }],
      ['desktop', { w: 680, h: 360 }],
    ] as const) {
      const spec = map([tokyo, seoul, bangkok, bali, penang, big], rates, { layout });
      const pb = projectBounds(spec.bounds);
      for (const [x, y] of jarScreenPoints(spec)) {
        expect(x).toBeGreaterThanOrEqual(pb.minX - 1e-9);
        expect(x).toBeLessThanOrEqual(pb.maxX + 1e-9);
        expect(y).toBeGreaterThanOrEqual(pb.minY - 1e-9);
        expect(y).toBeLessThanOrEqual(pb.maxY + 1e-9);
      }
      const zoom = fitZoom(spec.bounds, slot.w, slot.h);
      const xs = spec.jars.map((j) => isoProject(j.at)[0]);
      const wide = slot.w >= 600;
      spec.labels.forEach((l, i) => {
        const col = Math.min(...[xs[i] - (xs[i - 1] ?? -Infinity), (xs[i + 1] ?? Infinity) - xs[i]]) * zoom;
        const textPx = l.text.length * LABEL_FONT.text(wide) + LABEL_FONT.chrome - 6;
        const subPx = (l.sub ?? '').length * LABEL_FONT.sub + LABEL_FONT.chrome - 6;
        expect(textPx).toBeLessThanOrEqual(col);
        expect(subPx).toBeLessThanOrEqual(col);
      });
    }
  });

  it('is deterministic', () => {
    expect(map([tokyo, seoul, bangkok])).toEqual(map([tokyo, seoul, bangkok]));
  });

  it('covers the rect of what it draws with its bounds', () => {
    const spec = map([tokyo, bali]);
    const rect = screenRectOf(spec.jars.map((j) => j.at));
    const pb = projectBounds(spec.bounds);
    expect(rect.minX).toBeGreaterThan(pb.minX);
    expect(rect.maxX).toBeLessThan(pb.maxX);
  });
});

describe('ShelfSvg twin', () => {
  it('renders every fixture in both themes', () => {
    const fixtures = [map([tokyo, seoul, bangkok]), map([tokyo, bali, penang], null), map([]), map([big])];
    for (const spec of fixtures) {
      for (const theme of ['light', 'dark'] as const) {
        const { container, unmount } = render(
          createElement(IsoSvgFrame, { bounds: spec.bounds, theme, size: { w: 343, h: 240 } }, createElement(ShelfSvg, { spec, theme })),
        );
        expect(container.querySelectorAll('polygon, path').length).toBeGreaterThan(5);
        unmount();
      }
    }
  });
});
