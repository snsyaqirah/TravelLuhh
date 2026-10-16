// Coin pile inside a balang (§7.6 #3): one InstancedMesh per coin tint (3 draw calls), seeded tilt and order.
// Coordinates are an unscaled 2.4-high jar; Balang scales the whole group.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three';
import { useIso } from '@/iso/canvas/context';
import { faceToneMaterial } from '@/iso/material/FaceToneMaterial';
import { cylinderGeo } from '@/iso/primitives/geometries';
import { COIN_PILE, coinPileLayout, type CoinPose } from '@/iso/shapes';

export interface CoinPileProps {
  count: number;
  seed: string | number;
  /** Override the tier's layout (lite = 60 bigger coins). */
  lite?: boolean;
  /** Coins hidden from the top of the pile (e.g. the one currently flying out). */
  hideTop?: number;
}

const m = new Matrix4();
const q = new Quaternion();
const v = new Vector3();
const axis = new Vector3();
const one = new Vector3(1, 1, 1);

function poseMatrix(c: CoinPose, out: Matrix4): Matrix4 {
  axis.set(c.axis[0], c.axis[1], c.axis[2]);
  q.setFromAxisAngle(axis, c.angle);
  v.set(c.position[0], c.position[1], c.position[2]);
  return out.compose(v, q, one);
}

export function CoinPile({ count, seed, lite, hideTop = 0 }: CoinPileProps) {
  const { theme, tier, palette } = useIso();
  const isLite = lite ?? tier === 'lite';
  const cfg = isLite ? COIN_PILE.lite : COIN_PILE.high;
  const layout = useMemo(() => coinPileLayout(count, seed, isLite), [count, seed, isLite]);
  const geo = cylinderGeo(cfg.r, cfg.r, cfg.h, cfg.segments);
  const refs = [useRef<InstancedMesh>(null), useRef<InstancedMesh>(null), useRef<InstancedMesh>(null)];
  const mats = palette.coins.map((hex) => faceToneMaterial(hex, theme, { curved: true }));

  useLayoutEffect(() => {
    const visible = layout.slice(0, Math.max(0, layout.length - hideTop));
    refs.forEach((ref, tint) => {
      const mesh = ref.current;
      if (!mesh) return;
      let i = 0;
      for (const c of visible) if (c.tint === tint) mesh.setMatrixAt(i++, poseMatrix(c, m));
      mesh.count = i;
      mesh.instanceMatrix.needsUpdate = true;
    });
    // refs are stable; mats only change with theme (which recreates the meshes via args)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, hideTop, mats[0], mats[1], mats[2], geo]);

  return (
    <>
      {refs.map((ref, tint) => (
        <instancedMesh
          key={tint}
          ref={ref}
          args={[geo, mats[tint], cfg.capacity]}
          renderOrder={1}
          frustumCulled={false}
        />
      ))}
    </>
  );
}
