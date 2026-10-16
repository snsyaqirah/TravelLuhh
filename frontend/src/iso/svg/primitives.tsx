/**
 * SVG twins of the primitive library. Same props as the WebGL primitives (positions are `at` = base centre),
 * same shapes.ts dimensions and the same faceTones, so a twin scene is a drop-in print/fallback version.
 * Theme comes from the surrounding <IsoSvgFrame>. Compose in painter's order (sortByDepth).
 */
import type { ReactNode } from 'react';
import type { CategoryKey, FabricKey, ThemeName } from '@/design/tokens';
import { faceColor, faceTones, facesCamera } from '@/iso/faceTones';
import { circleFootprint, rectFootprint } from '@/iso/geometry2d';
import { palette3d } from '@/iso/palette3d';
import { depthCompare, isoProject } from '@/iso/projection';
import {
  BLOCK,
  COIN_PILE,
  COIN_STACK,
  HOUSE,
  IOU,
  JAR_INTERIOR,
  JAR_MAX_R,
  JAR_MOUTH_R,
  JAR_PROFILE,
  JAR_REF_HEIGHT,
  LID,
  PACKED,
  PENNANT,
  PLINTH,
  ROAD,
  SHELF,
  SIGNPOST,
  STONE,
  SUITCASE,
  TICK_FRACTIONS,
  balangCoinCount,
  coinFillHeight,
  coinPileLayout,
  coinStackLayout,
  jarRadiusAt,
  lidPose,
  roadDashCount,
  shelfLength,
  stoneTop,
} from '@/iso/shapes';
import type { LidColorKey, LidState, Vec3 } from '@/iso/specs';
import type { StoneState } from '@/iso/types';
import { apply, applyDir, chain, rotationY, scaling, translation, trs, type Affine } from '@/iso/svg/affine';
import { Faces, IsoBox, IsoCylinder, IsoGhostBox, IsoLine, IsoPolygon, IsoShadow } from '@/iso/svg/IsoSvg';
import {
  boxFaces,
  cylinderFaces,
  gableFaces,
  prismFaces,
  useIsoSvg,
  useSvgId,
  type Face,
} from '@/iso/svg/isoSvgCore';

const f = (n: number) => +n.toFixed(4);
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** Sort faces of several convex parts by each part's transformed centre (painter's rule per part). */
function sortParts<T extends { center: Vec3 }>(parts: T[]): T[] {
  return parts.slice().sort((a, b) => depthCompare(a.center, b.center));
}

// ---------------------------------------------------------------- Plinth

export function SvgPlinth({ w, d, variant = 'plain', at = [0, 0, 0] }: { w: number; d: number; variant?: 'plain' | 'ledger'; at?: Vec3 }) {
  const { theme } = useIsoSvg();
  const p = palette3d(theme);
  const underBase = -PLINTH.topH / 2 - PLINTH.underDrop - PLINTH.underH / 2;
  const rules: number[] = [];
  if (variant === 'ledger') for (let z = d / 2 - 0.25; z > -d / 2 + 0.02; z -= 0.25) rules.push(z);
  const t = 2 / 64; // 2 texels of a 256px texture spanning 4 units
  return (
    <g>
      <IsoBox at={add(at, [0, underBase, 0])} size={[w - PLINTH.underInset, PLINTH.underH, d - PLINTH.underInset]} color={p.soil} />
      <IsoBox at={add(at, [0, -PLINTH.topH, 0])} size={[w, PLINTH.topH, d]} color={p.ground} />
      {rules.map((z) => (
        <IsoPolygon
          key={z}
          points={[
            add(at, [-w / 2 + 0.01, 0, z - t / 2]),
            add(at, [w / 2 - 0.01, 0, z - t / 2]),
            add(at, [w / 2 - 0.01, 0, z + t / 2]),
            add(at, [-w / 2 + 0.01, 0, z + t / 2]),
          ]}
          fill={p.rule}
        />
      ))}
    </g>
  );
}

// ---------------------------------------------------------------- Pennant

export function SvgPennant({ at, flag, height = PENNANT.poleH }: { at: Vec3; flag?: string; height?: number }) {
  const { theme } = useIsoSvg();
  const p = palette3d(theme);
  const y0 = height - PENNANT.flagH - 0.01;
  const x0 = PENNANT.poleR;
  return (
    <g>
      <IsoCylinder at={at} r={PENNANT.poleR} h={height} color={p.ink2} />
      <IsoPolygon
        points={[
          add(at, [x0, y0, 0]),
          add(at, [x0 + PENNANT.flagW, y0 + PENNANT.flagH / 2, 0]),
          add(at, [x0, y0 + PENNANT.flagH, 0]),
        ]}
        fill={faceTones(flag ?? p.brass, theme).left}
      />
    </g>
  );
}

// ---------------------------------------------------------------- Balang

export interface SvgBalangProps {
  at: Vec3;
  height?: number;
  fill: number;
  capacity?: number;
  coins?: number;
  lid?: LidState;
  lidColor?: LidColorKey;
  slots?: 1 | 3;
  lidYaw?: number;
  shadow?: boolean;
  /** Same seed as the WebGL Balang, so a jar holding less than one layer scatters the same coins. */
  seed?: string | number;
}

/** Jar outline path (bottom arc, right profile, mouth top arc, left profile) in projected units. */
function jarOutline(at: Vec3, s: number): string {
  const side = (sign: 1 | -1) =>
    JAR_PROFILE.slice(1).map(([r, y]) => {
      const [x, sy] = isoProject(add(at, [0, y * s, 0]));
      return [x + sign * r * s, sy] as const;
    });
  const right = side(1);
  const left = side(-1);
  const rb = JAR_PROFILE[1][0] * s;
  const rm = JAR_MOUTH_R * s;
  const ry = (r: number) => r / Math.sqrt(3);
  let d = `M${f(left[0][0])},${f(left[0][1])}`;
  d += `A${f(rb)},${f(ry(rb))} 0 0 0 ${f(right[0][0])},${f(right[0][1])}`;
  for (const [x, y] of right.slice(1)) d += `L${f(x)},${f(y)}`;
  const last = left[left.length - 1];
  d += `A${f(rm)},${f(ry(rm))} 0 0 0 ${f(last[0])},${f(last[1])}`;
  for (const [x, y] of left.slice(0, -1).reverse()) d += `L${f(x)},${f(y)}`;
  return `${d}Z`;
}

function SvgLid({ at, s, state, colorKey, slots, yaw }: { at: Vec3; s: number; state: LidState; colorKey: LidColorKey; slots: 1 | 3; yaw: number }) {
  const { theme } = useIsoSvg();
  const p = palette3d(theme);
  const pose = lidPose(state);
  if (!pose) return null;
  const color = p.lid[colorKey];
  const jarXf = chain(translation(...at), scaling(s));
  if (state === 'closed') {
    const base = apply(jarXf, [0, JAR_REF_HEIGHT, 0]);
    const top = apply(jarXf, [0, JAR_REF_HEIGHT + LID.h, 0]);
    const offsets = slots === 3 ? [-0.2, 0, 0.2] : [0];
    const c = Math.SQRT1_2;
    return (
      <g>
        <IsoCylinder at={base} r={LID.r * s} h={LID.h * s} color={color} />
        {offsets.map((o) => (
          <IsoBox
            key={o}
            at={add(top, [o * c * s, -LID.slot[1] * s * 0.4, o * c * s])}
            size={[LID.slot[0] * s, LID.slot[1] * s, LID.slot[2] * s]}
            color={p.shade}
            local={rotationY(Math.PI / 4)}
          />
        ))}
      </g>
    );
  }
  const xf = chain(jarXf, rotationY(yaw), trs(pose.position, pose.rotation));
  const offsets = slots === 3 ? [-0.2, 0, 0.2] : [0];
  const c = Math.SQRT1_2;
  const up = applyDir(xf, [0, 1, 0]);
  return (
    <g>
      <Faces faces={cylinderFaces(LID.r, LID.h, color, theme, xf)} />
      {facesCamera(up)
        ? offsets.map((o) => (
            <Faces
              key={o}
              faces={boxFaces(
                [LID.slot[0], LID.slot[1], LID.slot[2]],
                p.shade,
                theme,
                chain(xf, translation(o * c, LID.h / 2 + 0.004 - LID.slot[1] / 2, o * c), rotationY(Math.PI / 4)),
              )}
            />
          ))
        : null}
    </g>
  );
}

export function SvgBalang({
  at,
  height = JAR_REF_HEIGHT,
  fill,
  capacity,
  coins,
  lid = 'closed',
  lidColor = 'lidUpcoming',
  slots = 1,
  lidYaw = 0,
  shadow = true,
  seed = 'jar',
}: SvgBalangProps) {
  const { theme } = useIsoSvg();
  const p = palette3d(theme);
  const clip = useSvgId('jar');
  const s = height / JAR_REF_HEIGHT;
  const cap = capacity ?? COIN_PILE.high.capacity;
  const count = coins ?? balangCoinCount(fill, cap);
  // Same surface height the 3D pile reaches: share of capacity × interior height.
  const highCount = (count / cap) * COIN_PILE.high.capacity;
  const fillY = coinFillHeight(highCount) * s;
  // Under one full layer the 3D pile is a few loose coins on the floor, not a level: draw those coins instead
  // of a solid disc (same layout and seed as the WebGL pile, tilt dropped).
  const loose =
    count > 0 && Math.round(highCount) < COIN_PILE.high.perLayer
      ? coinPileLayout(Math.max(1, Math.round(highCount)), seed)
          .map((c) => ({ ...c, position: add(at, [c.position[0] * s, (c.position[1] - COIN_PILE.high.h / 2) * s, c.position[2] * s]) }))
          .sort((a, b) => depthCompare(a.position, b.position))
      : null;
  const outline = jarOutline(at, s);
  const [cx, by] = isoProject(at);
  const [, fy] = isoProject(add(at, [0, fillY, 0]));
  const rTop = jarRadiusAt(fillY / s) * s * 0.92;
  const brass = faceTones(p.coins[0], theme);
  const interior = JAR_REF_HEIGHT * JAR_INTERIOR;
  const ticks = TICK_FRACTIONS.map((fr) => {
    const y = fr * interior;
    const r = (jarRadiusAt(y) - 0.03) * Math.SQRT1_2;
    const c = add(at, [-r * s, y * s, -r * s]);
    const half = 0.06 * s * Math.SQRT1_2;
    return [add(c, [-half, 0, half]), add(c, [half, 0, -half])] as Vec3[];
  });
  const sideLine = (sign: 1 | -1) =>
    JAR_PROFILE.slice(1).map(([r, y]) => add(at, [sign * r * s * Math.SQRT1_2, y * s, -sign * r * s * Math.SQRT1_2]));
  const ring = (r: number, y: number) =>
    Array.from({ length: 32 }, (_, i) => {
      const a = (i / 32) * Math.PI * 2;
      return add(at, [Math.cos(a) * r * s, y * s, Math.sin(a) * r * s]);
    });
  // Base ring split at the screen-left/right extremes: front half has x + z > 0.
  const arc = (r: number, y: number, from: number, to: number) =>
    Array.from({ length: 17 }, (_, i) => {
      const a = from + ((to - from) * i) / 16;
      return add(at, [Math.cos(a) * r * s, y * s, Math.sin(a) * r * s]);
    });
  const rb0 = JAR_PROFILE[1][0];
  const baseRing = { front: arc(rb0, 0, -Math.PI / 4, (3 * Math.PI) / 4), back: arc(rb0, 0, (3 * Math.PI) / 4, (7 * Math.PI) / 4) };
  // One faint band per coin layer below the surface: the front edge of each layer, as in a stack of coins.
  const pitch = (interior / COIN_PILE.layers) * s;
  const bands: string[] = [];
  for (let y = pitch; y < fillY - pitch * 0.5; y += pitch) {
    const r = jarRadiusAt(y / s) * s;
    const [bx, byy] = isoProject(add(at, [0, y, 0]));
    const ry = r / Math.sqrt(3);
    bands.push(`M${f(bx - r)},${f(byy)}A${f(r)},${f(ry)} 0 0 0 ${f(bx + r)},${f(byy)}`);
  }
  return (
    <g>
      {shadow ? (
        <IsoShadow at={at} footprint={circleFootprint(JAR_MAX_R * s)} h={(JAR_REF_HEIGHT + (lid === 'closed' ? LID.h : 0)) * s} />
      ) : null}
      <clipPath id={clip}>
        <path d={outline} />
      </clipPath>
      {/* back glass, then the back half of the base ring (coins hide it in 3D) */}
      <path d={outline} fill={p.glass} fillOpacity={p.glassBackOpacity} />
      <IsoLine points={baseRing.back} stroke={p.ink} opacity={p.glassLineOpacity} />
      {ticks.map((t, i) => (
        <IsoLine key={i} points={t} stroke={p.ink3} width={1.2} />
      ))}
      {/* coins: brass fill clipped to the jar up to the fill height, faint layer bands, lit top ellipse */}
      {loose ? (
        <g clipPath={`url(#${clip})`}>
          {loose.map((c, i) => (
            <IsoCylinder key={i} at={c.position} r={COIN_PILE.high.r * s} h={COIN_PILE.high.h * s} color={p.coins[c.tint]} />
          ))}
        </g>
      ) : count > 0 ? (
        <g clipPath={`url(#${clip})`}>
          <rect x={f(cx - 2 * s)} y={f(fy)} width={f(2 * s)} height={f(by - fy + 1 * s)} fill={brass.left} />
          <rect x={f(cx)} y={f(fy)} width={f(2 * s)} height={f(by - fy + 1 * s)} fill={brass.right} />
          {bands.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={brass.top} strokeOpacity={0.55} strokeWidth={0.025 * s} />
          ))}
          <ellipse cx={f(cx)} cy={f(fy)} rx={f(rTop)} ry={f(rTop / Math.sqrt(3))} fill={p.coins[1]} />
        </g>
      ) : null}
      {/* front glass + drawn silhouette */}
      <path d={outline} fill={p.glass} fillOpacity={p.glassFrontOpacity} />
      <g>
        <IsoLine points={sideLine(1)} stroke={p.ink} opacity={p.glassLineOpacity} />
        <IsoLine points={sideLine(-1)} stroke={p.ink} opacity={p.glassLineOpacity} />
        <IsoLine points={ring(JAR_MOUTH_R, JAR_REF_HEIGHT)} stroke={p.ink} opacity={p.glassLineOpacity} closed />
        <IsoLine points={baseRing.front} stroke={p.ink} opacity={p.glassLineOpacity} />
      </g>
      <SvgLid at={at} s={s} state={lid} colorKey={lidColor} slots={slots} yaw={lidYaw} />
    </g>
  );
}

/** Empty-state jar: leaf fill, dashed ink-3 outline. */
export function SvgGhostJar({ at, height = JAR_REF_HEIGHT }: { at: Vec3; height?: number }) {
  const { theme, px } = useIsoSvg();
  const p = palette3d(theme);
  const clip = useSvgId('ghostjar');
  const s = height / JAR_REF_HEIGHT;
  const t = faceTones(p.leaf, theme);
  const dash = `${f(0.06 * 0.8165)} ${f(0.05 * 0.8165)}`;
  const outline = jarOutline(at, s);
  const [cx, by] = isoProject(at);
  const mouth = Array.from({ length: 32 }, (_, i) => {
    const a = (i / 32) * Math.PI * 2;
    return add(at, [Math.cos(a) * JAR_MOUTH_R * s, JAR_REF_HEIGHT * s, Math.sin(a) * JAR_MOUTH_R * s]);
  });
  return (
    <g>
      <clipPath id={clip}>
        <path d={outline} />
      </clipPath>
      {/* Curved surfaces snap to left/right halves, as the 3D ghost does. */}
      <g clipPath={`url(#${clip})`}>
        <rect x={f(cx - 2 * s)} y={f(by - 3 * s)} width={f(2 * s)} height={f(4 * s)} fill={t.left} />
        <rect x={f(cx)} y={f(by - 3 * s)} width={f(2 * s)} height={f(4 * s)} fill={t.right} />
      </g>
      <path d={outline} fill="none" stroke={p.ink3} strokeWidth={px} strokeDasharray={dash} />
      <IsoLine points={mouth} stroke={p.ink3} dash={[0.06, 0.05]} closed />
    </g>
  );
}

// ---------------------------------------------------------------- Coin stacks

export function SvgCoinStack({ at, count, seed }: { at: Vec3; count: number; seed: string | number }) {
  const { theme } = useIsoSvg();
  const p = palette3d(theme);
  const coins = coinStackLayout(count, seed);
  return (
    <g>
      {coins.map((c, i) => (
        <IsoCylinder
          key={i}
          at={add(at, [c.position[0], c.position[1] - COIN_STACK.h / 2, c.position[2]])}
          r={COIN_STACK.r}
          h={COIN_STACK.h}
          color={p.coins[c.tint]}
        />
      ))}
    </g>
  );
}

// ---------------------------------------------------------------- Day stones

export interface SvgDayStone {
  at: Vec3;
  state: StoneState;
  over?: boolean;
  selected?: boolean;
}

export function SvgDayStone({ stone, pennant = true }: { stone: SvgDayStone; pennant?: boolean }) {
  const { theme } = useIsoSvg();
  const p = palette3d(theme);
  const { at, state } = stone;
  const [w, h, d] = STONE.size;
  const top = stoneTop(state);
  const pad = STONE.selectPad;
  return (
    <g>
      {stone.over && state !== 'future' ? (
        <IsoBox at={add(at, [0, h / 2 + STONE.rimDrop - STONE.rim[1] / 2, 0])} size={[...STONE.rim]} color={p.over} />
      ) : null}
      {stone.selected ? (
        <IsoLine
          points={[
            add(at, [-w / 2 - pad, 0.006, -d / 2 - pad]),
            add(at, [w / 2 + pad, 0.006, -d / 2 - pad]),
            add(at, [w / 2 + pad, 0.006, d / 2 + pad]),
            add(at, [-w / 2 - pad, 0.006, d / 2 + pad]),
          ]}
          stroke={p.brass}
          closed
        />
      ) : null}
      {state === 'future' ? (
        <IsoGhostBox at={at} size={[w, h, d]} />
      ) : (
        <IsoBox at={at} size={[w, top, d]} color={state === 'today' ? p.stone.today : p.stone.past} />
      )}
      {state === 'today' && pennant ? <SvgPennant at={add(at, [-0.18, top, -0.18])} /> : null}
    </g>
  );
}

export function SvgDayStones({ stones, pennant = true }: { stones: SvgDayStone[]; pennant?: boolean }) {
  const sorted = stones.slice().sort((a, b) => depthCompare(a.at, b.at));
  return (
    <g>
      {sorted.map((s) => (
        <SvgDayStone key={`${s.at[0]},${s.at[1]},${s.at[2]}`} stone={s} pennant={pennant} />
      ))}
    </g>
  );
}

// ---------------------------------------------------------------- Signpost

export function SvgSignpost({ at, shadow = true }: { at: Vec3; shadow?: boolean }) {
  const { theme } = useIsoSvg();
  const p = palette3d(theme);
  const [pw, ph, pd] = SIGNPOST.post;
  const board = (y: number, yaw: number): Face[] => {
    // Arrow prism: outline in XY, extruded ±depth/2 in Z. Faces: front (+Z), back, and each side quad.
    const L = SIGNPOST.boardLen;
    const H = SIGNPOST.boardH;
    // The board's first .1 is buried in the post; start at the post's face so painter's order stays simple.
    const s0 = pw / 2;
    const outline: Array<[number, number]> = [
      [s0, -H / 2],
      [L - 0.1, -H / 2],
      [L, 0],
      [L - 0.1, H / 2],
      [s0, H / 2],
    ];
    const xf = chain(translation(...at), translation(0, y, 0), rotationY(yaw));
    const dz = SIGNPOST.depth / 2;
    return prismFaces(outline, dz, p.leaf, theme, xf);
  };
  const boards = sortParts([
    { faces: board(SIGNPOST.boardsY[0], 0), center: add(at, [0.2, SIGNPOST.boardsY[0], 0]) },
    { faces: board(SIGNPOST.boardsY[1], -Math.PI / 2), center: add(at, [0, SIGNPOST.boardsY[1], 0.2]) },
  ]);
  return (
    <g>
      {shadow ? <IsoShadow at={at} footprint={rectFootprint(pw, pd)} h={ph} /> : null}
      <IsoBox at={at} size={[pw, ph, pd]} color={p.soil} />
      <Faces faces={boards[0].faces} />
      <Faces faces={boards[1].faces} />
    </g>
  );
}

// ---------------------------------------------------------------- Category block + prop

export function SvgCategoryProp({ category, at }: { category: CategoryKey; at: Vec3 }) {
  const { theme } = useIsoSvg();
  const p = palette3d(theme);
  const hue = p.category[category];
  const xf = translation(...at);
  switch (category) {
    case 'accommodation':
      return <Faces faces={gableFaces(0.9, 0.35, 0.9, hue, theme, xf)} />;
    case 'transportation':
      return (
        <g>
          <IsoBox at={add(at, [-0.25, 0.13, 0])} size={[0.1, 0.14, 0.03]} color={p.leaf} />
          <IsoBox at={add(at, [0, 0.03, 0])} size={[0.6, 0.14, 0.14]} color={p.leaf} />
          <IsoBox at={add(at, [0.02, 0.095, 0])} size={[0.12, 0.03, 0.6]} color={p.leaf} />
        </g>
      );
    case 'activities':
      return <SvgPennant at={at} flag={p.leaf} height={0.6} />;
    case 'bundle': {
      // Ribbons cross through the parcel, so draw only what shows: a cross on top and a band on each side face.
      const t = faceTones(p.leaf, theme);
      const H = 0.31;
      const r = 0.03;
      const e = 0.26;
      return (
        <g>
          <IsoBox at={at} size={[0.5, 0.3, 0.5]} color={hue} />
          <IsoPolygon points={[add(at, [e, 0, -r]), add(at, [e, 0, r]), add(at, [e, H, r]), add(at, [e, H, -r])]} fill={t.right} />
          <IsoPolygon points={[add(at, [-r, 0, e]), add(at, [r, 0, e]), add(at, [r, H, e]), add(at, [-r, H, e])]} fill={t.left} />
          <IsoPolygon points={[add(at, [-e, H, -r]), add(at, [e, H, -r]), add(at, [e, H, r]), add(at, [-e, H, r])]} fill={t.top} />
          <IsoPolygon points={[add(at, [-r, H, -e]), add(at, [r, H, -e]), add(at, [r, H, e]), add(at, [-r, H, e])]} fill={t.top} />
        </g>
      );
    }
    case 'food': {
      const [hx, hy] = isoProject(add(at, [0.14, 0.12, 0]));
      return (
        <g>
          <IsoCylinder at={at} r={0.22} h={0.03} color={p.leaf} />
          <IsoCylinder at={add(at, [0, 0.03, 0])} r={0.13} h={0.18} color={p.leaf} />
          <path
            d={`M${f(hx)},${f(hy - 0.06)}a0.06,0.06 0 0 1 0,0.12`}
            fill="none"
            stroke={faceTones(p.leaf, theme).right}
            strokeWidth={0.035}
          />
        </g>
      );
    }
    case 'shopping': {
      const arc = Array.from({ length: 9 }, (_, i) => {
        const a = (i / 8) * Math.PI;
        return add(at, [Math.cos(a) * 0.1, 0.4 + Math.sin(a) * 0.1, 0]);
      });
      return (
        <g>
          <IsoBox at={at} size={[0.36, 0.4, 0.2]} color={p.leaf} />
          <IsoLine points={arc} stroke={p.shade} width={2} />
        </g>
      );
    }
    case 'other':
    default: {
      const gaps: Vec3[][] = [];
      for (const y of [0.4 / 3, 0.8 / 3]) {
        gaps.push([add(at, [0.25, y, -0.25]), add(at, [0.25, y, 0.25])]);
        gaps.push([add(at, [-0.25, y, 0.25]), add(at, [0.25, y, 0.25])]);
      }
      for (const x of [-0.5 / 6, 0.5 / 6]) gaps.push([add(at, [x, 0.4, -0.25]), add(at, [x, 0.4, 0.25])]);
      return (
        <g>
          <IsoBox at={at} size={[0.5, 0.4, 0.5]} color={p.soil} />
          {gaps.map((g, i) => (
            <IsoLine key={i} points={g} stroke={p.shade} width={1.2} />
          ))}
        </g>
      );
    }
  }
}

export function SvgCategoryBlock({
  category,
  height,
  at,
  prop = true,
  shadow = true,
}: {
  category: CategoryKey;
  height: number;
  at: Vec3;
  prop?: boolean;
  shadow?: boolean;
}) {
  const { theme } = useIsoSvg();
  const p = palette3d(theme);
  const h = Math.max(height, BLOCK.minH);
  const propH: Record<CategoryKey, number> = {
    accommodation: 0.35,
    transportation: 0.27,
    activities: 0.6,
    bundle: 0.31,
    food: 0.21,
    shopping: 0.5,
    other: 0.4,
  };
  return (
    <g>
      {shadow ? <IsoShadow at={at} footprint={rectFootprint(BLOCK.w, BLOCK.d)} h={h + (prop ? propH[category] : 0)} /> : null}
      <IsoBox at={at} size={[BLOCK.w, h, BLOCK.d]} color={p.category[category]} />
      {prop ? <SvgCategoryProp category={category} at={add(at, [0, h, 0])} /> : null}
    </g>
  );
}

// ---------------------------------------------------------------- Suitcase

interface SuitcasePart {
  faces: Face[];
  center: Vec3;
}

function suitcaseBox(size: Vec3, color: string, theme: ThemeName, xf: Affine): SuitcasePart {
  return { faces: boxFaces(size, color, theme, xf), center: apply(xf, [0, size[1] / 2, 0]) };
}

/** Shell pieces in shell space (base on y = 0), split by which side of the contents they fall on. */
function suitcaseShell(theme: ThemeName, xf: Affine) {
  const p = palette3d(theme);
  const { w, d, baseH, wall, wallH, corner } = SUITCASE;
  const c = corner / 2 - 0.01;
  const at = (x: number, y: number, z: number) => chain(xf, translation(x, y, z));
  const cap = (x: number, z: number) => suitcaseBox([corner, corner, corner], p.suitcase.corners, theme, at(x, -0.005, z));
  return {
    base: suitcaseBox([w, baseH, d], p.suitcase.shell, theme, xf),
    // far walls (behind the contents): back (−Z), then left (−X), which overlaps the back wall's inner face
    far: [
      suitcaseBox([w, wallH, wall], p.suitcase.shell, theme, at(0, 0, -d / 2 + wall / 2)),
      suitcaseBox([wall, wallH, d - 2 * wall], p.suitcase.shell, theme, at(-w / 2 + wall / 2, 0, 0)),
      cap(-w / 2 + c, -d / 2 + c),
    ],
    // near walls (in front of the contents): right (+X) first so the front wall's corner covers its end
    near: [
      suitcaseBox([wall, wallH, d - 2 * wall], p.suitcase.shell, theme, at(w / 2 - wall / 2, 0, 0)),
      suitcaseBox([w, wallH, wall], p.suitcase.shell, theme, at(0, 0, d / 2 - wall / 2)),
      cap(w / 2 - c, -d / 2 + c),
      cap(-w / 2 + c, d / 2 - c),
      cap(w / 2 - c, d / 2 - c),
    ],
  };
}

function suitcaseLid(theme: ThemeName, root: Affine, lidAngle: number): SuitcasePart[] {
  const p = palette3d(theme);
  const { d, wallH, strapW, strapT, strapX } = SUITCASE;
  const lidXf = chain(root, translation(0, wallH, -d / 2), trs([0, 0, 0], [(-lidAngle * Math.PI) / 180, 0, 0]));
  const lidShell = chain(lidXf, translation(0, wallH, d / 2), trs([0, 0, 0], [Math.PI, 0, 0]));
  const sh = suitcaseShell(theme, lidShell);
  const straps = sortParts(
    [-strapX, strapX].flatMap((x) => [
      suitcaseBox([strapW, strapT, d + 0.02], p.suitcase.straps, theme, chain(lidXf, translation(x, wallH, d / 2))),
      suitcaseBox([strapW, wallH * 0.6, strapT], p.suitcase.straps, theme, chain(lidXf, translation(x, wallH * 0.4, d + strapT / 2))),
    ]),
  );
  const body = sortParts([sh.base, ...sh.far, ...sh.near]);
  // The straps ride on the lid's outside, which faces the camera only while the lid is under 45°.
  return lidAngle < 45 ? [...body, ...straps] : [...straps, ...body];
}

export interface SvgSuitcaseProps {
  /** Degrees: 0 = shut, 110 = wide open (same as the WebGL primitive). */
  lidAngle: number;
  buckled?: boolean;
  at: Vec3;
  shadow?: boolean;
  /**
   * Contents drawn between the tray's far and near walls (e.g. <SvgPackedItems/>), so they sit inside the case
   * instead of over or under it. Positions are world units like everything else in the twin.
   */
  inside?: ReactNode;
}

/**
 * Tray in three layers around `inside` (far walls, contents, near walls), with the lid behind the tray when
 * it is open past 45° and over it when nearly shut.
 */
export function SvgSuitcase({ lidAngle, buckled = false, at, shadow = true, inside }: SvgSuitcaseProps) {
  const { theme } = useIsoSvg();
  const p = palette3d(theme);
  const { w, d, wallH, strapW, strapT, strapX } = SUITCASE;
  const root = translation(...at);
  const tray = suitcaseShell(theme, root);
  const lid = suitcaseLid(theme, root, lidAngle);
  const lower: SuitcasePart[] = buckled
    ? [-strapX, strapX].flatMap((x) => [
        suitcaseBox([strapW, wallH * 0.5, strapT], p.suitcase.straps, theme, translation(at[0] + x, at[1] + wallH * 0.5, at[2] + d / 2 + strapT / 2)),
        suitcaseBox([strapW + 0.04, 0.06, 0.02], p.suitcase.corners, theme, translation(at[0] + x, at[1] + wallH - 0.03, at[2] + d / 2 + 0.012)),
      ])
    : [];
  const handle = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 8) * Math.PI;
    return add(at, [Math.cos(a) * 0.2, 0.3, d / 2 + Math.sin(a) * 0.2]);
  });
  const lidBehind = lidAngle > 45;
  const draw = (parts: SuitcasePart[], k: string) => parts.map((q, i) => <Faces key={`${k}${i}`} faces={q.faces} />);
  return (
    <g>
      {shadow ? <IsoShadow at={at} footprint={rectFootprint(w, d)} h={lidAngle <= 0.5 ? wallH * 2 : wallH} /> : null}
      {lidBehind ? draw(lid, 'l') : null}
      <Faces faces={tray.base.faces} />
      {draw(tray.far, 'f')}
      {inside}
      {draw(tray.near, 'n')}
      {draw(lower, 's')}
      <IsoLine points={handle} stroke={faceTones(p.ink2, theme).right} width={2.5} />
      {!lidBehind ? draw(lid, 'l') : null}
    </g>
  );
}

// ---------------------------------------------------------------- Packed items

export interface SvgPackedItem {
  at: Vec3;
  tone: FabricKey;
  rotY?: number;
}

export function SvgPackedItems({ items }: { items: SvgPackedItem[] }) {
  const { theme } = useIsoSvg();
  const p = palette3d(theme);
  const sorted = items.slice().sort((a, b) => depthCompare(a.at, b.at));
  return (
    <g>
      {sorted.map((it, i) => {
        const size = (it.tone === 'passport' ? PACKED.slab : PACKED.box) as unknown as Vec3;
        return <IsoBox key={i} at={it.at} size={size} color={p.fabric[it.tone]} local={rotationY(it.rotY ?? 0)} curved />;
      })}
    </g>
  );
}

// ---------------------------------------------------------------- IOU slip

export function SvgIOUSlip({ at, rotY = 0.18 }: { at: Vec3; rotY?: number }) {
  const { theme } = useIsoSvg();
  const p = palette3d(theme);
  const xf = chain(translation(...at), rotationY(rotY));
  const [pw, ph, pd] = IOU.paper;
  const [lw, lh] = IOU.line;
  return (
    <g>
      <Faces faces={boxFaces([pw, ph, pd], p.leaf, theme, xf)} />
      <Faces faces={boxFaces([lw, 0.002, lh], p.over, theme, chain(xf, translation(0, ph, 0.05)))} />
    </g>
  );
}

// ---------------------------------------------------------------- Shelf

export function SvgShelf({ slots, at }: { slots: number; at: Vec3 }) {
  const { theme } = useIsoSvg();
  const p = palette3d(theme);
  const L = shelfLength(slots);
  const { plankH, d, rail, bracket } = SHELF;
  const tones = faceTones(p.soil, theme);
  const bracketTri = (x: number): Vec3[] => [
    add(at, [x, -plankH, -d / 2]),
    add(at, [x, -plankH - bracket, -d / 2]),
    add(at, [x, -plankH, -d / 2 + bracket]),
  ];
  return (
    <g>
      {[-L / 2 + 0.3, L / 2 - 0.3].map((x) => (
        <IsoPolygon key={x} points={bracketTri(x + 0.04)} fill={tones.right} />
      ))}
      <IsoBox at={add(at, [0, -plankH, 0])} size={[L, plankH, d]} color={p.soil} />
      <IsoBox at={add(at, [0, 0, -d / 2 + rail / 2])} size={[L, rail, rail]} color={p.soil} />
    </g>
  );
}

// ---------------------------------------------------------------- Kampung house

export function SvgKampungHouse({
  footprint,
  floors,
  roof = 'under',
  firstVisit,
  at,
  shadow = true,
}: {
  footprint: number;
  floors: number;
  roof?: 'under' | 'over';
  firstVisit?: boolean;
  at: Vec3;
  shadow?: boolean;
}) {
  const { theme } = useIsoSvg();
  const p = palette3d(theme);
  const fp = footprint;
  const n = Math.min(Math.max(Math.round(floors), 1), 4);
  const bodyH = HOUSE.floorH * n;
  const inset = 0.1;
  const stilts: Vec3[] = [
    [-fp / 2 + inset, 0, -fp / 2 + inset],
    [fp / 2 - inset, 0, -fp / 2 + inset],
    [-fp / 2 + inset, 0, fp / 2 - inset],
    [fp / 2 - inset, 0, fp / 2 - inset],
  ];
  const span = fp + HOUSE.overhang * 2;
  const roofXf = chain(translation(...at), translation(0, HOUSE.stiltH + bodyH, 0), rotationY(Math.PI / 2));
  const [dw, dh] = HOUSE.door;
  const doorZ = fp / 2 + 0.001;
  const height = HOUSE.stiltH + bodyH + HOUSE.roofH;
  return (
    <g>
      {shadow ? <IsoShadow at={at} footprint={rectFootprint(fp, fp)} h={height} /> : null}
      {stilts
        .slice()
        .sort(depthCompare)
        .map((s, i) => (
          <IsoCylinder key={i} at={add(at, s)} r={HOUSE.stiltR} h={HOUSE.stiltH} color={p.house.stilts} />
        ))}
      <IsoBox at={add(at, [0, HOUSE.stiltH, 0])} size={[fp, bodyH, fp]} color={p.house.body} />
      <IsoPolygon
        points={[
          add(at, [-dw / 2, HOUSE.stiltH, doorZ]),
          add(at, [dw / 2, HOUSE.stiltH, doorZ]),
          add(at, [dw / 2, HOUSE.stiltH + dh, doorZ]),
          add(at, [-dw / 2, HOUSE.stiltH + dh, doorZ]),
        ]}
        fill={faceTones(p.house.door, theme).left}
      />
      <Faces faces={gableFaces(span, HOUSE.roofH, span, p.roof[roof], theme, roofXf)} />
      {firstVisit ? <SvgPennant at={add(at, [fp / 2 - 0.05, height - 0.02, 0])} height={0.45} /> : null}
    </g>
  );
}

// ---------------------------------------------------------------- Road

export function SvgRoad({ length, at }: { length: number; at: Vec3 }) {
  const { theme } = useIsoSvg();
  const p = palette3d(theme);
  const count = roadDashCount(length);
  const start = -((count - 1) * ROAD.dashPitch) / 2;
  return (
    <g>
      <IsoBox at={at} size={[length, ROAD.h, ROAD.d]} color={p.ruleStrong} />
      {Array.from({ length: count }, (_, i) => (
        <IsoBox key={i} at={add(at, [start + i * ROAD.dashPitch, ROAD.h, 0])} size={[...ROAD.dash]} color={p.leaf} />
      ))}
    </g>
  );
}

// ---------------------------------------------------------------- Ghost

/** Same as IsoGhostBox; named to match the 3D GhostBox. */
export const SvgGhostBox = IsoGhostBox;
