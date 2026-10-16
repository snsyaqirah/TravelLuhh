// Balang (§7.6 #5): the glass jar that is every trip's tabung. Glass back faces, coins, glass front faces,
// then a drawn silhouette, so it reads as a drawn glass jar rather than a plastic cylinder.
import type { LidColorKey, LidState, Vec3 } from '@/iso/specs';
import { useIso } from '@/iso/canvas/context';
import { circleFootprint } from '@/iso/geometry2d';
import { faceToneMaterial, glassMaterials } from '@/iso/material/FaceToneMaterial';
import { CoinPile } from '@/iso/primitives/CoinPile';
import { IsoEdges } from '@/iso/primitives/Edges';
import { HardShadow } from '@/iso/primitives/HardShadow';
import { boxGeo, cylinderGeo, jarGeo, jarSilhouetteGeo, jarTicksGeo } from '@/iso/primitives/geometries';
import { COIN_PILE, JAR_MAX_R, JAR_REF_HEIGHT, LID, balangCoinCount, lidPose } from '@/iso/shapes';

export interface BalangProps {
  /** World height of the jar body (2.4 = reference). Everything scales by height / 2.4. */
  height?: number;
  /** 0..1 share of the jar holding coins. */
  fill: number;
  /** Coin capacity; defaults to the tier's (120 high, 60 lite). */
  capacity?: number;
  /** Exact coin count; overrides fill × capacity (for animating one coin out). */
  coins?: number;
  lid?: LidState;
  lidColor?: LidColorKey;
  /** 3 for a shared pot. */
  slots?: 1 | 3;
  seed: string | number;
  /** Rotate the tilted lid around the jar (radians). 0 = leaning on the front (+Z) wall. */
  lidYaw?: number;
  shadow?: boolean;
  position?: Vec3;
}

function Lid({ state, colorKey, slots, yaw }: { state: LidState; colorKey: LidColorKey; slots: 1 | 3; yaw: number }) {
  const { theme, palette } = useIso();
  const pose = lidPose(state);
  if (!pose) return null;
  const body = cylinderGeo(LID.r, LID.r, LID.h, 24);
  const slot = boxGeo(LID.slot[0], LID.slot[1], LID.slot[2]);
  const offsets = slots === 3 ? [-0.2, 0, 0.2] : [0];
  const c = Math.SQRT1_2;
  return (
    <group rotation={[0, state === 'tilted' ? yaw : 0, 0]}>
      <group position={pose.position} rotation={pose.rotation}>
        <mesh geometry={body} material={faceToneMaterial(palette.lid[colorKey], theme, { curved: true })}>
          <IsoEdges geometry={body} />
        </mesh>
        {offsets.map((o) => (
          <mesh
            key={o}
            geometry={slot}
            material={faceToneMaterial(palette.shade, theme)}
            position={[o * c, LID.h / 2 + 0.004, o * c]}
            rotation={[0, Math.PI / 4, 0]}
          />
        ))}
      </group>
    </group>
  );
}

export function Balang({
  height = JAR_REF_HEIGHT,
  fill,
  capacity,
  coins,
  lid = 'closed',
  lidColor = 'lidUpcoming',
  slots = 1,
  seed,
  lidYaw = 0,
  shadow = true,
  position,
}: BalangProps) {
  const { theme, tier, palette } = useIso();
  const s = height / JAR_REF_HEIGHT;
  const lite = tier === 'lite';
  const cap = capacity ?? (lite ? COIN_PILE.lite.capacity : COIN_PILE.high.capacity);
  const count = coins ?? balangCoinCount(fill, cap);
  const glass = glassMaterials(theme);
  const jar = jarGeo();
  return (
    <group position={position} scale={s}>
      {shadow ? <HardShadow footprint={circleFootprint(JAR_MAX_R)} h={JAR_REF_HEIGHT + (lid === 'closed' ? LID.h : 0)} /> : null}
      <CoinPile count={count} seed={seed} lite={lite} />
      <mesh geometry={jarTicksGeo()} material={faceToneMaterial(palette.ink3, theme)} />
      <mesh geometry={jar} material={glass.back} renderOrder={2} />
      <mesh geometry={jar} material={glass.front} renderOrder={3} />
      <lineSegments geometry={jarSilhouetteGeo()} material={glass.line} renderOrder={4} />
      <Lid state={lid} colorKey={lidColor} slots={slots} yaw={lidYaw} />
    </group>
  );
}
