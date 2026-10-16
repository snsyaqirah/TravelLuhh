import { describe, expect, it } from 'vitest';
import {
  convertMoney,
  currencyDecimals,
  currencyPrefix,
  formatMoney,
  formatRate,
  niceUnit,
  parseMoneyInput,
  rateBetween,
  roundMoney,
  splitMoney,
  toHome,
  toTripCurrency,
} from './money';
import type { Rates } from '@/types';

const NB = '\u00A0';
const MINUS = '−';

describe('currencyPrefix', () => {
  it('uses RM and the unambiguous symbols', () => {
    expect(currencyPrefix('MYR')).toBe('RM');
    expect(currencyPrefix('JPY')).toBe('¥');
    expect(currencyPrefix('CNY')).toBe('CN¥');
    expect(currencyPrefix('KRW')).toBe('₩');
    expect(currencyPrefix('THB')).toBe('฿');
    expect(currencyPrefix('GBP')).toBe('£');
    expect(currencyPrefix('EUR')).toBe('€');
    expect(currencyPrefix('INR')).toBe('₹');
    expect(currencyPrefix('PHP')).toBe('₱');
    expect(currencyPrefix('VND')).toBe('₫');
    expect(currencyPrefix('IDR')).toBe('Rp');
  });
  it('never uses a bare $: dollar currencies show their ISO code', () => {
    for (const c of ['USD', 'SGD', 'AUD', 'HKD', 'TWD', 'CAD', 'NZD']) expect(currencyPrefix(c)).toBe(c);
  });
  it('is case-insensitive and empty for a missing currency', () => {
    expect(currencyPrefix('myr')).toBe('RM');
    expect(currencyPrefix(undefined)).toBe('');
  });
});

describe('currencyDecimals', () => {
  it('is 0 for JPY, KRW, VND, IDR, CLP, COP and 2 otherwise', () => {
    for (const c of ['JPY', 'KRW', 'VND', 'IDR', 'CLP', 'COP']) expect(currencyDecimals(c)).toBe(0);
    for (const c of ['MYR', 'USD', 'SGD', 'THB', 'EUR']) expect(currencyDecimals(c)).toBe(2);
  });
});

describe('formatMoney', () => {
  it('formats with a non-breaking space between prefix and number', () => {
    expect(formatMoney(1250, 'MYR')).toBe(`RM${NB}1,250.00`);
    expect(formatMoney(40, 'SGD')).toBe(`SGD${NB}40.00`);
    expect(formatMoney(0, 'MYR')).toBe(`RM${NB}0.00`);
  });
  it('drops minor units for JPY, KRW and IDR', () => {
    expect(formatMoney(3200, 'JPY')).toBe(`¥${NB}3,200`);
    expect(formatMoney(98200.6, 'JPY')).toBe(`¥${NB}98,201`);
    expect(formatMoney(15000, 'KRW')).toBe(`₩${NB}15,000`);
    expect(formatMoney(1250000, 'IDR')).toBe(`Rp${NB}1,250,000`);
  });
  it('puts U+2212 before the prefix for negatives', () => {
    expect(formatMoney(-240, 'MYR')).toBe(`${MINUS}RM${NB}240.00`);
    expect(formatMoney(-240, 'MYR')).not.toContain('-');
  });
  it('never shows a negative zero', () => {
    expect(formatMoney(-0.001, 'MYR')).toBe(`RM${NB}0.00`);
    expect(formatMoney(-0.4, 'JPY')).toBe(`¥${NB}0`);
  });
  it('supports approx and signed', () => {
    expect(formatMoney(38.4, 'MYR', { approx: true })).toBe(`≈${NB}RM${NB}38.40`);
    expect(formatMoney(40, 'SGD', { signed: true })).toBe(`+SGD${NB}40.00`);
    expect(formatMoney(-40, 'SGD', { signed: true })).toBe(`${MINUS}SGD${NB}40.00`);
    expect(formatMoney(0, 'SGD', { signed: true })).toBe(`SGD${NB}0.00`);
  });
  it('hero decimals: auto drops .00 from whole amounts of 1,000 or more', () => {
    expect(formatMoney(4000, 'MYR', { decimals: 'auto' })).toBe(`RM${NB}4,000`);
    expect(formatMoney(4000.5, 'MYR', { decimals: 'auto' })).toBe(`RM${NB}4,000.50`);
    expect(formatMoney(312, 'MYR', { decimals: 'auto' })).toBe(`RM${NB}312.00`);
    expect(formatMoney(312.4, 'MYR', { decimals: 'none' })).toBe(`RM${NB}312`);
  });
  it('renders non-finite input as a dash, never NaN', () => {
    expect(formatMoney(NaN, 'MYR')).toBe(`RM${NB}—`);
    expect(formatMoney(Infinity, 'MYR')).not.toContain('Infinity');
  });
});

describe('splitMoney', () => {
  it('splits prefix, integer and decimals', () => {
    expect(splitMoney(2340.5, 'MYR')).toEqual({ prefix: 'RM', int: '2,340', dec: '.50', negative: false });
    expect(splitMoney(4000, 'MYR')).toEqual({ prefix: 'RM', int: '4,000', dec: null, negative: false });
    expect(splitMoney(98200, 'JPY')).toEqual({ prefix: '¥', int: '98,200', dec: null, negative: false });
    expect(splitMoney(-240, 'MYR')).toEqual({ prefix: 'RM', int: '240', dec: '.00', negative: true });
  });
  it('can keep fixed decimals', () => {
    expect(splitMoney(4000, 'MYR', { decimals: 'fixed' }).dec).toBe('.00');
  });
});

describe('niceUnit', () => {
  it('returns the smallest 1/2/5 × 10^k at or above x, minimum 1', () => {
    expect(niceUnit(0)).toBe(1);
    expect(niceUnit(0.3)).toBe(1);
    expect(niceUnit(1)).toBe(1);
    expect(niceUnit(1.1)).toBe(2);
    expect(niceUnit(2)).toBe(2);
    expect(niceUnit(3)).toBe(5);
    expect(niceUnit(6)).toBe(10);
    expect(niceUnit(18.6)).toBe(20);
    expect(niceUnit(20)).toBe(20);
    expect(niceUnit(120)).toBe(200);
    expect(niceUnit(500)).toBe(500);
    expect(niceUnit(501)).toBe(1000);
    expect(niceUnit(1000)).toBe(1000);
    expect(niceUnit(NaN)).toBe(1);
    expect(niceUnit(-5)).toBe(1);
  });
});

describe('roundMoney', () => {
  it('rounds half away from zero to the minor unit', () => {
    expect(roundMoney(1.005, 'MYR')).toBe(1.01);
    expect(roundMoney(-1.005, 'MYR')).toBe(-1.01);
    expect(roundMoney(3199.5, 'JPY')).toBe(3200);
    expect(roundMoney(NaN, 'MYR')).toBe(0);
  });
});

const myrRates: Rates = { base: 'MYR', date: '2026-10-15', rates: { MYR: 1, JPY: 38.784, USD: 0.24495, SGD: 0.31425 } };

describe('conversion', () => {
  it('toHome divides by the base rate and returns null for a missing rate', () => {
    expect(toHome(3878.4, 'JPY', myrRates)).toBeCloseTo(100, 6);
    expect(toHome(100, 'MYR', myrRates)).toBe(100);
    expect(toHome(100, 'VND', myrRates)).toBeNull();
    expect(toHome(100, 'JPY', null)).toBeNull();
  });
  it('toHome keeps same-currency amounts without rates when home is given', () => {
    expect(toHome(100, 'MYR', null, 'MYR')).toBe(100);
  });
  it('cross rates go through the base', () => {
    expect(rateBetween('SGD', 'JPY', myrRates)).toBeCloseTo(38.784 / 0.31425, 9);
    expect(convertMoney(10, 'USD', 'SGD', myrRates)).toBeCloseTo((10 / 0.24495) * 0.31425, 9);
    expect(rateBetween('USD', 'USD', null)).toBe(1);
  });
  it('toTripCurrency converts paid money into the trip currency with the rate used', () => {
    const r = toTripCurrency({ amount: 3200, currency: 'JPY' }, 'MYR', myrRates);
    expect(r).not.toBeNull();
    expect(r!.currency).toBe('MYR');
    expect(r!.amount).toBe(82.51);
    expect(r!.originalAmount).toBe(3200);
    expect(r!.originalCurrency).toBe('JPY');
    expect(r!.originalAmount * (r!.fxRate as number)).toBeCloseTo(r!.amount, 1);
  });
  it('toTripCurrency passes same-currency amounts through and prefers a manual rate', () => {
    expect(toTripCurrency({ amount: 40, currency: 'MYR' }, 'MYR', null)).toEqual({
      amount: 40,
      currency: 'MYR',
      originalAmount: 40,
      originalCurrency: 'MYR',
    });
    expect(toTripCurrency({ amount: 1000, currency: 'JPY' }, 'MYR', null, 0.0262)!.amount).toBe(26.2);
    expect(toTripCurrency({ amount: 1000, currency: 'VND' }, 'MYR', myrRates)).toBeNull();
  });
});

describe('parseMoneyInput', () => {
  it('reads what people type', () => {
    expect(parseMoneyInput('1,250.50')).toBe(1250.5);
    expect(parseMoneyInput('RM 40')).toBe(40);
    expect(parseMoneyInput('¥3,200', 'JPY')).toBe(3200);
    expect(parseMoneyInput('12,5')).toBe(12.5);
    expect(parseMoneyInput('.5')).toBe(0.5);
    expect(parseMoneyInput('−12', 'MYR')).toBe(-12);
    expect(parseMoneyInput('10.256', 'MYR')).toBe(10.26);
    expect(parseMoneyInput(42)).toBe(42);
  });
  it('returns null for empty or junk', () => {
    expect(parseMoneyInput('')).toBeNull();
    expect(parseMoneyInput('   ')).toBeNull();
    expect(parseMoneyInput('abc')).toBeNull();
    expect(parseMoneyInput('1.2.3')).toBeNull();
    expect(parseMoneyInput('.')).toBeNull();
    expect(parseMoneyInput(null)).toBeNull();
  });
});

describe('formatRate', () => {
  it('scales decimals with the size of the rate', () => {
    expect(formatRate(38.784)).toBe('38.78');
    expect(formatRate(0.24495)).toBe('0.2450');
    expect(formatRate(6333)).toBe('6,333');
  });
});
