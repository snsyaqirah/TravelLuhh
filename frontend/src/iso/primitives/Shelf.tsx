// Shelf (§7.6 #13): soil plank, back rail and two brackets, merged into one mesh. Plank top is y = 0.
import { useIso } from '@/iso/canvas/context';
import { faceToneMaterial } from '@/iso/material/FaceToneMaterial';
import { IsoEdges } from '@/iso/primitives/Edges';
import { shelfGeo } from '@/iso/primitives/geometries';
import type { Vec3 } from '@/iso/specs';

export interface ShelfProps {
  /** Number of jar slots (2.6 units each). */
  slots: number;
  position?: Vec3;
}

export function Shelf({ slots, position }: ShelfProps) {
  const { theme, palette } = useIso();
  const geo = shelfGeo(slots);
  return (
    <mesh geometry={geo} material={faceToneMaterial(palette.soil, theme)} position={position}>
      <IsoEdges geometry={geo} />
    </mesh>
  );
}
