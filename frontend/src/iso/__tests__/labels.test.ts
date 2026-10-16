import { labelCap, labelVisibility, placeTargets, rankLabels, visibleLabels, withRevealTargets } from '@/iso/overlay';
import type { SceneLabel, SceneTarget } from '@/iso/specs';

const view = { zoom: 40, center: [0, 0, 0] as [number, number, number] };
const size = { w: 375, h: 220 };

describe('rankLabels', () => {
  it('keeps array order by default and lets priority promote', () => {
    const l = (id: string, priority?: number): SceneLabel => ({ id, at: [0, 0, 0], text: id, priority });
    expect(rankLabels([l('a'), l('b'), l('c', -1), l('d', 2)]).map((x) => x.id)).toEqual(['c', 'a', 'b', 'd']);
  });
});

describe('label visibility', () => {
  const l = (id: string, extra: Partial<SceneLabel> = {}): SceneLabel => ({ id, at: [0, 0, 0], text: id, ...extra });
  const five = [l('a'), l('b'), l('c'), l('d'), l('e')];

  it('shows the first four by default and reveals the rest on their target', () => {
    expect(visibleLabels(five).map((x) => x.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(visibleLabels(five, undefined, 'e').map((x) => x.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('honours a raised cap', () => {
    expect(visibleLabels(five, 5).map((x) => x.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('never gives a focusOnly label a slot, and shows it only for its own target', () => {
    const labels = [l('hidden', { focusOnly: true, priority: -5 }), l('a'), l('b')];
    expect(visibleLabels(labels).map((x) => x.id)).toEqual(['a', 'b']);
    expect(visibleLabels(labels, 4, 'a').map((x) => x.id)).toEqual(['a', 'b']);
    expect(visibleLabels(labels, 4, 'hidden').map((x) => x.id)).toEqual(['a', 'b', 'hidden']);
    // focusOnly labels don't push ranked labels past the cap either
    const capped = [l('f1', { focusOnly: true }), l('f2', { focusOnly: true }), ...five];
    expect(labelVisibility(capped).filter((v) => v.always).map((v) => v.label.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('drops focusOnly labels that no target can reveal', () => {
    const labels = [l('a'), l('b', { focusOnly: true }), l('c', { focusOnly: true })];
    const kept = withRevealTargets(labels, [{ id: 'c', at: [0, 0, 0], ariaLabel: 'c' }]);
    expect(kept.map((x) => x.id)).toEqual(['a', 'c']);
  });

  it('picks the cap: page override, then spec, then 4', () => {
    expect(labelCap()).toBe(4);
    expect(labelCap(undefined, 5)).toBe(5);
    expect(labelCap(2, 5)).toBe(2);
    expect(labelCap(-1)).toBe(0);
    expect(labelCap(Number.NaN)).toBe(4);
  });
});

describe('placeTargets', () => {
  const t = (id: string, x: number): SceneTarget => ({ id, at: [x, 0, -x], ariaLabel: id });
  it('drops targets closer than 32px to a neighbour', () => {
    // SCREEN_RIGHT spacing: (x, 0, -x) projects to 2x·0.70711·zoom px apart
    const tight = placeTargets([t('a', 0), t('b', 0.5)], view, size); // ≈ 28px
    expect(tight).toHaveLength(0);
    const loose = placeTargets([t('a', 0), t('b', 0.75)], view, size); // ≈ 42px
    expect(loose.map((p) => p.target.id)).toEqual(['a', 'b']);
  });
  it('enforces the 32px minimum size and drops offscreen targets', () => {
    const [p] = placeTargets([{ id: 'x', at: [0, 0, 0], ariaLabel: 'x', sizePx: 20 }], view, size);
    expect(p.size).toBe(32);
    expect(placeTargets([t('far', 20)], view, size)).toHaveLength(0);
  });
});
