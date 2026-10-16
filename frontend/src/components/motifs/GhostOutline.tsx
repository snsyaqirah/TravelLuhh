// Empty-state outlines (§5.4): a dashed 1.5px ink-3 drawing (4 on, 3 off) of the thing that isn't there yet.
// Jar, suitcase and house are drawn in the shared iso projection so they match the scenes; the ticket is flat,
// like the TripTicket it stands in for.
import { cn } from '@/lib/utils';
import { isoProject } from '@/iso/projection';
import { JAR_PROFILE, LID } from '@/iso/shapes';
import type { Vec3 } from '@/iso/specs';

export type GhostKind = 'jar' | 'ticket' | 'suitcase' | 'house';

export interface GhostOutlineProps {
  kind: GhostKind;
  /** Rendered height in px (width follows the drawing). */
  height?: number;
  /** Accessible name; without it the drawing is decorative. */
  title?: string;
  className?: string;
}

interface Drawing {
  /** Path data in drawing units. */
  d: string[];
  box: { x: number; y: number; w: number; h: number };
}

const f = (n: number) => +n.toFixed(4);
const ELLIPSE = 1 / Math.sqrt(3);
const K_Y = 2 / Math.sqrt(6);

function bbox(points: Array<[number, number]>, pad: number) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
}

/** Polylines in world space → projected path data and bounds. */
function isoDrawing(lines: Vec3[][], extra: Array<[number, number]> = [], extraD: string[] = []): Drawing {
  const all: Array<[number, number]> = [...extra];
  const d = lines.map((line) => {
    const pts = line.map((p) => isoProject(p));
    all.push(...pts);
    return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)},${f(y)}`).join('');
  });
  return { d: [...d, ...extraD], box: bbox(all, 0.08) };
}

/** Front-facing edges of an axis-aligned box: silhouette hexagon + the three edges meeting at the near corner. */
function boxEdges([x0, y0, z0]: Vec3, [x1, y1, z1]: Vec3): Vec3[][] {
  return [
    [[x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]],
    [[x1, y1, z1], [x0, y1, z1]],
    [[x1, y1, z1], [x1, y1, z0]],
    [[x1, y1, z1], [x1, y0, z1]],
  ];
}

function jar(): Drawing {
  const H = 2.4;
  const lidTop = H + LID.h;
  const y = (h: number) => -h * K_Y;
  const side = (s: 1 | -1) =>
    JAR_PROFILE.slice(1)
      .map(([r, h], i) => `${i ? 'L' : 'M'}${f(s * r)},${f(y(h))}`)
      .join('');
  const rb = JAR_PROFILE[1][0];
  const lr = LID.r;
  const d = [
    side(1),
    side(-1),
    `M${f(-rb)},0A${f(rb)},${f(rb * ELLIPSE)} 0 0 0 ${f(rb)},0`,
    // lid: sides, front rim, full top ellipse, coin slot
    `M${f(-lr)},${f(y(H))}L${f(-lr)},${f(y(lidTop))}M${f(lr)},${f(y(H))}L${f(lr)},${f(y(lidTop))}`,
    `M${f(-lr)},${f(y(H))}A${f(lr)},${f(lr * ELLIPSE)} 0 0 0 ${f(lr)},${f(y(H))}`,
    `M${f(-lr)},${f(y(lidTop))}A${f(lr)},${f(lr * ELLIPSE)} 0 1 1 ${f(lr)},${f(y(lidTop))}A${f(lr)},${f(lr * ELLIPSE)} 0 1 1 ${f(-lr)},${f(y(lidTop))}`,
    `M-0.25,${f(y(lidTop))}L0.25,${f(y(lidTop))}`,
  ];
  const pts: Array<[number, number]> = [
    [-1, rb * ELLIPSE],
    [1, rb * ELLIPSE],
    [-1, y(lidTop) - lr * ELLIPSE],
    [1, y(lidTop) - lr * ELLIPSE],
  ];
  return { d, box: bbox(pts, 0.08) };
}

function suitcase(): Drawing {
  // Standing case, wide face to the front-left: body on two short feet, an arched carry handle, two straps.
  const lines = boxEdges([-0.9, 0.12, -0.32], [0.9, 1.3, 0.32]);
  const handle: Vec3[] = Array.from({ length: 9 }, (_, i) => {
    const a = Math.PI * (i / 8);
    return [-Math.cos(a) * 0.38, 1.3 + Math.sin(a) * 0.3, 0];
  });
  lines.push(handle);
  lines.push([[-0.45, 0.12, 0.32], [-0.45, 1.3, 0.32], [-0.45, 1.3, -0.32]]);
  lines.push([[0.45, 0.12, 0.32], [0.45, 1.3, 0.32], [0.45, 1.3, -0.32]]);
  lines.push([[-0.72, 0, 0.32], [-0.72, 0.12, 0.32]]);
  lines.push([[0.72, 0, 0.32], [0.72, 0.12, 0.32]]);
  return isoDrawing(lines);
}

function house(): Drawing {
  const a = 0.55;
  const s = 0.3; // stilt height
  const y1 = s + 0.6;
  const ridge = y1 + 0.42;
  const st = a - 0.1;
  const lines: Vec3[][] = [
    // three stilts in view (the back one hides behind the body)
    [[st, 0, st], [st, s, st]],
    [[st, 0, -st], [st, s, -st]],
    [[-st, 0, st], [-st, s, st]],
    // body: visible verticals, bottom and top edges of the two front faces
    [[-a, s, a], [a, s, a], [a, s, -a]],
    [[-a, y1, a], [a, y1, a], [a, y1, -a]],
    [[-a, s, a], [-a, y1, a]],
    [[a, s, a], [a, y1, a]],
    [[a, s, -a], [a, y1, -a]],
    // gable roof, ridge along Z: front gable, ridge, back slope edges, left eave
    [[-a, y1, a], [0, ridge, a], [a, y1, a]],
    [[0, ridge, a], [0, ridge, -a]],
    [[-a, y1, -a], [0, ridge, -a], [a, y1, -a]],
    [[-a, y1, a], [-a, y1, -a]],
    // door on the +Z face
    [[0.1, s, a], [0.1, s + 0.32, a], [0.32, s + 0.32, a], [0.32, s, a]],
  ];
  return isoDrawing(lines);
}

function ticket(): Drawing {
  const W = 120;
  const H = 56;
  const r = 6;
  const px = 34; // perforation x
  const n = 6; // notch radius
  const d = [
    `M${r},0H${px - n}A${n},${n} 0 0 0 ${px + n},0H${W - r}A${r},${r} 0 0 1 ${W},${r}V${H - r}A${r},${r} 0 0 1 ${W - r},${H}H${px + n}A${n},${n} 0 0 0 ${px - n},${H}H${r}A${r},${r} 0 0 1 0,${H - r}V${r}A${r},${r} 0 0 1 ${r},0Z`,
    `M${px},${n + 4}V${H - n - 4}`,
  ];
  return { d, box: { x: -1, y: -1, w: W + 2, h: H + 2 } };
}

const DRAW: Record<GhostKind, () => Drawing> = { jar, ticket, suitcase, house };
const cache = new Map<GhostKind, Drawing>();
const drawingFor = (kind: GhostKind) => {
  let dr = cache.get(kind);
  if (!dr) {
    dr = DRAW[kind]();
    cache.set(kind, dr);
  }
  return dr;
};

const DEFAULT_HEIGHT: Record<GhostKind, number> = { jar: 88, ticket: 72, suitcase: 80, house: 88 };

export function GhostOutline({ kind, height = DEFAULT_HEIGHT[kind], title, className }: GhostOutlineProps) {
  const { d, box } = drawingFor(kind);
  const scale = height / box.h; // px per drawing unit
  const width = Math.round(box.w * scale);
  return (
    <svg
      width={width}
      height={height}
      viewBox={`${f(box.x)} ${f(box.y)} ${f(box.w)} ${f(box.h)}`}
      className={cn('shrink-0 text-ink-3', className)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      data-kind={kind}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={f(1.5 / scale)}
        strokeDasharray={`${f(4 / scale)} ${f(3 / scale)}`}
        strokeLinecap="butt"
        strokeLinejoin="round"
      >
        {d.map((p, i) => (
          <path key={i} d={p} />
        ))}
      </g>
    </svg>
  );
}
