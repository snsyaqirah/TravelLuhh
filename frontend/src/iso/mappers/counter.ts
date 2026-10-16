// S3 Counter (§8): the Fund tab stage. A ledger plinth with the trip's jar on the left and one category block
// per category with spend on a single baseline along +X. The jar's interior is 3.0 tall and so is the budget:
// a block's height is 3.0 × catSpent / target, so while under budget the coins left plus the blocks add up to
// the dashed budget line. Pure: data in, spec out. Also home to the small layout helpers the other E8 mappers
// share (tight framing, label room, collision-free label picks).
import { CATEGORY_ORDER, type CategoryKey } from '@/design/tokens';
import { CATEGORY_LABELS } from '@/lib/categories';
import { formatMoney } from '@/lib/money';
import type { Phase } from '@/lib/phase';
import { MAX_VISIBLE_LABELS, withRevealTargets } from '@/iso/overlay';
import { fitZoom, FIT_PAD, isoProject, projectBounds, type Bounds } from '@/iso/projection';
import { BLOCK, JAR_INTERIOR, JAR_MAX_R, JAR_REF_HEIGHT, LID } from '@/iso/shapes';
import type { LidColorKey, LidState, SceneLabel, SceneSpecBase, SceneTarget, Vec3 } from '@/iso/specs';

// =============================================================================================== shared helpers

const K_X = Math.SQRT1_2;
const K_XZ = 1 / Math.sqrt(6);
const K_Y = 2 / Math.sqrt(6);

/** Lid colour per phase (§2.2): fund before, brass on the road, rule-strong at home. */
export const LID_BY_PHASE: Record<Phase, LidColorKey> = {
  upcoming: 'lidUpcoming',
  onTheRoad: 'lidOnTheRoad',
  home: 'lidHome',
};

/** Money for scene labels and summaries: whole units from 100 up and for whole amounts ('RM 2,340', 'RM 50'),
 * cents otherwise ('RM 12.50'). */
export function sceneMoney(amount: number, currency: string, o: { approx?: boolean } = {}): string {
  const v = Number.isFinite(amount) ? amount : 0;
  const whole = Math.abs(v) >= 100 || Math.abs(v - Math.round(v)) < 0.005;
  return formatMoney(v, currency, { approx: o.approx, decimals: whole ? 'none' : undefined });
}

/** Ground point (y = 0) that projects to screen point (sx, sy). */
export function screenToGround(sx: number, sy: number): Vec3 {
  const a = sx / K_X; // x − z
  const b = sy / K_XZ; // x + z
  return [(a + b) / 2, 0, (b - a) / 2];
}

/**
 * A framing box for IsoStage whose projection is exactly the screen extent of `points`.
 *
 * spec.bounds only frames the camera (computeView projects its 8 corners). The plain axis-aligned box of a
 * scene with a tall jar at the back wastes a third of the slot, because its top-back corner projects far
 * above anything real. This box covers the same screen rectangle as the content, so scenes fill the slot.
 * A box always projects at least 0.577 × as tall as it is wide; for flatter content the extra room is
 * split evenly above and below.
 */
export function fitScreenBounds(points: readonly Vec3[]): Bounds {
  if (points.length === 0) return { min: [0, 0, 0], max: [1, 1, 1] };
  let sx0 = Infinity;
  let sx1 = -Infinity;
  let sy0 = Infinity;
  let sy1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const p of points) {
    const [sx, sy] = isoProject(p);
    sx0 = Math.min(sx0, sx);
    sx1 = Math.max(sx1, sx);
    sy0 = Math.min(sy0, sy);
    sy1 = Math.max(sy1, sy);
    z0 = Math.min(z0, p[2]);
    z1 = Math.max(z1, p[2]);
  }
  let minz = z0;
  let maxz = z1;
  let minx = sx0 / K_X + maxz;
  let maxx = sx1 / K_X + minz;
  if (minx > maxx) {
    const zc = (z0 + z1) / 2;
    minz = zc;
    maxz = zc;
    minx = sx0 / K_X + zc;
    maxx = sx1 / K_X + zc;
  }
  let maxy = ((minx + minz) * K_XZ - sy0) / K_Y;
  let miny = ((maxx + maxz) * K_XZ - sy1) / K_Y;
  if (miny > maxy) {
    // Content flatter than any box can project: keep it centred vertically.
    const y = (((minx + minz + maxx + maxz) / 2) * K_XZ - (sy0 + sy1) / 2) / K_Y;
    miny = y;
    maxy = y;
  }
  const r = (v: number) => Math.round(v * 1e4) / 1e4;
  return { min: [r(minx), r(miny), r(minz)], max: [r(maxx), r(maxy), r(maxz)] };
}

/** The slot a mapper plans its labels for (IsoStage measures the real one; this only sizes label room). */
export interface NominalSlot {
  w: number;
  h: number;
  fit: 'contain' | 'height';
}

/** Typical stage slots: mobile 375 minus gutters, desktop the 7-column stage. */
export const STAGE_SLOT: Record<'compact' | 'wide', NominalSlot> = {
  compact: { w: 343, h: 220, fit: 'contain' },
  wide: { w: 640, h: 320, fit: 'contain' },
};

/** Zoom the stage would pick for these bounds in this slot (same rules as computeView). */
export function nominalZoom(b: Bounds, slot: NominalSlot): number {
  if (slot.fit === 'contain') return fitZoom(b, slot.w, slot.h);
  const { minY, maxY } = projectBounds(b);
  return Math.max((slot.h / Math.max(maxY - minY, 1e-6)) * (1 - 2 * FIT_PAD), 1e-3);
}

// Chip metrics from SceneLabels: type-ledger 14px Plex Mono (≈ 8.4px a glyph), overline 11px, 6px gap.
const CHAR_PX = 8.6;
const SUB_CHAR_PX = 7.6;
const CHIP_PAD_X = 16;
const CHIP_H = 26;
const SUB_H = 14;
const ANCHOR_GAP = 6;

/** Screen rectangle (screen units, y down) a label chip covers at `zoom`. */
export interface ScreenRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function labelRect(label: SceneLabel, zoom: number): ScreenRect {
  const [sx, sy] = isoProject(label.at);
  const w = (Math.max(label.text.length * CHAR_PX, (label.sub?.length ?? 0) * SUB_CHAR_PX) + CHIP_PAD_X) / zoom;
  const h = (CHIP_H + (label.sub ? SUB_H : 0)) / zoom;
  const g = ANCHOR_GAP / zoom;
  switch (label.anchor ?? 'above') {
    case 'below':
      return { x0: sx - w / 2, x1: sx + w / 2, y0: sy + g, y1: sy + g + h };
    case 'left':
      return { x0: sx - g - w, x1: sx - g, y0: sy - h / 2, y1: sy + h / 2 };
    case 'right':
      return { x0: sx + g, x1: sx + g + w, y0: sy - h / 2, y1: sy + h / 2 };
    case 'above':
    default:
      return { x0: sx - w / 2, x1: sx + w / 2, y0: sy - g - h, y1: sy - g };
  }
}

export function rectsOverlap(a: ScreenRect, b: ScreenRect, margin = 0): boolean {
  return a.x0 < b.x1 + margin && b.x0 < a.x1 + margin && a.y0 < b.y1 + margin && b.y0 < a.y1 + margin;
}

const rectCorners = (r: ScreenRect): Vec3[] => [
  screenToGround(r.x0, r.y0),
  screenToGround(r.x1, r.y0),
  screenToGround(r.x0, r.y1),
  screenToGround(r.x1, r.y1),
];

export interface PlannedLabels {
  bounds: Bounds;
  /** Labels to ship, in display priority order. */
  labels: SceneLabel[];
  /** Zoom the labels were planned at. */
  zoom: number;
}

/** SceneLabels always shows the first four labels by priority; the rest only on focus/hover of their target. */
export const ALWAYS_VISIBLE_LABELS = MAX_VISIBLE_LABELS;

/** Screen rectangle of a group of world points (an object's silhouette box). */
export function screenRect(points: readonly Vec3[]): ScreenRect {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    const [x, y] = isoProject(p);
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1 };
}

/** Something a label must not cover (data: a jar, a block). `id` lets an object's own label sit on it. */
export interface LabelObstacle {
  id?: string;
  rect: ScreenRect;
}

/** One optional label, or alternatives for it (same id, different anchors) tried in order. */
export type LabelChoice = SceneLabel | readonly SceneLabel[];

export interface PlanOptions {
  /** At most this many optional labels always visible. */
  maxOptional?: number;
  obstacles?: readonly LabelObstacle[];
}

/**
 * Frames `points` plus room for the labels that are always visible.
 * `required` labels always show (in order). `optional` labels are tried in order and shown when one of their
 * alternatives overlaps neither a label already shown nor an obstacle. Whatever is left rides along as a
 * `focusOnly` label: it shows only while its target (same id) is hovered or focused and never takes one of
 * the four always-visible slots, so a leftover can't appear on top of the chips that fit.
 */
export function planLabels(
  points: readonly Vec3[],
  required: readonly LabelChoice[],
  optional: readonly LabelChoice[],
  slot: NominalSlot,
  opts: PlanOptions = {},
): PlannedLabels {
  const maxOptional = opts.maxOptional ?? Infinity;
  const obstacles = opts.obstacles ?? [];
  const base = fitScreenBounds(points);
  let zoom = nominalZoom(base, slot);
  const margin = 4 / zoom;
  const shown: SceneLabel[] = [];
  const rest: SceneLabel[] = [];
  const rects: ScreenRect[] = [];
  const altsOf = (choice: LabelChoice): readonly SceneLabel[] => (Array.isArray(choice) ? choice : [choice as SceneLabel]);
  const fits = (l: SceneLabel) => {
    const r = labelRect(l, zoom);
    return (
      !rects.some((o) => rectsOverlap(o, r, margin)) && !obstacles.some((o) => o.id !== l.id && rectsOverlap(o.rect, r, margin))
    );
  };
  // Required: the first alternative that is clear, else the first one anyway.
  for (const choice of required) {
    const alts = altsOf(choice);
    if (!alts.length) continue;
    const pick = alts.find(fits) ?? alts[0];
    shown.push(pick);
    rects.push(labelRect(pick, zoom));
  }
  let taken = 0;
  for (const choice of optional) {
    const alts = altsOf(choice);
    if (!alts.length) continue;
    const pick = shown.length < ALWAYS_VISIBLE_LABELS && taken < maxOptional ? alts.find(fits) : undefined;
    if (!pick) {
      rest.push(alts[0]);
      continue;
    }
    shown.push(pick);
    rects.push(labelRect(pick, zoom));
    taken += 1;
  }
  // Two passes: room for the labels lowers the zoom a little, which makes the chips a little bigger in world
  // units. Labels stay on their anchors; only the framing grows.
  let bounds = base;
  for (let pass = 0; pass < 2; pass++) {
    const extra = shown.flatMap((l) => rectCorners(labelRect(l, zoom)));
    bounds = fitScreenBounds([...points, ...extra]);
    zoom = nominalZoom(bounds, slot);
  }
  const labels = [...shown, ...rest.map((l) => ({ ...l, focusOnly: true }))];
  return { bounds, labels: labels.map((l, i) => ({ ...l, priority: i })), zoom };
}

/** Keep targets whose projected centres sit at least `minPx` apart at `zoom` (greedy, in the given order). */
export function spreadTargets(targets: readonly SceneTarget[], zoom: number, minPx = 36): SceneTarget[] {
  const kept: Array<{ t: SceneTarget; x: number; y: number }> = [];
  for (const t of targets) {
    const [x, y] = isoProject(t.at);
    if (kept.every((k) => Math.hypot((k.x - x) * zoom, (k.y - y) * zoom) >= minPx)) kept.push({ t, x, y });
  }
  return kept.map((k) => k.t);
}

/** Snap to the 0.25 world grid (§7.1). */
export const snap = (v: number, step = 0.25) => Math.round(v / step) * step;

// ================================================================================================ the Counter

/** The jar's interior height, the budget line and the block scale (3.0 = the whole budget). */
export const COUNTER_FULL = 3.0;
/** Blocks taller than this are cut with a zig-zag cap and their label gets ▲. */
export const COUNTER_CLAMP = 4.5;
/** Jar height whose interior (0.85 × H) is exactly COUNTER_FULL. */
export const COUNTER_JAR_H = COUNTER_FULL / JAR_INTERIOR;
const JAR_S = COUNTER_JAR_H / JAR_REF_HEIGHT;
const JAR_R = JAR_MAX_R * JAR_S;
const MARGIN = 0.5;
const JAR_GAP = 0.6;
/** Fixed 7-slot row: the framing never changes as categories appear, so the jar never rescales mid-trip. */
const SLOTS = CATEGORY_ORDER.length;
const PITCH = BLOCK.w; // gaps closed

/** Zig-zag cap on a clamped block: a paper break band this far below the top. */
export const ZIGZAG = { capH: 0.45, band: 0.13, teeth: 3, amp: 0.1 } as const;

/** Budget line dashes (thin boxes, so the line stays ≥ 1 CSS px on phones). */
export const BUDGET_DASH = { len: 0.16, gap: 0.1, thick: 0.05 } as const;

export interface CounterBlockSpec {
  /** Same id as the block's target and label. */
  id: string;
  category: CategoryKey;
  /** Trip currency. */
  amount: number;
  /** Share of all category spend, 0..1. */
  share: number;
  /** Base centre. */
  at: Vec3;
  /** Drawn height (≥ .12, ≤ 4.5). */
  height: number;
  /** True when the real height was above 4.5 and is drawn cut. */
  clamped: boolean;
}

export interface CounterSpec extends SceneSpecBase {
  kind: 'counter';
  tripId: number;
  currency: string;
  /** budget: heights are shares of the budget. compare: no budget, heights compare categories only. */
  mode: 'budget' | 'compare';
  over: boolean;
  plinth: { at: Vec3; w: number; d: number };
  jar: {
    at: Vec3;
    height: number;
    fill: number;
    lid: LidState;
    lidColor: LidColorKey;
    /** Where a leaving coin starts (top of the mouth). */
    mouth: Vec3;
  };
  /** Fixed category order, only categories with spend. */
  blocks: CounterBlockSpec[];
  /** Sketch block in the first slot when nothing has been spent yet. */
  ghostBlock: { at: Vec3; size: Vec3 } | null;
  /** Dashed line at y = 3.0 across the row: the whole budget. Null without a budget. */
  budgetLine: { from: Vec3; to: Vec3; tone: 'ink3' | 'over' } | null;
  /** Base centre of each of the 7 row slots (live coins aim at a slot before its block exists). */
  slots: Vec3[];
}

/** The parts of FundState the Counter reads (pass useFund(trip, { spent: totalSpent }) so jar and blocks agree). */
export interface CounterFund {
  target: number;
  spent: number;
  inJar: number;
  over: number;
  fill: number;
  hasBudget: boolean;
  currency: string;
  phase: Phase;
}

export interface CounterInput {
  tripId: number;
  fund: CounterFund;
  /** Trip-currency totals per category: useExpenses(tripId).totalsByCategory. Unknown keys count as Other. */
  byCategory: Partial<Record<string, number>>;
}

export interface CounterOptions {
  /** Mobile slot: labels only for blocks ≥ 8% of spend, sized for a 343×220 stage. */
  compact?: boolean;
}

const finite = (n: unknown) => {
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? v : 0;
};

function categoryTotals(byCategory: Partial<Record<string, number>>): Array<[CategoryKey, number]> {
  const sums = new Map<CategoryKey, number>();
  for (const [key, raw] of Object.entries(byCategory)) {
    const amount = finite(raw);
    if (amount <= 0) continue;
    const k = (CATEGORY_ORDER as readonly string[]).includes(key) ? (key as CategoryKey) : 'other';
    sums.set(k, (sums.get(k) ?? 0) + amount);
  }
  return CATEGORY_ORDER.filter((k) => (sums.get(k) ?? 0) > 0).map((k) => [k, sums.get(k) as number]);
}

/** Dash segments [start, end] along a line of length `len` (shared by the 3D scene and its twin). */
export function dashSegments(len: number, dash: number = BUDGET_DASH.len, gap: number = BUDGET_DASH.gap): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let s = 0; s < len - 1e-6; s += dash + gap) out.push([s, Math.min(s + dash, len)]);
  return out;
}

export interface DashBox {
  center: Vec3;
  size: Vec3;
}

/**
 * The budget line as dash boxes: the level at y = 3.0 across the row plus a dashed post down to the plinth
 * at each end, so it reads as "this high = the whole budget" rather than a line hanging in the air.
 */
export function budgetDashBoxes(line: { from: Vec3; to: Vec3 }): DashBox[] {
  const t = BUDGET_DASH.thick;
  const [fx, fy, fz] = line.from;
  const out: DashBox[] = dashSegments(line.to[0] - fx).map(([a, b]) => ({ center: [fx + (a + b) / 2, fy, fz], size: [b - a, t, t] }));
  for (const x of [fx, line.to[0]]) {
    for (const [a, b] of dashSegments(fy - t / 2)) out.push({ center: [x, (a + b) / 2, fz], size: [t, b - a, t] });
  }
  return out;
}

/**
 * Zig-zag break band in face coordinates (u across the face, centred; v up from the band's centre line):
 * a strip `band` tall whose two edges zig-zag with `teeth` teeth. Closed polygon, counter-clockwise.
 */
export function zigzagBand(width: number, band: number = ZIGZAG.band, teeth: number = ZIGZAG.teeth, amp: number = ZIGZAG.amp): Array<[number, number]> {
  const n = teeth * 2;
  const edge = (offset: number) =>
    Array.from({ length: n + 1 }, (_, i) => [-width / 2 + (width * i) / n, offset + (i % 2 === 0 ? -amp / 2 : amp / 2)] as [number, number]);
  const lower = edge(-band / 2);
  const upper = edge(band / 2).reverse();
  return [...lower, ...upper];
}

export function mapCounter({ tripId, fund, byCategory }: CounterInput, opts: CounterOptions = {}): CounterSpec {
  const currency = fund.currency;
  const money = (n: number) => sceneMoney(n, currency);
  const hasBudget = fund.hasBudget && fund.target > 0;
  const over = hasBudget && fund.over > 0;
  const totals = categoryTotals(byCategory);
  const catSum = totals.reduce((s, [, a]) => s + a, 0);
  const maxCat = totals.reduce((m, [, a]) => Math.max(m, a), 0);

  // ---- layout (fixed: plinth, jar, 7 slots)
  const d = snap(2 * JAR_R + 2 * 0.3);
  const zc = d / 2;
  const jarX = snap(MARGIN + JAR_R);
  const x0 = snap(jarX + JAR_R + JAR_GAP + PITCH / 2);
  const slots: Vec3[] = Array.from({ length: SLOTS }, (_, i) => [x0 + i * PITCH, 0, zc]);
  const rowEnd = x0 + (SLOTS - 1) * PITCH + PITCH / 2;
  const w = rowEnd + MARGIN;
  const plinth = { at: [w / 2, 0, zc] as Vec3, w, d };

  const fill = hasBudget && !over ? Math.min(Math.max(fund.fill, 0), 1) : 0;
  const jarAt: Vec3 = [jarX, 0, zc];
  const jar = {
    at: jarAt,
    height: COUNTER_JAR_H,
    fill,
    lid: (over ? 'off' : 'closed') as LidState,
    lidColor: LID_BY_PHASE[fund.phase] ?? 'lidUpcoming',
    mouth: [jarX, COUNTER_JAR_H, zc] as Vec3,
  };

  // ---- blocks
  const blocks: CounterBlockSpec[] = totals.map(([category, amount], i) => {
    const raw = hasBudget ? (COUNTER_FULL * amount) / fund.target : maxCat > 0 ? (COUNTER_FULL * amount) / maxCat : 0;
    const clamped = raw > COUNTER_CLAMP;
    return {
      id: `cat-${category}`,
      category,
      amount,
      share: catSum > 0 ? amount / catSum : 0,
      at: slots[i],
      height: Math.min(Math.max(raw, BLOCK.minH), COUNTER_CLAMP),
      clamped,
    };
  });

  const ghostBlock = blocks.length === 0 ? { at: slots[0], size: [BLOCK.w, 0.45, BLOCK.d] as Vec3 } : null;

  const budgetLine = hasBudget
    ? {
        from: [x0 - PITCH / 2, COUNTER_FULL, zc + BLOCK.d / 2 + 0.03] as Vec3,
        to: [rowEnd, COUNTER_FULL, zc + BLOCK.d / 2 + 0.03] as Vec3,
        tone: (over ? 'over' : 'ink3') as 'ink3' | 'over',
      }
    : null;

  // ---- labels
  const lidTop = COUNTER_JAR_H + (jar.lid === 'closed' ? LID.h * JAR_S : 0);
  const rightOfJar: Vec3 = [jarX + LID.r * JAR_S * K_X, lidTop - 0.1, zc - LID.r * JAR_S * K_X];
  const jarWords: Pick<SceneLabel, 'text' | 'tone'> = !hasBudget
    ? { text: 'No budget set', tone: 'muted' }
    : over
      ? { text: `Over ${money(fund.over)}`, tone: 'stamp' }
      : { text: `${money(fund.inJar)} left`, tone: 'fund' };
  // Right of the lid (clear air above the row), else above the lid, else left of the jar.
  const jarLabel: SceneLabel[] = [
    { id: 'jar', at: rightOfJar, anchor: 'right', ...jarWords },
    { id: 'jar', at: [jarX - 0.3, lidTop + 0.05, zc - 0.3], anchor: 'above', ...jarWords },
    { id: 'jar', at: [jarX - JAR_R * K_X, COUNTER_JAR_H * 0.55, zc + JAR_R * K_X], anchor: 'left', ...jarWords },
  ];

  const propTop = 0.62; // tallest prop (pennant); keeps chips clear of every prop
  // Above the block; or right of its top's far corner, at a few heights, but only when nothing just to its right is
  // taller (a chip floating over a taller neighbour would read as that neighbour's).
  const blockLabels: SceneLabel[][] = blocks
    .filter((b) => !opts.compact || b.share >= 0.08)
    .slice()
    .sort((a, b) => b.amount - a.amount)
    .map((b) => {
      const text = `${b.clamped ? '▲ ' : ''}${money(b.amount)}`;
      const i = blocks.indexOf(b);
      const tallerRight = blocks.slice(i + 1, i + 4).some((n) => n.height > b.height + 0.3);
      // The category is named on the chip, so a chip set off to the right still says whose amount it is.
      const sub = CATEGORY_LABELS[b.category];
      const above: SceneLabel = { id: b.id, at: [b.at[0], b.height + propTop, b.at[2]], text, sub, tone: 'ink', anchor: 'above' };
      const right = (lift: number): SceneLabel => ({
        id: b.id,
        at: [b.at[0] + BLOCK.w / 2, b.height + lift, b.at[2] - BLOCK.d / 2],
        text,
        sub,
        tone: 'ink',
        anchor: 'right',
      });
      return tallerRight ? [above] : [above, right(propTop), right(propTop + 0.35), right(propTop + 0.7)];
    });

  const jarTop = lidTop;
  const obstacles: LabelObstacle[] = [
    {
      id: 'jar',
      rect: screenRect([
        [jarX - JAR_R * K_X, jarTop, zc + JAR_R * K_X],
        [jarX + JAR_R * K_X, jarTop, zc - JAR_R * K_X],
        [jarX + JAR_R * K_X, 0, zc + JAR_R * K_X],
        [jarX - JAR_R * K_X, 0, zc + JAR_R * K_X],
        [jarX + JAR_R, 0, zc + JAR_R],
      ]),
    },
    // Body corners plus the prop's top at the centre: the real silhouette's box, not the bounding box's.
    ...blocks.map((b) => ({
      id: b.id,
      rect: screenRect([
        [b.at[0] - BLOCK.w / 2, b.height, b.at[2] - BLOCK.d / 2],
        [b.at[0] + BLOCK.w / 2, 0, b.at[2] + BLOCK.d / 2],
        [b.at[0] - BLOCK.w / 2, 0, b.at[2] + BLOCK.d / 2],
        [b.at[0] + BLOCK.w / 2, 0, b.at[2] - BLOCK.d / 2],
        [b.at[0], b.height + propTop - 0.05, b.at[2]],
      ]),
    })),
  ];

  const points: Vec3[] = [
    [plinth.at[0] - w / 2, -0.4, 0],
    [plinth.at[0] + w / 2, -0.4, 0],
    [plinth.at[0] - w / 2, -0.4, d],
    [plinth.at[0] + w / 2, -0.4, d],
    [plinth.at[0] - w / 2, 0, 0],
    [plinth.at[0] + w / 2, 0, d],
    // jar silhouette and lid
    [jarX - JAR_R * K_X, lidTop, zc + JAR_R * K_X],
    [jarX + JAR_R * K_X, lidTop, zc - JAR_R * K_X],
    [jarX - JAR_R, lidTop, zc - JAR_R],
    ...blocks.flatMap((b) => [
      [b.at[0] - BLOCK.w / 2, b.height + propTop, b.at[2] - BLOCK.d / 2] as Vec3,
      [b.at[0] + BLOCK.w / 2, b.height + propTop, b.at[2] - BLOCK.d / 2] as Vec3,
    ]),
  ];
  if (budgetLine) points.push(budgetLine.from, budgetLine.to);

  const slot = opts.compact ? STAGE_SLOT.compact : STAGE_SLOT.wide;
  const plan = planLabels(points, [jarLabel], blockLabels, slot, { maxOptional: opts.compact ? 2 : 3, obstacles });

  // ---- targets: one per block (top centre), spread so DOM buttons don't stack
  const targets = spreadTargets(
    blocks
      .slice()
      .sort((a, b) => b.amount - a.amount)
      .map((b) => ({
        id: b.id,
        at: [b.at[0], b.height + 0.25, b.at[2]] as Vec3,
        ariaLabel: `${CATEGORY_LABELS[b.category]}: ${money(b.amount)}, ${Math.round(b.share * 100)}% of spent. Open in ledger`,
        href: `/trips/${tripId}/ledger?cat=${b.category}`,
      })),
    plan.zoom,
  );

  // ---- words
  const list = blocks.map((b) => `${CATEGORY_LABELS[b.category]} ${money(b.amount)}`).join(', ');
  let summary: string;
  if (blocks.length === 0) {
    summary = hasBudget ? `Nothing spent yet. ${money(fund.inJar)} in the jar.` : 'Nothing spent yet. No budget set for this trip.';
  } else if (!hasBudget) {
    summary = `Spent ${money(fund.spent)}: ${list}. No budget, heights compare categories only.`;
  } else if (over) {
    summary = `Spent ${money(fund.spent)} of ${money(fund.target)}, ${money(fund.over)} over: ${list}.`;
  } else {
    summary = `Spent ${money(fund.spent)} of ${money(fund.target)}: ${list}.`;
  }

  return {
    kind: 'counter',
    tripId,
    currency,
    mode: hasBudget ? 'budget' : 'compare',
    over,
    bounds: plan.bounds,
    labels: withRevealTargets(plan.labels, targets),
    targets,
    summary,
    unitChip: hasBudget ? `Dashed line = ${money(fund.target)}` : undefined,
    plinth,
    jar,
    blocks,
    ghostBlock,
    budgetLine,
    slots,
  };
}
