// Category block + prop (§7.6 #9). The block's height is data (Counter: 3.0 × catSpent / target); the prop
// on top names the category without text. Props are merged per material at first use (≤ 2 meshes each).
import type { CategoryKey } from '@/design/tokens';
import { useIso } from '@/iso/canvas/context';
import { rectFootprint } from '@/iso/geometry2d';
import { faceToneMaterial } from '@/iso/material/FaceToneMaterial';
import { IsoEdges } from '@/iso/primitives/Edges';
import { HardShadow } from '@/iso/primitives/HardShadow';
import { Pennant } from '@/iso/primitives/Pennant';
import { PROP_HEIGHT, boxBaseGeo, categoryPropGeo } from '@/iso/primitives/geometries';
import { BLOCK } from '@/iso/shapes';
import type { Vec3 } from '@/iso/specs';

export interface CategoryPropProps {
  category: CategoryKey;
  position?: Vec3;
}

export function CategoryProp({ category, position }: CategoryPropProps) {
  const { theme, palette } = useIso();
  const parts = categoryPropGeo(category);
  if (parts.pennant) return <Pennant position={position} flag={palette.leaf} height={0.6} />;
  const curved = !!parts.curved;
  const meshes: Array<[NonNullable<typeof parts.main>, string, boolean]> = [];
  if (parts.main) meshes.push([parts.main, palette.category[category], false]);
  if (parts.paper) meshes.push([parts.paper, palette.leaf, curved]);
  if (parts.wood) meshes.push([parts.wood, palette.soil, false]);
  if (parts.shade) meshes.push([parts.shade, palette.shade, curved]);
  return (
    <group position={position}>
      {meshes.map(([geometry, hex, c]) => (
        <mesh key={geometry.uuid} geometry={geometry} material={faceToneMaterial(hex, theme, { curved: c })}>
          <IsoEdges geometry={geometry} />
        </mesh>
      ))}
    </group>
  );
}

export interface CategoryBlockProps {
  category: CategoryKey;
  /** Block height in world units (clamped to ≥ .12). */
  height: number;
  position?: Vec3;
  prop?: boolean;
  shadow?: boolean;
}

export function CategoryBlock({ category, height, position, prop = true, shadow = true }: CategoryBlockProps) {
  const { theme, palette } = useIso();
  const h = Math.max(height, BLOCK.minH);
  const geo = boxBaseGeo(BLOCK.w, 1, BLOCK.d);
  return (
    <group position={position}>
      {shadow ? (
        <HardShadow footprint={rectFootprint(BLOCK.w, BLOCK.d)} h={h + (prop ? PROP_HEIGHT[category] : 0)} />
      ) : null}
      <mesh geometry={geo} material={faceToneMaterial(palette.category[category], theme)} scale={[1, h, 1]}>
        <IsoEdges geometry={geo} />
      </mesh>
      {prop ? <CategoryProp category={category} position={[0, h, 0]} /> : null}
    </group>
  );
}
