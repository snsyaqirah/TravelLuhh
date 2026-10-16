// Road (§7.6 #15): rule-strong strip along X with instanced leaf centre dashes. Separates Kampung years.
import { useLayoutEffect, useRef } from 'react';
import { Matrix4, type InstancedMesh } from 'three';
import { useIso } from '@/iso/canvas/context';
import { faceToneMaterial } from '@/iso/material/FaceToneMaterial';
import { boxGeo, roadGeo } from '@/iso/primitives/geometries';
import { LAYER, ROAD, roadDashCount } from '@/iso/shapes';
import type { Vec3 } from '@/iso/specs';

export interface RoadProps {
  /** Length along X, centred on the origin. */
  length: number;
  position?: Vec3;
}

const mtx = new Matrix4();

export function Road({ length, position }: RoadProps) {
  const { theme, palette } = useIso();
  const ref = useRef<InstancedMesh>(null);
  const count = roadDashCount(length);
  const dash = boxGeo(...ROAD.dash);
  const dashMat = faceToneMaterial(palette.leaf, theme);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const start = -((count - 1) * ROAD.dashPitch) / 2;
    for (let i = 0; i < count; i++) mesh.setMatrixAt(i, mtx.makeTranslation(start + i * ROAD.dashPitch, ROAD.h + ROAD.dash[1] / 2, 0));
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  }, [count, dashMat]);
  return (
    <group position={position}>
      <mesh geometry={roadGeo(length)} material={faceToneMaterial(palette.ruleStrong, theme)} renderOrder={LAYER.ground} />
      {count > 0 ? (
        <instancedMesh ref={ref} args={[dash, dashMat, count]} frustumCulled={false} renderOrder={LAYER.ground} />
      ) : null}
    </group>
  );
}
