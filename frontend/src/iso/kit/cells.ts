// Per-cell content parameters for the kit, shared by the 3D and SVG boards.
import type { CategoryKey, FabricKey } from '@/design/tokens';
import { CATEGORY_ORDER, FABRIC_KEYS } from '@/design/tokens';
import type { Vec3 } from '@/iso/specs';
import type { StoneState } from '@/iso/types';

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const R = Math.SQRT1_2;

export const kitStones = (c: Vec3): Array<{ at: Vec3; state: StoneState; over?: boolean; selected?: boolean }> => [
  { at: add(c, [-0.75, 0, -0.4]), state: 'past' },
  { at: add(c, [0, 0, -0.4]), state: 'past', over: true },
  { at: add(c, [0.75, 0, -0.4]), state: 'today' },
  { at: add(c, [-0.75, 0, 0.35]), state: 'future' },
  { at: add(c, [0, 0, 0.35]), state: 'future', selected: true },
  { at: add(c, [0.75, 0, 0.35]), state: 'future' },
];

export const kitStacks = (c: Vec3) => [
  { at: add(c, [-0.55, 0, 0.35]), count: 3, seed: 'k1' },
  { at: add(c, [0, 0, 0]), count: 6, seed: 'k2' },
  { at: add(c, [0.55, 0, -0.35]), count: 10, seed: 'k3' },
];

export const kitCategories = (c: Vec3): Array<{ category: CategoryKey; height: number; at: Vec3 }> => {
  const heights = [1.6, 1.0, 0.7, 0.45, 1.2, 0.8, 0.3];
  return CATEGORY_ORDER.map((category, i) => {
    const k = (i - 3) * 1.0;
    return { category, height: heights[i], at: add(c, [k * R, 0, -k * R]) };
  });
};

export const kitPacked = (c: Vec3): Array<{ at: Vec3; tone: FabricKey; rotY: number }> =>
  FABRIC_KEYS.map((tone, i) => ({
    at: add(c, [(i % 3) * 0.5 - 0.5, 0, Math.floor(i / 3) * 0.45 - 0.2]),
    tone,
    rotY: ((i * 37) % 11) / 60 - 0.08,
  }));

/** Items lying in the open suitcase's tray (tray floor at y = .08). */
export const kitCaseItems = (c: Vec3): Array<{ at: Vec3; tone: FabricKey; rotY: number }> => {
  const tones: FabricKey[] = ['khaki', 'khaki', 'sage', 'denim', 'linen', 'clay', 'khaki', 'passport'];
  return tones.map((tone, i) => ({
    at: add(c, [-0.85 + (i % 4) * 0.42, 0.08, -0.35 + Math.floor(i / 4) * 0.36]),
    tone,
    rotY: 0,
  }));
};

export { add as addVec };
