// Pennant (§7.6 #7): ink-2 pole and a brass triangle. Marks today's stone and first visits.
import { useIso } from '@/iso/canvas/context';
import { faceToneMaterial } from '@/iso/material/FaceToneMaterial';
import { cylinderGeo, flagGeo } from '@/iso/primitives/geometries';
import { PENNANT } from '@/iso/shapes';
import type { Vec3 } from '@/iso/specs';

export interface PennantProps {
  position?: Vec3;
  /** Flag colour; brass by default. Pass a hex from the palette (e.g. palette.leaf). */
  flag?: string;
  /** Pole height; the flag rides at the top. */
  height?: number;
}

export function Pennant({ position, flag, height = PENNANT.poleH }: PennantProps) {
  const { theme, palette } = useIso();
  const pole = cylinderGeo(PENNANT.poleR, PENNANT.poleR, height, 6);
  return (
    <group position={position}>
      <mesh geometry={pole} material={faceToneMaterial(palette.ink2, theme, { curved: true })} position={[0, height / 2, 0]} />
      <mesh
        geometry={flagGeo(PENNANT.flagW, PENNANT.flagH)}
        material={faceToneMaterial(flag ?? palette.brass, theme)}
        position={[PENNANT.poleR, height - PENNANT.flagH - 0.01, 0]}
      />
    </group>
  );
}
