// "Checking you in…": a coin hopping across three day stones, in plain CSS (no WebGL on auth pages, §8).
// Each hop is 450ms (--dur-object). Under reduced motion the coin simply sits on the last stone.
import { isoProject } from '@/iso/projection';
import type { Vec3 } from '@/iso/specs';

const STONE = { w: 0.62, h: 0.14 };
const GAP = 0.86;
const SCALE = 64; // px per world unit

const pt = (p: Vec3) => {
  const [x, y] = isoProject(p);
  return `${(x * SCALE).toFixed(1)},${(y * SCALE).toFixed(1)}`;
};

/** One stone: top face plus the two visible sides, in the shared projection. */
function Stone({ cx, today }: { cx: number; today?: boolean }) {
  const r = STONE.w / 2;
  const h = STONE.h;
  const top = [pt([cx - r, h, -r]), pt([cx + r, h, -r]), pt([cx + r, h, r]), pt([cx - r, h, r])].join(' ');
  const left = [pt([cx - r, h, r]), pt([cx + r, h, r]), pt([cx + r, 0, r]), pt([cx - r, 0, r])].join(' ');
  const right = [pt([cx + r, h, -r]), pt([cx + r, h, r]), pt([cx + r, 0, r]), pt([cx + r, 0, -r])].join(' ');
  return (
    <g strokeWidth={1.25} strokeLinejoin="round" stroke="hsl(var(--ink-2))">
      <polygon points={left} fill="hsl(var(--rule-strong))" />
      <polygon points={right} fill="hsl(var(--rule))" />
      <polygon points={top} fill={today ? 'hsl(var(--brass))' : 'hsl(var(--leaf))'} />
    </g>
  );
}

const CSS = `
@keyframes tl-hop {
  0%, 8%   { transform: translate(0px, 0px); opacity: 1; }
  20%      { transform: translate(var(--hx1), calc(var(--sy1) * 0.5 - 34px)); }
  33%, 41% { transform: translate(var(--sx1), var(--sy1)); }
  53%      { transform: translate(var(--hx2), calc((var(--sy1) + var(--sy2)) * 0.5 - 34px)); }
  66%, 90% { transform: translate(var(--sx2), var(--sy2)); opacity: 1; }
  98%      { transform: translate(var(--sx2), var(--sy2)); opacity: 0; }
  100%     { transform: translate(0px, 0px); opacity: 0; }
}
.tl-coin { animation: tl-hop 1800ms cubic-bezier(.2,.8,.2,1) infinite; }
@media (prefers-reduced-motion: reduce) {
  .tl-coin { animation: none; transform: translate(var(--sx2), var(--sy2)); }
}
`;

export function StoneHop({ className }: { className?: string }) {
  const xs = [0, GAP, GAP * 2];
  const [x0, y0] = isoProject([xs[0], STONE.h, 0]);
  const [x1, y1] = isoProject([xs[1], STONE.h, 0]);
  const [x2, y2] = isoProject([xs[2], STONE.h, 0]);
  const sx1 = (x1 - x0) * SCALE;
  const sy1 = (y1 - y0) * SCALE;
  const sx2 = (x2 - x0) * SCALE;
  const sy2 = (y2 - y0) * SCALE;
  const vars = {
    '--sx1': `${sx1.toFixed(1)}px`,
    '--sy1': `${sy1.toFixed(1)}px`,
    '--sx2': `${sx2.toFixed(1)}px`,
    '--sy2': `${sy2.toFixed(1)}px`,
    '--hx1': `${(sx1 / 2).toFixed(1)}px`,
    '--hx2': `${((sx1 + sx2) / 2).toFixed(1)}px`,
  } as React.CSSProperties;

  // viewBox: every stone corner, plus room above for the hop.
  const corners = xs.flatMap((cx) =>
    [-1, 1].flatMap((a) => [-1, 1].flatMap((b) => [0, STONE.h].map((y) => isoProject([cx + (a * STONE.w) / 2, y, (b * STONE.w) / 2])))),
  );
  const px = corners.map(([x]) => x * SCALE);
  const py = corners.map(([, y]) => y * SCALE);
  const minX = Math.min(...px) - 12;
  const maxX = Math.max(...px) + 12;
  const minY = Math.min(...py) - 52;
  const maxY = Math.max(...py) + 4;
  const coinX = x0 * SCALE;
  const coinY = y0 * SCALE - 6;

  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox={`${minX.toFixed(1)} ${minY.toFixed(1)} ${(maxX - minX).toFixed(1)} ${(maxY - minY).toFixed(1)}`}
      width={Math.round(maxX - minX)}
      height={Math.round(maxY - minY)}
      style={vars}
    >
      <style>{CSS}</style>
      <Stone cx={xs[0]} />
      <Stone cx={xs[1]} />
      <Stone cx={xs[2]} today />
      <g className="tl-coin">
        <ellipse cx={coinX} cy={coinY + 4} rx={12} ry={6.9} fill="hsl(var(--brass-ink))" stroke="hsl(var(--ink-2))" strokeWidth={1.25} />
        <ellipse cx={coinX} cy={coinY} rx={12} ry={6.9} fill="hsl(var(--brass))" stroke="hsl(var(--ink-2))" strokeWidth={1.25} />
      </g>
    </svg>
  );
}
