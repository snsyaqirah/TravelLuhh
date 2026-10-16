// S4 Suitcase, SVG twin (§7.7), plus the static closed case with a luggage tag used on auth pages (§8, "No WebGL").
//
// The packed items sit between the tray's far walls and its near walls: SvgSuitcase draws the case in three layers
// (lid if open, far shell, `inside`, near shell, lid if shut). Dimensions and shading match the 3D primitive.
import type { ThemeName } from '@/design/tokens';
import { rectFootprint } from '@/iso/geometry2d';
import { useIsoTheme } from '@/iso/hooks';
import { palette3d } from '@/iso/palette3d';
import { depthCompare, isoProject, projectBounds, type Bounds } from '@/iso/projection';
import { SUITCASE } from '@/iso/shapes';
import type { Vec3 } from '@/iso/specs';
import type { IsoSvgTwinProps } from '@/iso/types';
import { apply, chain, rotationY, translation } from '@/iso/svg/affine';
import { Faces, IsoGhostBox, IsoLine, IsoPolygon, IsoShadow, IsoSvgFrame } from '@/iso/svg/IsoSvg';
import { boxFaces } from '@/iso/svg/isoSvgCore';
import { SvgPackedItems, SvgPlinth, SvgSuitcase } from '@/iso/svg/primitives';
import type { SuitcaseSpec } from '@/iso/mappers/suitcase';
import { fitScreenBounds } from '@/iso/mappers/counter';

export function SuitcaseSvg({ spec }: IsoSvgTwinProps<SuitcaseSpec>) {
  const { plinth } = spec;
  const ghosts = spec.ghosts.slice().sort((a, b) => depthCompare(a.at, b.at));
  return (
    <g>
      <SvgPlinth w={plinth.w} d={plinth.d} at={plinth.at} />
      <SvgSuitcase
        at={spec.case.at}
        lidAngle={spec.lidAngle}
        buckled={spec.done}
        inside={<SvgPackedItems items={spec.boxes.map((b) => ({ at: b.at, tone: b.tone, rotY: b.rotY }))} />}
      />
      {ghosts.map((g) => (
        <IsoGhostBox key={g.key} at={g.at} size={g.size} />
      ))}
    </g>
  );
}

// ------------------------------------------------------------------------------------------------ auth variant

// The case lies flat with its handle low on the front wall, so the tag lies face up on the floor in front of it,
// tied to the handle: a top face is the most legible face in this projection.
const TAG = { w: 0.92, d: 0.5, t: 0.016, band: 0.17, yaw: -0.32, at: [0.55, 0, SUITCASE.d / 2 + 0.66] as Vec3 } as const;

const tagXf = () => chain(translation(...TAG.at), rotationY(TAG.yaw));

/** Closed case with a luggage tag: everything in world units around a case at the origin. */
function ClosedCaseWithTag({ theme, tag }: { theme: ThemeName; tag?: string }) {
  const p = palette3d(theme);
  const { d } = SUITCASE;
  const xf = tagXf();
  const top = TAG.t + 0.001;
  const on = (u: number, v: number): Vec3 => apply(xf, [u, top, v]);
  // A pale card in both themes (dark leaf would vanish into the page), with dark text on it.
  const cardColor = theme === 'light' ? p.leaf : p.ink2;
  const text = theme === 'light' ? p.ink : p.shade;
  const card = boxFaces([TAG.w, TAG.t, TAG.d], cardColor, theme, xf);
  const x0 = -TAG.w / 2;
  const band: Vec3[] = [on(x0, -TAG.d / 2), on(x0 + TAG.band, -TAG.d / 2), on(x0 + TAG.band, TAG.d / 2), on(x0, TAG.d / 2)];
  const hole = on(x0 + TAG.band / 2, 0);
  const hook: Vec3 = [0.12, 0.3, d / 2 + 0.19];
  // Text on the top face: text x runs along the card, text y runs toward the viewer (+v).
  const u = isoProject(apply(rotationY(TAG.yaw), [1, 0, 0]));
  const v = isoProject(apply(rotationY(TAG.yaw), [0, 0, 1]));
  const [ox, oy] = isoProject(on(x0 + TAG.band + 0.08, 0.09));
  const [hx, hy] = isoProject(hole);
  const rule = (vv: number) => [on(x0 + TAG.band + 0.08, vv), on(TAG.w / 2 - 0.08, vv)];
  return (
    <g>
      <IsoShadow at={TAG.at} footprint={rectFootprint(TAG.w + 0.04, TAG.d + 0.04)} h={0} />
      <SvgSuitcase at={[0, 0, 0]} lidAngle={0} buckled />
      <Faces faces={card} />
      <IsoPolygon points={band} fill={p.fund} />
      <ellipse cx={hx} cy={hy} rx={0.035} ry={0.035 / Math.sqrt(3)} fill={p.brass} />
      <IsoLine points={[hook, [hook[0] + 0.08, 0.1, hook[2] + 0.2], hole]} stroke={p.ink2} width={1.5} />
      {tag ? (
        <text
          transform={`matrix(${u[0]} ${u[1]} ${v[0]} ${v[1]} ${ox} ${oy})`}
          fontFamily='"IBM Plex Mono", ui-monospace, monospace'
          fontWeight={600}
          fontSize={0.24}
          fill={text}
        >
          {tag.slice(0, 5).toUpperCase()}
        </text>
      ) : (
        <>
          <IsoLine points={rule(-0.08)} stroke={p.ink3} width={1} />
          <IsoLine points={rule(0.08)} stroke={p.ink3} width={1} />
        </>
      )}
    </g>
  );
}

const CLOSED_BOUNDS: Bounds = (() => {
  const { w, d, wallH } = SUITCASE;
  const xf = tagXf();
  const pts: Vec3[] = [
    [-w / 2, 0, -d / 2],
    [w / 2 + wallH, 0, -d / 2],
    [-w / 2, 0, d / 2],
    [-w / 2, wallH * 2, -d / 2],
    [w / 2, wallH * 2, d / 2],
    ...[-1, 1].flatMap((a) => [-1, 1].map((b) => apply(xf, [(a * TAG.w) / 2, 0, (b * TAG.d) / 2]))),
  ];
  return fitScreenBounds(pts);
})();

export interface ClosedSuitcaseSvgProps {
  /** Rendered width in CSS px; height follows the drawing's aspect. */
  width?: number;
  /** Short text on the tag (airport code, initials). Plain ruled tag when omitted. */
  tag?: string;
  /** Defaults to the app's resolved theme. */
  theme?: ThemeName;
  className?: string;
  /** Accessible name; decorative (aria-hidden) when omitted. */
  title?: string;
}

/** Static closed suitcase with a luggage tag (auth pages: no WebGL, no data). */
export function ClosedSuitcaseSvg({ width = 200, tag, theme: themeProp, className, title }: ClosedSuitcaseSvgProps) {
  const theme = useIsoTheme(themeProp);
  const pb = projectBounds(CLOSED_BOUNDS);
  const height = Math.round((width * (pb.maxY - pb.minY)) / (pb.maxX - pb.minX));
  return (
    <IsoSvgFrame bounds={CLOSED_BOUNDS} theme={theme} size={{ w: width, h: height }} className={className} title={title}>
      <ClosedCaseWithTag theme={theme} tag={tag} />
    </IsoSvgFrame>
  );
}
