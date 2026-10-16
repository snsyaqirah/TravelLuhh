import { describe, expect, it } from 'vitest';
import { computeFund } from './useFund';

const tokyo = { budget: 4000, currency: 'MYR', startDate: '2026-11-12', endDate: '2026-11-20' };
const day3 = new Date(2026, 10, 14, 20, 0);

describe('computeFund — budget mode (Phase A)', () => {
  it('drains a full jar on the road', () => {
    const f = computeFund({ ...tokyo, totalExpenses: 1660 }, day3);
    expect(f.mode).toBe('budget');
    expect(f.target).toBe(4000);
    expect(f.spent).toBe(1660);
    expect(f.inJar).toBe(2340);
    expect(f.over).toBe(0);
    expect(f.fill).toBeCloseTo(0.585, 6);
    expect(f.usedRatio).toBeCloseTo(0.415, 6);
    expect(f.phase).toBe('onTheRoad');
    expect(f.daysTotal).toBe(9);
    expect(f.daysElapsed).toBe(3);
    expect(f.daysLeft).toBe(7);
    expect(f.dailyAllowance).toBeCloseTo(2340 / 7, 6);
    expect(f.pace!.projected).toBeCloseTo(4980, 6);
    expect(f.pace!.delta).toBeCloseTo(980, 6);
    expect(f.toSave).toBe(0);
  });

  it('plans a daily amount before the trip', () => {
    const f = computeFund(tokyo, new Date(2026, 9, 15));
    expect(f.phase).toBe('upcoming');
    expect(f.spent).toBe(0);
    expect(f.fill).toBe(1);
    expect(f.daysElapsed).toBe(0);
    expect(f.daysLeft).toBe(9);
    expect(f.dailyAllowance).toBeCloseTo(4000 / 9, 6);
    expect(f.pace).toBeNull();
  });

  it('has no allowance once home, and baki is what is left', () => {
    const f = computeFund({ ...tokyo, totalExpenses: 3688 }, new Date(2026, 10, 25));
    expect(f.phase).toBe('home');
    expect(f.dailyAllowance).toBeNull();
    expect(f.pace).toBeNull();
    expect(f.daysLeft).toBe(0);
    expect(f.daysElapsed).toBe(9);
    expect(f.inJar).toBe(312);
  });

  it('handles going over', () => {
    const f = computeFund({ ...tokyo, totalExpenses: 4240 }, day3);
    expect(f.inJar).toBe(0);
    expect(f.over).toBe(240);
    expect(f.fill).toBe(0);
    expect(f.dailyAllowance).toBe(0);
    expect(f.usedRatio).toBeCloseTo(1.06, 6);
  });

  it('never divides by a zero budget', () => {
    const f = computeFund({ ...tokyo, budget: 0, totalExpenses: 120 }, day3);
    expect(f.hasBudget).toBe(false);
    expect(f.fill).toBe(0);
    expect(f.inJar).toBe(0);
    expect(f.over).toBe(120);
    expect(f.usedRatio).toBe(0);
    expect(f.dailyAllowance).toBeNull();
    expect(f.pace).toBeNull();
    for (const v of Object.values(f)) if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
  });

  it('treats junk numbers as 0 and falls back to spentAmount', () => {
    const f = computeFund({ ...tokyo, budget: Number('x'), spentAmount: 50 }, day3);
    expect(f.target).toBe(0);
    expect(f.spent).toBe(50);
  });

  it('lets callers override spent', () => {
    expect(computeFund({ ...tokyo, totalExpenses: 10 }, day3, { spent: 400 }).spent).toBe(400);
  });
});

describe('computeFund — trip lengths', () => {
  it('a 1-day trip on its day', () => {
    const f = computeFund(
      { budget: 300, currency: 'SGD', startDate: '2026-11-12', endDate: '2026-11-12', totalExpenses: 100 },
      new Date(2026, 10, 12, 23, 30)
    );
    expect(f.daysTotal).toBe(1);
    expect(f.daysElapsed).toBe(1);
    expect(f.daysLeft).toBe(1);
    expect(f.dailyAllowance).toBe(200);
    expect(f.pace!.projected).toBe(100);
  });

  it('a 60-day trip halfway', () => {
    const f = computeFund(
      { budget: 6000, currency: 'MYR', startDate: '2026-01-01', endDate: '2026-03-01', totalExpenses: 3000 },
      new Date(2026, 0, 30)
    );
    expect(f.daysTotal).toBe(60);
    expect(f.daysElapsed).toBe(30);
    expect(f.daysLeft).toBe(31);
    expect(f.dailyAllowance).toBeCloseTo(3000 / 31, 6);
    expect(f.pace!.projected).toBeCloseTo(6000, 6);
    expect(f.pace!.delta).toBeCloseTo(0, 6);
  });
});

describe('computeFund — saving mode (Phase B fund entries)', () => {
  it('fills from what was saved, and shows what is still to save', () => {
    const f = computeFund({ ...tokyo, savedAmount: 1500 }, new Date(2026, 9, 15));
    expect(f.mode).toBe('saving');
    expect(f.saved).toBe(1500);
    expect(f.inJar).toBe(1500);
    expect(f.toSave).toBe(2500);
    expect(f.fill).toBeCloseTo(0.375, 6);
    expect(f.dailyAllowance).toBeCloseTo(4000 / 9, 6);
  });

  it('spends from the saved money on the road; over is still against the target', () => {
    const f = computeFund({ ...tokyo, savedAmount: 1500, totalExpenses: 1700 }, day3);
    expect(f.inJar).toBe(0);
    expect(f.over).toBe(0);
    expect(f.dailyAllowance).toBe(0);
    const g = computeFund({ ...tokyo, savedAmount: 4500, totalExpenses: 4200 }, day3);
    expect(g.inJar).toBe(300);
    expect(g.over).toBe(200);
    expect(g.toSave).toBe(0);
    expect(g.fill).toBeCloseTo(300 / 4000, 6);
  });

  it('a fully funded jar caps fill at 1', () => {
    const f = computeFund({ ...tokyo, savedAmount: 5000 }, new Date(2026, 9, 15));
    expect(f.fill).toBe(1);
    expect(f.toSave).toBe(0);
  });

  it('saved money with no budget still gives an allowance on the road', () => {
    const f = computeFund({ ...tokyo, budget: 0, savedAmount: 700, totalExpenses: 0 }, day3);
    expect(f.fill).toBe(0);
    expect(f.dailyAllowance).toBe(100);
    expect(f.pace).toBeNull();
  });
});
