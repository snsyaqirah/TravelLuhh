// S1 Shelf (Home hero): the plank turned to run along the screen, a balang per trip standing on it. No live
// events here; the scene is a still picture of ShelfSpec. Jars cast no hard shadow: on a plank 1.6 deep it
// would hang off the front edge in mid-air.
import type { ShelfSpec } from '@/iso/mappers/shelf';
import { Balang, GhostJar, IOUSlip, Shelf } from '@/iso/primitives';
import type { IsoSceneProps } from '@/iso/types';

export default function ShelfScene({ spec }: IsoSceneProps<ShelfSpec>) {
  const { at, yaw, slots, scaleX } = spec.shelf;
  return (
    <group>
      <group position={at} rotation={[0, yaw, 0]} scale={[scaleX, 1, 1]}>
        <Shelf slots={slots} />
      </group>
      {spec.jars.map((j) => (
        <group key={j.id}>
          <Balang
            height={j.height}
            fill={j.fill}
            lid={j.lid}
            lidColor={j.lidColor}
            lidYaw={j.lidYaw}
            seed={j.seed}
            shadow={false}
            position={j.at}
          />
          {j.iou ? <IOUSlip position={j.iou.at} rotY={j.iou.rotY} /> : null}
        </group>
      ))}
      {spec.ghost ? <GhostJar height={spec.ghost.height} position={spec.ghost.at} /> : null}
    </group>
  );
}
