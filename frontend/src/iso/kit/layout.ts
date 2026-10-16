// Dev kit boards (§14): pure data shared by the WebGL board and its SVG twin, so both draw the same thing.
import type { SceneLabel, Vec3 } from '@/iso/specs';
import type { Bounds } from '@/iso/projection';
import type { StoneState } from '@/iso/types';

/** Cells are laid out on a *screen* grid: columns step screen-right, rows step screen-down. */
const COL: Vec3 = [3.3, 0, -3.3]; // 4.67 screen units right
const ROW: Vec3 = [6.4, 0, 6.4]; // 5.2 screen units down

export type CellId =
  | 'plinth'
  | 'shadow'
  | 'coinPile'
  | 'coinStacks'
  | 'balangClosed'
  | 'balangTilted'
  | 'balangOff'
  | 'balangShared'
  | 'dayStones'
  | 'pennantSignpost'
  | 'ghosts'
  | 'iouSlip'
  | 'categories'
  | 'suitcaseOpen'
  | 'suitcaseClosed'
  | 'packedItems'
  | 'shelf'
  | 'houses'
  | 'road';

export interface KitCell {
  id: CellId;
  name: string;
  col: number;
  row: number;
}

export const PRIMITIVE_CELLS: KitCell[] = [
  { id: 'plinth', name: 'Plinth · ledger', col: 0, row: 0 },
  { id: 'shadow', name: 'HardShadow', col: 1, row: 0 },
  { id: 'coinPile', name: 'CoinPile', col: 2, row: 0 },
  { id: 'coinStacks', name: 'CoinStack', col: 3, row: 0 },
  { id: 'iouSlip', name: 'IOUSlip', col: 4, row: 0 },
  { id: 'balangClosed', name: 'Balang · closed', col: 0, row: 1 },
  { id: 'balangTilted', name: 'Balang · tilted', col: 1, row: 1 },
  { id: 'balangOff', name: 'Balang · lid off', col: 2, row: 1 },
  { id: 'balangShared', name: 'Balang · 3 slots', col: 3, row: 1 },
  { id: 'ghosts', name: 'Ghost', col: 4, row: 1 },
  { id: 'dayStones', name: 'DayStones', col: 0, row: 2 },
  { id: 'categories', name: 'CategoryBlock', col: 2, row: 2 },
  { id: 'pennantSignpost', name: 'Pennant · Signpost', col: 4, row: 2 },
  { id: 'suitcaseOpen', name: 'Suitcase · open', col: 0, row: 3 },
  { id: 'suitcaseClosed', name: 'Suitcase · buckled', col: 1, row: 3 },
  { id: 'packedItems', name: 'PackedItems', col: 2, row: 3 },
  { id: 'shelf', name: 'Shelf', col: 3, row: 3 },
  { id: 'houses', name: 'KampungHouse', col: 4, row: 3 },
  { id: 'road', name: 'Road', col: 0, row: 4 },
];

export function cellCenter(col: number, row: number): Vec3 {
  return [COL[0] * col + ROW[0] * row, 0, COL[2] * col + ROW[2] * row];
}

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** Corner points that frame a set of cells (fed to fitPoints: the layout runs along screen axes). */
export function cellPoints(cells: readonly KitCell[]): Vec3[] {
  const r = 1.7;
  return cells.flatMap((c) => {
    const centre = cellCenter(c.col, c.row);
    const wide = c.id === 'categories' ? 2.6 : 0;
    return [
      add(centre, [-r - wide, 2.6, -r + wide]),
      add(centre, [r + wide, 2.6, r - wide]),
      add(centre, [-r - wide, -0.45, -r + wide]),
      add(centre, [r + wide, -0.45, r - wide]),
      add(centre, [r, -0.8, r]),
      add(centre, [-r, 2.6, r]),
      add(centre, [r, 2.6, -r]),
    ];
  });
}

/** Axis-aligned bounds (only used where a Bounds is required; framing uses cellPoints). */
export const PRIMITIVE_BOUNDS: Bounds = (() => {
  const pts = cellPoints(PRIMITIVE_CELLS);
  return {
    min: [Math.min(...pts.map((p) => p[0])), -0.45, Math.min(...pts.map((p) => p[2]))],
    max: [Math.max(...pts.map((p) => p[0])), 2.6, Math.max(...pts.map((p) => p[2]))],
  };
})();

export const cellLabel = (c: KitCell): SceneLabel => ({
  id: c.id,
  at: add(cellCenter(c.col, c.row), [1.5, -0.3, 1.5]),
  text: c.name,
  anchor: 'below',
  tone: 'muted',
});

export const PRIMITIVE_LABELS: SceneLabel[] = PRIMITIVE_CELLS.map(cellLabel);

// ---------------------------------------------------------------- states board (sketch / ink / chop)

export type RenderStateKey = 'sketch' | 'ink' | 'chop';

export interface StateStone {
  at: Vec3;
  state: StoneState;
  over?: boolean;
  selected?: boolean;
}

export interface StatePlot {
  key: RenderStateKey;
  title: string;
  origin: Vec3;
  plinth: { w: number; d: number; at: Vec3 };
  jar: { at: Vec3; height: number; fill: number; lid: 'closed' | 'tilted' | 'off'; lidColor: 'lidUpcoming' | 'lidOnTheRoad' | 'lidHome' };
  stones: StateStone[];
  stacks: Array<{ at: Vec3; count: number; seed: string }>;
  signpost: Vec3;
}

const DAYS = 10;

function plot(key: RenderStateKey, title: string, col: number): StatePlot {
  const origin: Vec3 = [COL[0] * col * 1.62, 0, COL[2] * col * 1.62];
  const stones: StateStone[] = [];
  const stacks: StatePlot['stacks'] = [];
  for (let i = 0; i < DAYS; i++) {
    const c = i % 4;
    const r = Math.floor(i / 4);
    const at = add(origin, [2.5 + c * 0.75, 0, 0.55 + r * 0.75]);
    let state: StoneState = 'future';
    if (key === 'chop') state = 'past';
    if (key === 'ink') state = i < 5 ? 'past' : i === 5 ? 'today' : 'future';
    const over = key !== 'sketch' && (i === 2 || i === 7) && state !== 'future';
    stones.push({ at, state, over, selected: key === 'ink' && i === 3 });
    if (state !== 'future') {
      const count = [3, 5, 9, 2, 4, 6, 3, 8, 2, 5][i];
      stacks.push({ at: add(at, [0, 0.08 + (state === 'today' ? 0.06 : 0), 0]), count, seed: `${key}-${i}` });
    }
  }
  return {
    key,
    title,
    origin,
    plinth: { w: 5.6, d: 2.9, at: add(origin, [2.8, 0, 1.45]) },
    jar: {
      at: add(origin, [1.0, 0, 1.25]),
      height: 2.0,
      fill: key === 'sketch' ? 1 : key === 'ink' ? 0.55 : 0.18,
      lid: 'closed',
      lidColor: key === 'sketch' ? 'lidUpcoming' : key === 'ink' ? 'lidOnTheRoad' : 'lidHome',
    },
    stones,
    stacks,
    signpost: add(origin, [5.3, 0, 2.35]),
  };
}

export const STATE_PLOTS: StatePlot[] = [plot('sketch', 'Sketch · upcoming', 0), plot('ink', 'Ink · day 6 of 10', 1), plot('chop', 'Chop · home', 2)];

export const STATE_BOUNDS: Bounds = (() => {
  const xs = STATE_PLOTS.flatMap((p) => [p.plinth.at[0] - p.plinth.w / 2, p.plinth.at[0] + p.plinth.w / 2]);
  const zs = STATE_PLOTS.flatMap((p) => [p.plinth.at[2] - p.plinth.d / 2, p.plinth.at[2] + p.plinth.d / 2]);
  return { min: [Math.min(...xs), -0.45, Math.min(...zs)], max: [Math.max(...xs), 2.3, Math.max(...zs)] };
})();

/** Corner points of the three plots, for fitPoints. */
export const STATE_POINTS: Vec3[] = STATE_PLOTS.flatMap((p) => {
  const { w, d, at } = p.plinth;
  return [
    add(at, [-w / 2, 2.4, -d / 2]),
    add(at, [w / 2, 2.4, -d / 2]),
    add(at, [-w / 2, -0.4, d / 2]),
    add(at, [w / 2, -0.4, d / 2]),
    add(at, [-w / 2, 2.4, d / 2]),
    add(at, [w / 2, -0.4, -d / 2]),
  ];
});

export const STATE_LABELS: SceneLabel[] = STATE_PLOTS.map((p) => ({
  id: p.key,
  at: add(p.plinth.at, [p.plinth.w / 2 - 0.4, -0.4, p.plinth.d / 2]),
  text: p.title,
  anchor: 'below',
  tone: 'muted',
}));

// ---------------------------------------------------------------- motion board

export const MOTION = {
  jar: [-0.9, 0, -0.1] as Vec3,
  /** Jar mouth (H 2.0) where a coin leaves. */
  mouth: [-0.9, 2.05, -0.1] as Vec3,
  stone: [1.1, 0, 0.2] as Vec3,
  /** Today's stone is .14 tall. */
  stackTop: 0.14,
};

export const MOTION_BOUNDS: Bounds = { min: [-1.9, -0.4, -1.3], max: [2.3, 2.4, 1.3] };

export const MOTION_POINTS: Vec3[] = [
  [-1.9, 2.4, -1.3],
  [2.3, -0.4, 1.3],
  [-1.9, -0.4, 1.3],
  [2.3, 2.4, -1.3],
  [-1.9, 2.4, 1.3],
  [2.3, -0.4, -1.3],
];
