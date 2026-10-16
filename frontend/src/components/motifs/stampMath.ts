// Seeded stamp pose. A stamp lands at the same slight angle every time it is drawn for the same thing, on
// every device, so a passport page never reshuffles.
import { hashString, mulberry32 } from '@/iso/seed';

/** Rotation range from the spec (§5.4): −6° to +8°. */
export const STAMP_ROTATION_MIN = -6;
export const STAMP_ROTATION_MAX = 8;

/** Degrees in [−6, +8), from hash(seed + text). */
export function stampRotation(seed: string | number, text: string): number {
  const next = mulberry32(hashString(`${seed}${text}`));
  const deg = STAMP_ROTATION_MIN + next() * (STAMP_ROTATION_MAX - STAMP_ROTATION_MIN);
  return Math.round(deg * 10) / 10;
}

/** feTurbulence seed for the ink bleed, so two stamps on one page don't bleed identically. */
export function stampNoiseSeed(seed: string | number, text: string): number {
  return hashString(`${text}|${seed}|ink`) % 997;
}
