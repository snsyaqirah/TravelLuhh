// One projection for the whole iso system (§7.1). The WebGL camera sits at target + (50, 50, 50) looking at
// target, so azimuth 45° and elevation 35.264°. Everything drawn in the DOM or SVG uses these functions and
// lands on the same pixel as the WebGL render at the same zoom (projection.test.ts checks this against three).
import type { Vec3 } from '@/iso/specs';
import type { IsoView, StageFit } from '@/iso/types';

const K_X = Math.SQRT1_2; // 0.70711
const K_XZ = 1 / Math.sqrt(6); // 0.40825
const K_Y = 2 / Math.sqrt(6); // 0.81650

/** Camera offset from its target. Large so near/far never clip a scene. */
export const CAMERA_OFFSET: Vec3 = [50, 50, 50];

/** World direction that moves exactly 1 screen unit to the right (used for Kampung panning). */
export const SCREEN_RIGHT: Vec3 = [K_X, 0, -K_X];

/** Default padding fraction around a fitted scene. */
export const FIT_PAD = 0.08;

/** World point → screen units (y down). 1 world unit along X or Z is 0.866 screen units long. */
export const isoProject = ([x, y, z]: Vec3): [number, number] => [(x - z) * K_X, (x + z) * K_XZ - y * K_Y];

export interface Bounds {
  min: Vec3;
  max: Vec3;
}

export function boundsCorners({ min, max }: Bounds): Vec3[] {
  const out: Vec3[] = [];
  for (const x of [min[0], max[0]])
    for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) out.push([x, y, z]);
  return out;
}

export function boundsCenter({ min, max }: Bounds): Vec3 {
  return [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
}

/** Screen-space rectangle (screen units) covered by the 8 projected corners of a box. */
export function projectBounds(b: Bounds): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const c of boundsCorners(b)) {
    const [sx, sy] = isoProject(c);
    if (sx < minX) minX = sx;
    if (sx > maxX) maxX = sx;
    if (sy < minY) minY = sy;
    if (sy > maxY) maxY = sy;
  }
  return { minX, maxX, minY, maxY };
}

const MIN_SPAN = 1e-6;

/** Zoom (px per world unit) that fits the projected bounds into w×h with `pad` on every side. */
export function fitZoom(b: Bounds, w: number, h: number, pad = FIT_PAD): number {
  const { minX, maxX, minY, maxY } = projectBounds(b);
  const spanX = Math.max(maxX - minX, MIN_SPAN);
  const spanY = Math.max(maxY - minY, MIN_SPAN);
  const z = Math.min(w / spanX, h / spanY) * (1 - 2 * pad);
  return Math.max(z, 1e-3);
}

/** World point → pixel position inside a w×h slot whose camera looks at `center` with `zoom`. */
export const toScreen = (p: Vec3, zoom: number, center: Vec3, w: number, h: number): [number, number] => {
  const [x, y] = isoProject(p);
  const [cx, cy] = isoProject(center);
  return [w / 2 + (x - cx) * zoom, h / 2 + (y - cy) * zoom];
};

export interface ViewOptions {
  fit?: StageFit;
  /** Sideways pan in screen units (= world units along SCREEN_RIGHT). Clamped to `maxPan`. */
  pan?: number;
  pad?: number;
}

/** Furthest the camera may pan either way so the scene never leaves the slot (0 when it already fits). */
export function maxPan(b: Bounds, w: number, zoom: number, pad = FIT_PAD): number {
  const { minX, maxX } = projectBounds(b);
  const visible = (w * (1 - 2 * pad)) / zoom;
  return Math.max(0, (maxX - minX - visible) / 2);
}

/**
 * The single source of truth for framing: the WebGL CameraRig, the SVG frame, labels and targets all call
 * this with the same inputs. `contain` = fitZoom; `height` fits the height only (wide scenes pan).
 */
export function computeView(b: Bounds, w: number, h: number, opts: ViewOptions = {}): IsoView {
  const pad = opts.pad ?? FIT_PAD;
  const base = boundsCenter(b);
  if (opts.fit !== 'height') return { zoom: fitZoom(b, w, h, pad), center: base };
  const { minY, maxY } = projectBounds(b);
  const spanY = Math.max(maxY - minY, MIN_SPAN);
  const zoom = Math.max((h / spanY) * (1 - 2 * pad), 1e-3);
  const limit = maxPan(b, w, zoom, pad);
  const pan = Math.min(Math.max(opts.pan ?? 0, -limit), limit);
  return {
    zoom,
    center: [base[0] + SCREEN_RIGHT[0] * pan, base[1], base[2] + SCREEN_RIGHT[2] * pan],
  };
}

/**
 * Fit arbitrary world points (e.g. a layout that runs along SCREEN_RIGHT, whose axis-aligned bounds would
 * waste half the slot). The camera target is placed on y = 0 under the centre of the projected extents.
 */
export function fitPoints(points: readonly Vec3[], w: number, h: number, pad = FIT_PAD): IsoView {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    const [sx, sy] = isoProject(p);
    minX = Math.min(minX, sx);
    maxX = Math.max(maxX, sx);
    minY = Math.min(minY, sy);
    maxY = Math.max(maxY, sy);
  }
  const spanX = Math.max(maxX - minX, MIN_SPAN);
  const spanY = Math.max(maxY - minY, MIN_SPAN);
  const zoom = Math.max(Math.min(w / spanX, h / spanY) * (1 - 2 * pad), 1e-3);
  // Invert isoProject on the ground plane: sx = (x − z)·K_X, sy = (x + z)·K_XZ.
  const a = (minX + maxX) / 2 / K_X;
  const b = (minY + maxY) / 2 / K_XZ;
  return { zoom, center: [(a + b) / 2, 0, (b - a) / 2] };
}

/** SVG viewBox that reproduces `view` in a w×h slot (pair with preserveAspectRatio="xMidYMid meet"). */
export function viewBoxFor(view: IsoView, w: number, h: number): [number, number, number, number] {
  const [cx, cy] = isoProject(view.center);
  const vw = w / view.zoom;
  const vh = h / view.zoom;
  return [cx - vw / 2, cy - vh / 2, vw, vh];
}

/**
 * Size-independent viewBox for bounds: with preserveAspectRatio="xMidYMid meet" this equals
 * computeView(b, w, h) (contain) at any w×h, so a twin can render before the slot is measured.
 */
export function viewBoxForBounds(b: Bounds, pad = FIT_PAD): [number, number, number, number] {
  const { minX, maxX, minY, maxY } = projectBounds(b);
  const spanX = Math.max(maxX - minX, MIN_SPAN) / (1 - 2 * pad);
  const spanY = Math.max(maxY - minY, MIN_SPAN) / (1 - 2 * pad);
  const [cx, cy] = isoProject(boundsCenter(b));
  return [cx - spanX / 2, cy - spanY / 2, spanX, spanY];
}

/** Snap to the 0.25 world grid (§7.1). */
export const snap = (v: number, step = 0.25) => Math.round(v / step) * step;

/** Painter's key (§7.7): draw ascending by (x + z), then y. Smaller = further from the camera. */
export function depthCompare(a: Vec3, b: Vec3): number {
  const d = a[0] + a[2] - (b[0] + b[2]);
  return Math.abs(d) > 1e-9 ? d : a[1] - b[1];
}
