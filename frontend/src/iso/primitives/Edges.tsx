// Hero-mesh outlines (§7.4). Our own 1-device-pixel LineSegments rather than drei <Edges>, which in drei 9.122
// is a fat-line (Line2) shader the spec rules out. Render as a child of the mesh so it inherits the transform.
import type { BufferGeometry } from 'three';
import { useIso } from '@/iso/canvas/context';
import { edgeMaterial } from '@/iso/material/FaceToneMaterial';
import { edgesGeo } from '@/iso/primitives/geometries';

export interface IsoEdgesProps {
  /** Source mesh geometry (cached). Edges are cached per geometry and threshold. */
  geometry: BufferGeometry;
  /** Crease angle in degrees. */
  threshold?: number;
  /** Already an edges/line geometry (e.g. merged house edges). */
  prebuilt?: boolean;
}

export function IsoEdges({ geometry, threshold = 20, prebuilt }: IsoEdgesProps) {
  const { theme, tier } = useIso();
  if (tier === 'lite') return null;
  return (
    <lineSegments
      geometry={prebuilt ? geometry : edgesGeo(geometry, threshold)}
      material={edgeMaterial(theme)}
      renderOrder={5}
    />
  );
}
