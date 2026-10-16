// Kampung house (§7.6 #14): one completed trip. Stilts, leaf body (floors = spend), gable roof (fund or
// stamp), shade door on the +Z face, and a brass pennant on the ridge for a first visit.
import { useIso } from '@/iso/canvas/context';
import { rectFootprint } from '@/iso/geometry2d';
import { faceToneMaterial } from '@/iso/material/FaceToneMaterial';
import { IsoEdges } from '@/iso/primitives/Edges';
import { HardShadow } from '@/iso/primitives/HardShadow';
import { Pennant } from '@/iso/primitives/Pennant';
import { houseGeos } from '@/iso/primitives/geometries';
import type { Vec3 } from '@/iso/specs';

export interface KampungHouseProps {
  /** Footprint side: 0.8 + 0.6 × min(days, 14) / 14. */
  footprint: number;
  /** 1..4 */
  floors: number;
  /** Fund roof when the trip stayed within budget, stamp when over. */
  roof?: 'under' | 'over';
  firstVisit?: boolean;
  position?: Vec3;
  shadow?: boolean;
}

export function KampungHouse({ footprint, floors, roof = 'under', firstVisit, position, shadow = true }: KampungHouseProps) {
  const { theme, palette } = useIso();
  const n = Math.min(Math.max(Math.round(floors), 1), 4);
  const g = houseGeos(footprint, n);
  return (
    <group position={position}>
      {shadow ? <HardShadow footprint={rectFootprint(footprint, footprint)} h={g.height} /> : null}
      <mesh geometry={g.stilts} material={faceToneMaterial(palette.house.stilts, theme, { curved: true })} />
      <mesh geometry={g.body} material={faceToneMaterial(palette.house.body, theme)} />
      <mesh geometry={g.roof} material={faceToneMaterial(palette.roof[roof], theme)} />
      <mesh geometry={g.door} material={faceToneMaterial(palette.house.door, theme)} />
      <IsoEdges geometry={g.edges} prebuilt />
      {firstVisit ? <Pennant position={[footprint / 2 - 0.05, g.height - 0.02, 0]} height={0.45} /> : null}
    </group>
  );
}
