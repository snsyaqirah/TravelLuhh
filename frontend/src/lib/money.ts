// Money formatting and conversion (spec §4). Every figure in the app goes through here so prefixes, decimals
// and negatives look the same everywhere: 'RM 1,250.00', '¥ 3,200', '−RM 240.00', '≈ SGD 40.00'.
import type { Rates } from '@/types';

export type { Rates } from '@/types';

const NBSP = '\u00A0';
const MINUS = '−';

/** Unambiguous symbols. Everything else shows its ISO code; '$' alone is never used. */
const SYMBOLS: Record<string, string> = {
  MYR: 'RM',
  JPY: '¥',
  CNY: 'CN¥',
  KRW: '₩',
  THB: '฿',
  GBP: '£',
  EUR: '€',
  INR: '₹',
  PHP: '₱',
  VND: '₫',
  IDR: 'Rp',
};

/** Currencies shown without minor units. */
const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'IDR', 'CLP', 'COP']);

const formatters = new Map<number, Intl.NumberFormat>();
function numberFormat(d: number): Intl.NumberFormat {
  let f = formatters.get(d);
  if (!f) {
    f = new Intl.NumberFormat('en-MY', { minimumFractionDigits: d, maximumFractionDigits: d });
    formatters.set(d, f);
  }
  return f;
}

function normCode(currency: string | null | undefined): string {
  return (currency ?? '').trim().toUpperCase();
}

/** 'RM', '¥', or the ISO code. Empty string when the currency is unknown/missing. */
export function currencyPrefix(currency: string | null | undefined): string {
  const code = normCode(currency);
  return SYMBOLS[code] ?? code;
}

/** 0 for JPY, KRW, VND, IDR, CLP, COP; 2 otherwise. */
export function currencyDecimals(currency: string | null | undefined): number {
  return ZERO_DECIMAL.has(normCode(currency)) ? 0 : 2;
}

/** Round to the currency's minor unit (2 dp, or whole units for JPY and friends). */
export function roundMoney(amount: number, currency: string | null | undefined): number {
  if (!Number.isFinite(amount)) return 0;
  const f = 10 ** currencyDecimals(currency);
  // toPrecision(15) absorbs float noise (1.005 × 100 = 100.49999…); rounding is half away from zero.
  const scaled = Number((Math.abs(amount) * f).toPrecision(15));
  const r = (Math.sign(amount) * Math.round(scaled)) / f;
  return Object.is(r, -0) ? 0 : r;
}

export interface FormatMoneyOptions {
  /** Prefix with '≈ ' (converted figures). */
  approx?: boolean;
  /** Show '+' on positive amounts (passbook IN/OUT columns). */
  signed?: boolean;
  /**
   * undefined: the currency's decimals. 'auto': hero rule, drop decimals when |n| ≥ 1000 and the amount is
   * whole. 'none': always round to whole units.
   */
  decimals?: 'auto' | 'none';
}

function resolveDecimals(abs: number, currency: string, mode: FormatMoneyOptions['decimals']): number {
  const d = currencyDecimals(currency);
  if (mode === 'none') return 0;
  if (mode === 'auto' && d > 0 && abs >= 1000 && Math.abs(abs - Math.round(abs)) < 0.005) return 0;
  return d;
}

/** 'RM 1,250.00' · '−RM 240.00' · '≈ ¥ 98,200' · '+SGD 40.00'. Non-finite input renders as 'RM —'. */
export function formatMoney(
  amount: number,
  currency: string | null | undefined,
  o: FormatMoneyOptions = {}
): string {
  const prefix = currencyPrefix(currency);
  const head = (o.approx ? `≈${NBSP}` : '');
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    return `${head}${prefix ? prefix + NBSP : ''}—`;
  }
  const abs = Math.abs(value);
  const d = resolveDecimals(abs, normCode(currency), o.decimals);
  const text = numberFormat(d).format(abs);
  // Decide the sign from what is displayed, so −0.001 never shows as '−RM 0.00'.
  const shownZero = Number(text.replace(/,/g, '')) === 0;
  const sign = shownZero ? '' : value < 0 ? MINUS : o.signed ? '+' : '';
  return `${head}${sign}${prefix ? prefix + NBSP : ''}${text}`;
}

export interface MoneyParts {
  /** 'RM', '¥', 'SGD' — no sign. */
  prefix: string;
  /** Integer part with grouping, no sign: '2,340'. */
  int: string;
  /** Decimal part including its separator ('.50'), or null when no decimals are shown. */
  dec: string | null;
  negative: boolean;
}

/**
 * Parts for the hero layout: small prefix, big integer, small decimals. Uses the hero decimals rule
 * ('auto') unless told otherwise.
 */
export function splitMoney(
  amount: number,
  currency: string | null | undefined,
  o: { decimals?: 'auto' | 'none' | 'fixed' } = {}
): MoneyParts {
  const prefix = currencyPrefix(currency);
  const value = Number(amount);
  if (!Number.isFinite(value)) return { prefix, int: '—', dec: null, negative: false };
  const abs = Math.abs(value);
  const mode = o.decimals === 'fixed' ? undefined : (o.decimals ?? 'auto');
  const d = resolveDecimals(abs, normCode(currency), mode);
  const text = numberFormat(d).format(abs);
  const dot = text.lastIndexOf('.');
  const int = d > 0 && dot >= 0 ? text.slice(0, dot) : text;
  const dec = d > 0 && dot >= 0 ? text.slice(dot) : null;
  const shownZero = Number(text.replace(/,/g, '')) === 0;
  return { prefix, int, dec, negative: value < 0 && !shownZero };
}

/** Smallest of {1, 2, 5} × 10^k that is ≥ x, never below 1. Used for "1 coin = RM 20" units. */
export function niceUnit(x: number): number {
  if (!Number.isFinite(x) || x <= 1) return 1;
  const k = Math.floor(Math.log10(x));
  const base = 10 ** k;
  for (const m of [1, 2, 5, 10]) {
    const c = m * base;
    // tolerance for float noise such as 3 × 0.1
    if (c >= x * (1 - 1e-9)) return Math.round(c);
  }
  return Math.round(10 * base);
}

/**
 * Rate that turns 1 unit of `from` into `to` using one Rates table (any base). null if either side is missing.
 */
export function rateBetween(from: string, to: string, rates: Rates | null | undefined): number | null {
  const f = normCode(from);
  const t = normCode(to);
  if (f && f === t) return 1;
  if (!rates || !rates.rates) return null;
  const base = normCode(rates.base);
  const perBase = (code: string): number | null => {
    if (code === base) return 1;
    const r = rates.rates[code];
    return typeof r === 'number' && Number.isFinite(r) && r > 0 ? r : null;
  };
  const rf = perBase(f);
  const rt = perBase(t);
  if (rf == null || rt == null) return null;
  return rt / rf;
}

/** Convert between any two currencies covered by `rates`. null if a rate is missing. */
export function convertMoney(
  amount: number,
  from: string,
  to: string,
  rates: Rates | null | undefined
): number | null {
  if (!Number.isFinite(amount)) return null;
  const r = rateBetween(from, to, rates);
  return r == null ? null : amount * r;
}

/**
 * Amount in `from` → the rates' base (the home currency). null when the rate is missing, so callers can show
 * per-currency lines instead of a fake sum. Pass `home` to keep same-currency amounts even with no rates.
 */
export function toHome(
  amount: number,
  from: string,
  rates: Rates | null | undefined,
  home?: string
): number | null {
  if (home && normCode(from) === normCode(home)) return Number.isFinite(amount) ? amount : null;
  if (!rates) return null;
  return convertMoney(amount, from, rates.base, rates);
}

export interface TripCurrencyAmount {
  /** Trip currency, rounded to its minor unit. */
  amount: number;
  currency: string;
  originalAmount: number;
  originalCurrency: string;
  /** originalAmount × fxRate ≈ amount; undefined when no conversion was needed. */
  fxRate?: number;
}

/**
 * Builds the money fields of an expense (§2.6): what was paid (`paid`, in any currency) becomes an amount in
 * the trip currency plus the original and the rate used. `manualRate` (trip units per 1 paid unit) wins over
 * `rates`, for money-changer cash. null when no rate is available.
 */
export function toTripCurrency(
  paid: { amount: number; currency: string },
  tripCurrency: string,
  rates: Rates | null | undefined,
  manualRate?: number | null
): TripCurrencyAmount | null {
  const from = normCode(paid.currency);
  const to = normCode(tripCurrency);
  if (!Number.isFinite(paid.amount)) return null;
  if (from === to) {
    const amount = roundMoney(paid.amount, to);
    return { amount, currency: to, originalAmount: amount, originalCurrency: to };
  }
  const rate =
    manualRate != null && Number.isFinite(manualRate) && manualRate > 0
      ? manualRate
      : rateBetween(from, to, rates);
  if (rate == null) return null;
  return {
    amount: roundMoney(paid.amount * rate, to),
    currency: to,
    originalAmount: roundMoney(paid.amount, from),
    originalCurrency: from,
    fxRate: Number(rate.toPrecision(8)),
  };
}

/**
 * Parse what someone typed into a money field: '1,250.50', 'RM 40', '¥3200', '−12'. Grouping commas and
 * currency prefixes are ignored. Rounded to the currency's minor unit when a currency is given.
 * Returns null for empty or unparseable input.
 */
export function parseMoneyInput(input: string | number | null | undefined, currency?: string): number | null {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? (currency ? roundMoney(input, currency) : input) : null;
  }
  if (input == null) return null;
  let s = String(input).trim().replace(/[\s\u00A0]/g, '');
  if (!s) return null;
  let negative = false;
  if (/^[-−]/.test(s)) {
    negative = true;
    s = s.slice(1);
  }
  // Strip a leading currency prefix/symbol (RM, SGD, ¥, Rp, CN¥ …) and a sign that comes after it.
  s = s.replace(/^[^\d.,\-−]+/, '');
  if (/^[-−]/.test(s)) {
    negative = !negative;
    s = s.slice(1);
  }
  // A lone comma followed by 1–2 digits is a decimal comma ('12,5'); otherwise commas group thousands.
  if (!s.includes('.') && /^\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.');
  s = s.replace(/,/g, '');
  if (!/^\d*\.?\d*$/.test(s) || s === '' || s === '.') return null;
  const n = Number(s) * (negative ? -1 : 1);
  if (!Number.isFinite(n)) return null;
  const r = currency ? roundMoney(n, currency) : n;
  return Object.is(r, -0) ? 0 : r;
}

/** Exchange rate for display: '38.78', '0.2450', '6,333'. */
export function formatRate(rate: number): string {
  if (!Number.isFinite(rate)) return '—';
  const abs = Math.abs(rate);
  const d = abs >= 1000 ? 0 : abs >= 1 ? 2 : 4;
  return numberFormat(d).format(rate);
}
