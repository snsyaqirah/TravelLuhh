// Tiny tween store (§7.6, §10). The canvas has frameloop="demand", so nothing renders unless asked: while any
// tween runs the store calls invalidate() each frame, then stops and the scene idles at 0 fps.
// Two kinds: timed tweens (duration + easing) and springs via maath/easing.damp.
// NOTE: maath imports three, so only the lazy 3D chunk may import this module.
import { damp } from 'maath/easing';

export type Easing = (t: number) => number;

/** CSS-style cubic-bezier(x1, y1, x2, y2) easing. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Easing {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dsx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - x;
      if (Math.abs(err) < 1e-6) return sy(t);
      const d = dsx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    // Newton stalled: fall back to bisection.
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 30; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

const dropIn = cubicBezier(0.5, 0, 0.75, 0);

/** Motion tokens (§10). */
export const easings = {
  linear: (t: number) => t,
  out: cubicBezier(0.2, 0.8, 0.2, 1),
  stamp: cubicBezier(0.3, 1.5, 0.5, 1),
  /** ease-drop then one 6% bounce: falls over the first 80%, rebounds 6% of the fall and settles. */
  drop: (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const split = 0.8;
    if (t < split) return dropIn(t / split);
    const u = (t - split) / (1 - split);
    return 1 - 0.06 * Math.sin(Math.PI * u);
  },
} satisfies Record<string, Easing>;

/** Point on a coin's arc: linear in x/z; in y a parabola that peaks `lift` above the chord's midpoint. */
export function arcPoint(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  lift: number,
  t: number,
): [number, number, number] {
  const y = from[1] + (to[1] - from[1]) * t + 4 * lift * t * (1 - t);
  return [from[0] + (to[0] - from[0]) * t, y, from[2] + (to[2] - from[2]) * t];
}

/** Coin stagger (§10.4): 8ms apart, at most 24 animated per event, the rest snap. */
export const COIN_STAGGER_MS = 8;
export const MAX_ANIMATED_COINS = 24;

export interface TimedTween {
  from: number;
  to: number;
  /** ms */
  duration: number;
  /** ms */
  delay?: number;
  ease?: Easing;
  onUpdate: (value: number, progress: number) => void;
  onDone?: () => void;
}

export interface SpringTween {
  /** Object holding the animated number; mutated in place (maath convention). */
  target: Record<string, number>;
  key: string;
  to: number;
  /** seconds, maath smoothTime (~0.1 settles in ≈400ms) */
  smoothTime?: number;
  eps?: number;
  onUpdate?: (value: number) => void;
  onDone?: () => void;
}

interface TimedEntry {
  kind: 'timed';
  t: TimedTween;
  elapsed: number;
}

interface SpringEntry {
  kind: 'spring';
  t: SpringTween;
}

type Entry = TimedEntry | SpringEntry;

export interface TweenStore {
  /** Start (or replace) a timed tween under `id`. */
  tween(id: string, t: TimedTween): void;
  /** Start (or retarget) a spring under `id`. */
  spring(id: string, t: SpringTween): void;
  cancel(id: string): void;
  /** Jump every running tween to its end and clear. */
  finishAll(): void;
  /** Advance by `dt` seconds. Returns true while anything still runs. Called by the canvas driver. */
  step(dt: number): boolean;
  readonly active: boolean;
  readonly size: number;
  /** The canvas registers its invalidate() so adding a tween wakes the demand loop. */
  setInvalidate(fn: (() => void) | null): void;
  /** Reduced motion: tweens complete instantly when added. */
  setReducedMotion(on: boolean): void;
}

export function createTweenStore(): TweenStore {
  const entries = new Map<string, Entry>();
  let invalidate: (() => void) | null = null;
  let reduced = false;

  const finish = (e: Entry) => {
    if (e.kind === 'timed') {
      e.t.onUpdate(e.t.to, 1);
      e.t.onDone?.();
    } else {
      e.t.target[e.t.key] = e.t.to;
      e.t.onUpdate?.(e.t.to);
      e.t.onDone?.();
    }
  };

  const add = (id: string, e: Entry) => {
    if (reduced) {
      entries.delete(id);
      finish(e);
      invalidate?.();
      return;
    }
    entries.set(id, e);
    invalidate?.();
  };

  return {
    tween(id, t) {
      add(id, { kind: 'timed', t, elapsed: 0 });
    },
    spring(id, t) {
      add(id, { kind: 'spring', t });
    },
    cancel(id) {
      entries.delete(id);
    },
    finishAll() {
      const all = [...entries.values()];
      entries.clear();
      all.forEach(finish);
      invalidate?.();
    },
    step(dt) {
      for (const [id, e] of [...entries]) {
        if (e.kind === 'timed') {
          e.elapsed += dt * 1000;
          const local = e.elapsed - (e.t.delay ?? 0);
          if (local < 0) continue;
          const p = e.t.duration <= 0 ? 1 : Math.min(local / e.t.duration, 1);
          const eased = (e.t.ease ?? easings.out)(p);
          e.t.onUpdate(e.t.from + (e.t.to - e.t.from) * eased, p);
          if (p >= 1) {
            entries.delete(id);
            e.t.onDone?.();
          }
        } else {
          const moving = damp(e.t.target, e.t.key, e.t.to, e.t.smoothTime ?? 0.1, dt, Infinity, undefined, e.t.eps ?? 0.001);
          e.t.onUpdate?.(e.t.target[e.t.key]);
          if (!moving) {
            entries.delete(id);
            e.t.onDone?.();
          }
        }
      }
      return entries.size > 0;
    },
    get active() {
      return entries.size > 0;
    },
    get size() {
      return entries.size;
    },
    setInvalidate(fn) {
      invalidate = fn;
    },
    setReducedMotion(on) {
      reduced = on;
      if (on) this.finishAll();
    },
  };
}
