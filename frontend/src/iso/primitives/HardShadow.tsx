// Hard shadow (§7.4): opaque hull of the footprint and the footprint pushed +0.5·h along X. No shadow maps.
// Drawn after ground layers and before objects, without writing depth, so objects standing in it (however
// thin) always cover it while it still sits on top of the ground.
import { useEffect, useMemo } from 'react';
import { useIso } from '@/iso/canvas/context';
import { shadowHull } from '@/iso/geometry2d';
import { flatMaterial } from '@/iso/material/FaceToneMaterial';
import { shadowShapeGeo } from '@/iso/primitives/geometries';
import { LAYER } from '@/iso/shapes';
import type { Vec3 } from '@/iso/specs';
import type { Footprint } from '@/iso/types';

export const SHADOW_Y = 0.002;

export interface HardShadowProps {
  /** Footprint in local x/z (use circleFootprint(r) for round things: 16 points). */
  footprint: Footprint;
  /** Height of the object casting it. */
  h: number;
  position?: Vec3;
}

export function HardShadow({ footprint, h, position }: HardShadowProps) {
  const { palette } = useIso();
  const key = `${h}|${footprint.map((p) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`).join(';')}`;
  // Per-instance geometry (footprints vary), so it is owned here rather than in the shared cache.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(() => shadowShapeGeo(shadowHull(footprint, h)), [key]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      geometry={geometry}
      material={flatMaterial(palette.shadow, { polygonOffset: -1, depthWrite: false })}
      renderOrder={LAYER.shadow}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[position?.[0] ?? 0, (position?.[1] ?? 0) + SHADOW_Y, position?.[2] ?? 0]}
    />
  );
}
