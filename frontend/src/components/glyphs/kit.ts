// Geometry kit for the iso glyphs (spec §5.5). Glyphs are modelled as tiny 3D objects in world units, projected
// with the shared isoProject (§7.1) and shaded with the same face tones as FaceToneMaterial (§7.3), so a 24px
// glyph is a miniature of the 3D prop. Builders return parts in painter's order (far first); `compileGlyph`
// fits them into the 24×24 grid once, at module load. Colours are resolved per theme at render time.
import { isoProject } from '@/iso/projection';
import type { Vec3 } from '@/iso/specs';

export type P2 = [number, number];
export type Face = 'top' | 'left' | 'right';

/**
 * Colour roles. `hue` is the glyph's main colour (category hue, or the glyph's default role, or the `tone`
 * prop); the rest are fixed accents resolved from tokens per theme (see palette.ts).
 */
export type ToneRole = 'hue' | 'paper' | 'ink' | 'shade' | 'fund' | 'brass' | 'stamp' | 'shell' | 'ground' | 'soil';

/** An axis face uses the exact face tone; any other normal is blended like the shader (or snapped if curved). */
export type Shading = Face | { n: Vec3; curved?: boolean };

export interface FillPart {
  kind: 'fill';
  pts: P2[];
  tone: ToneRole;
  shade: Shading;
  /** Outline in currentColor. Off for the facets of curved surfaces, which get a silhouette line instead. */
  stroke: boolean;
}

export interface LinePart {
  kind: 'line';
  pts: P2[];
  closed: boolean;
  /** Multiplier on the stroke width (details use ~0.75). */
  weight: number;
}

/** A solid rod (handles, poles): an outline stroke with a coloured core. */
export interface TubePart {
  kind: 'tube';
  pts: P2[];
  tone: ToneRole;
  shade: Shading;
  /** Core width in 24-grid units. */
  core: number;
}

export type Part = FillPart | LinePart | TubePart;

const C: Vec3 = [1, 1, 1]; // towards the camera
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec3): Vec3 => scale(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));

export const P = (v: Vec3): P2 => isoProject(v);
const visible = (n: Vec3) => dot(n, C) > 1e-6;

/** Dominant visible axis of a normal, as FaceToneMaterial snaps curved parts. */
export function snapFace(n: Vec3): Face {
  const x = Math.max(n[0], 0);
  const y = Math.max(n[1], 0);
  const z = Math.max(n[2], 0);
  const m = Math.max(x, y, z);
  return m === y ? 'top' : m === z ? 'left' : 'right';
}

function shadingFor(n: Vec3): Shading {
  const u = norm(n);
  if (u[1] > 0.999) return 'top';
  if (u[2] > 0.999) return 'left';
  if (u[0] > 0.999) return 'right';
  return { n: u };
}

// ---------------------------------------------------------------- primitives

export function fill(pts: Vec3[], tone: ToneRole, shade: Shading, stroke = true): FillPart {
  return { kind: 'fill', pts: pts.map(P), tone, shade, stroke };
}

/** Planar polygon at any orientation; shading comes from its normal (Newell's method), flipped to face the camera. */
export function poly(pts: Vec3[], tone: ToneRole, stroke = true): FillPart {
  let n: Vec3 = [0, 0, 0];
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    n = add(n, [(p[1] - q[1]) * (p[2] + q[2]), (p[2] - q[2]) * (p[0] + q[0]), (p[0] - q[0]) * (p[1] + q[1])]);
  });
  if (!visible(n)) n = scale(n, -1);
  return fill(pts, tone, shadingFor(n), stroke);
}

export function line(pts: Vec3[], o: { closed?: boolean; weight?: number } = {}): LinePart {
  return { kind: 'line', pts: pts.map(P), closed: o.closed ?? false, weight: o.weight ?? 1 };
}

export function tube(pts: Vec3[], tone: ToneRole, o: { core?: number; shade?: Shading } = {}): TubePart {
  return { kind: 'tube', pts: pts.map(P), tone, shade: o.shade ?? 'top', core: o.core ?? 1.4 };
}

/** Axis-aligned box; `at` is the centre of its base (like the 3D primitives). */
export function box(at: Vec3, size: Vec3, tone: ToneRole, o: { stroke?: boolean; faces?: Partial<Record<Face, ToneRole>> } = {}): Part[] {
  const [cx, y0, cz] = at;
  const [w, h, d] = size;
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const z0 = cz - d / 2;
  const z1 = cz + d / 2;
  const y1 = y0 + h;
  const s = o.stroke ?? true;
  const t = (f: Face) => o.faces?.[f] ?? tone;
  return [
    fill([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], t('top'), 'top', s),
    fill([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], t('left'), 'left', s),
    fill([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], t('right'), 'right', s),
  ];
}

/** Rectangle decal on the +Z (left) face plane z = `z`: x ∈ [x0,x1], y ∈ [y0,y1]. */
export const leftRect = (z: number, x0: number, x1: number, y0: number, y1: number, tone: ToneRole, stroke = false) =>
  fill([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], tone, 'left', stroke);

/** Rectangle decal on the +X (right) face plane x = `x`: z ∈ [z0,z1], y ∈ [y0,y1]. */
export const rightRect = (x: number, z0: number, z1: number, y0: number, y1: number, tone: ToneRole, stroke = false) =>
  fill([[x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]], tone, 'right', stroke);

/** Rectangle decal on the top plane y = `y`: x ∈ [x0,x1], z ∈ [z0,z1]. */
export const topRect = (y: number, x0: number, x1: number, z0: number, z1: number, tone: ToneRole, stroke = false) =>
  fill([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], tone, 'top', stroke);

export interface Frame {
  origin: Vec3;
  u: Vec3;
  v: Vec3;
}

/** Point (a, b) of a 2D outline placed in a frame. */
const inFrame = (f: Frame, [a, b]: P2): Vec3 => add(f.origin, add(scale(f.u, a), scale(f.v, b)));

/** A flat polygon drawn in a frame (decals, flags, sheets). Shading follows the frame's normal u×v. */
export function flat(f: Frame, outline: P2[], tone: ToneRole, stroke = true): FillPart {
  let n = cross(f.u, f.v);
  if (!visible(n)) n = scale(n, -1);
  return fill(outline.map((p) => inFrame(f, p)), tone, shadingFor(n), stroke);
}

/** Circle of radius r around `c` in the plane spanned by u, v (unit vectors). */
export function ring3(c: Vec3, u: Vec3, v: Vec3, r: number, a0 = 0, a1 = Math.PI * 2, seg = 40): Vec3[] {
  const n = Math.max(2, Math.ceil((seg * Math.abs(a1 - a0)) / (Math.PI * 2)));
  const out: Vec3[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push(add(c, add(scale(u, Math.cos(a) * r), scale(v, Math.sin(a) * r))));
  }
  return out;
}

/** Filled disc in a plane (lens glass, emblems, coffee). */
export function disc(c: Vec3, u: Vec3, v: Vec3, r: number, tone: ToneRole, stroke = true): FillPart {
  const pts = ring3(c, u, v, r);
  pts.pop();
  let n = cross(u, v);
  if (!visible(n)) n = scale(n, -1);
  return fill(pts, tone, shadingFor(n), stroke);
}

/**
 * Extrusion of a 2D outline (in the frame's u/v plane) along the frame normal by `depth` (from 0 to depth).
 * Flat faces, each stroked: every visible edge of a flat-faced solid is a real edge.
 */
export function prism(f: Frame, outline: P2[], depth: number, tone: ToneRole, o: { capTone?: ToneRole; stroke?: boolean } = {}): Part[] {
  const w = norm(cross(f.u, f.v));
  const back = outline.map((p) => inFrame(f, p));
  const front = back.map((p) => add(p, scale(w, depth)));
  let area = 0;
  outline.forEach(([x, y], i) => {
    const [x2, y2] = outline[(i + 1) % outline.length];
    area += x * y2 - x2 * y;
  });
  const sign = area > 0 ? 1 : -1;
  const sides: Array<{ pts: Vec3[]; n: Vec3; depth: number }> = [];
  outline.forEach(([x, y], i) => {
    const j = (i + 1) % outline.length;
    const [x2, y2] = outline[j];
    // Outward normal of edge i→j in frame coords, then to world.
    const n = add(scale(f.u, sign * (y2 - y)), scale(f.v, -sign * (x2 - x)));
    if (!visible(n)) return;
    const pts = [back[i], back[j], front[j], front[i]];
    const c = pts.reduce((acc, p) => add(acc, p), [0, 0, 0] as Vec3);
    sides.push({ pts, n, depth: dot(c, C) });
  });
  sides.sort((a, b) => a.depth - b.depth);
  const s = o.stroke ?? true;
  const parts: Part[] = sides.map((sd) => fill(sd.pts, tone, shadingFor(sd.n), s));
  if (visible(w)) parts.push(fill(front, o.capTone ?? tone, shadingFor(w), s));
  else parts.push(fill(back, o.capTone ?? tone, shadingFor(scale(w, -1)), s));
  return parts;
}

/** Frame for the +Z face plane at z (u = +X, v = +Y), i.e. outlines that face the left of the screen. */
export const frontFrame = (origin: Vec3 = [0, 0, 0]): Frame => ({ origin, u: [1, 0, 0], v: [0, 1, 0] });
/** Frame for the +X face plane (u = −Z so outlines read left-to-right on screen, v = +Y). */
export const sideFrame = (origin: Vec3 = [0, 0, 0]): Frame => ({ origin, u: [0, 0, -1], v: [0, 1, 0] });
/** Frame for the ground plane (u = +X, v = −Z so a positive-area outline is counter-clockwise from above). */
export const groundFrame = (origin: Vec3 = [0, 0, 0]): Frame => ({ origin, u: [1, 0, 0], v: [0, 0, -1] });

function hull(points: P2[]): P2[] {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const crossZ = (o: P2, a: P2, b: P2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: P2[] = [];
  for (const q of p) {
    while (lower.length >= 2 && crossZ(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: P2[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && crossZ(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/**
 * Cylinder from `base` along unit `axis`, cut-paper shaded like uCurved (each facet snaps to its dominant
 * axis tone). Facets are merged into one polygon per tone run, outlined by the silhouette (convex hull) and
 * the visible cap. `half` keeps only the half whose side faces that direction (a rounded top, a roll).
 */
export function cylinder(
  base: Vec3,
  axis: Vec3,
  r: number,
  len: number,
  tone: ToneRole,
  o: { cap?: boolean; capTone?: ToneRole; seg?: number; outline?: boolean; half?: Vec3 } = {},
): Part[] {
  const w = norm(axis);
  const helper: Vec3 = Math.abs(w[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = norm(cross(w, helper));
  const v = cross(w, u);
  const top = add(base, scale(w, len));
  const at = (c: Vec3, a: number): Vec3 => add(c, add(scale(u, Math.cos(a) * r), scale(v, Math.sin(a) * r)));
  const normalAt = (a: number): Vec3 => add(scale(u, Math.cos(a)), scale(v, Math.sin(a)));
  let a0 = 0;
  let span = Math.PI * 2;
  let seg = o.seg ?? 48;
  if (o.half) {
    a0 = Math.atan2(dot(o.half, v), dot(o.half, u)) - Math.PI / 2;
    span = Math.PI;
    seg = Math.ceil(seg / 2);
  } else {
    // Start the full ring at a tone boundary so no run is split across the seam.
    const faceAt = (i: number) => {
      const n = normalAt(((i + 0.5) / seg) * span);
      return visible(n) ? snapFace(n) : null;
    };
    const k = Array.from({ length: seg }, (_, i) => i).find((i) => faceAt(i) !== faceAt(i - 1)) ?? 0;
    a0 = (k / seg) * span;
  }
  const angle = (t: number) => a0 + (span * t) / seg;
  const parts: Part[] = [];
  let runStart = -1;
  let runFace: Face | null = null;
  const flush = (end: number) => {
    if (runFace === null || runStart < 0) return;
    const lo: Vec3[] = [];
    const hi: Vec3[] = [];
    for (let t = runStart; t <= end; t++) {
      lo.push(at(base, angle(t)));
      hi.push(at(top, angle(t)));
    }
    parts.push(fill([...lo, ...hi.reverse()], tone, runFace, false));
  };
  for (let i = 0; i <= seg; i++) {
    const n = i < seg ? normalAt(angle(i + 0.5)) : null;
    const face = n && visible(n) ? snapFace(n) : null;
    if (face !== runFace) {
      flush(i);
      runStart = i;
      runFace = face;
    }
  }
  const capUp = visible(w);
  const capC = capUp ? top : base;
  const capN = capUp ? w : scale(w, -1);
  const ringPts = (c: Vec3) => Array.from({ length: seg + (o.half ? 1 : 0) }, (_, i) => at(c, angle(i)));
  const capPts = ringPts(capC);
  if (o.cap ?? true) parts.push(fill(capPts, o.capTone ?? tone, snapFace(capN), true));
  if (o.outline ?? true) {
    const all = [...capPts, ...ringPts(capUp ? base : top)].map(P);
    parts.push({ kind: 'line', pts: hull(all), closed: true, weight: 1 });
  }
  return parts;
}

/** Vertical cylinder standing on `at` (base centre). */
export const vcyl = (at: Vec3, r: number, h: number, tone: ToneRole, o: Parameters<typeof cylinder>[5] = {}) =>
  cylinder(at, [0, 1, 0], r, h, tone, o);

// Screen angles (y down) of the three seams of a cut-paper sphere: the projections of the great circles
// x = y, y = z and x = z, which all pass through the point facing the camera.
const SEAM_UP_LEFT = (210 * Math.PI) / 180;
const SEAM_UP_RIGHT = (330 * Math.PI) / 180;
const SEAM_DOWN = (90 * Math.PI) / 180;

function arc2(c: P2, rx: number, ry: number, a0: number, a1: number, seg = 40): P2[] {
  const n = Math.max(2, Math.ceil((seg * Math.abs(a1 - a0)) / (Math.PI * 2)));
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [c[0] + Math.cos(a) * rx, c[1] + Math.sin(a) * ry] as P2;
  });
}

const SECTORS: Array<{ face: Face; a0: number; a1: number }> = [
  { face: 'top', a0: SEAM_UP_LEFT, a1: SEAM_UP_RIGHT },
  { face: 'right', a0: SEAM_UP_RIGHT, a1: SEAM_DOWN + Math.PI * 2 },
  { face: 'left', a0: SEAM_DOWN, a1: SEAM_UP_LEFT },
];

/**
 * Sphere: orthographic, so a circle of radius r. Cut-paper shading splits it into three 120° sectors (top, right,
 * left) whose seams are straight radii, like a cube's hexagon. `flat` fills it with the top tone only.
 */
export function sphere(c: Vec3, r: number, tone: ToneRole, o: { flat?: boolean; outline?: boolean } = {}): Part[] {
  const sc = P(c);
  const parts: Part[] = [];
  if (o.flat) {
    parts.push({ kind: 'fill', pts: arc2(sc, r, r, 0, Math.PI * 2).slice(0, -1), tone, shade: 'top', stroke: o.outline ?? true });
    return parts;
  }
  for (const s of SECTORS) parts.push({ kind: 'fill', pts: [sc, ...arc2(sc, r, r, s.a0, s.a1)], tone, shade: s.face, stroke: false });
  if (o.outline ?? true) parts.push({ kind: 'line', pts: arc2(sc, r, r, 0, Math.PI * 2).slice(0, -1), closed: true, weight: 1 });
  return parts;
}

/** Sutherland–Hodgman: clip `poly` by a convex `clip` polygon (any winding). */
function clipConvex(poly: P2[], clip: P2[]): P2[] {
  let area = 0;
  clip.forEach(([x, y], i) => {
    const [x2, y2] = clip[(i + 1) % clip.length];
    area += x * y2 - x2 * y;
  });
  const s = area > 0 ? 1 : -1;
  const inside = (p: P2, a: P2, b: P2) => s * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) >= 0;
  const meet = (p: P2, q: P2, a: P2, b: P2): P2 => {
    const d = (p[0] - q[0]) * (a[1] - b[1]) - (p[1] - q[1]) * (a[0] - b[0]);
    const t = ((p[0] - a[0]) * (a[1] - b[1]) - (p[1] - a[1]) * (a[0] - b[0])) / (d || 1e-9);
    return [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])];
  };
  let out = poly;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j];
      const q = input[(j + 1) % input.length];
      const pin = inside(p, a, b);
      const qin = inside(q, a, b);
      if (pin) out.push(p);
      if (pin !== qin) out.push(meet(p, q, a, b));
    }
  }
  return out;
}

/**
 * Upper hemisphere (domes, bulbs) centred on `c` (the centre of its flat base). The visible region is the
 * upper half-disc plus the front half of the base ellipse; the sphere's sectors are clipped to it.
 */
export function dome(c: Vec3, r: number, tone: ToneRole): Part[] {
  const sc = P(c);
  const ry = r / Math.sqrt(3);
  const region = [...arc2(sc, r, r, Math.PI, Math.PI * 2), ...arc2(sc, r, ry, 0, Math.PI).slice(1, -1)];
  const parts: Part[] = [];
  for (const s of SECTORS) {
    const sector: P2[] = [sc, ...arc2(sc, r * 1.02, r * 1.02, s.a0, s.a1)];
    const pts = clipConvex(sector, region);
    if (pts.length >= 3) parts.push({ kind: 'fill', pts, tone, shade: s.face, stroke: false });
  }
  parts.push({ kind: 'line', pts: region, closed: true, weight: 1 });
  return parts;
}

/**
 * Lower hemisphere open at the top (bowls). The rim ellipse is filled with `inner` (what's in the bowl),
 * the outer wall splits left/right at the front meridian.
 */
export function bowl(c: Vec3, r: number, tone: ToneRole, inner: ToneRole): Part[] {
  const sc = P(c);
  const ry = r / Math.sqrt(3);
  const rim = arc2(sc, r, ry, 0, Math.PI * 2).slice(0, -1);
  // Outer wall: lower half-disc minus the rim's front half, split by the vertical through the centre.
  const leftWall: P2[] = [...arc2(sc, r, r, Math.PI / 2, Math.PI), ...arc2(sc, r, ry, Math.PI, Math.PI / 2)];
  const rightWall: P2[] = [...arc2(sc, r, r, 0, Math.PI / 2), ...arc2(sc, r, ry, Math.PI / 2, 0)];
  return [
    { kind: 'fill', pts: leftWall, tone, shade: 'left', stroke: false },
    { kind: 'fill', pts: rightWall, tone, shade: 'right', stroke: false },
    { kind: 'fill', pts: rim, tone: inner, shade: 'top', stroke: true },
    { kind: 'line', pts: [...arc2(sc, r, r, 0, Math.PI), ...arc2(sc, r, ry, Math.PI, Math.PI * 2).slice(1)], closed: true, weight: 1 },
  ];
}

/**
 * Faceted cone / pyramid: a regular polygon of `sides` around `at` (perpendicular to `axis`, default up) and an
 * apex `h` along the axis. Flat faces, stroked (parasol ribs, mountain ridges). `alternate` stripes every other face.
 */
export function cone(
  at: Vec3,
  r: number,
  h: number,
  sides: number,
  tone: ToneRole,
  o: { rotate?: number; alternate?: ToneRole; axis?: Vec3 } = {},
): Part[] {
  const w = norm(o.axis ?? [0, 1, 0]);
  const helper: Vec3 = Math.abs(w[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
  const v = norm(cross(helper, w));
  const u = cross(w, v);
  const apex = add(at, scale(w, h));
  const rot = o.rotate ?? 0;
  const base: Vec3[] = Array.from({ length: sides }, (_, i) => {
    const a = rot + (i / sides) * Math.PI * 2;
    return add(at, add(scale(u, Math.cos(a) * r), scale(v, Math.sin(a) * r)));
  });
  const faces: Array<{ pts: Vec3[]; n: Vec3; depth: number; k: number }> = [];
  base.forEach((p, i) => {
    const q = base[(i + 1) % sides];
    const n = cross([q[0] - p[0], q[1] - p[1], q[2] - p[2]], [apex[0] - p[0], apex[1] - p[1], apex[2] - p[2]]);
    const mid: Vec3 = [(p[0] + q[0]) / 2 - at[0], (p[1] + q[1]) / 2 - at[1], (p[2] + q[2]) / 2 - at[2]];
    const out = dot(n, mid) >= 0 ? n : scale(n, -1);
    if (!visible(out)) return;
    faces.push({ pts: [p, q, apex], n: out, depth: dot(add(add(p, q), apex), C), k: i });
  });
  faces.sort((a, b) => a.depth - b.depth);
  return faces.map((f) => fill(f.pts, o.alternate && f.k % 2 ? o.alternate : tone, shadingFor(f.n), true));
}

/** Upright pyramid over a regular polygon base in the ground plane. */
export const pyramid = (at: Vec3, r: number, h: number, sides: number, tone: ToneRole, o: { rotate?: number; alternate?: ToneRole } = {}) =>
  cone(at, r, h, sides, tone, o);

// ---------------------------------------------------------------- compile

export interface GlyphGeometry {
  parts: Part[];
  /** Largest extent in 24-grid units (default 22). Lower it for glyphs that read heavy. */
  fit?: number;
  /** Nudge after centring, in 24-grid units. */
  nudge?: P2;
}

export interface CompiledFill {
  kind: 'fill';
  d: string;
  tone: ToneRole;
  shade: Shading;
  stroke: boolean;
}
export interface CompiledLine {
  kind: 'line';
  d: string;
  weight: number;
}
export interface CompiledTube {
  kind: 'tube';
  d: string;
  tone: ToneRole;
  shade: Shading;
  core: number;
}
export type CompiledPart = CompiledFill | CompiledLine | CompiledTube;

export const GRID = 24;
const f2 = (n: number) => (Math.round(n * 100) / 100).toString();

function pathD(pts: P2[], closed: boolean): string {
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f2(x)} ${f2(y)}`).join('');
  return closed ? `${d}Z` : d;
}

/** Bounding box of the compiled parts in grid units (for tests and the harness). */
export interface GlyphBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Project → fit into the 24 grid (centred, `fit` units on the long side) → SVG path strings. */
export function compileGlyph(g: GlyphGeometry): { parts: CompiledPart[]; box: GlyphBox } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of g.parts)
    for (const [x, y] of p.pts) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  const fit = g.fit ?? 22;
  const k = fit / Math.max(maxX - minX, maxY - minY, 1e-6);
  const [nx, ny] = g.nudge ?? [0, 0];
  const ox = GRID / 2 - ((minX + maxX) / 2) * k + nx;
  const oy = GRID / 2 - ((minY + maxY) / 2) * k + ny;
  const tx = (pts: P2[]): P2[] => pts.map(([x, y]) => [x * k + ox, y * k + oy]);
  const parts = g.parts.map((p): CompiledPart => {
    if (p.kind === 'fill') return { kind: 'fill', d: pathD(tx(p.pts), true), tone: p.tone, shade: p.shade, stroke: p.stroke };
    if (p.kind === 'line') return { kind: 'line', d: pathD(tx(p.pts), p.closed), weight: p.weight };
    return { kind: 'tube', d: pathD(tx(p.pts), false), tone: p.tone, shade: p.shade, core: p.core };
  });
  return { parts, box: { minX: minX * k + ox, maxX: maxX * k + ox, minY: minY * k + oy, maxY: maxY * k + oy } };
}
