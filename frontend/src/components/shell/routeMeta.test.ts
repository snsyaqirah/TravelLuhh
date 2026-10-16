import { describe, expect, it } from 'vitest';
import {
  NAV_ITEMS,
  defaultChrome,
  defaultTabForPhase,
  isNavActive,
  isTripTab,
  routeFadeKey,
  tripIdFromPath,
  withParam,
} from '@/components/shell/routeMeta';

const item = (to: string) => NAV_ITEMS.find((n) => n.to === to)!;

describe('trip tabs', () => {
  it('accepts only the five tabs', () => {
    for (const t of ['fund', 'ledger', 'days', 'pack', 'notes']) expect(isTripTab(t)).toBe(true);
    for (const t of ['expenses', 'edit', '', undefined, null, 'FUND']) expect(isTripTab(t)).toBe(false);
  });

  it('lands on the tab that fits the phase', () => {
    expect(defaultTabForPhase('upcoming')).toBe('days');
    expect(defaultTabForPhase('onTheRoad')).toBe('ledger');
    expect(defaultTabForPhase('home')).toBe('fund');
  });
});

describe('tripIdFromPath', () => {
  it('reads the id from any trip path', () => {
    expect(tripIdFromPath('/trips/12')).toBe('12');
    expect(tripIdFromPath('/trips/12/ledger')).toBe('12');
    expect(tripIdFromPath('/trips/12/edit')).toBe('12');
  });

  it('ignores the list and the create flow', () => {
    expect(tripIdFromPath('/trips')).toBeNull();
    expect(tripIdFromPath('/trips/')).toBeNull();
    expect(tripIdFromPath('/trips/new')).toBeNull();
    expect(tripIdFromPath('/home')).toBeNull();
  });
});

describe('routeFadeKey', () => {
  it('gives every tab of one trip the same key', () => {
    expect(routeFadeKey('/trips/7/fund')).toBe(routeFadeKey('/trips/7/ledger'));
    expect(routeFadeKey('/trips/7')).toBe('/trips/7');
  });

  it('separates pages and trips', () => {
    expect(routeFadeKey('/trips/7/fund')).not.toBe(routeFadeKey('/trips/8/fund'));
    expect(routeFadeKey('/trips')).not.toBe(routeFadeKey('/trips/new'));
    expect(routeFadeKey('/home/')).toBe('/home');
  });
});

describe('isNavActive', () => {
  it('lights Trips inside a trip but not in the create flow', () => {
    expect(isNavActive(item('/trips'), '/trips')).toBe(true);
    expect(isNavActive(item('/trips'), '/trips/4/days')).toBe(true);
    expect(isNavActive(item('/trips'), '/trips/new')).toBe(false);
  });

  it('matches only its own section', () => {
    expect(isNavActive(item('/home'), '/home')).toBe(true);
    expect(isNavActive(item('/home'), '/trips')).toBe(false);
    expect(isNavActive(item('/me'), '/me')).toBe(true);
    expect(isNavActive(item('/me'), '/messages')).toBe(false);
  });

  it('numbers the rail rows in order', () => {
    expect(NAV_ITEMS.map((n) => `${n.index} ${n.label}`)).toEqual(['01 Home', '02 Trips', '03 Passport', '04 Me']);
  });
});

describe('defaultChrome', () => {
  it('titles each section', () => {
    expect(defaultChrome('/home')).toMatchObject({ title: 'Home', brand: true });
    expect(defaultChrome('/trips').title).toBe('Trips');
    expect(defaultChrome('/passport').title).toBe('Passport');
    expect(defaultChrome('/me').title).toBe('Me');
  });

  it('gives trips a way back and hides the bar while creating', () => {
    expect(defaultChrome('/trips/3/ledger')).toMatchObject({ backTo: '/trips', title: '' });
    expect(defaultChrome('/trips/new')).toMatchObject({ backTo: '/trips', hideBottomBar: true, title: 'Start a tabung' });
  });
});

describe('withParam', () => {
  it('adds or replaces a param and keeps the rest', () => {
    expect(withParam('', 'sheet', 'log-spend')).toBe('?sheet=log-spend');
    expect(withParam('?day=2026-11-14', 'sheet', 'log-spend')).toBe('?day=2026-11-14&sheet=log-spend');
    expect(withParam('?sheet=logbook&cat=food', 'sheet', 'edit')).toBe('?sheet=edit&cat=food');
  });
});
