import { describe, expect, it } from 'vitest';
import { computeFund } from '@/hooks/useFund';
import { settleUpText } from '@/lib/fundCopy';
import {
  axisMoney,
  balanceRows,
  cleanMoney,
  fxPair,
  headerFieldParts,
  headerFieldRow,
  initialsOf,
  paceLine,
  plainAmount,
  readAmount,
  savedLine,
} from '@/components/trip/tripCopy';
import { roleAtLeast, searchForTab, canEditTrip, isTripOwner } from '@/components/trip/tripTabs';

const tokyo = {
  destinationCountry: 'JP',
  startDate: '2026-10-12',
  endDate: '2026-10-20',
  budgetType: 'shared' as const,
  memberCount: 3,
  budget: 4000,
  currency: 'MYR',
};
const today = new Date(2026, 9, 16);
/** formatMoney joins prefix and number with a no-break space; compare as plain text. */
const sp = (s: string) => s.replace(/\u00A0/g, ' ');

describe('header field row', () => {
  it('reads route, dates, duration and party', () => {
    expect(headerFieldRow(tokyo, 'MY')).toBe('MY → JP · 12–20 OCT 2026 · 9D8N · GENG · 3');
    expect(headerFieldParts({ ...tokyo, budgetType: 'solo' }, 'MY').at(-1)).toBe('SOLO');
  });
});

describe('figures: budget vs saving mode', () => {
  it('budget mode has nothing saved, so no saved line is needed', () => {
    const f = computeFund({ ...tokyo, totalExpenses: 1000, savedAmount: 0 }, today);
    expect(f.mode).toBe('budget');
    expect(f.inJar).toBe(3000);
  });

  it('saving mode: the jar holds what was dropped in minus spend, and the line adds up', () => {
    const f = computeFund({ ...tokyo, totalExpenses: 2868.45, savedAmount: 3350 }, today);
    expect(f.mode).toBe('saving');
    expect(f.inJar).toBeCloseTo(481.55);
    expect(sp(savedLine(f))).toBe('Saved RM 3,350 of RM 4,000 · RM 650 to go');
    expect(sp(savedLine({ ...f, saved: 1775.5, toSave: 2224.5 }))).toBe('Saved RM 1,775.50 of RM 4,000 · RM 2,224.50 to go');
  });

  it('says cukup once the target is met', () => {
    const f = computeFund({ ...tokyo, totalExpenses: 0, savedAmount: 4000 }, today);
    expect(sp(savedLine(f))).toBe('Saved RM 4,000 of RM 4,000. Cukup.');
  });

  it('a fund below zero says it is short instead of "Saved −RM 80"', () => {
    const f = computeFund({ ...tokyo, totalExpenses: 0, savedAmount: -80 }, today);
    expect(sp(savedLine(f))).toBe('Fund is RM 80 short · RM 4,080 to go');
    expect(sp(savedLine({ ...f, hasBudget: false }))).toBe('Fund is RM 80 short.');
  });
});

describe('fxPair', () => {
  it('quotes the destination currency against the trip currency', () => {
    expect(fxPair({ currency: 'MYR', destinationCountry: 'JP' })).toEqual(['MYR', 'JPY']);
  });
  it('falls back to home when the trip is already in the local money, else nothing', () => {
    expect(fxPair({ currency: 'MYR', destinationCountry: 'MY' }, 'SGD')).toEqual(['MYR', 'SGD']);
    expect(fxPair({ currency: 'MYR', destinationCountry: 'MY' }, 'MYR')).toBeNull();
  });
});

describe('paceLine', () => {
  it('uses the pace sentence on the road', () => {
    const f = computeFund({ ...tokyo, totalExpenses: 2868.45 }, today);
    expect(sp(paceLine(f, 0))).toBe("At this pace you'll land at RM 5,163, about RM 1,163 over.");
  });
  it('recaps at home and plans before', () => {
    const home = computeFund({ ...tokyo, totalExpenses: 3700 }, new Date(2026, 10, 1));
    expect(sp(paceLine(home, 0))).toBe('Landed at RM 3,700, RM 300 under the plan.');
    const before = computeFund({ ...tokyo, totalExpenses: 300 }, new Date(2026, 9, 1));
    expect(sp(paceLine(before, 300))).toBe('The pace line starts on day 1. RM 300 already went on bookings.');
  });
});

describe('readAmount', () => {
  it('accepts positive amounts with the currency decimals', () => {
    expect(readAmount('1,250.50', 'MYR')).toEqual({ amount: 1250.5 });
    expect(readAmount('RM 25', 'MYR')).toEqual({ amount: 25 });
  });
  it('rejects zero, negatives, extra decimals and decimals in yen', () => {
    expect(readAmount('0', 'MYR')).toHaveProperty('error');
    expect(readAmount('-5', 'MYR')).toHaveProperty('error');
    expect(readAmount('1.234', 'MYR')).toEqual({ error: 'Use at most 2 decimals.' });
    expect(readAmount('100.5', 'JPY')).toEqual({ error: 'JPY has no decimals. Enter a whole amount.' });
  });
});

describe('money bits', () => {
  it('axis money is short', () => {
    expect(axisMoney(0, 'MYR')).toBe('RM 0');
    expect(axisMoney(1500, 'MYR')).toBe('RM 1.5k');
    expect(axisMoney(120000, 'JPY')).toBe('¥ 120k');
  });
  it('clean money drops .00 only on whole amounts', () => {
    expect(sp(cleanMoney(550, 'MYR'))).toBe('RM 550');
    expect(sp(cleanMoney(82.5, 'MYR'))).toBe('RM 82.50');
  });
  it('plain amount is what a bank app wants', () => {
    expect(plainAmount(82.5, 'MYR')).toBe('82.50');
    expect(plainAmount(3200, 'JPY')).toBe('3200');
  });
  it('initials', () => {
    expect(initialsOf('Siti Aisyah')).toBe('SA');
    expect(initialsOf('Aiman')).toBe('A');
    expect(initialsOf(null)).toBe('');
  });
});

describe('Kongsi', () => {
  it('labels balances with first names, You, and who left', () => {
    const rows = balanceRows(
      [
        { userId: 3, name: 'Syaqirah', paid: 0, share: 0, net: -289.69 },
        { userId: 1, name: 'Aiman Hakim', paid: 0, share: 0, net: 905.21 },
        { userId: 2, name: 'Siti Aisyah', paid: 0, share: 0, net: -615.52, onTrip: false },
      ],
      3
    );
    expect(rows.map((r) => r.name)).toEqual(['You', 'Aiman', 'Siti (left)']);
  });

  it('builds the WhatsApp text with plain spaces', () => {
    const text = settleUpText(
      'Tokyo autumn',
      [
        { fromName: 'Siti Aisyah', toName: 'Aiman Hakim', amount: 615.52 },
        { fromName: 'Syaqirah', toName: 'Aiman Hakim', amount: 289.69 },
      ],
      'MYR'
    );
    expect(text).toBe('Tokyo autumn settle-up\nSiti Aisyah → Aiman Hakim RM 615.52\nSyaqirah → Aiman Hakim RM 289.69');
    expect(text).not.toMatch(/\u00a0/);
  });
});

describe('tabs and roles', () => {
  it('moving tabs closes sheets, keeps ?day for plot tabs and ?cat only into the ledger', () => {
    const s = '?day=2026-10-14&cat=food&sheet=expense&id=4';
    expect(searchForTab(s, 'ledger')).toBe('?day=2026-10-14&cat=food');
    expect(searchForTab(s, 'days')).toBe('?day=2026-10-14');
    expect(searchForTab(s, 'fund')).toBe('');
  });

  it('ranks roles; an unknown role is a viewer', () => {
    expect(roleAtLeast('owner', 'editor')).toBe(true);
    expect(roleAtLeast('editor', 'owner')).toBe(false);
    expect(roleAtLeast(undefined, 'editor')).toBe(false);
    expect(canEditTrip({ myRole: 'editor' })).toBe(true);
    expect(canEditTrip({ myRole: 'viewer' })).toBe(false);
    expect(isTripOwner({ myRole: 'editor' })).toBe(false);
  });
});
