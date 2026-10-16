// Minimal 3D affine maths for SVG twins (no three.js in the page bundle). Rotations follow three's
// Euler 'XYZ' convention, so a twin can copy a primitive's rotation props verbatim.
import type { Vec3 } from '@/iso/specs';

/** Row-major 3×3 linear part + translation. */
export interface Affine {
  m: [number, number, number, number, number, number, number, number, number];
  t: Vec3;
}

export const IDENTITY: Affine = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] };

export function apply(a: Affine, v: Vec3): Vec3 {
  const { m, t } = a;
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2] + t[0],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2] + t[1],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2] + t[2],
  ];
}

/** Rotate/scale a direction (ignores translation). Fine for normals under rotation + axis-aligned scale. */
export function applyDir(a: Affine, v: Vec3): Vec3 {
  const { m } = a;
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
}

/** a ∘ b: apply b first, then a (same order as three's parent.matrix × child.matrix). */
export function mul(a: Affine, b: Affine): Affine {
  const A = a.m;
  const B = b.m;
  const m: Affine['m'] = [
    A[0] * B[0] + A[1] * B[3] + A[2] * B[6],
    A[0] * B[1] + A[1] * B[4] + A[2] * B[7],
    A[0] * B[2] + A[1] * B[5] + A[2] * B[8],
    A[3] * B[0] + A[4] * B[3] + A[5] * B[6],
    A[3] * B[1] + A[4] * B[4] + A[5] * B[7],
    A[3] * B[2] + A[4] * B[5] + A[5] * B[8],
    A[6] * B[0] + A[7] * B[3] + A[8] * B[6],
    A[6] * B[1] + A[7] * B[4] + A[8] * B[7],
    A[6] * B[2] + A[7] * B[5] + A[8] * B[8],
  ];
  return { m, t: apply(a, b.t) };
}

export const translation = (x: number, y: number, z: number): Affine => ({ m: [...IDENTITY.m], t: [x, y, z] });

export const scaling = (x: number, y = x, z = x): Affine => ({ m: [x, 0, 0, 0, y, 0, 0, 0, z], t: [0, 0, 0] });

export function rotationX(a: number): Affine {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { m: [1, 0, 0, 0, c, -s, 0, s, c], t: [0, 0, 0] };
}

export function rotationY(a: number): Affine {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { m: [c, 0, s, 0, 1, 0, -s, 0, c], t: [0, 0, 0] };
}

export function rotationZ(a: number): Affine {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { m: [c, -s, 0, s, c, 0, 0, 0, 1], t: [0, 0, 0] };
}

/** three.js Object3D transform: T · R(XYZ) · S. */
export function trs(position: Vec3 = [0, 0, 0], rotation: Vec3 = [0, 0, 0], scale: Vec3 | number = 1): Affine {
  const s = typeof scale === 'number' ? scaling(scale) : scaling(scale[0], scale[1], scale[2]);
  const r = mul(mul(rotationX(rotation[0]), rotationY(rotation[1])), rotationZ(rotation[2]));
  return mul(translation(position[0], position[1], position[2]), mul(r, s));
}

/** Compose a chain parent → child → grandchild. */
export const chain = (...xs: Affine[]): Affine => xs.reduce((acc, x) => mul(acc, x), IDENTITY);
