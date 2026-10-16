// Signpost (§7.6 #8): soil post with two leaf arrow boards. The DOM label carries "MY → JP".
import { useIso } from '@/iso/canvas/context';
import { rectFootprint } from '@/iso/geometry2d';
import { faceToneMaterial } from '@/iso/material/FaceToneMaterial';
import { IsoEdges } from '@/iso/primitives/Edges';
import { HardShadow } from '@/iso/primitives/HardShadow';
import { arrowBoardGeo, boxBaseGeo } from '@/iso/primitives/geometries';
import { SIGNPOST } from '@/iso/shapes';
import type { Vec3 } from '@/iso/specs';

export interface SignpostProps {
  position?: Vec3;
  shadow?: boolean;
}

export function Signpost({ position, shadow = true }: SignpostProps) {
  const { theme, palette } = useIso();
  const post = boxBaseGeo(...SIGNPOST.post);
  const board = arrowBoardGeo();
  const boardMat = faceToneMaterial(palette.leaf, theme);
  return (
    <group position={position}>
      {shadow ? <HardShadow footprint={rectFootprint(SIGNPOST.post[0], SIGNPOST.post[2])} h={SIGNPOST.post[1]} /> : null}
      <mesh geometry={post} material={faceToneMaterial(palette.soil, theme)}>
        <IsoEdges geometry={post} />
      </mesh>
      {/* Upper board points +X (right on screen), lower board points +Z (left on screen). */}
      <mesh geometry={board} material={boardMat} position={[0, SIGNPOST.boardsY[0], 0]}>
        <IsoEdges geometry={board} />
      </mesh>
      <mesh geometry={board} material={boardMat} position={[0, SIGNPOST.boardsY[1], 0]} rotation={[0, -Math.PI / 2, 0]}>
        <IsoEdges geometry={board} />
      </mesh>
    </group>
  );
}
