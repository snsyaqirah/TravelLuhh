// S4 Suitcase (§8): the Pack tab stage. p = packed / total opens the lid by 100° × (1 − p)^0.6; at p = 1 it is
// shut, buckled and SIAP. Packed items fill a 6 × 4 × 2 grid of 48 slots, grouped by packing category; what is
// still unpacked waits beside the case as sketch boxes (at most 12, then "+n"). Pure: data in, spec out.
import type { FabricKey } from '@/design/tokens';
import type { PackingItem } from '@/types';
import { PACKING_CATEGORIES, PACKING_CATEGORY_KEYS, type PackingCategory } from '@/data/packing';
import { rng } from '@/iso/seed';
import { PACKED, SUITCASE } from '@/iso/shapes';
import type { SceneLabel, SceneSpecBase, Vec3 } from '@/iso/specs';
import { planLabels, screenRect, STAGE_SLOT, type LabelObstacle } from '@/iso/mappers/counter';

/** Packing categories in fill order (§8), from the shared catalogue (data/packing). Unknown → 'general'. */
export const PACKING_CATEGORY_ORDER = PACKING_CATEGORY_KEYS;

export type { PackingCategory };

/** Fabric tone per packing category (§8). Documents are a passport slab rather than a soft brick. */
export const PACKING_TONE = Object.fromEntries(PACKING_CATEGORIES.map((c) => [c.key, c.fabric])) as Readonly<
  Record<PackingCategory, FabricKey>
>;

export function packingCategory(value: string | null | undefined): PackingCategory {
  const v = (value ?? '').trim().toLowerCase();
  return (PACKING_CATEGORY_ORDER as readonly string[]).includes(v) ? (v as PackingCategory) : 'general';
}

/** Grid of the case interior: 6 across (x), 4 deep (z), 2 layers. */
export const CASE_GRID = { cols: 6, rows: 4, layers: 2 } as const;
export const CASE_SLOTS = CASE_GRID.cols * CASE_GRID.rows * CASE_GRID.layers;
/** Sketch boxes shown beside the case before "+n". */
export const GHOST_CAP = 12;
/** Full lid opening in degrees (p = 0). */
export const LID_OPEN = 100;

const innerW = SUITCASE.w - 2 * SUITCASE.wall;
const innerD = SUITCASE.d - 2 * SUITCASE.wall;
const PITCH_X = innerW / CASE_GRID.cols;
const PITCH_Z = innerD / CASE_GRID.rows;
const FLOOR = SUITCASE.baseH;

/** Base centre of slot k: layer-major, then rows from the hinge side forward, each row left to right. */
export function caseSlotXZ(k: number): [number, number] {
  const j = k % (CASE_GRID.cols * CASE_GRID.rows);
  const row = Math.floor(j / CASE_GRID.cols);
  const col = j % CASE_GRID.cols;
  return [-innerW / 2 + PITCH_X * (col + 0.5), -innerD / 2 + PITCH_Z * (row + 0.5)];
}

/** Sketch box g beside the case (+X side): 3 across, rows matching the case rows. */
const GHOST_X0 = SUITCASE.w / 2 + 0.45;
const GHOST_PITCH_X = 0.42;
export function ghostXZ(g: number): [number, number] {
  const col = g % 3;
  const row = Math.floor(g / 3);
  return [GHOST_X0 + col * GHOST_PITCH_X, -innerD / 2 + PITCH_Z * (row + 0.5)];
}

/** Lid angle in degrees for a packed share p (0..1): 100° × (1 − p)^0.6. */
export function lidAngleFor(p: number): number {
  const q = Math.min(Math.max(Number.isFinite(p) ? p : 0, 0), 1);
  return LID_OPEN * Math.pow(1 - q, 0.6);
}

/** Smallest items-per-box so every category's boxes fit the 48 slots (1 when the list fits as is). */
export function itemsPerBox(countsByCategory: readonly number[]): number {
  const total = countsByCategory.reduce((s, n) => s + n, 0);
  let u = Math.max(1, Math.ceil(total / CASE_SLOTS));
  while (countsByCategory.reduce((s, n) => s + Math.ceil(n / u), 0) > CASE_SLOTS) u += 1;
  return u;
}

export interface SuitcaseBox {
  /** Stable across ticks: the first item it holds. */
  key: string;
  itemIds: number[];
  category: PackingCategory;
  tone: FabricKey;
  /** Passport slab (documents) instead of a fabric brick. */
  slab: boolean;
  /** Base centre. */
  at: Vec3;
  rotY: number;
  slot: number;
}

export interface SuitcaseGhost {
  /** `item-<id>`, or `empty-<n>` for the empty-state sketches. */
  key: string;
  itemId: number | null;
  /** Base centre. */
  at: Vec3;
  size: Vec3;
}

export interface SuitcaseSpec extends SceneSpecBase {
  kind: 'suitcase';
  tripId: number;
  total: number;
  packed: number;
  /** packed / total (0 when the list is empty). */
  progress: number;
  /** Degrees; 0 = shut. */
  lidAngle: number;
  /** All packed: lid shut and buckled, SIAP. */
  done: boolean;
  /** Items per box (1 unless the list is longer than 48). */
  unit: number;
  case: { at: Vec3 };
  plinth: { at: Vec3; w: number; d: number };
  boxes: SuitcaseBox[];
  ghosts: SuitcaseGhost[];
  /** Unpacked items not drawn (the "+n"). */
  hiddenUnpacked: number;
  /** Where a page may pin E4's PassportStamp SIAP (world point on the closed lid), when done. */
  stamp: { at: Vec3; text: 'SIAP' } | null;
}

export interface SuitcaseInput {
  tripId: number;
  items: ReadonlyArray<Pick<PackingItem, 'id' | 'isChecked'> & { category?: string | null }>;
}

export interface SuitcaseOptions {
  compact?: boolean;
  /**
   * Draw the SIAP state as a scene label (default). Pass false when the page shows E4's PassportStamp
   * instead, so the stamp isn't doubled.
   */
  stampLabel?: boolean;
}

const CASE_TOP = SUITCASE.wallH * 2;

export function mapSuitcase({ tripId, items }: SuitcaseInput, opts: SuitcaseOptions = {}): SuitcaseSpec {
  const list = items
    .filter((it) => it && Number.isFinite(Number(it.id)))
    .map((it) => ({ id: Number(it.id), checked: !!it.isChecked, category: packingCategory(it.category) }))
    .sort(
      (a, b) =>
        PACKING_CATEGORY_ORDER.indexOf(a.category) - PACKING_CATEGORY_ORDER.indexOf(b.category) || a.id - b.id,
    );
  const total = list.length;
  const packed = list.filter((i) => i.checked).length;
  const progress = total > 0 ? packed / total : 0;
  const done = total > 0 && packed === total;
  const lidAngle = done ? 0 : lidAngleFor(progress);

  const byCat = PACKING_CATEGORY_ORDER.map((c) => list.filter((i) => i.category === c));
  const unit = itemsPerBox(byCat.map((g) => g.length));

  // ---- packed boxes: per category, chunks of `unit` ticked items; slots filled in category order
  const boxes: SuitcaseBox[] = [];
  const floorTop = new Map<number, number>(); // layer-0 slot → top of what sits there
  for (const group of byCat) {
    const ticked = group.filter((i) => i.checked);
    for (let c = 0; c < ticked.length; c += unit) {
      const chunk = ticked.slice(c, c + unit);
      const slot = boxes.length;
      const category = chunk[0].category;
      const tone = PACKING_TONE[category];
      const slab = tone === 'passport';
      const [x, z] = caseSlotXZ(slot);
      const perLayer = CASE_GRID.cols * CASE_GRID.rows;
      const layer = Math.floor(slot / perLayer);
      const y = layer === 0 ? FLOOR : (floorTop.get(slot % perLayer) ?? FLOOR);
      const h = slab ? PACKED.slab[1] : PACKED.box[1];
      if (layer === 0) floorTop.set(slot, FLOOR + h);
      const r = rng(`pack|${tripId}|${chunk[0].id}`);
      boxes.push({
        key: `box-${chunk[0].id}`,
        itemIds: chunk.map((i) => i.id),
        category,
        tone,
        slab,
        at: [x, y, z],
        rotY: r.range(-0.08, 0.08),
        slot,
      });
    }
  }

  // ---- unpacked: one sketch box per item beside the case, capped
  const unpacked = list.filter((i) => !i.checked);
  const box: Vec3 = [PACKED.box[0], PACKED.box[1], PACKED.box[2]];
  const ghosts: SuitcaseGhost[] =
    total === 0
      ? [0, 1, 2].map((g) => {
          const [x, z] = ghostXZ(g);
          return { key: `empty-${g}`, itemId: null, at: [x, 0, z] as Vec3, size: box };
        })
      : unpacked.slice(0, GHOST_CAP).map((it, g) => {
          const [x, z] = ghostXZ(g);
          return { key: `item-${it.id}`, itemId: it.id, at: [x, 0, z] as Vec3, size: box };
        });
  const hiddenUnpacked = Math.max(0, unpacked.length - GHOST_CAP);

  // ---- frame
  const caseAt: Vec3 = [0, 0, 0];
  const xMin = -SUITCASE.w / 2 - 0.3;
  const xMax = ghostXZ(2)[0] + PACKED.box[0] / 2 + 0.35;
  const zMin = -SUITCASE.d / 2 - 0.45;
  const zMax = SUITCASE.d / 2 + 0.35;
  const plinth = { at: [(xMin + xMax) / 2, 0, (zMin + zMax) / 2] as Vec3, w: xMax - xMin, d: zMax - zMin };
  // The open lid stands up to ~2 behind the hinge; frame its corners at this angle (pivot: back top edge).
  const rad = (lidAngle * Math.PI) / 180;
  const lidCorner = (yy: number, zz: number): [number, number] => [
    SUITCASE.wallH + yy * Math.cos(rad) + zz * Math.sin(rad),
    -SUITCASE.d / 2 - yy * Math.sin(rad) + zz * Math.cos(rad),
  ];
  const lidCorners = [lidCorner(0, SUITCASE.d), lidCorner(SUITCASE.wallH, SUITCASE.d), lidCorner(SUITCASE.wallH, 0)];
  const points: Vec3[] = [
    [xMin, -0.4, zMin],
    [xMax, -0.4, zMin],
    [xMin, -0.4, zMax],
    [xMax, -0.4, zMax],
    [xMin, 0, zMin],
    [xMax, 0, zMax],
    [-SUITCASE.w / 2, CASE_TOP, SUITCASE.d / 2],
    ...lidCorners.flatMap(([y, z]) => [
      [-SUITCASE.w / 2, y, z] as Vec3,
      [SUITCASE.w / 2, y, z] as Vec3,
    ]),
  ];

  // ---- labels: the pile's chip goes beside the pile, never over the case
  const labels: SceneLabel[][] = [];
  const [gx0] = ghostXZ(0);
  const [gx2, gzBack] = ghostXZ(2);
  const [, gzFront] = ghostXZ(GHOST_CAP - 1);
  const pileAround = (words: Pick<SceneLabel, 'id' | 'text' | 'sub' | 'tone'>): SceneLabel[] => [
    { ...words, at: [gx2 + PACKED.box[0] / 2 + 0.05, 0.1, gzBack], anchor: 'right' },
    { ...words, at: [gx2 + PACKED.box[0] / 2, 0, gzFront + PACKED.box[2] / 2], anchor: 'below' },
    { ...words, at: [(gx0 + gx2) / 2, 0.3, gzBack], anchor: 'above' },
  ];
  const stampAt: Vec3 = [0, CASE_TOP + 0.02, 0.15];
  if (total === 0) {
    labels.push(pileAround({ id: 'start', text: 'Start from a list', tone: 'muted' }));
  } else if (done) {
    if (opts.stampLabel !== false) labels.push([{ id: 'siap', at: stampAt, text: 'SIAP', tone: 'fund', anchor: 'above' }]);
  } else if (unpacked.length > 0) {
    const n = unpacked.length;
    labels.push(
      pileAround(
        hiddenUnpacked > 0
          ? { id: 'more', text: `+${hiddenUnpacked}`, sub: `${n} to pack`, tone: 'muted' }
          : { id: 'to-pack', text: `${n} to pack`, tone: 'muted' },
      ),
    );
  }
  const caseObstacle: LabelObstacle = {
    rect: screenRect([
      [-SUITCASE.w / 2, CASE_TOP, SUITCASE.d / 2],
      [SUITCASE.w / 2, 0, SUITCASE.d / 2],
      [SUITCASE.w / 2, 0, -SUITCASE.d / 2],
      [SUITCASE.w / 2, CASE_TOP, -SUITCASE.d / 2],
      ...lidCorners.flatMap(([y, z]) => [[-SUITCASE.w / 2, y, z] as Vec3, [SUITCASE.w / 2, y, z] as Vec3]),
    ]),
  };
  const plan = planLabels(points, labels, [], opts.compact ? STAGE_SLOT.compact : STAGE_SLOT.wide, {
    obstacles: [caseObstacle],
  });

  const summary =
    total === 0
      ? 'Empty bag. Start from a list or add your own.'
      : done
        ? `All ${total} packed. Zip it.`
        : `${packed} of ${total} packed.`;

  return {
    kind: 'suitcase',
    tripId,
    total,
    packed,
    progress,
    lidAngle,
    done,
    unit,
    case: { at: caseAt },
    plinth,
    boxes,
    ghosts,
    hiddenUnpacked,
    stamp: done ? { at: stampAt, text: 'SIAP' } : null,
    bounds: plan.bounds,
    labels: plan.labels,
    targets: [],
    summary,
    unitChip: unit > 1 ? `1 box = ${unit} items` : undefined,
  };
}
