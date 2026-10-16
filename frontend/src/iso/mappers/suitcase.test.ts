import { describe, expect, it } from 'vitest';
import { PACKED, SUITCASE } from '@/iso/shapes';
import {
  CASE_SLOTS,
  GHOST_CAP,
  PACKING_CATEGORY_ORDER,
  caseSlotXZ,
  itemsPerBox,
  lidAngleFor,
  mapSuitcase,
  packingCategory,
  type SuitcaseInput,
} from '@/iso/mappers/suitcase';
import { labelRect, nominalZoom, rectsOverlap, screenRect, STAGE_SLOT } from '@/iso/mappers/counter';

type Item = SuitcaseInput['items'][number];

function items(n: number, checked: (i: number) => boolean, category: (i: number) => string | null = () => 'clothing'): Item[] {
  return Array.from({ length: n }, (_, i) => ({ id: i + 1, isChecked: checked(i), category: category(i) }));
}

const mixed = (i: number) => PACKING_CATEGORY_ORDER[i % PACKING_CATEGORY_ORDER.length];

function expectSane(spec: ReturnType<typeof mapSuitcase>) {
  const { min, max } = spec.bounds;
  for (let i = 0; i < 3; i++) expect(min[i]).toBeLessThanOrEqual(max[i] + 1e-9);
  expect(spec.boxes.length).toBeLessThanOrEqual(CASE_SLOTS);
  expect(spec.ghosts.length).toBeLessThanOrEqual(GHOST_CAP);
  const innerX = SUITCASE.w / 2 - SUITCASE.wall;
  const innerZ = SUITCASE.d / 2 - SUITCASE.wall;
  for (const b of spec.boxes) {
    expect(Math.abs(b.at[0]) + PACKED.box[0] / 2).toBeLessThanOrEqual(innerX + 1e-9);
    expect(Math.abs(b.at[2]) + PACKED.box[2] / 2).toBeLessThanOrEqual(innerZ + 1e-9);
    expect(b.at[1] + PACKED.box[1]).toBeLessThanOrEqual(SUITCASE.wallH + 1e-9);
  }
  // every ghost stands outside the case
  for (const g of spec.ghosts) expect(g.at[0] - g.size[0] / 2).toBeGreaterThan(SUITCASE.w / 2);
  expect(spec.summary).not.toMatch(/NaN|undefined/);
}

describe('mapSuitcase', () => {
  it('lid angle is 100° × (1 − p)^0.6', () => {
    expect(lidAngleFor(0)).toBe(100);
    expect(lidAngleFor(0.5)).toBeCloseTo(100 * 0.5 ** 0.6, 9);
    expect(lidAngleFor(1)).toBe(0);
    expect(lidAngleFor(Number.NaN)).toBe(100);
  });

  it('23 of 31 packed: boxes, ghosts, summary', () => {
    const spec = mapSuitcase({ tripId: 3, items: items(31, (i) => i < 23, mixed) });
    expectSane(spec);
    expect(spec.packed).toBe(23);
    expect(spec.boxes).toHaveLength(23);
    expect(spec.ghosts).toHaveLength(8);
    expect(spec.lidAngle).toBeCloseTo(lidAngleFor(23 / 31), 9);
    expect(spec.done).toBe(false);
    expect(spec.summary).toBe('23 of 31 packed.');
    expect(spec.labels.map((l) => l.text)).toEqual(['8 to pack']);
    expect(spec.unitChip).toBeUndefined();
  });

  it('groups packed boxes by packing category in the fixed order', () => {
    const spec = mapSuitcase({ tripId: 3, items: items(20, () => true, (i) => ['general', 'documents', 'clothing', 'health'][i % 4]) });
    const order = spec.boxes.map((b) => PACKING_CATEGORY_ORDER.indexOf(b.category));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(spec.boxes[0]).toMatchObject({ category: 'documents', tone: 'passport', slab: true });
    expect(spec.boxes.find((b) => b.category === 'clothing')?.tone).toBe('khaki');
    expect(spec.boxes.find((b) => b.category === 'health')?.tone).toBe('clay');
    expect(spec.boxes.find((b) => b.category === 'general')?.tone).toBe('linen');
  });

  it('fills from the hinge side, left to right, bottom layer first; nothing floats', () => {
    const spec = mapSuitcase({ tripId: 1, items: items(30, () => true) });
    const [x0, z0] = caseSlotXZ(0);
    const [x1] = caseSlotXZ(1);
    const [, z6] = caseSlotXZ(6);
    expect(x1).toBeGreaterThan(x0);
    expect(z6).toBeGreaterThan(z0);
    expect(spec.boxes[0].at[1]).toBe(SUITCASE.baseH);
    const top = spec.boxes[24];
    expect(top.at[0]).toBeCloseTo(spec.boxes[0].at[0], 9);
    expect(top.at[1]).toBeCloseTo(SUITCASE.baseH + PACKED.box[1], 9);
  });

  it('a box on a passport slab rests on the slab', () => {
    const list = [...items(1, () => true, () => 'documents'), ...items(30, () => true).map((i) => ({ ...i, id: i.id + 100 }))];
    const spec = mapSuitcase({ tripId: 1, items: list });
    const above = spec.boxes.find((b) => b.slot === 24);
    expect(above?.at[1]).toBeCloseTo(SUITCASE.baseH + PACKED.slab[1], 9);
  });

  it('0 items: open empty case, 3 sketches and "Start from a list"', () => {
    const spec = mapSuitcase({ tripId: 1, items: [] });
    expectSane(spec);
    expect(spec.lidAngle).toBe(100);
    expect(spec.boxes).toHaveLength(0);
    expect(spec.ghosts.map((g) => g.key)).toEqual(['empty-0', 'empty-1', 'empty-2']);
    expect(spec.labels[0]).toMatchObject({ text: 'Start from a list', tone: 'muted' });
    expect(spec.summary).toBe('Empty bag. Start from a list or add your own.');
  });

  it('nothing packed yet: lid fully open, every item waiting outside', () => {
    const spec = mapSuitcase({ tripId: 1, items: items(5, () => false) });
    expect(spec.lidAngle).toBe(100);
    expect(spec.ghosts).toHaveLength(5);
    expect(spec.summary).toBe('0 of 5 packed.');
  });

  it('all packed: shut, buckled, SIAP label and stamp anchor', () => {
    const spec = mapSuitcase({ tripId: 1, items: items(12, () => true, mixed) });
    expectSane(spec);
    expect(spec).toMatchObject({ done: true, lidAngle: 0, progress: 1 });
    expect(spec.labels[0]).toMatchObject({ id: 'siap', text: 'SIAP', tone: 'fund' });
    expect(spec.stamp?.text).toBe('SIAP');
    expect(spec.ghosts).toHaveLength(0);
    expect(spec.summary).toBe('All 12 packed. Zip it.');
    const noLabel = mapSuitcase({ tripId: 1, items: items(12, () => true) }, { stampLabel: false });
    expect(noLabel.labels).toHaveLength(0);
    expect(noLabel.stamp).not.toBeNull();
  });

  it("the pile's chip never covers the open case", () => {
    for (const n of [0, 5, 31, 200]) {
      for (const compact of [true, false]) {
        const spec = mapSuitcase({ tripId: 1, items: items(n, (i) => i < n / 3) }, { compact });
        const zoom = nominalZoom(spec.bounds, compact ? STAGE_SLOT.compact : STAGE_SLOT.wide);
        const box = screenRect([
          [-SUITCASE.w / 2, SUITCASE.wallH * 2, SUITCASE.d / 2],
          [SUITCASE.w / 2, 0, SUITCASE.d / 2],
          [SUITCASE.w / 2, SUITCASE.wallH * 2, -SUITCASE.d / 2],
        ]);
        for (const l of spec.labels) expect(rectsOverlap(labelRect(l, zoom), box)).toBe(false);
      }
    }
  });

  it('caps sketches at 12 and says +n', () => {
    const spec = mapSuitcase({ tripId: 1, items: items(30, (i) => i < 5) });
    expect(spec.ghosts).toHaveLength(12);
    expect(spec.hiddenUnpacked).toBe(13);
    expect(spec.labels[0]).toMatchObject({ text: '+13', sub: '25 to pack' });
  });

  it('200 items: one box holds several, everything fits 48 slots, unit chip shown', () => {
    const spec = mapSuitcase({ tripId: 1, items: items(200, () => true, mixed) });
    expectSane(spec);
    expect(spec.unit).toBe(5);
    expect(spec.boxes.length).toBeLessThanOrEqual(CASE_SLOTS);
    expect(spec.boxes.reduce((s, b) => s + b.itemIds.length, 0)).toBe(200);
    expect(spec.unitChip).toBe('1 box = 5 items');
  });

  it('items per box grows until every category fits', () => {
    expect(itemsPerBox([48])).toBe(1);
    expect(itemsPerBox([49])).toBe(2);
    // 10 categories of 5: 50 items → 2 per box gives 30 boxes
    expect(itemsPerBox(Array(10).fill(5))).toBe(2);
    // 9 categories of 9 and one of 10: 2 per box would need 9×5 + 5 = 50 boxes, so 3
    expect(itemsPerBox([...Array(9).fill(9), 10])).toBe(3);
  });

  it('box keys are stable when another item is ticked', () => {
    const before = mapSuitcase({ tripId: 1, items: items(10, (i) => i < 4) });
    const after = mapSuitcase({ tripId: 1, items: items(10, (i) => i < 5) });
    const keys = (s: typeof before) => s.boxes.map((b) => b.key);
    expect(keys(after).slice(0, 4)).toEqual(keys(before));
    expect(after.boxes[4].itemIds).toEqual([5]);
    expect(before.ghosts[0].key).toBe('item-5');
  });

  it('unknown or missing categories pack as general', () => {
    expect(packingCategory('Toiletries')).toBe('general');
    expect(packingCategory(null)).toBe('general');
    expect(packingCategory(' Clothing ')).toBe('clothing');
  });

  it('is deterministic (seeded twist per item)', () => {
    const i = { tripId: 9, items: items(40, (k) => k % 3 !== 0, mixed) };
    expect(mapSuitcase(i)).toEqual(mapSuitcase(i));
    for (const b of mapSuitcase(i).boxes) expect(Math.abs(b.rotY)).toBeLessThanOrEqual(0.08);
  });
});
