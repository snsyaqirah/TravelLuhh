// Packing presets, seasons and note categories.
import type { Vec3 } from '@/iso/specs';
import type { NoteCategory, PackingPreset, Season } from '@/types';
import {
  bowl,
  box,
  disc,
  dome,
  flat,
  frontFrame,
  leftRect,
  line,
  prism,
  cone,
  pyramid,
  rightRect,
  sphere,
  topRect,
  tube,
  vcyl,
  poly,
  type Frame,
  type GlyphGeometry,
  type P2,
  type Part,
} from '../kit';

const X: Vec3 = [1, 0, 0];
const Y: Vec3 = [0, 1, 0];
const Z: Vec3 = [0, 0, 1];

// Camera-facing plane: SR projects to screen-right (1, 0), SU to screen-up (0, −1). Spheres and flat shapes in
// this plane keep their true shape, which is what a sun, a blossom or a snowflake needs.
const SR: Vec3 = [Math.SQRT1_2, 0, -Math.SQRT1_2];
const SU: Vec3 = [-1 / Math.sqrt(6), 2 / Math.sqrt(6), -1 / Math.sqrt(6)];
const facing = (origin: Vec3 = [0, 0, 0]): Frame => ({ origin, u: SR, v: SU });
const onScreen = (c: Vec3, a: number, d: number): Vec3 => [
  c[0] + (SR[0] * Math.cos(a) + SU[0] * Math.sin(a)) * d,
  c[1] + (SR[1] * Math.cos(a) + SU[1] * Math.sin(a)) * d,
  c[2] + (SR[2] * Math.cos(a) + SU[2] * Math.sin(a)) * d,
];

// ---------------------------------------------------------------- presets

/** General: closed suitcase (the S4 shell) with straps. */
const presetGeneral: GlyphGeometry = {
  parts: [
    ...box([0, 0, 0], [1.0, 0.8, 0.4], 'hue'),
    leftRect(0.2, -0.32, -0.22, 0, 0.8, 'shade'),
    leftRect(0.2, 0.22, 0.32, 0, 0.8, 'shade'),
    topRect(0.8, -0.32, -0.22, -0.2, 0.2, 'shade'),
    topRect(0.8, 0.22, 0.32, -0.2, 0.2, 'shade'),
    tube([[-0.16, 0.8, 0], [-0.16, 0.95, 0], [0.16, 0.95, 0], [0.16, 0.8, 0]], 'ink', { core: 1.1 }),
  ],
};

/** Beach: a striped parasol leaning in the sand. */
const presetBeach: GlyphGeometry = (() => {
  // Lean towards the viewer's left so the striped canopy faces us.
  const lean: Vec3 = [0.18, 0.95, 0.26];
  const len = Math.hypot(...lean);
  const ax: Vec3 = [lean[0] / len, lean[1] / len, lean[2] / len];
  const at = (k: number): Vec3 => [ax[0] * k, ax[1] * k, ax[2] * k];
  return {
    parts: [
      disc([0, 0, 0], X, Z, 0.34, 'ground'),
      line([at(0), at(0.9)]),
      ...cone(at(0.78), 0.72, 0.3, 8, 'hue', { alternate: 'paper', rotate: Math.PI / 8, axis: ax }),
      line([at(1.08), at(1.18)]),
    ],
  };
})();

/** Hiking: two peaks, snow on the tall one. */
const presetHiking: GlyphGeometry = {
  parts: [
    ...pyramid([0, 0, -0.1], 0.72, 1.1, 4, 'hue', { rotate: Math.PI / 4 }),
    ...pyramid([0, 0.72, -0.1], 0.72 * (1 - 0.72 / 1.1), 1.1 - 0.72, 4, 'paper', { rotate: Math.PI / 4 }),
    ...pyramid([-0.42, 0, 0.5], 0.46, 0.66, 4, 'hue', { rotate: Math.PI / 4 }),
  ],
};

/** Business: open laptop. */
const presetBusiness: GlyphGeometry = (() => {
  const tilt = (12 * Math.PI) / 180;
  const h = 0.72;
  const zb = -0.33;
  const yb = 0.06;
  // Point k (0..1) up the lid from the hinge.
  const up = (x: number, k: number): Vec3 => [x, yb + h * k * Math.cos(tilt), zb - h * k * Math.sin(tilt) + 0.001];
  return {
    parts: [
      ...box([0, 0, 0], [1.04, yb, 0.66], 'hue'),
      topRect(yb, -0.4, 0.4, -0.24, 0.06, 'shade'),
      poly([up(-0.52, 0), up(0.52, 0), up(0.52, 1), up(-0.52, 1)], 'hue'),
      poly([up(-0.43, 0.1), up(0.43, 0.1), up(0.43, 0.9), up(-0.43, 0.9)], 'paper', false),
    ],
  };
})();

/** Umrah & Hajj: an abstract dome and minaret, no calligraphy, no crescent. */
const presetUmrah: GlyphGeometry = {
  parts: [
    ...vcyl([0.42, 0.14, -0.42], 0.1, 1.12, 'paper'),
    ...pyramid([0.42, 1.26, -0.42], 0.13, 0.26, 8, 'hue'),
    ...box([0, 0, 0], [1.08, 0.14, 1.08], 'paper'),
    ...vcyl([0, 0.14, 0], 0.42, 0.3, 'paper', { cap: false }),
    ...dome([0, 0.44, 0], 0.42, 'hue'),
    line([[0, 0.86, 0], [0, 1.04, 0]]),
  ],
};

export const PRESET_DEFS: Record<PackingPreset, GlyphGeometry> = {
  general: presetGeneral,
  beach: presetBeach,
  hiking: presetHiking,
  business: presetBusiness,
  umrah: presetUmrah,
};

// ---------------------------------------------------------------- seasons

/** Spring: a five-petal blossom. */
const spring: GlyphGeometry = (() => {
  const c: Vec3 = [0, 0, 0];
  const petals: Part[] = [];
  for (let i = 0; i < 5; i++) petals.push(...sphere(onScreen(c, Math.PI / 2 + (i * 2 * Math.PI) / 5, 0.36), 0.27, 'hue'));
  return { parts: [...petals, ...sphere(c, 0.17, 'brass')] };
})();

/** Summer: sun with eight rays. */
const summer: GlyphGeometry = {
  parts: [
    ...Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4;
      return line([onScreen([0, 0, 0], a, 0.62), onScreen([0, 0, 0], a, 0.86)]);
    }),
    ...sphere([0, 0, 0], 0.44, 'hue'),
  ],
};

/** Autumn: a falling leaf with its veins. */
const autumn: GlyphGeometry = (() => {
  const rot = (-35 * Math.PI) / 180;
  const r = ([a, b]: P2): P2 => [a * Math.cos(rot) - b * Math.sin(rot), a * Math.sin(rot) + b * Math.cos(rot)];
  const f = facing();
  const at = (p: P2): Vec3 => {
    const [a, b] = r(p);
    return [SR[0] * a + SU[0] * b, SR[1] * a + SU[1] * b, SR[2] * a + SU[2] * b];
  };
  const outline: P2[] = [
    [0, -0.42],
    [0.24, -0.26],
    [0.34, 0.02],
    [0.28, 0.3],
    [0, 0.58],
    [-0.28, 0.3],
    [-0.34, 0.02],
    [-0.24, -0.26],
  ];
  return {
    parts: [
      flat(f, outline.map(r), 'hue'),
      line([at([0, -0.62]), at([0, 0.44])], { weight: 0.75 }),
      line([at([0, -0.12]), at([0.2, 0.08])], { weight: 0.75 }),
      line([at([0, -0.12]), at([-0.2, 0.08])], { weight: 0.75 }),
      line([at([0, 0.14]), at([0.15, 0.3])], { weight: 0.75 }),
      line([at([0, 0.14]), at([-0.15, 0.3])], { weight: 0.75 }),
    ],
  };
})();

/** Winter: a snowflake whose six arms are the three iso axes. */
const winter: GlyphGeometry = (() => {
  const L = 0.8;
  const t = 0.09;
  const branches: Part[] = [];
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 6 + (k * Math.PI) / 3;
    const base = onScreen([0, 0, 0], a, 0.46);
    for (const s of [-1, 1]) branches.push(line([base, onScreen(base, a + (s * Math.PI) / 3.2, 0.2)]));
  }
  return {
    parts: [
      ...box([0, -L, 0], [t, 2 * L, t], 'hue'),
      ...box([0, -t / 2, 0], [2 * L, t, t], 'hue'),
      ...box([0, -t / 2, 0], [t, t, 2 * L], 'hue'),
      ...box([0, -0.1, 0], [0.2, 0.2, 0.2], 'hue'),
      ...branches,
    ],
  };
})();

/** Tropical: a palm on a patch of sand. */
const tropical: GlyphGeometry = (() => {
  const crown: Vec3 = [0.22, 1.04, -0.14];
  const fronds = Array.from({ length: 4 }, (_, i) => {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const d: Vec3 = [Math.cos(a), 0, Math.sin(a)];
    const p: Vec3 = [-d[2], 0, d[0]];
    const pt = (k: number, w: number, dy: number): Vec3 => [crown[0] + d[0] * k + p[0] * w, crown[1] + dy, crown[2] + d[2] * k + p[2] * w];
    const pts = [crown, pt(0.36, 0.17, 0.1), pt(0.78, 0, -0.32), pt(0.36, -0.17, 0.1)];
    return { pts, depth: pts.reduce((sum, q) => sum + q[0] + q[1] + q[2], 0) };
  });
  fronds.sort((a, b) => a.depth - b.depth);
  return {
    parts: [
      disc([0, 0, 0], X, Z, 0.36, 'ground'),
      tube([[0, 0, 0], [0.05, 0.4, -0.03], [0.13, 0.74, -0.08], [0.22, 1.04, -0.14]], 'shell', { core: 1.8 }),
      ...fronds.map((f) => poly(f.pts, 'hue')),
    ],
  };
})();

export const SEASON_DEFS: Record<Season, GlyphGeometry> = { spring, summer, autumn, winter, tropical };

// ---------------------------------------------------------------- notes

/** Local tips: a lit bulb. */
const localTips: GlyphGeometry = {
  parts: [
    ...vcyl([0, 0, 0], 0.17, 0.32, 'ink'),
    ...sphere([0, 0.66, 0], 0.4, 'hue'),
    ...[-0.6, 0, 0.6].map((a) => line([onScreen([0, 0.66, 0], Math.PI / 2 + a, 0.54), onScreen([0, 0.66, 0], Math.PI / 2 + a, 0.72)])),
  ],
};

/** Food: a bowl of noodles with chopsticks in it. */
const noteFood: GlyphGeometry = {
  parts: [
    ...bowl([0, 0.5, 0], 0.52, 'hue', 'brass'),
    // Chopsticks standing in the bowl, leaning right.
    line([onScreen([0, 0.5, 0], 0.4, 0.04), onScreen([0, 0.5, 0], 1.12, 0.9)]),
    line([onScreen([0, 0.5, 0], -0.2, 0.16), onScreen([0, 0.5, 0], 0.98, 0.92)]),
  ],
};

/** Transport: a bus, windscreen on the left. */
const noteTransport: GlyphGeometry = {
  parts: [
    ...box([0, 0.08, 0], [0.62, 0.66, 1.2], 'hue'),
    leftRect(0.6, -0.23, 0.23, 0.42, 0.66, 'paper'),
    rightRect(0.31, -0.5, -0.24, 0.44, 0.64, 'paper'),
    rightRect(0.31, -0.16, 0.1, 0.44, 0.64, 'paper'),
    rightRect(0.31, 0.18, 0.44, 0.44, 0.64, 'paper'),
    disc([0.311, 0.1, -0.34], [0, 0, -1], Y, 0.13, 'shade'),
    disc([0.311, 0.1, 0.34], [0, 0, -1], Y, 0.13, 'shade'),
  ],
};

/** Safety: a shield with a check. */
const safety: GlyphGeometry = {
  parts: [
    ...prism(
      frontFrame([0, 0, 0]),
      [
        [0, 0],
        [0.32, 0.22],
        [0.44, 0.52],
        [0.44, 0.94],
        [0, 1.04],
        [-0.44, 0.94],
        [-0.44, 0.52],
        [-0.32, 0.22],
      ],
      0.12,
      'hue',
    ),
    tube([[-0.18, 0.54, 0.121], [-0.04, 0.4, 0.121], [0.2, 0.72, 0.121]], 'paper', { core: 1.3, shade: 'left' }),
  ],
};

/** Emergency: a phone with a stamp-red screen, ringing. */
const emergency: GlyphGeometry = {
  parts: [
    ...box([0, 0, 0], [0.62, 1.0, 0.12], 'ink'),
    leftRect(0.061, -0.22, 0.22, 0.16, 0.86, 'hue'),
    line(
      Array.from({ length: 9 }, (_, i) => onScreen([0.3, 0.92, 0], -0.9 + (i / 8) * 1.4, 0.26)),
      { weight: 1 },
    ),
    line(
      Array.from({ length: 9 }, (_, i) => onScreen([0.3, 0.92, 0], -0.9 + (i / 8) * 1.4, 0.44)),
      { weight: 1 },
    ),
  ],
};

/** Custom: a standing note card with a folded corner. */
const custom: GlyphGeometry = {
  parts: [
    ...prism(frontFrame([0, 0, 0]), [[-0.38, 0], [0.38, 0], [0.38, 0.76], [0.16, 1.0], [-0.38, 1.0]], 0.06, 'hue'),
    poly([[0.16, 1.0, 0.061], [0.16, 0.76, 0.061], [0.38, 0.76, 0.061]], 'ground'),
    ...[0.62, 0.44, 0.26].map((y, i) => line([[-0.24, y, 0.061], [i === 0 ? 0.04 : 0.24, y, 0.061]], { weight: 0.75 })),
  ],
};

export const NOTE_DEFS: Record<NoteCategory, GlyphGeometry> = {
  local_tips: localTips,
  food: noteFood,
  transport: noteTransport,
  safety,
  emergency,
  custom,
};
