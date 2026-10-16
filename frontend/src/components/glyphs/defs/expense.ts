// Expense glyphs (+ itinerary's sightseeing). Each is the category's 3D prop (§7.6 #9) on its own, in the
// category hue: roof, mini plane, pennant, ribboned parcel, kopi cup, bag, crate.
import type { Vec3 } from '@/iso/specs';
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
  rightRect,
  ring3,
  sideFrame,
  sphere,
  topRect,
  tube,
  vcyl,
  type GlyphGeometry,
} from '../kit';

const X: Vec3 = [1, 0, 0];
const Y: Vec3 = [0, 1, 0];
const Z: Vec3 = [0, 0, 1];

/** Gabled house: the roof prop on its block, door on the gable end. */
export const stay: GlyphGeometry = {
  parts: [
    ...box([0, 0, 0], [0.84, 0.6, 0.9], 'hue'),
    leftRect(0.45, -0.13, 0.13, 0, 0.36, 'shade'),
    // Steeper than 45°, so the back slope stays hidden and the roof reads as one plane.
    ...prism({ origin: [0, 0.6, -0.53], u: X, v: Y }, [[-0.53, 0], [0.53, 0], [0, 0.6]], 1.06, 'hue'),
  ],
};

/** Mini plane, nose to the upper right (taking off). */
export const transport: GlyphGeometry = {
  parts: [
    flat(groundFrame([0, 0.2, 0]), [[-0.9, -0.14], [0, 0.2], [0.9, -0.14], [0.9, -0.32], [0, -0.16], [-0.9, -0.32]], 'hue'),
    flat(groundFrame([0, 0.3, 0]), [[-0.36, -0.5], [0, -0.34], [0.36, -0.5], [0.36, -0.62], [0, -0.52], [-0.36, -0.62]], 'hue'),
    ...sphere([0, 0.27, -0.5], 0.15, 'hue'),
    ...cylinder([0, 0.27, 0.62], [0, 0, -1], 0.15, 1.12, 'hue'),
    flat(sideFrame([0, 0, 0]), [[-0.34, 0.4], [-0.62, 0.4], [-0.66, 0.8]], 'hue'),
  ],
  fit: 21,
};

/** Pennant on a stone. */
export const activities: GlyphGeometry = {
  parts: [
    ...box([0, 0, 0], [0.72, 0.18, 0.72], 'hue'),
    line([[0, 0.18, 0], [0, 1.42, 0]]),
    flat(frontFrame([0, 0, 0]), [[0, 1.42], [0, 0.92], [0.72, 1.3]], 'hue'),
  ],
};

/** Parcel tied with leaf-coloured ribbon. */
export const packages: GlyphGeometry = (() => {
  const w = 0.96;
  const h = 0.64;
  const s = 0.09;
  const e = w / 2;
  return {
    parts: [
      ...box([0, 0, 0], [w, h, w], 'hue'),
      topRect(h, -e, e, -s, s, 'paper'),
      topRect(h, -s, s, -e, e, 'paper'),
      leftRect(e, -s, s, 0, h, 'paper'),
      rightRect(e, -s, s, 0, h, 'paper'),
      // Bow: two small loops leaning out of the knot.
      flat({ origin: [0, h, 0], u: [0.7071, 0, -0.7071], v: Y }, [[0, 0], [-0.22, 0.17], [-0.22, 0.01]], 'paper'),
      flat({ origin: [0, h, 0], u: [0.7071, 0, -0.7071], v: Y }, [[0, 0], [0.22, 0.01], [0.22, 0.17]], 'paper'),
    ],
  };
})();

/** Kopi cup on a saucer, handle to the right. */
export const food: GlyphGeometry = (() => {
  const d: Vec3 = [0.7071, 0, -0.7071]; // screen-right
  const at = (r: number, y: number): Vec3 => [d[0] * r, y, d[2] * r];
  return {
    parts: [
      ...vcyl([0, 0, 0], 0.66, 0.08, 'paper'),
      tube([at(0.3, 0.5), at(0.5, 0.48), at(0.56, 0.36), at(0.5, 0.24), at(0.3, 0.22)], 'hue', { core: 1.3, shade: 'right' }),
      ...vcyl([0, 0.08, 0], 0.38, 0.52, 'hue'),
      disc([0, 0.6, 0], X, Z, 0.3, 'shade', false),
    ],
  };
})();

/** Shopping bag with a rope handle. */
export const shopping: GlyphGeometry = {
  parts: [
    ...box([0, 0, 0], [0.82, 0.84, 0.46], 'hue'),
    tube(ring3([0, 0.84, -0.1], X, Y, 0.2, Math.PI, 0, 16), 'hue', { core: 1.1 }),
    tube(ring3([0, 0.84, 0.1], X, Y, 0.2, Math.PI, 0, 16), 'hue', { core: 1.1 }),
  ],
};

/** Crate: planked box (the legend pairs it with a 135° hatch). */
export const other: GlyphGeometry = (() => {
  const e = 0.46;
  const h = 0.76;
  const y = h / 2;
  return {
    parts: [
      ...box([0, 0, 0], [2 * e, h, 2 * e], 'hue'),
      line([[-e, y, e], [e, y, e], [e, y, -e]], { weight: 0.75 }),
      line([[-e, h, 0], [e, h, 0]], { weight: 0.75 }),
    ],
  };
})();

/** Camera, lens facing the viewer's left. */
export const sightseeing: GlyphGeometry = {
  parts: [
    ...box([-0.22, 0.6, -0.02], [0.34, 0.14, 0.3], 'hue'),
    ...box([0, 0, 0], [1.0, 0.6, 0.46], 'hue'),
    ...cylinder([0.06, 0.3, 0.23], Z, 0.27, 0.14, 'hue', { capTone: 'paper' }),
    disc([0.06, 0.3, 0.371], X, Y, 0.13, 'shade', false),
  ],
};
