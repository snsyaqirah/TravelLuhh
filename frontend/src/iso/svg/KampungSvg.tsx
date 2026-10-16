// S5 Kampung, SVG twin (§7.7): the same village drawn flat. First paint, fallback and print.
import { circleFootprint, rectFootprint } from '@/iso/geometry2d';
import { palette3d } from '@/iso/palette3d';
import { depthCompare } from '@/iso/projection';
import { COIN_PILE, HOUSE, JAR_MAX_R, JAR_REF_HEIGHT, LID } from '@/iso/shapes';
import type { Vec3 } from '@/iso/specs';
import type { IsoSvgTwinProps } from '@/iso/types';
import { chain, rotationY, translation } from '@/iso/svg/affine';
import { Faces, IsoGhostBox, IsoLine, IsoShadow } from '@/iso/svg/IsoSvg';
import { gableFaces, useIsoSvg } from '@/iso/svg/isoSvgCore';
import { SvgBalang, SvgKampungHouse, SvgPlinth, SvgRoad } from '@/iso/svg/primitives';
import type { KampungHouseSpec, KampungJarSpec, KampungSpec } from '@/iso/mappers/kampung';

type Thing = { kind: 'house'; at: Vec3; house: KampungHouseSpec } | { kind: 'jar'; at: Vec3; jar: KampungJarSpec };

/** Sketch house for the empty state: leaf body and gable with dashed ink-3 outlines, on the ground. */
function SvgGhostHouse({ at, footprint }: { at: Vec3; footprint: number }) {
  const { theme } = useIsoSvg();
  const p = palette3d(theme);
  const bodyH = HOUSE.floorH;
  const span = footprint + HOUSE.overhang * 2;
  const roof = gableFaces(span, HOUSE.roofH, span, p.leaf, theme, chain(translation(at[0], at[1] + bodyH, at[2]), rotationY(Math.PI / 2)));
  return (
    <g>
      <IsoGhostBox at={at} size={[footprint, bodyH, footprint]} />
      <Faces faces={roof} />
      {roof.map((f, i) => (
        <IsoLine key={i} points={f.points} stroke={p.ink3} dash={[0.06, 0.05]} closed />
      ))}
    </g>
  );
}

export function KampungSvg({ spec }: IsoSvgTwinProps<KampungSpec>) {
  const { plinth } = spec;
  const things: Thing[] = [
    ...spec.houses.map((house) => ({ kind: 'house' as const, at: house.at, house })),
    ...spec.jars.map((jar) => ({ kind: 'jar' as const, at: jar.at, jar })),
  ].sort((a, b) => depthCompare(a.at, b.at));
  return (
    <g>
      <SvgPlinth w={plinth.w} d={plinth.d} at={plinth.at} />
      {spec.roads.map((r) => (
        <SvgRoad key={r.at[2]} length={r.length} at={r.at} />
      ))}
      {spec.houses.map((h) => (
        <IsoShadow
          key={`s${h.id}`}
          at={h.at}
          footprint={rectFootprint(h.footprint, h.footprint)}
          h={HOUSE.stiltH + HOUSE.floorH * h.floors + HOUSE.roofH}
        />
      ))}
      {spec.jars.map((j) => {
        const s = j.height / JAR_REF_HEIGHT;
        return <IsoShadow key={`s${j.id}`} at={j.at} footprint={circleFootprint(JAR_MAX_R * s)} h={(JAR_REF_HEIGHT + LID.h) * s} />;
      })}
      {things.map((t) =>
        t.kind === 'house' ? (
          <SvgKampungHouse
            key={t.house.id}
            at={t.at}
            footprint={t.house.footprint}
            floors={t.house.floors}
            roof={t.house.roof}
            firstVisit={t.house.firstVisit}
            shadow={false}
          />
        ) : (
          <SvgBalang
            key={t.jar.id}
            at={t.at}
            height={t.jar.height}
            fill={t.jar.fill}
            capacity={COIN_PILE.lite.capacity}
            lid="closed"
            lidColor="lidHome"
            shadow={false}
          />
        ),
      )}
      {spec.ghost ? <SvgGhostHouse at={spec.ghost.at} footprint={spec.ghost.footprint} /> : null}
    </g>
  );
}
