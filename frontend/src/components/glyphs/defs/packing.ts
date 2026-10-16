// Packing-category glyphs: one thing you'd actually pack per category.
import type { Vec3 } from '@/iso/specs';
import type { PackingCategory } from '../names';
import {
  box,
  cylinder,
  disc,
  flat,
  frontFrame,
  groundFrame,
  leftRect,
  line,
  prism,
  ring3,
  tube,
  vcyl,
  type GlyphGeometry,
} from '../kit';

const X: Vec3 = [1, 0, 0];
const Y: Vec3 = [0, 1, 0];
const Z: Vec3 = [0, 0, 1];

/** T-shirt, standing, facing the viewer's left. */
const clothing: GlyphGeometry = {
  parts: prism(
    frontFrame([0, 0, -0.05]),
    [
      [-0.3, 0],
      [0.3, 0],
      [0.3, 0.6],
      [0.5, 0.5],
      [0.64, 0.74],
      [0.34, 0.96],
      [0.15, 0.96],
      [0, 0.84],
      [-0.15, 0.96],
      [-0.34, 0.96],
      [-0.64, 0.74],
      [-0.5, 0.5],
      [-0.3, 0.6],
    ],
    0.1,
    'hue',
  ),
};

/** Plug, pins up, cable trailing. */
const electronics: GlyphGeometry = {
  parts: [
    ...box([0, 0, 0], [0.64, 0.5, 0.5], 'hue'),
    ...box([-0.16, 0.5, 0], [0.11, 0.42, 0.11], 'brass'),
    ...box([0.16, 0.5, 0], [0.11, 0.42, 0.11], 'brass'),
    tube([[0, 0.12, 0.25], [0, 0.06, 0.48], [-0.14, 0.02, 0.62]], 'ink', { core: 1.2 }),
  ],
};

/** First-aid kit: case with a leaf cross (ISO 7010 style, not the Red Cross emblem). */
const health: GlyphGeometry = {
  parts: [
    ...box([0, 0, 0], [1.0, 0.7, 0.5], 'hue'),
    tube([[-0.2, 0.7, 0], [-0.2, 0.86, 0], [0.2, 0.86, 0], [0.2, 0.7, 0]], 'ink', { core: 1.1 }),
    leftRect(0.25, -0.08, 0.08, 0.13, 0.57, 'paper'),
    leftRect(0.25, -0.22, 0.22, 0.27, 0.43, 'paper'),
  ],
};

/** Passport standing up: cover facing left, page edges on top and right. */
const documents: GlyphGeometry = {
  parts: [
    ...box([0, 0, 0], [0.72, 1.0, 0.16], 'hue', { faces: { top: 'paper', right: 'paper' } }),
    disc([0, 0.62, 0.081], X, Y, 0.17, 'brass'),
    leftRect(0.081, -0.18, 0.18, 0.26, 0.33, 'brass'),
  ],
};

/** Backpack with a front pocket and a grab loop. */
const gear: GlyphGeometry = {
  parts: [
    ...box([0, 0, 0], [0.8, 0.62, 0.5], 'hue'),
    ...cylinder([-0.4, 0.62, 0], X, 0.25, 0.8, 'hue', { half: Y }),
    tube(ring3([0, 0.87, 0], X, Y, 0.13, Math.PI, 0, 12), 'ink', { core: 1.1 }),
    ...box([0, 0.06, 0.3], [0.54, 0.36, 0.1], 'hue'),
  ],
};

/** Toothbrush in a cup. */
const personal: GlyphGeometry = {
  parts: [
    ...vcyl([0, 0, 0], 0.32, 0.62, 'paper', { capTone: 'shade' }),
    tube([[0.02, 0.62, 0.02], [0.24, 1.16, -0.2]], 'hue', { core: 1.6 }),
    // Bristle head: a fatter leaf-coloured stub at the top of the handle.
    tube([[0.22, 1.11, -0.18], [0.3, 1.32, -0.26]], 'paper', { core: 2.6 }),
  ],
};

/** Food tin with a label band and a ring pull. */
const food: GlyphGeometry = {
  parts: [
    ...vcyl([0, 0, 0], 0.42, 0.82, 'paper'),
    ...cylinder([0, 0.18, 0], Y, 0.425, 0.42, 'hue', { cap: false, outline: false }),
    line(ring3([0, 0.18, 0], X, Z, 0.425, Math.PI * 0.75, -Math.PI * 0.25, 24), { weight: 0.75 }),
    line(ring3([0, 0.6, 0], X, Z, 0.425, Math.PI * 0.75, -Math.PI * 0.25, 24), { weight: 0.75 }),
    line(ring3([0.12, 0.82, 0.12], X, Z, 0.11), { closed: true, weight: 0.75 }),
  ],
};

/** Briefcase with brass clasps. */
const work: GlyphGeometry = {
  parts: [
    ...box([0, 0, 0], [1.0, 0.66, 0.36], 'hue'),
    tube([[-0.18, 0.66, 0], [-0.18, 0.8, 0], [0.18, 0.8, 0], [0.18, 0.66, 0]], 'ink', { core: 1.1 }),
    line([[-0.5, 0.48, 0.18], [0.5, 0.48, 0.18], [0.5, 0.48, -0.18]], { weight: 0.75 }),
    leftRect(0.181, -0.32, -0.2, 0.4, 0.56, 'brass', true),
    leftRect(0.181, 0.2, 0.32, 0.4, 0.56, 'brass', true),
  ],
};

/** Prayer mat, far end rolled, with a plain arch (no calligraphy). */
const religious: GlyphGeometry = {
  parts: [
    ...box([0, 0, 0.06], [0.84, 0.05, 1.0], 'hue'),
    flat(groundFrame([0, 0.05, 0]), [[-0.24, -0.46], [0.24, -0.46], [0.24, 0], [0, 0.22], [-0.24, 0]], 'brass', false),
    ...cylinder([-0.42, 0.17, -0.5], X, 0.17, 0.84, 'hue'),
  ],
};

/** Luggage tag on a loop of string. */
const general: GlyphGeometry = {
  parts: [
    ...prism(frontFrame([0, 0, 0]), [[-0.32, 0], [0.32, 0], [0.32, 0.76], [0.13, 0.98], [-0.13, 0.98], [-0.32, 0.76]], 0.07, 'hue'),
    disc([0, 0.78, 0.071], X, Y, 0.075, 'shade', false),
    line([[-0.18, 0.44, 0.071], [0.18, 0.44, 0.071]], { weight: 0.75 }),
    line([[-0.18, 0.28, 0.071], [0.1, 0.28, 0.071]], { weight: 0.75 }),
    line([[0, 0.78, 0.071], [-0.06, 1.0, 0.071], [0.06, 1.22, 0.04], [0.3, 1.3, 0]]),
  ],
};

export const PACKING_DEFS: Record<PackingCategory, GlyphGeometry> = {
  documents,
  clothing,
  personal,
  health,
  electronics,
  gear,
  work,
  food,
  religious,
  general,
};
