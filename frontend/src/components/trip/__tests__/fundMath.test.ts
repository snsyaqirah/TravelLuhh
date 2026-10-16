import { describe, expect, it } from 'vitest';
import {
  allocationHint,
  biggestSpends,
  buildPace,
  categoryRows,
  fundedOn,
  savingPlan,
  sharePercent,
  spentBeforeTrip,
} from '@/components/trip/fund/fundMath';

/** formatMoney joins prefix and number with a no-break space; compare as plain text. */
const plain = <T extends { text: string }>(h: T) => ({ ...h, text: h.text.replace(/\u00A0/g, ' ') });

const e = (id: number, category: string, amount: number, expenseDate = '2026-10-12') =>
  ({ id, category, amount, expenseDate }) as never;

describe('categoryRows', () => {
  it('keeps the fixed category order, counts entries and shares of spent', () => {
    const rows = categoryRows(
      [e(1, 'food', 30), e(2, 'accommodation', 120), e(3, 'food', 50), e(4, 'mystery', 0)],
      'MYR'
    );
    expect(rows.map((r) => r.key)).toEqual(['accommodation', 'food', 'other']);
    expect(rows[1]).toMatchObject({ key: 'food', amount: 80, count: 2 });
    expect(rows[0].share).toBeCloseTo(0.6);
  });

  it('is empty with no expenses', () => {
    expect(categoryRows([], 'MYR')).toEqual([]);
  });
});

describe('sharePercent', () => {
  it('rounds, and never shows a real sliver as 0%', () => {
    expect(sharePercent(0.436)).toBe('44%');
    expect(sharePercent(0.001)).toBe('<1%');
    expect(sharePercent(0)).toBe('0%');
  });
});

describe('biggestSpends', () => {
  it('takes the three largest, newest first on ties', () => {
    const list = [e(1, 'food', 10), e(2, 'food', 99, '2026-10-13'), e(3, 'food', 99, '2026-10-14'), e(4, 'food', 50), e(5, 'food', 5)];
    expect(biggestSpends(list).map((x: { id: number }) => x.id)).toEqual([3, 2, 4]);
  });
});

describe('buildPace', () => {
  const base = { startDate: '2026-10-12', endDate: '2026-10-20', target: 4000, currency: 'MYR' };

  it('accumulates spend up to today on the road, with an even line to the budget', () => {
    const points = buildPace({
      ...base,
      phase: 'onTheRoad',
      today: '2026-10-16',
      byDay: { '2026-10-10': 100, '2026-10-12': 200, '2026-10-14': 50, '2026-10-17': 999 },
    });
    expect(points).toHaveLength(9);
    // a booking before the trip counts on day 1
    expect(points[0]).toMatchObject({ day: 1, spent: 300, even: 444.44 });
    expect(points[4]).toMatchObject({ day: 5, spent: 350, isToday: true });
    expect(points[5].spent).toBeNull();
    expect(points[8].even).toBe(4000);
  });

  it('puts spends after the trip on the last day once home', () => {
    const points = buildPace({ ...base, phase: 'home', today: '2026-11-01', byDay: { '2026-10-25': 10 } });
    expect(points[8].spent).toBe(10);
    expect(points.some((p) => p.isToday)).toBe(false);
  });

  it('has no lived days before the trip and no even line without a budget', () => {
    const points = buildPace({ ...base, target: 0, phase: 'upcoming', today: '2026-10-01', byDay: {} });
    expect(points.every((p) => p.spent === null && p.even === null)).toBe(true);
  });

  it('handles a 1-day trip', () => {
    const points = buildPace({ ...base, endDate: '2026-10-12', phase: 'home', today: '2026-10-13', byDay: { '2026-10-12': 5 } });
    expect(points).toEqual([{ date: '2026-10-12', day: 1, spent: 5, even: 4000, isToday: false }]);
  });
});

describe('spentBeforeTrip', () => {
  it('sums only spends dated before day 1', () => {
    expect(spentBeforeTrip({ '2026-10-01': 300, '2026-10-12': 50 }, '2026-10-12')).toBe(300);
  });
});

describe('savingPlan', () => {
  it('spreads what is left over the whole weeks before the start, rounded up', () => {
    // 16 Oct → 18 Dec is 63 days = 9 weeks; 3,750 / 9 = 416.67
    expect(savingPlan(3750, '2026-12-18', new Date(2026, 9, 16))).toEqual({ perWeek: 417, weeks: 9, until: '18 Dec' });
  });

  it('is null once nothing is left to save or the trip has started', () => {
    expect(savingPlan(0, '2026-12-18', new Date(2026, 9, 16))).toBeNull();
    expect(savingPlan(500, '2026-10-12', new Date(2026, 9, 16))).toBeNull();
  });

  it('asks for at least one week', () => {
    expect(savingPlan(100, '2026-10-18', new Date(2026, 9, 16))).toMatchObject({ perWeek: 100, weeks: 1 });
  });
});

describe('fundedOn', () => {
  const entry = (id: number, amount: number, entryDate: string) => ({ id, amount, entryDate });

  it('is the date the running fund first met the target', () => {
    expect(fundedOn([entry(3, 600, '2026-08-01'), entry(1, 600, '2026-06-01'), entry(2, 600, '2026-07-01')], 1800)).toBe(
      '2026-08-01'
    );
  });

  it('resets when a withdrawal takes it back under, and is null when never reached', () => {
    expect(fundedOn([entry(1, 1000, '2026-06-01'), entry(2, -200, '2026-06-05'), entry(3, 200, '2026-06-09')], 1000)).toBe(
      '2026-06-09'
    );
    expect(fundedOn([entry(1, 10, '2026-06-01')], 1000)).toBeNull();
    expect(fundedOn([entry(1, 10, '2026-06-01')], 0)).toBeNull();
  });
});

describe('allocationHint (jars sum hint)', () => {
  it('matches the whole budget', () => {
    expect(plain(allocationHint(1500, 1500, 'MYR'))).toEqual({ tone: 'ok', text: 'RM 1,500 in jars, the whole budget.' });
  });
  it('says what is not in a jar yet', () => {
    expect(plain(allocationHint(1300, 1500, 'MYR'))).toEqual({
      tone: 'short',
      text: "RM 200 of the RM 1,500 budget isn't in a jar yet.",
    });
  });
  it('says how far over the budget the jars are', () => {
    expect(plain(allocationHint(1600, 1500, 'MYR'))).toEqual({ tone: 'over', text: 'RM 100 more than the RM 1,500 budget.' });
  });
  it('copes with a trip without a budget', () => {
    expect(allocationHint(50.5, 0, 'MYR').tone).toBe('ok');
  });
});
