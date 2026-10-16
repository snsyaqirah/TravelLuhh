// Stand-in SVG twin matching PlaceholderScene, used until E7/E8 land the real twins.
import type { IsoSvgTwinProps } from '@/iso/types';
import { IsoGhostBox } from '@/iso/svg/IsoSvg';
import { SvgPlinth } from '@/iso/svg/primitives';

export function PlaceholderSvg({ spec }: IsoSvgTwinProps) {
  const { min, max } = spec.bounds;
  const w = Math.max(max[0] - min[0], 1);
  const d = Math.max(max[2] - min[2], 1);
  const cx = (min[0] + max[0]) / 2;
  const cz = (min[2] + max[2]) / 2;
  return (
    <g>
      <SvgPlinth w={w} d={d} at={[cx, 0, cz]} />
      <IsoGhostBox at={[cx, 0, cz]} size={[0.8, Math.min(1.2, Math.max(max[1] - 0.2, 0.4)), 0.8]} />
    </g>
  );
}
