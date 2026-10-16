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
  it('saving mode, spent all that was dropped in but not the budget: says why the jar is empty', () => {
    // budget 1,000, saved 500, spent 920 → jar empty, nothing over, RM 80 of the budget still unsaved
    const f = computeFund(
      { budget: 1000, currency: 'MYR', startDate: '2026-10-10', endDate: '2026-10-20', totalExpenses: 920, savedAmount: 500 },
      new Date(2026, 9, 16)
    );
    expect(f.mode).toBe('saving');
    expect(practicalLine(f)).toBe(`You've spent everything you dropped in. RM${NB}80.00 of the budget isn't saved yet.`);
  });
  it('exactly on budget, either mode', () => {
    expect(practicalLine(computeFund({ ...tokyo, totalExpenses: 4000 }, day3))).toBe('Right on budget. Nothing left in the jar.');
    expect(practicalLine(computeFund({ ...tokyo, savedAmount: 2500, totalExpenses: 4000 }, day3))).toBe(
      'Right on budget. Nothing left in the jar.'
    );
    // a float sum a hair over the budget is still on budget
    expect(practicalLine(computeFund({ ...tokyo, totalExpenses: 4000.0000000001 }, day3))).toBe('Right on budget. Nothing left in the jar.');
  });
  it('never prints "Over by RM 0.00"', () => {
    const cases = [
      { ...tokyo, totalExpenses: 4000 },
      { ...tokyo, totalExpenses: 4000.004 },
      { ...tokyo, savedAmount: 500, totalExpenses: 920 },
      { ...tokyo, savedAmount: 500, totalExpenses: 500 },
      { ...tokyo, savedAmount: -80, totalExpenses: 0 },
    ];
    for (const t of cases) {
      for (const when of [day3, new Date(2026, 9, 15), new Date(2026, 10, 25)]) {
        const f = computeFund(t, when);
        expect(practicalLine(f)).not.toMatch(/Over by RM.0\.00/);
        expect(fundNotice(f)?.text ?? '').not.toMatch(/Over by RM.0\.00/);
      }
    }
  });
  it('a fund that went below zero stays honest: empty jar, says it is short', () => {
    const f = computeFund({ ...tokyo, savedAmount: -80, totalExpenses: 0 }, day3);
    expect(practicalLine(f)).toBe(`The fund is RM${NB}80.00 short. Nothing left in the jar.`);
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
  it('in saving mode, "left" is the same jar the figures show (saved − spent), not target − spent', () => {
    // saved 3,700, spent 3,600 of 4,000: the jar holds RM 100, so the notice must not say RM 400
    expect(fundNotice(computeFund({ ...tokyo, savedAmount: 3700, totalExpenses: 3600 }, new Date(2026, 10, 19)))).toEqual({
      id: 'p90',
      level: 'warn',
      text: `RM${NB}100 left for 2 days.`,
    });
    // spent past what was saved, still under the target
    expect(fundNotice(computeFund({ ...tokyo, savedAmount: 2000, totalExpenses: 3700 }, new Date(2026, 10, 19)))!.text).toBe(
      `You've spent everything you dropped in. RM${NB}300 of the budget isn't saved yet.`
    );
  });
  it('exactly on budget: no "RM 0.00 left"', () => {
    expect(fundNotice(computeFund({ ...tokyo, totalExpenses: 4000 }, new Date(2026, 10, 19)))).toEqual({
      id: 'p90',
      level: 'warn',
      text: 'Right on budget. Nothing left in the jar.',
    });
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
