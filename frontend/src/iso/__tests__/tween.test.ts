import { arcPoint, createTweenStore, cubicBezier, easings } from '@/iso/tween';

describe('cubicBezier', () => {
  it('hits the end points and matches linear for (0,0,1,1)', () => {
    const lin = cubicBezier(0, 0, 1, 1);
    for (const t of [0, 0.25, 0.5, 0.9, 1]) expect(lin(t)).toBeCloseTo(t, 5);
  });
  it('ease-out is front-loaded; stamp overshoots', () => {
    expect(easings.out(0.25)).toBeGreaterThan(0.5);
    const peak = Math.max(...Array.from({ length: 101 }, (_, i) => easings.stamp(i / 100)));
    expect(peak).toBeGreaterThan(1);
    expect(easings.stamp(1)).toBe(1);
  });
  it('drop lands, bounces 6% once, settles', () => {
    expect(easings.drop(0)).toBe(0);
    expect(easings.drop(0.8)).toBeCloseTo(1, 5);
    expect(easings.drop(0.9)).toBeCloseTo(0.94, 5);
    expect(easings.drop(1)).toBe(1);
  });
});

describe('arcPoint', () => {
  it('starts and ends on the endpoints and peaks lift above the chord midpoint', () => {
    const a = [0, 2, 0] as const;
    const b = [4, 0, 2] as const;
    expect(arcPoint(a, b, 1, 0)).toEqual([0, 2, 0]);
    expect(arcPoint(a, b, 1, 1)).toEqual([4, 0, 2]);
    const mid = arcPoint(a, b, 1, 0.5);
    expect(mid[0]).toBe(2);
    expect(mid[1]).toBeCloseTo(2, 9); // (2 + 0) / 2 + 1
  });
});

describe('tween store', () => {
  it('drives invalidate only while running', () => {
    const store = createTweenStore();
    const invalidate = vi.fn();
    store.setInvalidate(invalidate);
    const values: number[] = [];
    const done = vi.fn();
    store.tween('lid', { from: 0, to: 100, duration: 450, onUpdate: (v) => values.push(v), onDone: done });
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(store.active).toBe(true);
    let frames = 0;
    while (store.step(1 / 60)) frames++;
    expect(frames).toBeGreaterThan(20);
    expect(frames).toBeLessThan(30);
    expect(values[values.length - 1]).toBe(100);
    expect(done).toHaveBeenCalledTimes(1);
    expect(store.active).toBe(false);
    expect(store.step(1 / 60)).toBe(false);
  });

  it('respects delay (coin stagger)', () => {
    const store = createTweenStore();
    const v: number[] = [];
    store.tween('c', { from: 0, to: 1, duration: 100, delay: 50, onUpdate: (x) => v.push(x) });
    store.step(0.03);
    expect(v).toEqual([]);
    store.step(0.03);
    expect(v.length).toBe(1);
  });

  it('replaces a tween with the same id', () => {
    const store = createTweenStore();
    const a = vi.fn();
    const b = vi.fn();
    store.tween('x', { from: 0, to: 1, duration: 100, onUpdate: a });
    store.tween('x', { from: 0, to: 2, duration: 100, onUpdate: b });
    expect(store.size).toBe(1);
    while (store.step(1 / 60));
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenLastCalledWith(2, 1);
  });

  it('springs settle with maath damp', () => {
    const store = createTweenStore();
    const block = { h: 0 };
    const done = vi.fn();
    store.spring('block', { target: block, key: 'h', to: 1.5, smoothTime: 0.1, onDone: done });
    let t = 0;
    while (store.step(1 / 60)) t += 1 / 60;
    expect(block.h).toBe(1.5);
    expect(done).toHaveBeenCalled();
    expect(t).toBeLessThan(1.2);
  });

  it('reduced motion completes immediately and never needs frames', () => {
    const store = createTweenStore();
    store.setReducedMotion(true);
    const on = vi.fn();
    const block = { h: 0 };
    store.tween('a', { from: 0, to: 5, duration: 450, onUpdate: on });
    store.spring('b', { target: block, key: 'h', to: 2 });
    expect(on).toHaveBeenCalledWith(5, 1);
    expect(block.h).toBe(2);
    expect(store.active).toBe(false);
  });

  it('finishAll jumps everything to the end', () => {
    const store = createTweenStore();
    const on = vi.fn();
    store.tween('a', { from: 0, to: 3, duration: 1000, onUpdate: on });
    store.step(0.1);
    store.finishAll();
    expect(on).toHaveBeenLastCalledWith(3, 1);
    expect(store.active).toBe(false);
  });
});
