// Words and small figures on the trip page. Pure (no React), so the components stay fast-refresh friendly and
// the tests check exactly what people read.
import type { SettlementBalance, Trip } from '@/types';
import type { FundState } from '@/hooks/useFund';
import { getCountryByCode } from '@/data/countries';
import { formatRange } from '@/lib/dates';
import { durationLabel, tripDays } from '@/lib/phase';
import { currencyDecimals, currencyPrefix, formatMoney, parseMoneyInput, roundMoney } from '@/lib/money';
import { paceSentence, sentenceMoney } from '@/lib/fundCopy';
import { partyLabel, routeLabel } from '@/components/motifs/tripMeta';

type HeaderTrip = Pick<Trip, 'destinationCountry' | 'startDate' | 'endDate' | 'budgetType' | 'memberCount' | 'members'>;

/** ['MY → JP', '12–20 OCT 2026', '9D8N', 'GENG · 3']: the header row's pieces, each kept on one line. */
export function headerFieldParts(trip: HeaderTrip, home?: string | null): string[] {
  return [
    routeLabel(trip.destinationCountry, home),
    formatRange(trip.startDate, trip.endDate),
    durationLabel(tripDays(trip)),
    partyLabel(trip),
  ].filter(Boolean);
}

/** 'MY → JP · 12–20 OCT 2026 · 9D8N · GENG · 3' */
export function headerFieldRow(trip: HeaderTrip, home?: string | null): string {
  return headerFieldParts(trip, home).join(' · ');
}

/** Exact money without trailing zeros: 'RM 550', 'RM 1,775.50'. For sums people check against each other. */
export function cleanMoney(amount: number, currency: string): string {
  const whole = Math.abs(roundMoney(amount, currency) - Math.round(amount)) < 0.005;
  return formatMoney(amount, currency, whole ? { decimals: 'none' } : {});
}

/**
 * 'Saved RM 1,750 of RM 5,500 · RM 3,750 to go', or the fully funded line. Exact, so the parts add up.
 * A fund that went below zero says it's short ('Fund is RM 80 short · RM 1,080 to go'), never 'Saved −RM 80'.
 */
export function savedLine(fund: Pick<FundState, 'saved' | 'target' | 'toSave' | 'currency' | 'hasBudget'>): string {
  const c = fund.currency;
  const m = (n: number) => cleanMoney(n, c);
  if (fund.saved < 0) {
    return fund.hasBudget ? `Fund is ${m(-fund.saved)} short · ${m(fund.toSave)} to go` : `Fund is ${m(-fund.saved)} short.`;
  }
  if (!fund.hasBudget) return `Saved ${m(fund.saved)} so far.`;
  if (fund.toSave <= 0) return `Saved ${m(fund.saved)} of ${m(fund.target)}. Cukup.`;
  return `Saved ${m(fund.saved)} of ${m(fund.target)} · ${m(fund.toSave)} to go`;
}

/** FX pair for the mini line: trip currency → the destination's, or → home when the trip is in the local money. */
export function fxPair(trip: Pick<Trip, 'currency' | 'destinationCountry'>, home?: string | null): [string, string] | null {
  const base = trip.currency.toUpperCase();
  const local = getCountryByCode(trip.destinationCountry)?.currency?.toUpperCase();
  if (local && local !== base) return [base, local];
  const h = home?.toUpperCase();
  if (h && h !== base) return [base, h];
  return null;
}

/** The sentence above the pace chart: pace on the road, the recap at home, the plan before. */
export function paceLine(fund: FundState, spentBefore: number): string {
  const c = fund.currency;
  if (fund.phase === 'onTheRoad') {
    return paceSentence(fund) ?? `${sentenceMoney(fund.spent, c)} spent in ${fund.daysElapsed} of ${fund.daysTotal} days.`;
  }
  if (fund.phase === 'home') {
    if (!fund.hasBudget) return `${sentenceMoney(fund.spent, c)} over ${fund.daysTotal} days.`;
    return fund.over > 0
      ? `Landed at ${sentenceMoney(fund.spent, c)}, ${sentenceMoney(fund.over, c)} over the plan.`
      : `Landed at ${sentenceMoney(fund.spent, c)}, ${sentenceMoney(fund.target - fund.spent, c)} under the plan.`;
  }
  const before = spentBefore > 0 ? ` ${sentenceMoney(spentBefore, c)} already went on bookings.` : '';
  return `The pace line starts on day 1.${before}`;
}

/** Validates a typed amount for the trip currency: the amount, or why it can't be used. */
export function readAmount(raw: string, currency: string): { amount: number } | { error: string } {
  const n = parseMoneyInput(raw);
  if (n == null || !(n > 0)) return { error: 'Enter an amount above zero.' };
  const d = currencyDecimals(currency);
  const [, frac = ''] = raw.replace(/[\s,]/g, '').split('.');
  if (frac.length > d) {
    return { error: d === 0 ? `${currency} has no decimals. Enter a whole amount.` : `Use at most ${d} decimals.` };
  }
  if (n >= 1e10) return { error: 'That amount is too large.' };
  return { amount: n };
}

/** Axis money: 'RM 0', 'RM 2k', 'RM 1.5k', '¥ 120k'. */
export function axisMoney(v: number, currency: string): string {
  const p = currencyPrefix(currency);
  const abs = Math.abs(v);
  const n =
    abs >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : abs >= 1e3 ? `${+(v / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}k` : `${Math.round(v)}`;
  return p ? `${p} ${n}` : n;
}

/** 'SA' for Siti Aisyah, 'A' for Aiman. */
export function initialsOf(name: string | null | undefined): string {
  return (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
}

/** '1 entry' · '38 entries' */
export const entriesWord = (n: number) => `${n} ${n === 1 ? 'entry' : 'entries'}`;

/** 'Siti' from 'Siti Aisyah'. */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/** B2 adds `onTrip` (false = paid on the trip, then left or was removed). Older payloads leave it out. */
export type KongsiBalance = SettlementBalance & { onTrip?: boolean };

/** 'You' for the signed-in person, else the first name. */
export const personLabel = (userId: number, name: string, meId?: number | null) => (meId != null && userId === meId ? 'You' : firstName(name));

/** DivergingBar rows: 'You' or first names, '(left)' for someone no longer on the trip. */
export function balanceRows(balances: readonly KongsiBalance[], meId?: number | null): { name: string; net: number }[] {
  return balances.map((b) => {
    const name = personLabel(b.userId, b.name, meId);
    return { name: b.onTrip === false ? `${name} (left)` : name, net: b.net };
  });
}

/** The plain number for DuitNow and bank apps: '82.50' (no prefix, no grouping; whole for yen and won). */
export function plainAmount(amount: number, currency: string): string {
  return roundMoney(amount, currency).toFixed(currencyDecimals(currency));
}
