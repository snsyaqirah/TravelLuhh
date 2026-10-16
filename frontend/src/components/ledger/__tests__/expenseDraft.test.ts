import { describe, expect, it } from 'vitest';
import type { Expense, Rates, Trip } from '@/types';
import {
  buildExpenseInput,
  defaultExpenseDate,
  draftFromExpense,
  manualRateValue,
  newDraft,
  newLine,
  rateLabel,
  summariseLines,
  tidyAmount,
  type ExpenseDraft,
} from '../expenseDraft';

const trip = { id: 2, currency: 'MYR', startDate: '2026-10-12', endDate: '2026-10-20' } as Trip;
// rates[X] = X per 1 MYR
const rates: Rates = { base: 'MYR', date: '2026-10-15', rates: { JPY: 32.41, SGD: 0.29, VND: 5600 } };
const today = new Date(2026, 9, 16, 9, 30);

function draft(p: Partial<ExpenseDraft> = {}): ExpenseDraft {
  return { ...newDraft(trip, { today }), ...p };
}

describe('defaultExpenseDate', () => {
  it('is today inside the trip, the start date otherwise', () => {
    expect(defaultExpenseDate(trip, today)).toBe('2026-10-16');
    expect(defaultExpenseDate(trip, new Date(2026, 8, 1))).toBe('2026-10-12');
    expect(defaultExpenseDate(trip, new Date(2026, 11, 1))).toBe('2026-10-12');
  });
});

describe('amount parsing', () => {
  it('reads grouped and decimal-comma input and tidies it per currency', () => {
    const r = buildExpenseInput(draft({ amount: '1,250.5', category: 'food' }), { trip, rates });
    expect(r.input?.amount).toBe(1250.5);
    expect(tidyAmount('3200', 'JPY')).toBe('3,200');
    expect(tidyAmount('3,200.00', 'JPY')).toBe('3,200');
    expect(tidyAmount('12.5', 'MYR')).toBe('12.50');
    expect(tidyAmount('abc', 'MYR')).toBe('abc');
  });

  it('asks for an amount and a category before anything is sent', () => {
    const r = buildExpenseInput(draft(), { trip, rates });
    expect(r.ok).toBe(false);
    expect(r.errors).toMatchObject({ amount: 'Enter how much you paid.', category: 'Pick a category.' });
    expect(buildExpenseInput(draft({ amount: '0', category: 'food' }), { trip, rates }).errors?.amount).toBe(
      'The amount has to be more than 0.',
    );
  });
});

describe('currency conversion payload (§2.6)', () => {
  it('sends JPY as MYR with the original amount and the rate', () => {
    const r = buildExpenseInput(draft({ amount: '3,200', currency: 'JPY', category: 'food', description: ' Ramen Ichiran ' }), { trip, rates });
    expect(r.ok).toBe(true);
    expect(r.input).toEqual({
      tripId: 2,
      description: 'Ramen Ichiran',
      amount: 98.73,
      currency: 'MYR',
      originalAmount: 3200,
      originalCurrency: 'JPY',
      fxRate: 0.030854674,
      category: 'food',
      expenseDate: '2026-10-16',
    });
    // originalAmount × fxRate ≈ amount
    expect(3200 * (r.input?.fxRate ?? 0)).toBeCloseTo(98.73, 2);
    expect(r.preview).toEqual({ paid: '¥ 3,200', label: 'Food' });
  });

  it('sends a trip-currency spend with no rate and the original equal to the amount', () => {
    const r = buildExpenseInput(draft({ amount: '12.50', category: 'transportation' }), { trip, rates });
    expect(r.input).toMatchObject({ amount: 12.5, currency: 'MYR', originalAmount: 12.5, originalCurrency: 'MYR' });
    expect(r.input).not.toHaveProperty('fxRate');
    // blank description falls back to the category label
    expect(r.input?.description).toBe('Transport');
  });

  it('uses a manual rate when there is no live one, in either direction', () => {
    const noRates = buildExpenseInput(draft({ amount: '250000', currency: 'KHR', category: 'food' }), { trip, rates });
    expect(noRates.errors?.rate).toBe('No live rate for KHR today. Enter the rate you got.');

    const inverse = draft({ amount: '250000', currency: 'VND', category: 'food', rateMode: 'manual', manualRate: '5,000', rateInverse: true });
    expect(manualRateValue(inverse)).toBeCloseTo(0.0002, 10);
    expect(buildExpenseInput(inverse, { trip, rates }).input).toMatchObject({ amount: 50, originalAmount: 250000, originalCurrency: 'VND', fxRate: 0.0002 });

    const direct = draft({ amount: '40', currency: 'SGD', category: 'food', rateMode: 'manual', manualRate: '3.40', rateInverse: false });
    expect(buildExpenseInput(direct, { trip, rates }).input).toMatchObject({ amount: 136, fxRate: 3.4 });

    const missing = draft({ amount: '40', currency: 'SGD', category: 'food', rateMode: 'manual', manualRate: '' });
    expect(buildExpenseInput(missing, { trip, rates }).errors?.rate).toBe('Enter the rate you got for SGD.');
  });

  it('labels rates the way money changers quote them', () => {
    expect(rateLabel(1 / 32.41, 'MYR', 'JPY')).toBe('1 MYR = 32.41 JPY');
    expect(rateLabel(3.45, 'MYR', 'SGD')).toBe('1 SGD = 3.45 MYR');
  });
});

describe('receipt lines', () => {
  it('converts every line with the receipt rate and puts the rounding on the last line', () => {
    const d = draft({
      amount: '7840',
      currency: 'JPY',
      category: 'bundle',
      description: 'Don Quijote haul',
      itemise: true,
      lines: [
        newLine({ description: 'KitKat matcha, 3 boxes', amount: '2400', category: 'shopping' }),
        newLine({ description: 'Sheet masks', amount: '3000', category: 'shopping' }),
        newLine({ description: 'Tokyo Banana', amount: '2440', category: 'food' }),
        newLine(),
      ],
    });
    expect(summariseLines(d)).toMatchObject({ allocated: 7840, remaining: 0, filled: 3 });
    const r = buildExpenseInput(d, { trip, rates });
    expect(r.input?.amount).toBe(241.9);
    expect(r.input?.subItems).toEqual([
      { description: 'KitKat matcha, 3 boxes', amount: 74.05, category: 'shopping' },
      { description: 'Sheet masks', amount: 92.56, category: 'shopping' },
      { description: 'Tokyo Banana', amount: 75.29, category: 'food' },
    ]);
    const sum = r.input!.subItems!.reduce((s, x) => s + x.amount, 0);
    expect(Math.round(sum * 100) / 100).toBe(241.9);
  });

  it('refuses lines that add up to more than the total, or lines without a name', () => {
    const over = draft({ amount: '1000', currency: 'JPY', category: 'bundle', itemise: true, lines: [newLine({ description: 'A', amount: '1200' })] });
    expect(buildExpenseInput(over, { trip, rates }).errors?.lines).toBe('The lines come to ¥ 1,200, more than the ¥ 1,000 paid.');
    const nameless = draft({ amount: '1000', currency: 'JPY', category: 'bundle', itemise: true, lines: [newLine({ amount: '200' })] });
    expect(buildExpenseInput(nameless, { trip, rates }).errors?.lines).toBe('Every line needs a name.');
  });
});

describe('edit payload', () => {
  const donki: Expense = {
    id: 22,
    tripId: 2,
    description: 'Don Quijote haul',
    amount: 241.9,
    currency: 'MYR',
    originalAmount: 7840,
    originalCurrency: 'JPY',
    fxRate: 0.03085467,
    category: 'bundle',
    expenseDate: '2026-10-15',
    notes: null,
    addedBy: 2,
    paidBy: 2,
    paidByUser: { id: 2, name: 'Siti Aisyah', email: 's@x' },
    subItems: [
      { id: 5, description: 'KitKat matcha, 3 boxes', amount: 74.06, category: 'shopping' },
      { id: 6, description: 'Sheet masks', amount: 92.57, category: 'shopping' },
      { id: 7, description: 'Tokyo Banana', amount: 75.27, category: 'food' },
    ],
    createdAt: '2026-10-15T17:05:00',
    updatedAt: '2026-10-15T17:05:00',
  };

  it('prefills the receipt as it was paid, with the rate as logged', () => {
    const d = draftFromExpense(donki, trip, { group: true });
    expect(d).toMatchObject({
      amount: '7,840',
      currency: 'JPY',
      category: 'bundle',
      description: 'Don Quijote haul',
      date: '2026-10-15',
      paidBy: 2,
      itemise: true,
      rateMode: 'manual',
      rateInverse: true,
      manualRate: '32.41',
    });
    expect(d.lines.map((l) => [l.description, l.amount, l.category])).toEqual([
      ['KitKat matcha, 3 boxes', '2400', 'shopping'],
      ['Sheet masks', '3000', 'shopping'],
      ['Tokyo Banana', '2440', 'food'],
    ]);
  });

  it('round-trips an unchanged entry to the same money, and a changed amount at the logged rate', () => {
    const d = draftFromExpense(donki, trip, { group: true });
    const same = buildExpenseInput(d, { trip, rates, hadSubItems: true });
    expect(same.input).toMatchObject({ amount: 241.9, currency: 'MYR', originalAmount: 7840, originalCurrency: 'JPY', paidBy: 2, category: 'bundle' });
    // untouched lines keep their stored amounts (no sen of drift)
    expect(same.input?.subItems).toEqual([
      { description: 'KitKat matcha, 3 boxes', amount: 74.06, category: 'shopping' },
      { description: 'Sheet masks', amount: 92.57, category: 'shopping' },
      { description: 'Tokyo Banana', amount: 75.27, category: 'food' },
    ]);
    // editing one line re-converts them all, and the last takes the rounding
    const edited = buildExpenseInput({ ...d, lines: d.lines.map((l, i) => (i === 0 ? { ...l, description: 'KitKat matcha' } : l)) }, { trip, rates, hadSubItems: true });
    expect(edited.input?.subItems?.[0]).toEqual({ description: 'KitKat matcha', amount: 74.06, category: 'shopping' });
    const moved = buildExpenseInput({ ...d, lines: d.lines.map((l, i) => (i === 0 ? { ...l, amount: '2500' } : i === 2 ? { ...l, amount: '2340' } : l)) }, { trip, rates, hadSubItems: true });
    expect(moved.input?.subItems?.map((x) => x.amount)).toEqual([77.14, 92.56, 72.2]);

    // a changed amount converts at the logged rate (exact, not the 2-decimal one on screen)
    const changed = buildExpenseInput({ ...d, amount: '8,000', itemise: false }, { trip, rates, hadSubItems: true });
    expect(changed.input).toMatchObject({ amount: 246.84, originalAmount: 8000, fxRate: 0.03085467 });
    // turning the lines off on an entry that had them sends [] so the server drops them
    expect(changed.input?.subItems).toEqual([]);
  });

  it('keeps the logged figures to the sen when the money is untouched', () => {
    // logged at a rate whose 2-decimal inverse (38.76) would drift by a sen
    const ramen: Expense = { ...donki, id: 13, description: 'Ichiran', amount: 82.55, originalAmount: 3200, fxRate: 0.025797797, category: 'food', subItems: [] };
    const d = draftFromExpense(ramen, trip);
    expect(d.manualRate).toBe('38.76');
    expect(buildExpenseInput(d, { trip, rates }).input).toMatchObject({ amount: 82.55, originalAmount: 3200, fxRate: 0.025797797 });
    // typing a new rate re-converts
    expect(buildExpenseInput({ ...d, manualRate: '40' }, { trip, rates }).input).toMatchObject({ amount: 80, fxRate: 0.025 });
  });

  it('a trip-currency entry edits without a rate', () => {
    const hotel: Expense = { ...donki, id: 11, description: 'Hotel Gracery Shinjuku, 8 nights', amount: 1260, originalAmount: 1260, originalCurrency: 'MYR', fxRate: null, category: 'accommodation', subItems: [], notes: 'Two rooms.' };
    const d = draftFromExpense(hotel, trip);
    expect(d).toMatchObject({ amount: '1,260.00', currency: 'MYR', rateMode: 'live', paidBy: null, notes: 'Two rooms.', itemise: false });
    const r = buildExpenseInput({ ...d, notes: '' }, { trip, rates, hadSubItems: false });
    expect(r.input).toEqual({
      tripId: 2,
      description: 'Hotel Gracery Shinjuku, 8 nights',
      amount: 1260,
      currency: 'MYR',
      originalAmount: 1260,
      originalCurrency: 'MYR',
      category: 'accommodation',
      expenseDate: '2026-10-15',
    });
  });
});
