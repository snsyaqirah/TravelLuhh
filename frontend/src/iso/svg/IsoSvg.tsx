/**
 * SVG twin toolkit (§7.7). Draw in *projected world units*: give helpers world positions (the same numbers the
 * 3D primitive gets) and they project with isoProject. <IsoSvgFrame> sets a viewBox that reproduces the
 * WebGL camera exactly, so a twin overlays its 3D scene pixel for pixel.
 *
 * Rules (spec): boxes are three polygons with faceTones; cylinders are an ellipse + rect with ry/rx = 0.577;
 * painter's sort ascending by (x + z) then y (`sortByDepth`); no edge strokes, no trees.
 *
 * Pure helpers (pts, sortByDepth, boxFaces, cylinderFaces, prismFaces, gableFaces, useIsoSvg, useSvgId) live in
 * ./isoSvgCore; components (frame, polygons, boxes, cylinders, shadows) live here.
 *
 * Quick start for a twin:
 *   export function ShelfSvg({ spec, theme }: IsoSvgTwinProps<ShelfSpec>) {
 *     return <g>{sortByDepth(spec.jars, (j) => j.at).map((j) => <SvgBalang key={j.id} at={j.at} ... />)}</g>;
 *   }
 * Standalone (no IsoStage): wrap in <IsoSvgFrame bounds={...} theme={theme} size={{ w: 56, h: 72 }}>.
 */
import type { ReactNode, SVGProps } from 'react';
import type { ThemeName } from '@/design/tokens';
import { faceTones } from '@/iso/faceTones';
import { shadowHull } from '@/iso/geometry2d';
import { palette3d } from '@/iso/palette3d';
import { isoProject, viewBoxFor, viewBoxForBounds, type Bounds } from '@/iso/projection';
import type { Vec3 } from '@/iso/specs';
import type { Footprint, IsoView } from '@/iso/types';
import { mul, translation, type Affine } from '@/iso/svg/affine';
import { boxFaces, ELLIPSE_RATIO as RY, ISO_SCALE, IsoSvgContext, pts, useIsoSvg, type Face } from '@/iso/svg/isoSvgCore';

// ---------------------------------------------------------------- frame

export interface IsoSvgFrameProps {
  bounds: Bounds;
  theme: ThemeName;
  /** Exact camera (from IsoStage). Omit for a standalone twin: it fits `bounds` like computeView 'contain'. */
  view?: IsoView;
  /** Rendered size in CSS px. Needed with `view`; for standalone twins it sets width/height and the 1px stroke. */
  size?: { w: number; h: number };
  className?: string;
  /** Accessible name. Without it the SVG is aria-hidden (IsoStage labels the slot instead). */
  title?: string;
  children?: ReactNode;
}

export function IsoSvgFrame({ bounds, theme, view, size, className, title, children }: IsoSvgFrameProps) {
  const vb = view && size ? viewBoxFor(view, size.w, size.h) : viewBoxForBounds(bounds);
  const px = view
    ? 1 / view.zoom
    : size
      ? Math.max(vb[2] / Math.max(size.w, 1), vb[3] / Math.max(size.h, 1))
      : 1 / 60;
  return (
    <svg
      viewBox={vb.map((n) => +n.toFixed(4)).join(' ')}
      preserveAspectRatio="xMidYMid meet"
      width={size && !view ? size.w : '100%'}
      height={size && !view ? size.h : '100%'}
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <IsoSvgContext.Provider value={{ theme, px }}>{children}</IsoSvgContext.Provider>
    </svg>
  );
}

// ---------------------------------------------------------------- projection helpers

const f = (n: number) => +n.toFixed(4);

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// ---------------------------------------------------------------- polygons & lines

export type IsoPolygonProps = Omit<SVGProps<SVGPolygonElement>, 'points'> & { points: readonly Vec3[] };

export function IsoPolygon({ points, ...rest }: IsoPolygonProps) {
  return <polygon points={pts(points)} {...rest} />;
}

export interface IsoLineProps {
  points: readonly Vec3[];
  stroke: string;
  /** CSS px (default 1). */
  width?: number;
  opacity?: number;
  /** World-unit dash/gap, projected like LineDashedMaterial (iso scales every axis by 0.8165). */
  dash?: [number, number];
  closed?: boolean;
}


export function IsoLine({ points, stroke, width = 1, opacity, dash, closed }: IsoLineProps) {
  const { px } = useIsoSvg();
  const Tag = closed ? 'polygon' : 'polyline';
  return (
    <Tag
      points={pts(points)}
      fill="none"
      stroke={stroke}
      strokeWidth={width * px}
      strokeOpacity={opacity}
      strokeDasharray={dash ? `${f(dash[0] * ISO_SCALE)} ${f(dash[1] * ISO_SCALE)}` : undefined}
      strokeLinejoin="round"
    />
  );
}

// ---------------------------------------------------------------- boxes

export function Faces({ faces, opacity }: { faces: readonly Face[]; opacity?: number }) {
  return (
    <>
      {faces.map((fc, i) => (
        <polygon key={i} points={pts(fc.points)} fill={fc.fill} fillOpacity={opacity} />
      ))}
    </>
  );
}

export interface IsoBoxProps {
  /** Base centre (same as the 3D primitive's position). */
  at: Vec3;
  size: Vec3;
  color: string;
  /** Extra transform applied before `at` (rotation in local space), e.g. rotationY(Math.PI / 4). */
  local?: Affine;
  curved?: boolean;
}

/** A box as three polygons (top/left/right) in face tones. */
export function IsoBox({ at, size, color, local, curved }: IsoBoxProps) {
  const { theme } = useIsoSvg();
  const xf = local ? mul(translation(...at), local) : translation(...at);
  return <Faces faces={boxFaces(size, color, theme, xf, curved)} />;
}

/** Sketch box: leaf faces + dashed ink-3 outline, matching the 3D Ghost. */
export function IsoGhostBox({ at, size, local }: { at: Vec3; size: Vec3; local?: Affine }) {
  const { theme } = useIsoSvg();
  const p = palette3d(theme);
  const xf = local ? mul(translation(...at), local) : translation(...at);
  const faces = boxFaces(size, p.leaf, theme, xf);
  return (
    <g>
      <Faces faces={faces} />
      {faces.map((fc, i) => (
        <IsoLine key={i} points={fc.points} stroke={p.ink3} dash={[0.06, 0.05]} closed />
      ))}
    </g>
  );
}

// ---------------------------------------------------------------- cylinders


export interface IsoCylinderProps {
  /** Base centre. */
  at: Vec3;
  r: number;
  h: number;
  color: string;
  /** Draw only the top ellipse (coins seen from above, lids flush with a surface). */
  topOnly?: boolean;
}

/** Vertical cylinder: left half in the left tone, right half in the right tone, top ellipse on top (curved snap). */
export function IsoCylinder({ at, r, h, color, topOnly }: IsoCylinderProps) {
  const { theme } = useIsoSvg();
  const tones = faceTones(color, theme);
  const [cx, by] = isoProject(at);
  const ty = isoProject([at[0], at[1] + h, at[2]])[1];
  const ry = r * RY;
  return (
    <g>
      {!topOnly ? (
        <>
          <path
            d={`M${f(cx - r)},${f(ty)}L${f(cx - r)},${f(by)}A${f(r)},${f(ry)} 0 0 0 ${f(cx)},${f(by + ry)}L${f(cx)},${f(ty)}Z`}
            fill={tones.left}
          />
          <path
            d={`M${f(cx)},${f(ty)}L${f(cx)},${f(by + ry)}A${f(r)},${f(ry)} 0 0 0 ${f(cx + r)},${f(by)}L${f(cx + r)},${f(ty)}Z`}
            fill={tones.right}
          />
        </>
      ) : null}
      <ellipse cx={f(cx)} cy={f(ty)} rx={f(r)} ry={f(ry)} fill={tones.top} />
    </g>
  );
}

// ---------------------------------------------------------------- shadows

/** Same hull as the 3D HardShadow, in the theme's shadow colour. */
export function IsoShadow({ footprint, h, at = [0, 0, 0] }: { footprint: Footprint; h: number; at?: Vec3 }) {
  const { theme } = useIsoSvg();
  const hull = shadowHull(footprint, h);
  return <IsoPolygon points={hull.map(([x, z]) => add(at, [x, 0, z]))} fill={palette3d(theme).shadow} />;
}


