// Primitive dimensions and seeded layouts (§7.6), shared by the WebGL primitives and their SVG twins.
// Pure: no three.js. Every primitive's local origin is the centre of its base, standing on y = 0.
import { rng } from '@/iso/seed';
import type { LidState, Vec3 } from '@/iso/specs';

// ---------- Draw order ----------
/**
 * Opaque draw layers. Ground surfaces draw first, hard shadows second (depth-tested but not depth-written),
 * everything else after, so a thin object (IOU slip, road dash) always paints over a shadow it sits in.
 */
export const LAYER = { ground: -2, shadow: -1, object: 0 } as const;

// ---------- Plinth ----------
// Spec geometry, re-based so the top *surface* is local y = 0 (things placed on a plinth stand at y = 0).
export const PLINTH = {
  topH: 0.25,
  underH: 0.15,
  underInset: 0.04,
  /** Under-layer centre sits .20 below the top box centre (spec). */
  underDrop: 0.2,
  ledgerLift: 0.001,
} as const;

// ---------- Balang ----------
/** Lathe profile (r, y) for a jar of height 2.4; scale by height / 2.4. */
export const JAR_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.8, 0],
  [0.92, 0.1],
  [1.0, 0.55],
  [1.0, 1.55],
  [0.9, 1.95],
  [0.74, 2.15],
  [0.74, 2.4],
];
export const JAR_REF_HEIGHT = 2.4;
export const JAR_INTERIOR = 0.85;
export const JAR_MOUTH_R = 0.74;
export const JAR_BASE_R = 0.8;
export const JAR_MAX_R = 1.0;
export const TICK_FRACTIONS = [0.25, 0.5, 0.75] as const;

/** Inner radius of the unscaled jar wall at height y (linear between profile points). */
export function jarRadiusAt(y: number): number {
  const p = JAR_PROFILE;
  if (y <= p[1][1]) return p[1][0];
  for (let i = 1; i < p.length - 1; i++) {
    const [r0, y0] = p[i];
    const [r1, y1] = p[i + 1];
    if (y >= y0 && y <= y1) return y1 === y0 ? r1 : r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
  }
  return p[p.length - 1][0];
}

export const LID = { r: 0.8, h: 0.22, slot: [0.5, 0.03, 0.08] as const } as const;

/** Lid pose in unscaled jar space. `tilted` leans against the jar's +Z (front-left) wall, resting on the ground. */
export function lidPose(state: LidState): { position: Vec3; rotation: Vec3 } | null {
  if (state === 'off') return null;
  if (state === 'closed') return { position: [0, JAR_REF_HEIGHT + LID.h / 2, 0], rotation: [0, 0, 0] };
  const tilt = 1.2;
  // Lowest rim point touches y = 0: centre height = r·sin(tilt) + (h/2)·cos(tilt).
  const y = LID.r * Math.sin(tilt) + (LID.h / 2) * Math.cos(tilt);
  // Upper rim leans on the wall: push forward until the back rim clears the jar's widest radius.
  const z = JAR_MAX_R + LID.r * Math.cos(tilt) + (LID.h / 2) * Math.sin(tilt) + 0.02;
  return { position: [0.35, y, z], rotation: [tilt, 0, 0] };
}

// ---------- Coins ----------
// Spec numbers are ring .48 / coin .20 (lite .40 / .26). Those leave a third of the jar's 1.0 radius empty, so
// the pile read as a column rather than a fill level; scaled up to reach the wall (checked in shapes tests).
export const COIN_PILE = {
  layers: 15,
  high: { capacity: 120, perLayer: 8, ring: 0.58, r: 0.24, h: 0.06, segments: 14, centre: true },
  lite: { capacity: 60, perLayer: 4, ring: 0.5, r: 0.3, h: 0.06, segments: 14, centre: false },
  tilt: (25 * Math.PI) / 180,
  yJitter: 0.02,
} as const;

export interface CoinPose {
  position: Vec3;
  /** Rotation axis (unit, horizontal) and angle in radians. */
  axis: Vec3;
  angle: number;
  /** 0..2 → palette coins[tint] */
  tint: 0 | 1 | 2;
}

/**
 * Coin positions inside an unscaled (height 2.4) jar. Fills bottom-up; the top partial layer fills in
 * seeded ring order. Same seed → same pile on every device.
 */
export function coinPileLayout(count: number, seed: string | number, lite = false): CoinPose[] {
  const cfg = lite ? COIN_PILE.lite : COIN_PILE.high;
  const n = Math.max(0, Math.min(Math.round(count), cfg.capacity));
  const r = rng(`${seed}|pile|${lite ? 'l' : 'h'}`);
  const interior = JAR_REF_HEIGHT * JAR_INTERIOR;
  const pitch = interior / COIN_PILE.layers;
  const out: CoinPose[] = [];
  const ringCount = cfg.centre ? cfg.perLayer - 1 : cfg.perLayer;
  for (let layer = 0; out.length < n; layer++) {
    const spin = r.range(0, Math.PI * 2);
    const slots: Array<[number, number]> = [];
    if (cfg.centre) slots.push([0, 0]);
    for (let k = 0; k < ringCount; k++) {
      const a = spin + (k / ringCount) * Math.PI * 2;
      slots.push([Math.cos(a) * cfg.ring, Math.sin(a) * cfg.ring]);
    }
    const remaining = n - out.length;
    const order = remaining < slots.length ? r.shuffle(slots).slice(0, remaining) : slots;
    for (const [x, z] of order) {
      const axisAngle = r.range(0, Math.PI * 2);
      out.push({
        position: [x, layer * pitch + cfg.h / 2 + 0.03 + r.range(-COIN_PILE.yJitter, COIN_PILE.yJitter), z],
        axis: [Math.cos(axisAngle), 0, Math.sin(axisAngle)],
        angle: r.range(-COIN_PILE.tilt, COIN_PILE.tilt),
        tint: r.int(3) as 0 | 1 | 2,
      });
    }
  }
  return out;
}

/** Coins in a jar for a fill share: round(capacity × clamp(fill, 0, 1)). */
export function balangCoinCount(fill: number, capacity: number): number {
  return Math.round(capacity * Math.min(Math.max(fill, 0), 1));
}

/** Height (unscaled jar units) of the coin surface for `count` coins: what the SVG twin fills to. */
export function coinFillHeight(count: number, lite = false): number {
  const cfg = lite ? COIN_PILE.lite : COIN_PILE.high;
  const interior = JAR_REF_HEIGHT * JAR_INTERIOR;
  return (Math.max(0, Math.min(count, cfg.capacity)) / cfg.capacity) * interior;
}

export const COIN_STACK = { r: 0.16, h: 0.05, pitch: 0.055, jitter: 0.012, segments: 12 } as const;

export interface StackCoin {
  position: Vec3;
  rotY: number;
  tint: 0 | 1 | 2;
}

/** Coins of one day stack, relative to the stack base. */
export function coinStackLayout(count: number, seed: string | number): StackCoin[] {
  const r = rng(`${seed}|stack`);
  return Array.from({ length: Math.max(0, Math.round(count)) }, (_, i) => ({
    position: [
      r.range(-COIN_STACK.jitter, COIN_STACK.jitter),
      COIN_STACK.h / 2 + i * COIN_STACK.pitch,
      r.range(-COIN_STACK.jitter, COIN_STACK.jitter),
    ] as Vec3,
    rotY: r.range(0, Math.PI * 2),
    tint: r.int(3) as 0 | 1 | 2,
  }));
}

// ---------- Day stones ----------
export const STONE = {
  size: [0.6, 0.08, 0.6] as const,
  spacing: 0.75,
  todayRaise: 0.06,
  rim: [0.66, 0.02, 0.66] as const,
  /** Rim centre relative to the stone centre. */
  rimDrop: -0.03,
  selectPad: 0.06,
} as const;

/** Top surface of a stone (where its coin stack and pennant stand). */
export const stoneTop = (state: 'past' | 'today' | 'future') => STONE.size[1] + (state === 'today' ? STONE.todayRaise : 0);

// ---------- Pennant ----------
export const PENNANT = { poleH: 0.6, poleR: 0.02, flagW: 0.25, flagH: 0.16 } as const;

// ---------- Signpost ----------
export const SIGNPOST = { post: [0.08, 0.9, 0.08] as const, boardLen: 0.5, boardH: 0.14, depth: 0.04, boardsY: [0.74, 0.54] as const };

// ---------- Category blocks ----------
export const BLOCK = { w: 0.8, d: 0.8, minH: 0.12 } as const;

// ---------- Suitcase ----------
export const SUITCASE = {
  w: 2.4,
  d: 1.6,
  baseH: 0.08,
  wall: 0.06,
  wallH: 0.45,
  corner: 0.12,
  strapW: 0.1,
  strapT: 0.012,
  strapX: 0.6,
} as const;

// ---------- Packed items ----------
export const PACKED = {
  box: [0.36, 0.14, 0.28] as const,
  radius: 0.03,
  slab: [0.18, 0.03, 0.25] as const,
} as const;

// ---------- IOU slip ----------
export const IOU = { paper: [0.5, 0.01, 0.3] as const, line: [0.4, 0.02] as const } as const;

// ---------- Shelf ----------
export const SHELF = { slotW: 2.6, extra: 0.4, plankH: 0.15, d: 1.6, rail: 0.08, bracket: 0.7 } as const;
export const shelfLength = (slots: number) => Math.max(1, slots) * SHELF.slotW + SHELF.extra;

// ---------- Kampung house ----------
export const HOUSE = { stiltH: 0.3, stiltR: 0.04, floorH: 0.45, roofH: 0.35, overhang: 0.08, door: [0.18, 0.28, 0.02] as const } as const;

// ---------- Road ----------
export const ROAD = { h: 0.02, d: 0.8, dash: [0.3, 0.005, 0.06] as const, dashPitch: 0.6 } as const;
export const roadDashCount = (length: number) => Math.max(0, Math.floor((length - 0.2) / ROAD.dashPitch));
