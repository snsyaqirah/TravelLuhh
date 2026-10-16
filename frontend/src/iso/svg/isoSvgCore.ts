// Pure SVG-twin helpers (no components): projection to SVG points, painter's sort, and the face builders
// that mirror FaceToneMaterial for boxes, cylinders and prisms under any transform. See svg/IsoSvg.tsx.
import { createContext, useContext, useId } from 'react';
import type { ThemeName } from '@/design/tokens';
import { faceColor, faceTones, facesCamera } from '@/iso/faceTones';
import { depthCompare, isoProject } from '@/iso/projection';
import type { Vec3 } from '@/iso/specs';
import { apply, applyDir, IDENTITY, type Affine } from '@/iso/svg/affine';

export interface IsoSvgContextValue {
  theme: ThemeName;
  /** viewBox units per CSS pixel (1 / zoom). Use for 1px strokes. */
  px: number;
}

export const IsoSvgContext = createContext<IsoSvgContextValue>({ theme: 'light', px: 1 / 60 });

/** Theme and pixel size for the twin being drawn. */
export const useIsoSvg = () => useContext(IsoSvgContext);

/** Stable unique id for clipPaths inside twins. */
export const useSvgId = (prefix: string) => `${prefix}-${useId().replace(/:/g, '')}`;

/** Every axis scales by sqrt(2/3) in this projection (dash lengths, heights). */
export const ISO_SCALE = Math.sqrt(2 / 3);
/** Ellipse ry/rx of a horizontal circle: 0.577. */
export const ELLIPSE_RATIO = 1 / Math.sqrt(3);

const f = (n: number) => +n.toFixed(4);

/** "x,y" of a projected world point. */
export const pt = (p: Vec3) => {
  const [x, y] = isoProject(p);
  return `${f(x)},${f(y)}`;
};

/** Space-separated projected points for `points=`. */
export const pts = (ps: readonly Vec3[]) => ps.map(pt).join(' ');

/** Sort anything with a world position into painter's order (far first). */
export function sortByDepth<T>(items: readonly T[], at: (item: T) => Vec3): T[] {
  return items.slice().sort((a, b) => depthCompare(at(a), at(b)));
}

export interface Face {
  points: Vec3[];
  fill: string;
  normal: Vec3;
}

const BOX_FACES: Array<{ n: Vec3; idx: [number, number, number, number] }> = [
  // corner index = (x?1:0) | (y?2:0) | (z?4:0)
  { n: [0, 1, 0], idx: [2, 3, 7, 6] },
  { n: [0, -1, 0], idx: [0, 4, 5, 1] },
  { n: [0, 0, 1], idx: [4, 6, 7, 5] },
  { n: [0, 0, -1], idx: [0, 1, 3, 2] },
  { n: [1, 0, 0], idx: [1, 5, 7, 3] },
  { n: [-1, 0, 0], idx: [0, 2, 6, 4] },
];

/**
 * Visible faces of a box (base-anchored: local y ∈ [0, h], x/z centred) under any affine transform.
 * Axis-aligned faces get the exact face tones; rotated faces get the shader's blend (or snap if curved).
 */
export function boxFaces(size: Vec3, color: string, theme: ThemeName, xf: Affine = IDENTITY, curved = false): Face[] {
  const [w, h, d] = size;
  const tones = faceTones(color, theme);
  const corners: Vec3[] = [];
  for (let i = 0; i < 8; i++) corners.push(apply(xf, [i & 1 ? w / 2 : -w / 2, i & 2 ? h : 0, i & 4 ? d / 2 : -d / 2]));
  const out: Face[] = [];
  for (const { n, idx } of BOX_FACES) {
    const wn = applyDir(xf, n);
    if (!facesCamera(wn)) continue;
    out.push({ points: idx.map((i) => corners[i]), fill: faceColor(wn, tones, curved), normal: wn });
  }
  return out;
}

/** Any-orientation cylinder (tilted lids): faceted side quads + the visible cap, snapped like uCurved. */
export function cylinderFaces(r: number, h: number, color: string, theme: ThemeName, xf: Affine, segments = 24): Face[] {
  const tones = faceTones(color, theme);
  const ring = (y: number) =>
    Array.from({ length: segments }, (_, i) => {
      const a = (i / segments) * Math.PI * 2;
      return apply(xf, [Math.cos(a) * r, y, Math.sin(a) * r]);
    });
  const top = ring(h / 2);
  const bottom = ring(-h / 2);
  const faces: Face[] = [];
  for (let i = 0; i < segments; i++) {
    const a = ((i + 0.5) / segments) * Math.PI * 2;
    const n = applyDir(xf, [Math.cos(a), 0, Math.sin(a)]);
    if (!facesCamera(n)) continue;
    const j = (i + 1) % segments;
    faces.push({ points: [bottom[i], bottom[j], top[j], top[i]], fill: faceColor(n, tones, true), normal: n });
  }
  const up = applyDir(xf, [0, 1, 0]);
  if (facesCamera(up)) faces.push({ points: top, fill: faceColor(up, tones, true), normal: up });
  else faces.push({ points: bottom, fill: faceColor([-up[0], -up[1], -up[2]], tones, true), normal: [-up[0], -up[1], -up[2]] });
  return faces;
}

/** Extruded polygon (outline in local XY, ±dz along Z) → visible faces, shaded like FaceToneMaterial. */
export function prismFaces(outline: Array<[number, number]>, dz: number, color: string, theme: ThemeName, xf: Affine): Face[] {
  const tones = faceTones(color, theme);
  const front = outline.map(([x, y]) => apply(xf, [x, y, dz]));
  const back = outline.map(([x, y]) => apply(xf, [x, y, -dz]));
  const faces: Face[] = [];
  const nf = applyDir(xf, [0, 0, 1]);
  const nb = applyDir(xf, [0, 0, -1]);
  // Signed area decides the outward side of each edge (outline may be CW or CCW).
  let area = 0;
  outline.forEach(([x, y], i) => {
    const [x2, y2] = outline[(i + 1) % outline.length];
    area += x * y2 - x2 * y;
  });
  const sign = area > 0 ? 1 : -1;
  outline.forEach(([x, y], i) => {
    const j = (i + 1) % outline.length;
    const [x2, y2] = outline[j];
    const n = applyDir(xf, [sign * (y2 - y), -sign * (x2 - x), 0]);
    if (facesCamera(n)) faces.push({ points: [back[i], back[j], front[j], front[i]], fill: faceColor(n, tones), normal: n });
  });
  if (facesCamera(nf)) faces.push({ points: front, fill: faceColor(nf, tones), normal: nf });
  if (facesCamera(nb)) faces.push({ points: back, fill: faceColor(nb, tones), normal: nb });
  return faces;
}

/** Gable roof prism: width along local X, ridge along local Z, base on y = 0. */
export function gableFaces(width: number, h: number, depth: number, color: string, theme: ThemeName, xf: Affine): Face[] {
  return prismFaces(
    [
      [-width / 2, 0],
      [width / 2, 0],
      [0, h],
    ],
    depth / 2,
    color,
    theme,
    xf,
  );
}
