// S1 Shelf (Home hero, §8): the trips you're saving for or travelling on, as balang on a wall shelf.
// Pure: trips + rates in, ShelfSpec out. The 3D scene (scenes/Shelf) and the SVG twin (svg/ShelfSvg) only
// draw what this returns.
//
// The shelf runs along the screen (SCREEN_RIGHT) rather than along world X, so jars stand side by side with
// their labels underneath instead of stepping down a diagonal where neighbours overlap.
import type { Rates, Trip } from '@/types';
import { computeFund, type FundState } from '@/hooks/useFund';
import { sentenceMoney } from '@/lib/fundCopy';
import { formatMoney, toHome } from '@/lib/money';
import { daysUntilStart, dayIndex, tripDays, type Phase } from '@/lib/phase';
import { MAX_VISIBLE_LABELS } from '@/iso/overlay';
import { fitZoom, isoProject, type Bounds } from '@/iso/projection';
import { JAR_MAX_R, JAR_REF_HEIGHT, LID, SHELF, lidPose } from '@/iso/shapes';
import type { LidColorKey, LidState, SceneLabel, SceneSpecBase, SceneTarget, Vec3 } from '@/iso/specs';

// ---------------------------------------------------------------- framing helpers (shared with tripPlot)

const KX = Math.SQRT1_2;
const KXZ = 1 / Math.sqrt(6);
const KY = 2 / Math.sqrt(6);

export interface ScreenRect {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Projected extents (screen units) of a set of world points. */
export function screenRectOf(points: readonly Vec3[]): ScreenRect {
  const r: ScreenRect = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (const p of points) {
    const [x, y] = isoProject(p);
    if (x < r.minX) r.minX = x;
    if (x > r.maxX) r.maxX = x;
    if (y < r.minY) r.minY = y;
    if (y > r.maxY) r.maxY = y;
  }
  return r;
}

/**
 * A framing box whose 8 projected corners span exactly `rect` (IsoStage frames spec.bounds by projecting its
 * corners). A plain world AABB around a scene wastes the projected corners it doesn't fill, which shrinks the
 * scene in its slot. When the rect is flatter than any box can project (height < 0.577 × width), the box
 * comes out taller and stays centred on it.
 */
export function boundsForScreenRect(rect: ScreenRect, yCenter = 1): Bounds {
  const p = (rect.maxX - rect.minX) / KX;
  const pc = (rect.minX + rect.maxX) / 2 / KX;
  const ySpan = Math.max(0, rect.maxY - rect.minY - p * KXZ) / KY;
  const syc = (rect.minY + rect.maxY) / 2;
  const qc = (syc + yCenter * KY) / KXZ;
  const xc = (qc + pc) / 2;
  const zc = (qc - pc) / 2;
  const h = p / 4;
  return {
    min: [xc - h, yCenter - ySpan / 2, zc - h],
    max: [xc + h, yCenter + ySpan / 2, zc + h],
  };
}

/** Points on a horizontal circle (for jar rims and lids in a screen rect). */
export function ringPoints(c: Vec3, r: number, n = 12): Vec3[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [c[0] + Math.cos(a) * r, c[1], c[2] + Math.sin(a) * r] as Vec3;
  });
}

/** Approximate glyph advance of the label fonts (IBM Plex Mono 0.6em; overline adds .08em tracking). */
export const LABEL_FONT = {
  /** type-ledger: 14px, 15px from lg. */
  text: (wide: boolean) => (wide ? 9 : 8.4),
  /** type-overline: 11px + tracking. */
  sub: 7.5,
  /** Chip padding + border (16), plus a 6px gap so neighbouring chips never touch. */
  chrome: 22,
};

/** Name cut to `max` characters, on a word boundary when that keeps at least 4 characters. */
export function truncateName(name: string, max: number): string {
  const s = name.trim().replace(/\s+/g, ' ');
  if (s.length <= max) return s;
  if (max <= 1) return '…';
  const room = s.slice(0, max - 1);
  const space = room.lastIndexOf(' ');
  const cut = space >= 4 ? room.slice(0, space) : room;
  return `${cut.trimEnd()}…`;
}

/** Last-resort short money for narrow label chips: '₩ 2.5M', '¥ 340K', 'RM 12K'. Only from 10,000 up. */
export function compactMoney(amount: number, currency: string): string {
  const abs = Math.abs(amount);
  if (abs < 10_000) return sentenceMoney(amount, currency);
  const prefix = formatMoney(0, currency).replace(/[\d.,]+$/, '');
  const [n, unit] = abs >= 1e9 ? [abs / 1e9, 'B'] : abs >= 1e6 ? [abs / 1e6, 'M'] : [abs / 1e3, 'K'];
  const num = n >= 100 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString();
  return `${amount < 0 ? '−' : ''}${prefix}${num}${unit}`;
}

/** Whole-unit amount without the currency prefix: '4,000', '500,000'. */
export function bareAmount(amount: number, currency: string): string {
  return formatMoney(amount, currency, { decimals: Math.abs(amount) >= 100 ? 'none' : undefined }).replace(/^[^\d−-]*/, '');
}

// ---------------------------------------------------------------- types

export type ShelfTrip = Pick<Trip, 'id' | 'name' | 'destinationCountry' | 'startDate' | 'endDate' | 'budget' | 'currency'> &
  Partial<Pick<Trip, 'totalExpenses' | 'spentAmount' | 'savedAmount' | 'isArchived'>>;

export interface ShelfInput {
  /** Any trips; the mapper keeps the upcoming and on-the-road ones that aren't archived. */
  trips: readonly ShelfTrip[];
  /** useRates(homeCurrency).rates. null while loading or when Frankfurter is down. */
  rates: Rates | null | undefined;
  /** user.currency, e.g. 'MYR'. */
  homeCurrency: string;
  today?: Date;
}

export interface ShelfOptions {
  /** 'mobile' = 3 jars in a 343×240 slot; 'desktop' = 5 jars in a 680×360 slot. Default 'mobile'. */
  layout?: 'mobile' | 'desktop';
  /** Override the jar cap (spec: 3 mobile, 5 desktop). */
  maxJars?: number;
  /** The slot's size in px, if known. Only used to size labels so neighbours never collide. */
  slot?: { w: number; h: number };
}

export interface ShelfJar {
  id: string;
  tripId: number;
  name: string;
  /** Base centre on the plank (plank top is y = 0). */
  at: Vec3;
  height: number;
  /** 0..1 share of the jar holding coins. */
  fill: number;
  lid: LidState;
  lidColor: LidColorKey;
  /** Tilted lids lean along the shelf, to the jar's right. */
  lidYaw: number;
  seed: string;
  phase: Phase;
  over: boolean;
  hasBudget: boolean;
  fund: FundState;
  /** IOU slip at the jar's foot when over budget. */
  iou: { at: Vec3; rotY: number } | null;
}

export interface ShelfSpec extends SceneSpecBase {
  kind: 'shelf';
  /** Plank: centre of its top surface, yaw (π/4 = along the screen), and stretch of the 1-slot-per-jar plank. */
  shelf: { at: Vec3; yaw: number; slots: number; scaleX: number; length: number };
  jars: ShelfJar[];
  /** Empty state: one sketched jar. */
  ghost: { at: Vec3; height: number } | null;
  /** Eligible trips that didn't fit ("+2 more on your shelf"). */
  more: number;
  /** Eligible trips in total. */
  total: number;
  /** false when a rate was missing and every jar is drawn the same size. */
  toScale: boolean;
}

// ---------------------------------------------------------------- layout constants

export const SHELF_YAW = Math.PI / 4;
const U: Vec3 = [Math.cos(SHELF_YAW), 0, -Math.sin(SHELF_YAW)]; // along the plank = SCREEN_RIGHT
const F: Vec3 = [Math.sin(SHELF_YAW), 0, Math.cos(SHELF_YAW)]; // towards the viewer

const SLOT = SHELF.slotW;
/** Plank beyond the first and last jar: the widest jar's radius plus a little. Less plank, bigger jars. */
const END = JAR_MAX_R + 0.2;
/** Room a tilted lid needs beside its jar (it reaches ~1.9 × scale along the plank). */
const OVER_GAP = 0.4;
const OVER_END = 2.15;
/** Jars stand a touch forward of the back rail. */
const JAR_Z = 0.05;
/**
 * Lid yaw that leans a tilted lid along +U (to the jar's right on screen) with the disc centred on the
 * plank's depth: the yaw that turns lidPose's (x, z) offset parallel to U.
 */
export const LID_LEAN_RIGHT = (() => {
  const [x, , z] = lidPose('tilted')!.position;
  return Math.PI - Math.atan((x + z) / (z - x));
})();

const SLOTS: Record<'mobile' | 'desktop', { w: number; h: number; jars: number }> = {
  mobile: { w: 343, h: 240, jars: 3 },
  desktop: { w: 680, h: 360, jars: 5 },
};

const local = (t: number, y: number, z: number): Vec3 => [t * U[0] + z * F[0], y, t * U[2] + z * F[2]];

// ---------------------------------------------------------------- helpers

function isEligible(phase: Phase, trip: ShelfTrip): boolean {
  return !trip.isArchived && (phase === 'onTheRoad' || phase === 'upcoming');
}

/** Short phase text for a label sub line: 'DAY 3/9', 'IN 28 DAYS', 'TOMORROW'. */
function phaseShort(trip: ShelfTrip, phase: Phase, today: Date): string {
  if (phase === 'onTheRoad') return `DAY ${dayIndex(trip, today)}/${tripDays(trip)}`;
  const n = Math.max(0, daysUntilStart(trip, today));
  if (n === 0) return 'TODAY';
  if (n === 1) return 'TOMORROW';
  return `IN ${n} DAYS`;
}

/** 'RM 2,340 of RM 4,000 left' · 'over by RM 240' · 'no budget set'. */
function jarDetail(f: FundState): string {
  if (!f.hasBudget) return 'no budget set';
  if (f.over > 0) return `over by ${sentenceMoney(f.over, f.currency)}`;
  return `${sentenceMoney(f.inJar, f.currency)} of ${sentenceMoney(f.target, f.currency)} left`;
}

function firstThatFits(options: string[], maxChars: number): string {
  return options.find((o) => o.length <= maxChars) ?? options[options.length - 1];
}

/** Jar height H = 1.6 + 0.8·√(targetHome / maxTargetHome); every H = 2.0 when a rate is missing. */
export function jarHeights(
  trips: readonly ShelfTrip[],
  rates: Rates | null | undefined,
  homeCurrency: string,
): { heights: number[]; toScale: boolean } {
  const targets = trips.map((t) => {
    const budget = Number.isFinite(t.budget) ? Math.max(0, t.budget) : 0;
    return budget === 0 ? 0 : toHome(budget, t.currency, rates, homeCurrency);
  });
  if (targets.some((v) => v == null)) return { heights: trips.map(() => 2.0), toScale: false };
  const max = Math.max(0, ...(targets as number[]));
  if (max <= 0) return { heights: trips.map(() => 2.0), toScale: true };
  return { heights: (targets as number[]).map((v) => 1.6 + 0.8 * Math.sqrt(v / max)), toScale: true };
}

// ---------------------------------------------------------------- mapper

export function mapShelf(input: ShelfInput, opts: ShelfOptions = {}): ShelfSpec {
  const today = input.today ?? new Date();
  const preset = SLOTS[opts.layout ?? 'mobile'];
  const slot = opts.slot ?? { w: preset.w, h: preset.h };
  const cap = Math.max(1, Math.floor(opts.maxJars ?? preset.jars));

  const eligible = input.trips
    .map((trip) => ({ trip, fund: computeFund(trip, today) }))
    .filter(({ trip, fund }) => isEligible(fund.phase, trip))
    .sort((a, b) => {
      const pa = a.fund.phase === 'onTheRoad' ? 0 : 1;
      const pb = b.fund.phase === 'onTheRoad' ? 0 : 1;
      return pa - pb || a.trip.startDate.localeCompare(b.trip.startDate) || a.trip.id - b.trip.id;
    });

  if (eligible.length === 0) return emptyShelf(slot);

  const shown = eligible.slice(0, cap);
  const { heights, toScale } = jarHeights(
    shown.map((s) => s.trip),
    input.rates,
    input.homeCurrency,
  );

  // Positions along the plank: a slot per jar, extra room after an over jar for its tilted lid.
  const ts: number[] = [];
  shown.forEach(({ fund }, i) => {
    if (i === 0) ts.push(0);
    const over = fund.hasBudget && fund.over > 0;
    if (i < shown.length - 1) ts.push(ts[i] + SLOT + (over ? OVER_GAP : 0));
  });
  const lastOver = shown[shown.length - 1].fund.hasBudget && shown[shown.length - 1].fund.over > 0;
  const tMin = ts[0] - END;
  const tMax = ts[ts.length - 1] + (lastOver ? OVER_END : END);
  const shift = (tMin + tMax) / 2;
  const length = tMax - tMin;

  const jars: ShelfJar[] = shown.map(({ trip, fund }, i) => {
    const t = ts[i] - shift;
    const height = heights[i];
    const s = height / JAR_REF_HEIGHT;
    const over = fund.hasBudget && fund.over > 0;
    return {
      id: `trip-${trip.id}`,
      tripId: trip.id,
      name: trip.name,
      at: local(t, 0, JAR_Z),
      height,
      fill: fund.hasBudget ? fund.fill : 0,
      lid: over ? 'tilted' : 'closed',
      lidColor: fund.phase === 'onTheRoad' ? 'lidOnTheRoad' : 'lidUpcoming',
      lidYaw: over ? LID_LEAN_RIGHT : 0,
      seed: `trip-${trip.id}`,
      phase: fund.phase,
      over,
      hasBudget: fund.hasBudget,
      fund,
      iou: over ? { at: local(t - (0.8 * s + 0.4), 0, JAR_Z + 0.3), rotY: SHELF_YAW + 0.22 } : null,
    };
  });

  const shelf = {
    at: [0, 0, 0] as Vec3,
    yaw: SHELF_YAW,
    slots: jars.length,
    scaleX: length / (jars.length * SLOT + SHELF.extra),
    length,
  };

  // Frame: plank, brackets, jars and their lids, plus room under the plank for the label chips.
  const base = framePoints(shelf.length, jars);
  let bounds = boundsForScreenRect(screenRectOf(base));
  const zoom = fitZoom(bounds, slot.w, slot.h);
  const labelRoom = LABEL_ROOM_PX / zoom / KY;
  bounds = boundsForScreenRect(
    screenRectOf([...base, local(-length / 2, -0.08 - labelRoom, SHELF.d / 2), local(length / 2, -0.08 - labelRoom, SHELF.d / 2)]),
  );
  const finalZoom = fitZoom(bounds, slot.w, slot.h);

  const labels = shelfLabels(jars, shown, ts.map((t) => t - shift), finalZoom, slot, today);
  const targets: SceneTarget[] = jars.map((j) => {
    const s = j.height / JAR_REF_HEIGHT;
    const px = Math.round(Math.min(2 * JAR_MAX_R * s, j.height * KY) * finalZoom);
    return {
      id: j.id,
      at: [j.at[0], j.height * 0.45, j.at[2]],
      sizePx: Math.max(44, Math.min(120, px)),
      ariaLabel: `Open ${j.name}: ${jarDetail(j.fund)}`,
      href: `/trips/${j.tripId}`,
    };
  });

  const n = eligible.length;
  const lines = [`${n} ${n === 1 ? 'trip' : 'trips'} on your shelf.`, ...jars.map((j) => `${j.name}: ${jarDetail(j.fund)}.`)];
  if (!toScale) lines.push('Jar sizes not to scale.');

  return {
    kind: 'shelf',
    bounds,
    labels,
    // Each chip is cut to its own jar's column, so every jar's label can show (5 on desktop, §8).
    ...(labels.length > MAX_VISIBLE_LABELS ? { maxLabels: labels.length } : {}),
    targets,
    summary: lines.join(' '),
    shelf,
    jars,
    ghost: null,
    more: Math.max(0, n - jars.length),
    total: n,
    toScale,
  };
}

/** Label chip height (2 lines) plus breathing room under the plank, in px. */
const LABEL_ROOM_PX = 44;

function framePoints(length: number, jars: readonly ShelfJar[]): Vec3[] {
  const L = length / 2;
  const d = SHELF.d / 2;
  const pts: Vec3[] = [];
  for (const t of [-L, L]) {
    for (const z of [-d, d]) pts.push(local(t, 0, z), local(t, -SHELF.plankH, z));
    pts.push(local(t * 0.9, -SHELF.plankH - SHELF.bracket, -d));
  }
  for (const j of jars) {
    const s = j.height / JAR_REF_HEIGHT;
    pts.push(...ringPoints([j.at[0], 1.0 * s, j.at[2]], JAR_MAX_R * s));
    pts.push(...ringPoints([j.at[0], (JAR_REF_HEIGHT + LID.h) * s, j.at[2]], LID.r * s));
  }
  return pts;
}

function shelfLabels(
  jars: readonly ShelfJar[],
  shown: ReadonlyArray<{ trip: ShelfTrip; fund: FundState }>,
  ts: readonly number[],
  zoom: number,
  slot: { w: number; h: number },
  today: Date,
): SceneLabel[] {
  const wide = slot.w >= 600;
  return jars.map((j, i) => {
    const { trip, fund } = shown[i];
    // Room between this jar and its nearest neighbour (screen units along the plank = world units).
    const gaps = [ts[i] - (ts[i - 1] ?? -Infinity), (ts[i + 1] ?? Infinity) - ts[i]];
    const col = Math.min(Math.min(...gaps) * zoom, slot.w * 0.9);
    const textMax = Math.max(6, Math.floor((col - LABEL_FONT.chrome) / LABEL_FONT.text(wide)));
    const subMax = Math.max(6, Math.floor((col - LABEL_FONT.chrome) / LABEL_FONT.sub));

    let text: string;
    let tone: SceneLabel['tone'];
    if (!fund.hasBudget) {
      text = firstThatFits(['No budget set', 'No budget'], textMax);
      tone = 'muted';
    } else if (j.over) {
      text = firstThatFits(
        [`Over ${sentenceMoney(fund.over, fund.currency)}`, `−${sentenceMoney(fund.over, fund.currency)}`, `−${compactMoney(fund.over, fund.currency)}`],
        textMax,
      );
      tone = 'stamp';
    } else {
      const left = sentenceMoney(fund.inJar, fund.currency);
      text = firstThatFits(
        [`${left} / ${bareAmount(fund.target, fund.currency)}`, `${left} left`, left, compactMoney(fund.inJar, fund.currency)],
        textMax,
      );
      tone = 'fund';
    }

    const code = (trip.destinationCountry || '').toUpperCase().slice(0, 3);
    const phase = phaseShort(trip, fund.phase, today);
    const head = code ? `${code} ` : '';
    const name14 = truncateName(trip.name, 14);
    const sub = firstThatFits(
      [`${head}${name14} · ${phase}`, `${head}${name14}`, `${head}${truncateName(trip.name, Math.max(4, subMax - head.length))}`],
      subMax,
    );

    return {
      id: j.id,
      at: local(ts[i], -0.08, SHELF.d / 2),
      text,
      sub,
      tone,
      anchor: 'below',
      priority: i,
    };
  });
}

/** Empty state: a plank three jars long with one sketched jar, so the sketch stays jar-sized. */
function emptyShelf(slot: { w: number; h: number }): ShelfSpec {
  const length = 3 * SLOT + SHELF.extra;
  const ghost = { at: local(0, 0, JAR_Z), height: 2.0 };
  const pts = framePoints(length, []);
  const s = ghost.height / JAR_REF_HEIGHT;
  pts.push(...ringPoints([ghost.at[0], s, ghost.at[2]], JAR_MAX_R * s), ...ringPoints([ghost.at[0], JAR_REF_HEIGHT * s, ghost.at[2]], 0.74 * s));
  const bounds = boundsForScreenRect(screenRectOf(pts));
  const zoom = fitZoom(bounds, slot.w, slot.h);
  return {
    kind: 'shelf',
    bounds,
    labels: [],
    targets: [
      {
        id: 'start',
        at: [ghost.at[0], ghost.height * 0.45, ghost.at[2]],
        sizePx: Math.max(44, Math.min(120, Math.round(2 * JAR_MAX_R * s * zoom))),
        ariaLabel: 'Start a tabung',
        href: '/trips/new',
      },
    ],
    summary: "Your shelf's empty. Pick a place, we'll start the tabung.",
    shelf: { at: [0, 0, 0], yaw: SHELF_YAW, slots: 3, scaleX: 1, length },
    jars: [],
    ghost,
    more: 0,
    total: 0,
    toScale: true,
  };
}
