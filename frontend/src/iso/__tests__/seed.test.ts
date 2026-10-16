import { hashString, mulberry32, rng } from '@/iso/seed';

describe('hashString', () => {
  it('is FNV-1a 32 (known vectors)', () => {
    expect(hashString('')).toBe(0x811c9dc5);
    expect(hashString('a')).toBe(0xe40c292c);
    expect(hashString('foobar')).toBe(0xbf9cf968);
  });
  it('is stable and spreads nearby ids', () => {
    expect(hashString('trip-42')).toBe(hashString('trip-42'));
    expect(hashString('trip-42')).not.toBe(hashString('trip-43'));
  });
});

describe('mulberry32', () => {
  it('is deterministic per seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const xs = Array.from({ length: 5 }, () => a());
    expect(Array.from({ length: 5 }, () => b())).toEqual(xs);
    expect(xs[0]).toBeCloseTo(0.6011037519201636, 12);
  });
  it('stays in [0, 1) and is roughly uniform', () => {
    const r = mulberry32(7);
    const bins = new Array(10).fill(0);
    let lo = 1;
    let hi = 0;
    for (let i = 0; i < 20000; i++) {
      const v = r();
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
      bins[Math.floor(v * 10)]++;
    }
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(hi).toBeLessThan(1);
    for (const b of bins) expect(Math.abs(b - 2000)).toBeLessThan(200);
  });
});

describe('rng helpers', () => {
  it('range, int, pick and shuffle are seeded', () => {
    const a = rng('tokyo');
    const b = rng('tokyo');
    expect(a.range(2, 3)).toBe(b.range(2, 3));
    const n = a.int(5);
    expect(n).toBe(b.int(5));
    expect(Number.isInteger(n)).toBe(true);
    expect(a.pick(['x', 'y', 'z'])).toBe(b.pick(['x', 'y', 'z']));
    const s = a.shuffle([1, 2, 3, 4, 5, 6]);
    expect(s).toEqual(b.shuffle([1, 2, 3, 4, 5, 6]));
    expect([...s].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
