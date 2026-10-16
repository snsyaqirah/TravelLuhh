// Stand-in 3D scene used until E7/E8 land the real ones: a plinth under the spec's bounds and a ghost
// block, so IsoStage wiring (gate, crossfade, labels, targets) can be exercised end to end.
import { GhostBox, Plinth } from '@/iso/primitives';
import type { IsoSceneProps } from '@/iso/types';

export function PlaceholderScene({ spec }: IsoSceneProps) {
  const { min, max } = spec.bounds;
  const w = Math.max(max[0] - min[0], 1);
  const d = Math.max(max[2] - min[2], 1);
  const cx = (min[0] + max[0]) / 2;
  const cz = (min[2] + max[2]) / 2;
  return (
    <group>
      <Plinth w={w} d={d} position={[cx, 0, cz]} />
      <GhostBox size={[0.8, Math.min(1.2, Math.max(max[1] - 0.2, 0.4)), 0.8]} position={[cx, 0, cz]} />
    </group>
  );
}
