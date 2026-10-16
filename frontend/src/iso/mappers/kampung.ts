// S5 Kampung (§8): the Passport stage. Every trip that is home becomes a house: footprint from its length,
// floors from what it cost (home currency), a fund roof when it stayed within budget and a stamp roof when
// it didn't, a brass pennant the first time you went to that country. Each year is a band of rows (4 houses a
// row, in end-date order) with a road to the next year and a jar at the end holding that year's baki.
// Pure: data in, spec out.
import type { Rates, Trip } from '@/types';
import { formatRange, parseLocalDate, isValidDate } from '@/lib/dates';
import { toHome } from '@/lib/money';
import { getPhase, tripDays } from '@/lib/phase';
import { HOUSE, JAR_MAX_R, JAR_REF_HEIGHT, LID } from '@/iso/shapes';
import { withRevealTargets } from '@/iso/overlay';
import type { SceneLabel, SceneSpecBase, SceneTarget, Vec3 } from '@/iso/specs';
import { planLabels, sceneMoney, screenRect, type LabelObstacle, type NominalSlot } from '@/iso/mappers/counter';

/** Lot pitch (both axes) and the gap a road takes between two years. Rows after the first are staggered by
 * half a lot, so a house in a back row shows between the two in front of it rather than behind one. */
export const KAMPUNG_LOT = 2.0;
export const KAMPUNG_ROAD_GAP = 1.25;
export const HOUSES_PER_ROW = 4;
/** Year jars (§8: Balang H 1.6). */
export const KAMPUNG_JAR_H = 1.6;
const JAR_R = (JAR_MAX_R * KAMPUNG_JAR_H) / JAR_REF_HEIGHT;

/** Footprint side for a trip of `days`: 0.8 + 0.6 × min(days, 14) / 14. */
export const houseFootprint = (days: number) => 0.8 + (0.6 * Math.min(Math.max(days, 1), 14)) / 14;

/** Floors 1..4: 1 + round(3 × spent / maxSpent). */
export function houseFloors(spentHome: number, maxSpentHome: number): number {
  if (!(maxSpentHome > 0) || !Number.isFinite(spentHome)) return 1;
  return Math.min(Math.max(1 + Math.round((3 * Math.max(spentHome, 0)) / maxSpentHome), 1), 4);
}

export const houseHeight = (floors: number) => HOUSE.stiltH + HOUSE.floorH * floors + HOUSE.roofH;

export type KampungTrip = Pick<Trip, 'id' | 'name' | 'destinationCountry' | 'startDate' | 'endDate' | 'budget' | 'currency'> &
  Partial<Pick<Trip, 'totalExpenses' | 'spentAmount'>>;

export interface KampungInput {
  /** Every trip you have (any phase): first visits are judged across all of them. */
  trips: ReadonlyArray<KampungTrip>;
  /** The selected year tab. */
  year: number | 'all';
  /** User's home currency. */
  homeCurrency: string;
  /** useRates(homeCurrency).rates; null while loading or offline. */
  rates: Rates | null;
  today?: Date;
}

export interface KampungOptions {
  compact?: boolean;
}

export interface KampungHouseSpec {
  /** Same id as the house's target and label. */
  id: string;
  tripId: number;
  name: string;
  country: string;
  year: number;
  days: number;
  /** Base centre. */
  at: Vec3;
  footprint: number;
  floors: number;
  roof: 'under' | 'over';
  firstVisit: boolean;
}

export interface KampungJarSpec {
  id: string;
  year: number;
  /** Base centre. */
  at: Vec3;
  height: number;
  /** Σ baki / Σ target for the year (home currency), 0..1. */
  fill: number;
}

export interface KampungSpec extends SceneSpecBase {
  kind: 'kampung';
  year: number | 'all';
  plinth: { at: Vec3; w: number; d: number };
  houses: KampungHouseSpec[];
  jars: KampungJarSpec[];
  /** Roads along X between years: centre and length. */
  roads: Array<{ at: Vec3; length: number }>;
  /** Empty state: one sketch house. */
  ghost: { at: Vec3; footprint: number } | null;
  /** Some trip had no rate to the home currency, so floors are all 2. */
  notToScale: boolean;
}

const SLOT: Record<'compact' | 'wide', NominalSlot> = {
  compact: { w: 343, h: 320, fit: 'height' },
  wide: { w: 960, h: 520, fit: 'height' },
};

const num = (n: unknown) => {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? v : 0;
};

interface Row {
  trip: KampungTrip;
  end: Date;
  year: number;
  days: number;
  spent: number;
  budget: number;
  spentHome: number | null;
  bakiHome: number | null;
  targetHome: number | null;
}

function byEnd(a: Row, b: Row) {
  return a.end.getTime() - b.end.getTime() || a.trip.startDate.localeCompare(b.trip.startDate) || a.trip.id - b.trip.id;
}

export function mapKampung(input: KampungInput, opts: KampungOptions = {}): KampungSpec {
  const today = input.today ?? new Date();
  const home = (input.homeCurrency || 'MYR').toUpperCase();
  const money = (n: number, approx = false) => sceneMoney(n, home, { approx });

  const all: Row[] = input.trips
    .filter((t) => getPhase(t, today) === 'home')
    .map((trip) => {
      const end = parseLocalDate(trip.endDate);
      const spent = Math.max(0, num(trip.totalExpenses ?? trip.spentAmount ?? 0));
      const budget = Math.max(0, num(trip.budget));
      const conv = (n: number) => toHome(n, trip.currency, input.rates, home);
      return {
        trip,
        end,
        year: isValidDate(end) ? end.getFullYear() : 0,
        days: tripDays(trip),
        spent,
        budget,
        spentHome: conv(spent),
        bakiHome: conv(Math.max(0, budget - spent)),
        targetHome: conv(budget),
      };
    })
    .filter((r) => r.year > 0)
    .sort(byEnd);

  // First visit per country, across every trip that is home (not just this year's).
  const firstVisit = new Set<number>();
  const seen = new Set<string>();
  for (const r of all) {
    const c = (r.trip.destinationCountry ?? '').toUpperCase();
    if (!c || seen.has(c)) continue;
    seen.add(c);
    firstVisit.add(r.trip.id);
  }

  const shown = input.year === 'all' ? all : all.filter((r) => r.year === input.year);
  const notToScale = shown.some((r) => r.spentHome === null);
  const maxSpent = shown.reduce((m, r) => Math.max(m, r.spentHome ?? 0), 0);

  const years = [...new Set(shown.map((r) => r.year))].sort((a, b) => a - b);
  const houses: KampungHouseSpec[] = [];
  const jars: KampungJarSpec[] = [];
  const roads: Array<{ at: Vec3; length: number }> = [];
  const jarLabels: SceneLabel[][] = [];
  const yearBaki: Array<{ year: number; baki: number; target: number; converted: boolean; missing: string[] }> = [];
  const houseLabels: SceneLabel[] = [];
  const P = KAMPUNG_LOT;

  // ---- lay out each year as a band of rows going back (−Z); bands separated by a road
  let zFront = 0;
  const backRows: number[] = [];
  for (const year of years) {
    const rows = shown.filter((r) => r.year === year);
    rows.forEach((r, i) => {
      const row = Math.floor(i / HOUSES_PER_ROW);
      const col = i % HOUSES_PER_ROW;
      const floors = notToScale ? 2 : houseFloors(r.spentHome ?? 0, maxSpent);
      const footprint = houseFootprint(r.days);
      const over = r.budget > 0 && r.spent > r.budget;
      const at: Vec3 = [col * P + (row % 2) * (P / 2), 0, zFront - row * P];
      const id = `trip-${r.trip.id}`;
      houses.push({
        id,
        tripId: r.trip.id,
        name: r.trip.name,
        country: (r.trip.destinationCountry ?? '').toUpperCase(),
        year,
        days: r.days,
        at,
        footprint,
        floors,
        roof: over ? 'over' : 'under',
        firstVisit: firstVisit.has(r.trip.id),
      });
      houseLabels.push({
        id,
        at: [at[0], houseHeight(floors) + 0.5, at[2]],
        text: (r.trip.destinationCountry ?? '').toUpperCase() || r.trip.name.slice(0, 3).toUpperCase(),
        tone: 'ink',
        anchor: 'above',
      });
    });
    const rowCount = Math.ceil(rows.length / HOUSES_PER_ROW);
    const zBack = zFront - (rowCount - 1) * P;
    // The jar closes the year's front row (nothing stands in front of it there). With every year showing, the
    // jars line up in one column so their chips step up the slope instead of piling onto each other.
    const jarCol = input.year === 'all' ? HOUSES_PER_ROW : Math.min(rows.length, HOUSES_PER_ROW);
    const jarAt: Vec3 = [jarCol * P, 0, zFront];

    // Year baki in home currency; trips with no rate are left out and named.
    let baki = 0;
    let target = 0;
    const missing = new Set<string>();
    let converted = false;
    for (const r of rows) {
      if (r.budget <= 0) continue;
      if (r.bakiHome === null || r.targetHome === null) {
        missing.add(r.trip.currency.toUpperCase());
        continue;
      }
      if (r.trip.currency.toUpperCase() !== home) converted = true;
      baki += r.bakiHome;
      target += r.targetHome;
    }
    const fill = target > 0 ? Math.min(Math.max(baki / target, 0), 1) : 0;
    jars.push({ id: `jar-${year}`, year, at: jarAt, height: KAMPUNG_JAR_H, fill });
    const words: Pick<SceneLabel, 'id' | 'text' | 'sub' | 'tone'> = {
      id: `jar-${year}`,
      text: target > 0 ? `${money(baki, converted)} baki in ${year}` : `No budgets in ${year}`,
      sub: missing.size ? `${[...missing].sort().join(', ')} not converted` : undefined,
      tone: target > 0 ? 'fund' : 'muted',
    };
    const below: SceneLabel = { ...words, at: [jarAt[0], 0, jarAt[2] + JAR_R], anchor: 'below' };
    const above: SceneLabel = { ...words, at: [jarAt[0] - 0.2, KAMPUNG_JAR_H + 0.35, jarAt[2] - 0.2], anchor: 'above' };
    const right: SceneLabel = { ...words, at: [jarAt[0] + JAR_R * 0.71, KAMPUNG_JAR_H * 0.5, jarAt[2] - JAR_R * 0.71], anchor: 'right' };
    // On a phone a chip to the right widens the village, and a wider village means a smaller zoom.
    jarLabels.push(opts.compact ? [below, above] : [below, above, right]);
    yearBaki.push({ year, baki, target, converted, missing: [...missing] });
    backRows.push(zBack);
    zFront = zBack - P - KAMPUNG_ROAD_GAP;
  }

  // ---- ground: one plinth under everything, roads between bands
  const empty = houses.length === 0;
  const xMax = empty
    ? 1.4
    : Math.max(...jars.map((j) => j.at[0] + JAR_R), ...houses.map((h) => h.at[0] + h.footprint / 2)) + 0.45;
  const xMin = empty ? -1.4 : -0.7 - 0.45;
  const zMax = empty ? 1.4 : 0.7 + 0.45;
  const zMin = empty ? -1.4 : backRows[backRows.length - 1] - 0.7 - 0.45;
  for (let k = 0; k < backRows.length - 1; k++) {
    roads.push({ at: [(xMin + xMax) / 2, 0, backRows[k] - (P + KAMPUNG_ROAD_GAP) / 2], length: xMax - xMin });
  }
  const plinth = { at: [(xMin + xMax) / 2, 0, (zMin + zMax) / 2] as Vec3, w: xMax - xMin, d: zMax - zMin };
  const ghost = empty ? { at: [0, 0, 0] as Vec3, footprint: 1.1 } : null;

  const points: Vec3[] = [
    [xMin, -0.4, zMin],
    [xMax, -0.4, zMin],
    [xMin, -0.4, zMax],
    [xMax, -0.4, zMax],
    [xMin, 0, zMin],
    [xMax, 0, zMax],
    ...houses.flatMap((h) => [
      [h.at[0] - h.footprint / 2, houseHeight(h.floors) + (h.firstVisit ? 0.45 : 0), h.at[2] - h.footprint / 2] as Vec3,
    ]),
    ...jars.map((j) => [j.at[0] - JAR_R, j.height + LID.h * (j.height / JAR_REF_HEIGHT), j.at[2] - JAR_R] as Vec3),
  ];
  // Frame the empty plot as if a 4-floor house stood on it, so it is drawn at a village's scale, not blown up.
  if (ghost) points.push([-0.6, houseHeight(4), -0.6]);

  // One year: its jar's chip always shows. Every year: chips are newest first and only where they fit (the
  // summary carries each year's baki, and tapping a jar opens that year).
  const manyYears = input.year === 'all' && jarLabels.length > 1;
  const labels: SceneLabel[][] = empty
    ? [[{ id: 'empty', at: [0, houseHeight(1) + 0.2, 0], text: 'No trips stamped yet.', tone: 'muted', anchor: 'above' }]]
    : manyYears
      ? []
      : jarLabels;
  const optional: SceneLabel[][] = empty ? [] : [...(manyYears ? jarLabels.slice().reverse() : []), ...houseLabels.map((l) => [l])];
  // House labels (country codes) must not cover another house or a jar.
  const obstacles: LabelObstacle[] = [
    ...houses.map((h) => ({
      id: h.id,
      rect: screenRect([
        [h.at[0] - h.footprint / 2, houseHeight(h.floors), h.at[2] - h.footprint / 2],
        [h.at[0] + h.footprint / 2, 0, h.at[2] + h.footprint / 2],
        [h.at[0] - h.footprint / 2, 0, h.at[2] + h.footprint / 2],
        [h.at[0] + h.footprint / 2, 0, h.at[2] - h.footprint / 2],
      ]),
    })),
    ...jars.map((j) => ({
      id: j.id,
      rect: screenRect([
        [j.at[0] - JAR_R, j.height + 0.2, j.at[2] - JAR_R],
        [j.at[0] + JAR_R, 0, j.at[2] + JAR_R],
        [j.at[0] - JAR_R * 0.7, 0, j.at[2] + JAR_R * 0.7],
        [j.at[0] + JAR_R * 0.7, j.height, j.at[2] - JAR_R * 0.7],
      ]),
    })),
  ];
  const plan = planLabels(points, labels, optional, opts.compact ? SLOT.compact : SLOT.wide, { obstacles });

  const rowsById = new Map(shown.map((r) => [r.trip.id, r]));
  const verdict = (r: Row) => (r.budget <= 0 ? 'no budget' : r.spent > r.budget ? 'over budget' : 'under budget');
  const targets: SceneTarget[] = houses.map((h) => {
    const r = rowsById.get(h.tripId) as Row;
    return {
      id: h.id,
      at: [h.at[0], HOUSE.stiltH + (HOUSE.floorH * h.floors) / 2, h.at[2]],
      ariaLabel: `${h.name}, ${formatRange(r.trip.startDate, r.trip.endDate)}, ${h.days} ${h.days === 1 ? 'day' : 'days'}, ${verdict(r)}. Open ticket`,
      action: { type: 'openTrip', payload: { tripId: h.tripId } },
    };
  });

  if (manyYears) {
    for (const j of jars) {
      const yb = yearBaki.find((y) => y.year === j.year);
      targets.push({
        id: j.id,
        at: [j.at[0], j.height / 2, j.at[2]],
        ariaLabel:
          yb && yb.target > 0
            ? `${j.year}: ${money(yb.baki, yb.converted)} baki. Show ${j.year}`
            : `${j.year}: no budgets. Show ${j.year}`,
        action: { type: 'selectYear', payload: { year: j.year } },
      });
    }
  }

  // ---- summary
  const n = shown.length;
  const where = input.year === 'all' ? '' : ` in ${input.year}`;
  let summary: string;
  if (n === 0) {
    summary = input.year === 'all' ? 'No trips stamped yet.' : `No trips stamped in ${input.year}.`;
  } else {
    const named = shown
      .slice(0, 4)
      .map((r) => `${r.trip.name} (${r.days} ${r.days === 1 ? 'day' : 'days'}, ${verdict(r)})`)
      .join(', ');
    const more = n > 4 ? `, and ${n - 4} more` : '';
    summary = `${n} ${n === 1 ? 'trip' : 'trips'} home${where}: ${named}${more}.`;
    const counted = shown.filter((r) => r.budget > 0 && r.bakiHome !== null);
    if (counted.length) {
      const total = counted.reduce((s, r) => s + (r.bakiHome ?? 0), 0);
      const approx = counted.some((r) => r.trip.currency.toUpperCase() !== home);
      if (manyYears) {
        const per = yearBaki
          .filter((y) => y.target > 0)
          .map((y) => `${y.year} ${money(y.baki, y.converted)}`)
          .join(', ');
        summary += ` Baki ${money(total, approx)} over ${years.length} years: ${per}.`;
      } else {
        summary += ` Baki ${money(total, approx)}.`;
      }
    }
    if (notToScale) summary += ' House heights not to scale.';
  }

  return {
    kind: 'kampung',
    year: input.year,
    bounds: plan.bounds,
    labels: withRevealTargets(plan.labels, targets),
    targets,
    summary,
    // One year: the newest trips (and the year's jar) sit at the screen-right end, so start there. All years:
    // read the village left to right from the first trip, so the first label isn't cut off at 375.
    panStart: input.year === 'all' ? 'start' : 'end',
    plinth,
    houses,
    jars,
    roads,
    ghost,
    notToScale,
  };
}
