// IOU slip (§7.6 #12): paper slip with a stamp line at the jar's foot. The jar owes money (over budget).
import { useIso } from '@/iso/canvas/context';
import { faceToneMaterial } from '@/iso/material/FaceToneMaterial';
import { boxBaseGeo } from '@/iso/primitives/geometries';
import { IOU } from '@/iso/shapes';
import type { Vec3 } from '@/iso/specs';

export interface IOUSlipProps {
  position?: Vec3;
  /** Radians about Y; a dropped slip reads better slightly askew. */
  rotY?: number;
}

export function IOUSlip({ position, rotY = 0.18 }: IOUSlipProps) {
  const { theme, palette } = useIso();
  const [pw, ph, pd] = IOU.paper;
  const [lw, lh] = IOU.line;
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh geometry={boxBaseGeo(pw, ph, pd)} material={faceToneMaterial(palette.leaf, theme)} />
      <mesh geometry={boxBaseGeo(lw, 0.002, lh)} material={faceToneMaterial(palette.over, theme)} position={[0, ph, 0.05]} />
    </group>
  );
}
