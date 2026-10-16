// SVG twin of S2 TripPlot: the same spec drawn with the SVG primitive twins, in painter's order. It is the
// first paint, the no-WebGL fallback and the print version, so it always shows the spec's final pose (no
// coins in flight, lids where the spec puts them).
import type { ReactNode } from 'react';
import type { TripPlotSpec } from '@/iso/mappers/tripPlot';
import { stoneTop } from '@/iso/shapes';
import type { Vec3 } from '@/iso/specs';
import { sortByDepth } from '@/iso/svg/isoSvgCore';
import { SvgBalang, SvgCoinStack, SvgDayStone, SvgGhostJar, SvgIOUSlip, SvgPlinth, SvgSignpost } from '@/iso/svg/primitives';
import type { IsoSvgTwinProps } from '@/iso/types';

type Item = { key: string; at: Vec3; node: ReactNode };

export function TripPlotSvg({ spec }: IsoSvgTwinProps<TripPlotSpec>) {
  const items: Item[] = [];
  for (const j of spec.jars) {
    items.push({
      key: j.id,
      at: j.at,
      node: j.ghost ? (
        <SvgGhostJar at={j.at} height={j.height} />
      ) : (
        <SvgBalang at={j.at} height={j.height} fill={j.fill} lid={j.lid} lidColor={j.lidColor} lidYaw={j.lidYaw} slots={j.slots} seed={j.seed} />
      ),
    });
  }
  for (const st of spec.stones) {
    items.push({ key: `stone-${st.index}`, at: st.at, node: <SvgDayStone stone={st} /> });
    if (st.coins > 0) {
      const base: Vec3 = [st.at[0], stoneTop(st.state), st.at[2]];
      items.push({ key: `stack-${st.index}`, at: base, node: <SvgCoinStack at={base} count={st.coins} seed={st.seed} /> });
    }
  }
  if (spec.signpost) items.push({ key: 'signpost', at: spec.signpost.at, node: <SvgSignpost at={spec.signpost.at} /> });
  if (spec.iou) items.push({ key: 'iou', at: spec.iou.at, node: <SvgIOUSlip at={spec.iou.at} rotY={spec.iou.rotY} /> });

  return (
    <g>
      <SvgPlinth w={spec.plinth.w} d={spec.plinth.d} at={spec.plinth.at} />
      {sortByDepth(items, (i) => i.at).map((i) => (
        <g key={i.key}>{i.node}</g>
      ))}
    </g>
  );
}
