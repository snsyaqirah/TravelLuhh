import { describe, expect, it } from 'vitest';
import { computeFund } from '@/hooks/useFund';
import { fundNotice, paceSentence, practicalLine, sentenceMoney, settleUpText, transferLine } from './fundCopy';

const NB = '\u00A0';
const tokyo = { budget: 4000, currency: 'MYR', startDate: '2026-11-12', endDate: '2026-11-20' };
const day3 = new Date(2026, 10, 14, 20);

describe('sentenceMoney', () => {
  it('rounds from 100 up, keeps cents below', () => {
    expect(sentenceMoney(312.4, 'MYR')).toBe(`RM${NB}312`);
    expect(sentenceMoney(82.5, 'MYR')).toBe(`RM${NB}82.50`);
  });
});

describe('practicalLine', () => {
  it('on the road: daily allowance for the days left', () => {
    expect(practicalLine(computeFund({ ...tokyo, totalExpenses: 1816 }, day3))).toBe(`≈${NB}RM${NB}312 a day for the next 7 days.`);
    expect(practicalLine(computeFund({ ...tokyo, totalExpenses: 3900 }, new Date(2026, 10, 20, 9)))).toBe(`≈${NB}RM${NB}100 left for today.`);
  });
  it('upcoming: planned per day', () => {
    expect(practicalLine(computeFund(tokyo, new Date(2026, 9, 15)))).toBe(`RM${NB}444 a day planned.`);
  });
  it('home: baki or over', () => {
    expect(practicalLine(computeFund({ ...tokyo, totalExpenses: 3688 }, new Date(2026, 10, 25)))).toBe(`Back with RM${NB}312 baki.`);
    expect(practicalLine(computeFund({ ...tokyo, totalExpenses: 4240 }, new Date(2026, 10, 25)))).toBe(`Over by RM${NB}240.`);
  });
  it('no budget', () => {
    expect(practicalLine(computeFund({ ...tokyo, budget: 0 }, day3))).toBe('No budget set for this trip. Add one to fill the jar.');
  });
});

describe('paceSentence', () => {
  it('on pace shows how far under', () => {
    // expected after 3 of 9 days = 1,333.33; spent 1,193.33 → 140 under
    expect(paceSentence(computeFund({ ...tokyo, totalExpenses: 1193.33 }, day3))).toBe(`On pace. RM${NB}140 under so far.`);
  });
  it('over pace projects the landing', () => {
    // 1,473.33 / 3 × 9 = 4,420
    expect(paceSentence(computeFund({ ...tokyo, totalExpenses: 1473.333333 }, day3))).toBe(
      `At this pace you'll land at RM${NB}4,420, about RM${NB}420 over.`
    );
  });
  it('is null off the road or without a budget', () => {
    expect(paceSentence(computeFund(tokyo, new Date(2026, 9, 15)))).toBeNull();
    expect(paceSentence(computeFund({ ...tokyo, budget: 0 }, day3))).toBeNull();
  });
});

describe('fundNotice', () => {
  it('picks only the highest severity', () => {
    expect(fundNotice(computeFund({ ...tokyo, totalExpenses: 4240 }, day3))).toEqual({
      id: 'over',
      level: 'over',
      text: `Over by RM${NB}240. Happens. Here's where it went →`,
    });
    expect(fundNotice(computeFund({ ...tokyo, totalExpenses: 3790 }, new Date(2026, 10, 19)))).toEqual({
      id: 'p90',
      level: 'warn',
      text: `RM${NB}210 left for 2 days.`,
    });
    expect(fundNotice(computeFund({ ...tokyo, totalExpenses: 3000 }, new Date(2026, 10, 16)))!.text).toBe(
      'Three quarters gone, 5 days left. Still okay if you slow down a bit.'
    );
    expect(fundNotice(computeFund({ ...tokyo, totalExpenses: 1000 }, day3))).toBeNull();
  });
  it('flags a missing budget, not on finished trips', () => {
    expect(fundNotice(computeFund({ ...tokyo, budget: 0 }, day3))!.id).toBe('nobudget');
    expect(fundNotice(computeFund({ ...tokyo, budget: 0 }, new Date(2026, 10, 25)))).toBeNull();
  });
});

describe('settle-up text', () => {
  const tx = [
    { fromName: 'Aiman', toName: 'Siti', amount: 82.5 },
    { fromName: 'Hafiz', toName: 'Siti', amount: 40 },
  ];
  it('builds the WhatsApp text with plain spaces', () => {
    expect(settleUpText('Tokyo autumn', tx, 'MYR')).toBe('Tokyo autumn settle-up\nAiman → Siti RM 82.50\nHafiz → Siti RM 40.00');
    expect(settleUpText('Tokyo autumn', [], 'MYR')).toBe('Tokyo autumn settle-up\nAll square. Nobody owes anybody.');
  });
  it('formats one Kongsi row', () => {
    expect(transferLine(tx[0], 'MYR')).toBe(`Aiman → Siti · RM${NB}82.50`);
  });
});
