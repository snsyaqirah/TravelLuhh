// Passport numbers (§9.7), pure. Only trips that are home count: their dates are behind you. Archived trips
// count too: they were still taken. Money is converted to the home currency with toHome; when a rate is
// missing the total is null and the per-currency lines are what the page shows instead of a fake sum.
import type { Rates, Region, Trip } from '@/types';
import { computeFund } from '@/hooks/useFund';
import { getPhase, tripDays } from '@/lib/phase';
import { isValidDate, parseLocalDate } from '@/lib/dates';
import { roundMoney, toHome } from '@/lib/money';
import { getCountryByCode, getRegion } from '@/data/countries';
import { regionOf } from '@/components/motifs/regions';

export type PassportTrip = Pick<Trip, 'id' | 'name' | 'destinationCountry' | 'startDate' | 'endDate' | 'budget' | 'currency'> &
  Partial<Pick<Trip, 'totalExpenses' | 'spentAmount' | 'savedAmount' | 'isArchived'>>;

export type PassportYear = number | 'all';

const norm = (c: string | null | undefined) => (c ?? '').trim().toUpperCase();

function num(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? v : 0;
}

/** Year a trip is stamped in: the year it came home. 0 when the end date can't be read. */
export function tripYear(t: Pick<Trip, 'endDate'>): number {
  const d = parseLocalDate(t.endDate);
  return isValidDate(d) ? d.getFullYear() : 0;
}

/** Active and archived lists merged (one row per id, the later list wins). */
export function mergeTrips<T extends { id: number }>(...lists: ReadonlyArray<ReadonlyArray<T> | undefined>): T[] {
  const byId = new Map<number, T>();
  for (const list of lists) for (const t of list ?? []) byId.set(t.id, t);
  return [...byId.values()];
}

/** Trips that are home, newest homecoming first. */
export function homeTrips<T extends PassportTrip>(trips: ReadonlyArray<T>, today: Date): T[] {
  return trips
    .filter((t) => getPhase(t, today) === 'home' && tripYear(t) > 0)
    .sort((a, b) => b.endDate.localeCompare(a.endDate) || b.startDate.localeCompare(a.startDate) || b.id - a.id);
}

/** Years with at least one trip home, newest first. */
export function passportYears(home: ReadonlyArray<PassportTrip>): number[] {
  return [...new Set(home.map(tripYear))].filter((y) => y > 0).sort((a, b) => b - a);
}

/** ?year= → a year we have, 'all', or the newest year (all when there are none). */
export function parseYearParam(raw: string | null | undefined, years: readonly number[]): PassportYear {
  if (raw === 'all') return 'all';
  const n = Number(raw);
  if (raw && Number.isInteger(n) && years.includes(n)) return n;
  return years[0] ?? 'all';
}

export function tripsInYear<T extends PassportTrip>(home: ReadonlyArray<T>, year: PassportYear): T[] {
  return year === 'all' ? [...home] : home.filter((t) => tripYear(t) === year);
}

/** What was spent (trip currency), never negative. */
export function tripSpent(t: PassportTrip): number {
  return Math.max(0, num(t.totalExpenses ?? t.spentAmount ?? 0));
}

/** Baki: what was left in the jar when the trip came home (same rule as the ticket and Home). */
export function tripBaki(t: PassportTrip, today: Date): number {
  return computeFund(t, today).inJar;
}

export interface CurrencyAmount {
  currency: string;
  amount: number;
}

export interface MoneyTotal {
  /** Sum in the home currency; null when any amount had no rate. */
  total: number | null;
  /** Some of it was converted from another currency. */
  approx: boolean;
  /** The same money per currency (trip currencies), biggest first. */
  byCurrency: CurrencyAmount[];
}

export interface PassportStats {
  trips: number;
  countries: number;
  daysAway: number;
  spent: MoneyTotal;
  baki: MoneyTotal;
  /** spent ÷ days away, home currency. null when spent can't be summed or there are no days. */
  avgPerDay: number | null;
  home: string;
  /** Currencies with no rate to the home currency right now. */
  missing: string[];
}

function totalOf(parts: Array<{ amount: number; currency: string }>, home: string, rates: Rates | null | undefined, missing: Set<string>): MoneyTotal {
  const per = new Map<string, number>();
  let total = 0;
  let approx = false;
  let broken = false;
  for (const p of parts) {
    const c = norm(p.currency) || home;
    per.set(c, (per.get(c) ?? 0) + p.amount);
    if (p.amount === 0) continue;
    const conv = toHome(p.amount, c, rates, home);
    if (conv == null) {
      broken = true;
      missing.add(c);
      continue;
    }
    if (c !== home) approx = true;
    total += conv;
  }
  const byCurrency = [...per.entries()]
    .map(([currency, amount]) => ({ currency, amount: roundMoney(amount, currency) }))
    .sort((a, b) => (a.currency === home ? -1 : b.currency === home ? 1 : b.amount - a.amount));
  return { total: broken ? null : roundMoney(total, home), approx, byCurrency };
}

/** Numbers for the strip. `trips` should already be the home trips in scope (a year or all). */
export function computePassportStats(
  trips: ReadonlyArray<PassportTrip>,
  homeCurrency: string,
  rates: Rates | null | undefined,
  today: Date,
): PassportStats {
  const home = norm(homeCurrency) || 'MYR';
  const missing = new Set<string>();
  const countries = new Set(trips.map((t) => norm(t.destinationCountry)).filter(Boolean));
  const daysAway = trips.reduce((s, t) => s + Math.max(1, tripDays(t)), 0);
  const spent = totalOf(
    trips.map((t) => ({ amount: tripSpent(t), currency: t.currency })),
    home,
    rates,
    missing,
  );
  const baki = totalOf(
    trips.map((t) => ({ amount: tripBaki(t, today), currency: t.currency })),
    home,
    rates,
    missing,
  );
  return {
    trips: trips.length,
    countries: countries.size,
    daysAway,
    spent,
    baki,
    avgPerDay: spent.total != null && daysAway > 0 ? spent.total / daysAway : null,
    home,
    missing: [...missing].sort(),
  };
}

/** Σ baki ÷ Σ target in the home currency, 0..1 (the Me page's lifetime balang). 0 when it can't be summed. */
export function lifetimeFill(trips: ReadonlyArray<PassportTrip>, homeCurrency: string, rates: Rates | null | undefined, today: Date): number {
  const home = norm(homeCurrency) || 'MYR';
  let baki = 0;
  let target = 0;
  for (const t of trips) {
    const budget = Math.max(0, num(t.budget));
    if (budget <= 0) continue;
    const b = toHome(tripBaki(t, today), t.currency, rates, home);
    const g = toHome(budget, t.currency, rates, home);
    if (b == null || g == null) return 0;
    baki += b;
    target += g;
  }
  return target > 0 ? Math.min(Math.max(baki / target, 0), 1) : 0;
}

export interface CountryStamp {
  code: string;
  name: string;
  region: Region;
  /** Start date of the first trip there (in scope). */
  first: string;
  /** End date of the latest trip there (in scope). */
  last: string;
  visits: number;
  /** Trip id of the first visit: seeds the stamp's angle so it never changes between renders. */
  seedTrip: number;
}

/** One stamp per country, in the order they were first visited (a passport fills page by page). */
export function countryStamps(trips: ReadonlyArray<PassportTrip>): CountryStamp[] {
  const by = new Map<string, CountryStamp>();
  const ordered = [...trips].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id - b.id);
  for (const t of ordered) {
    const code = norm(t.destinationCountry);
    if (!code) continue;
    const seen = by.get(code);
    if (seen) {
      seen.visits += 1;
      if (t.endDate > seen.last) seen.last = t.endDate;
      continue;
    }
    by.set(code, {
      code,
      name: getCountryByCode(code)?.name ?? code,
      region: getRegion(code) ?? regionOf(code),
      first: t.startDate,
      last: t.endDate,
      visits: 1,
      seedTrip: t.id,
    });
  }
  return [...by.values()];
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** 'AUG 2026' */
export function monthYear(iso: string): string {
  const d = parseLocalDate(iso);
  return isValidDate(d) ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '';
}
