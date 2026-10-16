// One coin on its way somewhere (§10): a precomputed parabola from `from` to `to`, then one 6% bounce. Driven
// by the canvas tween store, so it renders frames only while flying. Reduced motion lands it at once.
// Use for "coin leaves the jar" (TripPlot coinOut, Counter) without touching the instanced piles mid-flight.
import { useEffect, useRef } from 'react';
import type { Mesh } from 'three';
import { useIso } from '@/iso/canvas/context';
import { faceToneMaterial } from '@/iso/material/FaceToneMaterial';
import { cylinderGeo } from '@/iso/primitives/geometries';
import { COIN_STACK } from '@/iso/shapes';
import type { Vec3 } from '@/iso/specs';
import { arcPoint } from '@/iso/tween';

export interface CoinFlightProps {
  from: Vec3;
  to: Vec3;
  /** Change this to launch a coin (e.g. an event id); null keeps it parked and hidden. */
  launchKey: string | number | null;
  /** ms, default 450 (--dur-object). */
  duration?: number;
  /** Arc height above the chord midpoint. */
  lift?: number;
  /** Stagger (ms). */
  delay?: number;
  tint?: 0 | 1 | 2;
  onLanded?: () => void;
}

const FLIGHT = 0.8; // share of the duration spent in the air; the rest is the bounce

export function CoinFlight({ from, to, launchKey, duration = 450, lift = 0.8, delay = 0, tint = 0, onLanded }: CoinFlightProps) {
  const { theme, palette, tweens } = useIso();
  const ref = useRef<Mesh>(null);
  const landed = useRef(onLanded);
  landed.current = onLanded;
  const [fx, fy, fz] = from;
  const [tx, ty, tz] = to;

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh || launchKey === null) return;
    const a: Vec3 = [fx, fy, fz];
    const b: Vec3 = [tx, ty, tz];
    const bounce = 0.06 * Math.max(fy - ty + lift, 0.2);
    const id = `coin-flight-${String(launchKey)}`;
    mesh.visible = true;
    mesh.position.set(fx, fy, fz);
    tweens.tween(id, {
      from: 0,
      to: 1,
      duration,
      delay,
      ease: (t) => t,
      onUpdate: (t) => {
        if (t < FLIGHT) {
          const p = arcPoint(a, b, lift, t / FLIGHT);
          mesh.position.set(p[0], p[1], p[2]);
          mesh.rotation.x = (t / FLIGHT) * Math.PI * 1.5;
        } else {
          const u = (t - FLIGHT) / (1 - FLIGHT);
          mesh.position.set(tx, ty + bounce * Math.sin(Math.PI * u), tz);
          mesh.rotation.x = 0;
        }
      },
      onDone: () => {
        mesh.visible = false;
        landed.current?.();
      },
    });
    return () => tweens.cancel(id);
  }, [launchKey, fx, fy, fz, tx, ty, tz, duration, lift, delay, tweens]);

  return (
    <mesh
      ref={ref}
      visible={false}
      geometry={cylinderGeo(COIN_STACK.r, COIN_STACK.r, COIN_STACK.h, COIN_STACK.segments)}
      material={faceToneMaterial(palette.coins[tint], theme, { curved: true })}
    />
  );
}
