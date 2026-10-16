// Home's numbers (§9.3), pure so tests pin them: what's in the tabung across live trips (in the home currency,
// or per currency when a rate is missing, never a fake sum), the latest passbook entries across trips, and the
// passport strip totals.
import type { Expense, FundEntry, Rates, Trip } from '@/types';
import { computeFund } from '@/hooks/useFund';
import { getPhase, tripDays } from '@/lib/phase';
import { formatMoney, roundMoney, toHome } from '@/lib/money';
import { CATEGORY_CODES } from '@/lib/categories';
import type { PassbookRow } from '@/components/motifs/passbookMath';

type FundTrip = Pick<Trip, 'id' | 'name' | 'budget' | 'currency' | 'startDate' | 'endDate'> &
  Partial<Pick<Trip, 'totalExpenses' | 'spentAmount' | 'savedAmount' | 'isArchived' | 'destinationCountry'>>;

const norm = (c: string | null | undefined) => (c ?? '').trim().toUpperCase();

/** Upcoming and on-the-road trips that aren't archived: the jars still on the shelf. */
export function liveTripsOf<T extends FundTrip>(trips: readonly T[], today: Date): T[] {
  return trips.filter((t) => !t.isArchived && getPhase(t, today) !== 'home');
}

/** The status ticket's trip: on the road first (earliest start), else the next upcoming one. */
export function statusTrip<T extends FundTrip>(trips: readonly T[], today: Date): T | null {
  const live = liveTripsOf(trips, today);
  const byStart = (a: T, b: T) => a.startDate.localeCompare(b.startDate) || a.id - b.id;
  const road = live.filter((t) => getPhase(t, today) === 'onTheRoad').sort(byStart);
  if (road.length) return road[0];
  const upcoming = live.filter((t) => getPhase(t, today) === 'upcoming').sort(byStart);
  return upcoming[0] ?? null;
}

export interface CurrencyLine {
  currency: string;
  inJar: number;
  target: number;
  spent: number;
  trips: number;
}

export interface InTabung {
  /** Live trips counted. */
  trips: number;
  /**
   * Everything in the home currency, or null when any trip's rate is missing (then show `lines`).
   * target/spent/inJar feed one combined CoinRail.
   */
  total: { amount: number; target: number; spent: number; currency: string; approx: boolean } | null;
  /** Per trip currency, home currency first. Always filled. */
  lines: CurrencyLine[];
  /** Currencies with no rate to the home currency today. */
  missing: string[];
}

/** null when there are no live trips. */
export function inTabung(trips: readonly FundTrip[], today: Date, home: string, rates: Rates | null | undefined): InTabung | null {
  const live = liveTripsOf(trips, today);
  if (!live.length) return null;
  const h = norm(home);
  const byCur = new Map<string, CurrencyLine>();
  let amount = 0;
  let target = 0;
  let spent = 0;
  let approx = false;
  const missing = new Set<string>();
  for (const t of live) {
    const f = computeFund(t, today);
    const c = norm(t.currency);
    const line = byCur.get(c) ?? { currency: c, inJar: 0, target: 0, spent: 0, trips: 0 };
    line.inJar = roundMoney(line.inJar + f.inJar, c);
    line.target = roundMoney(line.target + f.target, c);
    line.spent = roundMoney(line.spent + f.spent, c);
    line.trips += 1;
    byCur.set(c, line);

    const conv = (n: number) => toHome(n, c, rates, h);
    const j = conv(f.inJar);
    const tg = conv(f.target);
    const sp = conv(f.spent);
    if (j == null || tg == null || sp == null) {
      missing.add(c);
      continue;
    }
    if (c !== h) approx = true;
    amount += j;
    target += tg;
    spent += sp;
  }
  const lines = [...byCur.values()].sort((a, b) => (a.currency === h ? -1 : b.currency === h ? 1 : a.currency.localeCompare(b.currency)));
  return {
    trips: live.length,
    total: missing.size
      ? null
      : { amount: roundMoney(amount, h), target: roundMoney(target, h), spent: roundMoney(spent, h), currency: h, approx },
    lines,
    missing: [...missing].sort(),
  };
}

// ---------------------------------------------------------------- latest entries

export interface EntrySource {
  trip: Pick<Trip, 'id' | 'currency' | 'destinationCountry' | 'name'>;
  expenses?: readonly Expense[] | null;
  fund?: readonly FundEntry[] | null;
}

/** A passbook row plus the trip it belongs to (the page adds the ISO chip glyph). */
export interface HomeEntry {
  row: PassbookRow;
  tripId: number;
  code: string;
  createdAt: string;
}

/**
 * The newest `limit` entries across trips, returned oldest first (the Passbook's order; show it with
 * newestFirst). Expenses are KELUAR; fund drops are MASUK, withdrawals KELUAR.
 */
export function latestEntries(sources: readonly EntrySource[], limit: number): HomeEntry[] {
  const all: HomeEntry[] = [];
  for (const { trip, expenses, fund } of sources) {
    const code = norm(trip.destinationCountry);
    for (const e of expenses ?? []) {
      all.push({
        tripId: trip.id,
        code,
        createdAt: e.createdAt ?? '',
        row: {
          id: `e${e.id}`,
          date: e.expenseDate,
          label: e.description || 'Spend',
          out: e.amount,
          sub: CATEGORY_CODES[e.category as keyof typeof CATEGORY_CODES] ?? undefined,
          originalAmount: e.originalAmount ?? null,
          originalCurrency: e.originalCurrency ?? null,
          currency: norm(trip.currency),
        },
      });
    }
    for (const f of fund ?? []) {
      const into = f.amount >= 0;
      all.push({
        tripId: trip.id,
        code,
        createdAt: f.createdAt ?? '',
        row: {
          id: `f${f.id}`,
          date: f.entryDate,
          label: f.note?.trim() || (into ? 'Into the tabung' : 'Out of the tabung'),
          ...(into ? { in: f.amount } : { out: -f.amount }),
          sub: 'FUND',
          currency: norm(trip.currency),
        },
      });
    }
  }
  const key = (x: HomeEntry) => `${x.row.date}|${x.createdAt}|${x.row.id}`;
  all.sort((a, b) => key(a).localeCompare(key(b)));
  return all.slice(Math.max(0, all.length - limit));
}

// ---------------------------------------------------------------- passport strip

export interface PassportStats {
  trips: number;
  countries: number;
  daysAway: number;
  /** Σ baki in the home currency; null when a rate is missing or nothing came back. */
  baki: number | null;
  approx: boolean;
  currency: string;
}

/** Trips that are home (archived ones count: they were still taken). */
export function passportStats(trips: readonly FundTrip[], today: Date, home: string, rates: Rates | null | undefined): PassportStats {
  const h = norm(home);
  const done = trips.filter((t) => getPhase(t, today) === 'home');
  const countries = new Set(done.map((t) => norm(t.destinationCountry)).filter(Boolean));
  let daysAway = 0;
  let baki = 0;
  let approx = false;
  let missing = false;
  for (const t of done) {
    daysAway += tripDays(t);
    const f = computeFund(t, today);
    const c = norm(t.currency);
    const conv = toHome(f.inJar, c, rates, h);
    if (conv == null) missing = true;
    else {
      if (c !== h && f.inJar > 0) approx = true;
      baki += conv;
    }
  }
  return {
    trips: done.length,
    countries: countries.size,
    daysAway,
    baki: missing || !done.length ? null : roundMoney(baki, h),
    approx,
    currency: h,
  };
}

const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** '4 TRIPS · 3 COUNTRIES · 31 DAYS AWAY · ≈ RM 1,240 BAKI' (baki drops out when a rate is missing). */
export function passportLine(s: PassportStats): string {
  if (!s.trips) return 'NO STAMPS YET · YOUR FIRST BALIK IS WAITING';
  const parts = [n(s.trips, 'TRIP', 'TRIPS'), n(s.countries, 'COUNTRY', 'COUNTRIES'), `${n(s.daysAway, 'DAY', 'DAYS')} AWAY`];
  if (s.baki != null) parts.push(`${formatMoney(s.baki, s.currency, { approx: s.approx, decimals: 'none' })} BAKI`);
  return parts.join(' · ').toUpperCase();
}
