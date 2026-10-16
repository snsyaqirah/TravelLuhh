// Live FX from Frankfurter v2 (https://api.frankfurter.dev/v2), called straight from the browser.
// Verified 15 Oct 2026: GET /rates?base=MYR → [{date, base, quote, rate}] (~165 quotes, dates may differ by a
// day per quote); &quotes=JPY,USD filters; &from=&to= returns one row per quote per day.
// One fetch per base is cached for 12 h (memory + localStorage travelluhh_fx_<BASE>), so converters can call
// these per keystroke without hitting the network.
import axios from 'axios';
import type { Rates } from '@/types';
import { rateBetween, currencyPrefix } from '@/lib/money';
import { CURRENCY_CODES, getCurrencyName } from '@/lib/currency';

const FX_API = 'https://api.frankfurter.dev/v2';
export const FX_TTL_MS = 12 * 60 * 60 * 1000;
const FX_KEY = (base: string) => `travelluhh_fx_${base}`;
const FAV_KEY = 'travelluhh_fav_currencies';
const LEGACY_FAV_KEY = 'favorite_currencies';
const MAX_FAVORITES = 4;
export const DEFAULT_FAVORITES: readonly string[] = ['SGD', 'JPY', 'THB', 'USD', 'MYR'];

/** @deprecated Same shape as Rates. */
export type ExchangeRates = Rates;

export interface CachedRates {
  rates: Rates;
  /** When we fetched it (ms epoch), not the publication date. */
  fetchedAt: number;
}

export interface RatePoint {
  date: string;
  rate: number;
}

interface FxRow {
  date: string;
  base: string;
  quote: string;
  rate: number;
}

const memory = new Map<string, CachedRates>();
const inflight = new Map<string, Promise<Rates>>();

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // quota or blocked storage: memory cache still works
  }
}

/** Last rates we have for `base`, however old. */
export function readCachedRates(base: string): CachedRates | null {
  const b = base.toUpperCase();
  const mem = memory.get(b);
  if (mem) return mem;
  const raw = readStorage(FX_KEY(b));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { date?: string; rates?: Record<string, number>; fetchedAt?: number };
    if (!parsed || typeof parsed.rates !== 'object' || !parsed.rates) return null;
    const cached: CachedRates = {
      rates: { base: b, date: parsed.date ?? '', rates: parsed.rates },
      fetchedAt: typeof parsed.fetchedAt === 'number' ? parsed.fetchedAt : 0,
    };
    memory.set(b, cached);
    return cached;
  } catch {
    return null;
  }
}

function writeCache(rates: Rates): CachedRates {
  const cached = { rates, fetchedAt: Date.now() };
  memory.set(rates.base, cached);
  writeStorage(FX_KEY(rates.base), JSON.stringify({ date: rates.date, rates: rates.rates, fetchedAt: cached.fetchedAt }));
  return cached;
}

function reshape(base: string, rows: FxRow[]): Rates {
  const rates: Record<string, number> = { [base]: 1 };
  let date = '';
  for (const r of rows) {
    if (typeof r.rate === 'number' && Number.isFinite(r.rate) && r.rate > 0) rates[r.quote] = r.rate;
    if (r.date > date) date = r.date;
  }
  return { base, date, rates };
}

async function fetchLatest(base: string): Promise<Rates> {
  const res = await axios.get<FxRow[]>(`${FX_API}/rates`, { params: { base }, timeout: 10000 });
  const rows = Array.isArray(res.data) ? res.data : [];
  if (rows.length === 0) throw new Error(`No rates published for ${base}`);
  return reshape(base, rows);
}

export interface CurrencyInfo {
  code: string;
  name: string;
  /** Unambiguous display prefix (lib/money): 'RM', '¥', otherwise the ISO code. */
  symbol: string;
  /** @deprecated No flags (no emoji). Holds a 2-letter code for older components. */
  flag: string;
}

export const CURRENCY_INFO: Record<string, CurrencyInfo> = Object.fromEntries(
  CURRENCY_CODES.map((code) => [
    code,
    { code, name: getCurrencyName(code), symbol: currencyPrefix(code), flag: code.slice(0, 2) },
  ])
);

export const currencyService = {
  /**
   * Latest rates with `base` as the unit (rates[X] = X per 1 base). Served from cache when younger than
   * maxAgeMs (12 h); concurrent calls share one request.
   */
  async getLatestRates(baseCurrency: string, opts: { force?: boolean; maxAgeMs?: number } = {}): Promise<Rates> {
    const base = baseCurrency.toUpperCase();
    const maxAge = opts.maxAgeMs ?? FX_TTL_MS;
    if (!opts.force) {
      const cached = readCachedRates(base);
      if (cached && Date.now() - cached.fetchedAt < maxAge) return cached.rates;
    }
    let p = inflight.get(base);
    if (!p) {
      p = fetchLatest(base)
        .then((rates) => writeCache(rates).rates)
        .finally(() => inflight.delete(base));
      inflight.set(base, p);
    }
    return p;
  },

  /** 1 `from` = rate × `to`, from cached tables. null when Frankfurter has no rate for the pair. */
  async getRate(from: string, to: string): Promise<{ rate: number; date: string } | null> {
    const f = from.toUpperCase();
    const t = to.toUpperCase();
    if (f === t) return { rate: 1, date: '' };
    const rates = await currencyService.getLatestRates(f);
    const rate = rateBetween(f, t, rates);
    return rate == null ? null : { rate, date: rates.date };
  },

  /** Converts with cached rates. Throws when there is no rate (never falls back to 1:1). */
  async convertCurrency(amount: number, fromCurrency: string, toCurrency: string): Promise<number> {
    if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) return amount;
    const r = await currencyService.getRate(fromCurrency, toCurrency);
    if (!r) throw new Error(`No rate for ${toCurrency.toUpperCase()} today`);
    return amount * r.rate;
  },

  /** Daily series per quote, oldest first, for sparklines and 7-day deltas. */
  async getRateHistory(base: string, quotes: string[], from: string, to: string): Promise<Record<string, RatePoint[]>> {
    const b = base.toUpperCase();
    const q = quotes.map((c) => c.toUpperCase()).filter((c) => c !== b);
    const out: Record<string, RatePoint[]> = {};
    if (q.length === 0) return out;
    const res = await axios.get<FxRow[]>(`${FX_API}/rates`, {
      params: { base: b, quotes: q.join(','), from, to },
      timeout: 10000,
    });
    for (const row of Array.isArray(res.data) ? res.data : []) {
      (out[row.quote] ??= []).push({ date: row.date, rate: row.rate });
    }
    for (const k of Object.keys(out)) out[k].sort((a, c) => a.date.localeCompare(c.date));
    return out;
  },

  /** code → name for every currency Frankfurter knows; falls back to the local catalogue offline. */
  async getAvailableCurrencies(): Promise<Record<string, string>> {
    try {
      const res = await axios.get<{ iso_code: string; name: string }[]>(`${FX_API}/currencies`, { timeout: 10000 });
      const result: Record<string, string> = {};
      for (const c of res.data ?? []) result[c.iso_code] = c.name;
      return result;
    } catch {
      return Object.fromEntries(CURRENCY_CODES.map((c) => [c, getCurrencyName(c)]));
    }
  },

  getCurrencyInfo(code: string): CurrencyInfo {
    const c = code.toUpperCase();
    return CURRENCY_INFO[c] ?? { code: c, name: getCurrencyName(c), symbol: currencyPrefix(c), flag: c.slice(0, 2) };
  },

  // ── Favourites (Rates board on Home and Me) ─────────────────────────────────

  getFavorites(): string[] {
    const raw = readStorage(FAV_KEY) ?? readStorage(LEGACY_FAV_KEY);
    if (!raw) return [];
    try {
      const list = JSON.parse(raw);
      return Array.isArray(list)
        ? list.filter((c): c is string => typeof c === 'string' && /^[A-Z]{3}$/.test(c)).slice(0, MAX_FAVORITES)
        : [];
    } catch {
      return [];
    }
  },

  /** Saved favourites, or sensible defaults; never includes `home`. */
  getFavoritesOrDefault(home: string | null | undefined, count = 3): string[] {
    const h = (home ?? '').toUpperCase();
    const saved = currencyService.getFavorites().filter((c) => c !== h);
    const list = saved.length > 0 ? saved : DEFAULT_FAVORITES.filter((c) => c !== h);
    return list.slice(0, count);
  },

  saveFavorites(currencies: string[]): void {
    const clean = Array.from(new Set(currencies.map((c) => c.toUpperCase()))).slice(0, MAX_FAVORITES);
    writeStorage(FAV_KEY, JSON.stringify(clean));
  },

  /** Adds or removes; at most 4 favourites. Returns the new list. */
  toggleFavorite(currencyCode: string): string[] {
    const code = currencyCode.toUpperCase();
    let favorites = currencyService.getFavorites();
    if (favorites.includes(code)) favorites = favorites.filter((c) => c !== code);
    else if (favorites.length < MAX_FAVORITES) favorites = [...favorites, code];
    currencyService.saveFavorites(favorites);
    return favorites;
  },

  isFavorite(currencyCode: string): boolean {
    return currencyService.getFavorites().includes(currencyCode.toUpperCase());
  },
};
