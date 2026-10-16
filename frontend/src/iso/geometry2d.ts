// Ground-plane helpers shared by the WebGL HardShadow and the SVG twin, so both draw the same polygon.
import type { Footprint } from '@/iso/types';

type P = readonly [number, number];

const cross = (o: P, a: P, b: P) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** Andrew's monotone chain. Returns the hull counter-clockwise (in x/z), without repeating the first point. */
export function convexHull(points: Footprint): [number, number][] {
  const pts = points.map((p) => [p[0], p[1]] as [number, number]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length <= 2) return pts;
  const lower: [number, number][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 1e-12) lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 1e-12) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/** Circle footprint sampled at `n` points (round footprints use 16, §7.4). */
export function circleFootprint(r: number, n = 16, cx = 0, cz = 0): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cz + Math.sin(a) * r] as [number, number];
  });
}

/** Axis-aligned rectangle footprint w (x) × d (z), centred on (cx, cz). */
export function rectFootprint(w: number, d: number, cx = 0, cz = 0): [number, number][] {
  return [
    [cx - w / 2, cz - d / 2],
    [cx + w / 2, cz - d / 2],
    [cx + w / 2, cz + d / 2],
    [cx - w / 2, cz + d / 2],
  ];
}

/** Hard shadow polygon (§7.4): hull of the footprint plus the footprint shifted +0.5·h along X. */
export function shadowHull(footprint: Footprint, h: number): [number, number][] {
  const shift = 0.5 * h;
  return convexHull([...footprint, ...footprint.map((p) => [p[0] + shift, p[1]] as const)]);
}
