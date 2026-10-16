// SVG twin of S1 Shelf: same spec, same projection and face tones as scenes/Shelf. First paint, fallback
// and print. The plank is turned to run along the screen, so it's drawn from rotated boxes here.
import type { ReactNode } from 'react';
import type { ShelfSpec } from '@/iso/mappers/shelf';
import { palette3d } from '@/iso/palette3d';
import { SHELF, shelfLength } from '@/iso/shapes';
import { chain, rotationY, scaling, translation } from '@/iso/svg/affine';
import { Faces } from '@/iso/svg/IsoSvg';
import { boxFaces, sortByDepth } from '@/iso/svg/isoSvgCore';
import { SvgBalang, SvgGhostJar, SvgIOUSlip } from '@/iso/svg/primitives';
import type { IsoSvgTwinProps } from '@/iso/types';
import type { Vec3 } from '@/iso/specs';

type Item = { key: string; at: Vec3; node: ReactNode };

export function ShelfSvg({ spec, theme }: IsoSvgTwinProps<ShelfSpec>) {
  const p = palette3d(theme);
  const { at, yaw, slots, scaleX } = spec.shelf;
  const L0 = shelfLength(slots);
  const { plankH, d, rail } = SHELF;
  // Same transform as the 3D group: position · rotation · stretch along the plank.
  const xf = chain(translation(...at), rotationY(yaw), scaling(scaleX, 1, 1));
  const plank = boxFaces([L0, plankH, d], p.soil, theme, chain(xf, translation(0, -plankH, 0)));
  const backRail = boxFaces([L0, rail, rail], p.soil, theme, chain(xf, translation(0, 0, -d / 2 + rail / 2)));

  const items: Item[] = [];
  for (const j of spec.jars) {
    items.push({
      key: j.id,
      at: j.at,
      node: (
        <SvgBalang
          at={j.at}
          height={j.height}
          fill={j.fill}
          lid={j.lid}
          lidColor={j.lidColor}
          lidYaw={j.lidYaw}
          seed={j.seed}
          shadow={false}
        />
      ),
    });
    if (j.iou) items.push({ key: `${j.id}-iou`, at: j.iou.at, node: <SvgIOUSlip at={j.iou.at} rotY={j.iou.rotY} /> });
  }
  if (spec.ghost) {
    const g = spec.ghost;
    items.push({ key: 'ghost', at: g.at, node: <SvgGhostJar at={g.at} height={g.height} /> });
  }

  return (
    <g>
      <Faces faces={plank} />
      <Faces faces={backRail} />
      {sortByDepth(items, (i) => i.at).map((i) => (
        <g key={i.key}>{i.node}</g>
      ))}
    </g>
  );
}
