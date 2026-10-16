// Sketch state (§7.4): leaf face tones plus dashed ink-3 edges. Used for future stones, empty-state jars,
// houses and unpacked items.
import { useLayoutEffect, useRef } from 'react';
import type { BufferGeometry, LineSegments } from 'three';
import { useIso } from '@/iso/canvas/context';
import { faceToneMaterial, ghostLineMaterial } from '@/iso/material/FaceToneMaterial';
import { boxBaseGeo, edgesGeo, jarGeo, jarSilhouetteGeo } from '@/iso/primitives/geometries';
import { JAR_REF_HEIGHT } from '@/iso/shapes';
import type { Vec3 } from '@/iso/specs';

/** Dashes need per-vertex line distances; compute once per shared geometry. */
export function DashedLines({ geometry }: { geometry: BufferGeometry }) {
  const { theme } = useIso();
  const ref = useRef<LineSegments>(null);
  useLayoutEffect(() => {
    if (ref.current && !geometry.getAttribute('lineDistance')) ref.current.computeLineDistances();
  }, [geometry]);
  return <lineSegments ref={ref} geometry={geometry} material={ghostLineMaterial(theme)} renderOrder={5} />;
}

export interface GhostProps {
  /** Any cached geometry (box, lathe, gable...). */
  of: BufferGeometry;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3 | number;
  /** Extra outline segments (e.g. a jar silhouette, which a lathe's crease edges can't give). */
  outline?: BufferGeometry;
  curved?: boolean;
}

export function Ghost({ of, position, rotation, scale, outline, curved }: GhostProps) {
  const { theme, palette } = useIso();
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={of} material={faceToneMaterial(palette.leaf, theme, { curved })} />
      <DashedLines geometry={edgesGeo(of, 20)} />
      {outline ? <DashedLines geometry={outline} /> : null}
    </group>
  );
}

/** Ghost box standing on y = 0. */
export function GhostBox({ size, position, rotation }: { size: Vec3; position?: Vec3; rotation?: Vec3 }) {
  return <Ghost of={boxBaseGeo(size[0], size[1], size[2])} position={position} rotation={rotation} />;
}

/** Ghost balang for empty shelves. */
export function GhostJar({ height = JAR_REF_HEIGHT, position }: { height?: number; position?: Vec3 }) {
  const s = height / JAR_REF_HEIGHT;
  return <Ghost of={jarGeo()} outline={jarSilhouetteGeo()} position={position} scale={s} curved />;
}
