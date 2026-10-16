// Cut-paper face tones (§7.3). One function shared by FaceToneMaterial, the SVG twins and the E5 glyphs, so a
// box looks identical in WebGL, SVG and a 24px icon. All maths is sRGB except faceColor, which mirrors the shader.
import { tokens, type ThemeName } from '@/design/tokens';
import type { Vec3 } from '@/iso/specs';

export interface FaceTones {
  /** +Y face */
  top: string;
  /** +Z face (left on screen) */
  left: string;
  /** +X face (right on screen) */
  right: string;
}

/** How much of the base colour survives on each side face (the rest is the theme's shade). */
export const FACE_MIX: Record<ThemeName, { left: number; right: number }> = {
  light: { left: 0.84, right: 0.66 },
  dark: { left: 0.8, right: 0.6 },
};

export type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`Invalid hex colour: ${hex}`);
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const clamp255 = (v: number) => Math.min(255, Math.max(0, Math.round(v)));

export function rgbToHex([r, g, b]: Rgb): string {
  return `#${((1 << 24) | (clamp255(r) << 16) | (clamp255(g) << 8) | clamp255(b)).toString(16).slice(1).toUpperCase()}`;
}

/** GLSL-style mix in sRGB: a·(1−t) + b·t, rounded per channel. */
export function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

const toneCache = new Map<string, FaceTones>();

/**
 * light: top = base, left = mix(shade, base, .84), right = mix(shade, base, .66)
 * dark:  top = base, left = mix(shade, base, .80), right = mix(shade, base, .60)
 */
export function faceTones(baseHex: string, theme: ThemeName): FaceTones {
  const key = `${baseHex.toUpperCase()}|${theme}`;
  const hit = toneCache.get(key);
  if (hit) return hit;
  const shade = tokens[theme].shade;
  const base = rgbToHex(hexToRgb(baseHex));
  const mix = FACE_MIX[theme];
  const tones: FaceTones = { top: base, left: mixHex(shade, base, mix.left), right: mixHex(shade, base, mix.right) };
  toneCache.set(key, tones);
  return tones;
}

// sRGB <-> linear, same curves as three's ColorManagement.
const toLinear = (c: number) => (c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4));
const toSrgb = (c: number) => (c < 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 0.41666) - 0.055);

/**
 * Colour of a face with world normal `n`, exactly as FaceToneMaterial shades it (blend in linear space,
 * or snap to the dominant axis when `curved`). Use for rotated faces in SVG twins; axis-aligned faces
 * can use the tones directly.
 */
export function faceColor(n: Vec3, tones: FaceTones, curved = false): string {
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  const wx = Math.max(n[0] / len, 0);
  const wy = Math.max(n[1] / len, 0);
  const wz = Math.max(n[2] / len, 0);
  if (curved) {
    const m = Math.max(wx, wy, wz);
    return m === wy ? tones.top : m === wz ? tones.left : tones.right;
  }
  const s = Math.max(wx + wy + wz, 1e-3);
  const R = hexToRgb(tones.right).map((c) => toLinear(c / 255));
  const T = hexToRgb(tones.top).map((c) => toLinear(c / 255));
  const L = hexToRgb(tones.left).map((c) => toLinear(c / 255));
  const out = [0, 1, 2].map((i) => toSrgb((R[i] * wx + T[i] * wy + L[i] * wz) / s) * 255) as Rgb;
  return rgbToHex(out);
}

/** True when a face with this world normal is visible from the iso camera. */
export const facesCamera = (n: Vec3) => n[0] + n[1] + n[2] > 1e-6;
