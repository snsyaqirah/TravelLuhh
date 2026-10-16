// S3 Counter, SVG twin (§7.7): the same spec drawn flat. First paint, fallback when WebGL is off, and print.
import { faceTones } from '@/iso/faceTones';
import { palette3d } from '@/iso/palette3d';
import { depthCompare } from '@/iso/projection';
import { BLOCK } from '@/iso/shapes';
import type { Vec3 } from '@/iso/specs';
import type { IsoSvgTwinProps } from '@/iso/types';
import { IsoBox, IsoGhostBox, IsoPolygon } from '@/iso/svg/IsoSvg';
import { SvgBalang, SvgCategoryBlock, SvgPlinth } from '@/iso/svg/primitives';
import { ZIGZAG, budgetDashBoxes, zigzagBand, type CounterBlockSpec, type CounterSpec } from '@/iso/mappers/counter';
import type { ThemeName } from '@/design/tokens';

const OFF = 0.006;

/** The paper break band on the two visible faces of a clamped block (mirrors ZigzagCap in the scene). */
function SvgZigzag({ block, theme }: { block: CounterBlockSpec; theme: ThemeName }) {
  const tones = faceTones(palette3d(theme).leaf, theme);
  const [x, , z] = block.at;
  const y0 = block.height - ZIGZAG.capH;
  const band = zigzagBand(BLOCK.w);
  // +Z face: local (u, v) → (x + u, y0 + v, z + d/2). +X face (rotated +90° about Y): (x + w/2, y0 + v, z − u).
  const left: Vec3[] = band.map(([u, v]) => [x + u, y0 + v, z + BLOCK.d / 2 + OFF]);
  const right: Vec3[] = band.map(([u, v]) => [x + BLOCK.w / 2 + OFF, y0 + v, z - u]);
  return (
    <g>
      <IsoPolygon points={left} fill={tones.left} />
      <IsoPolygon points={right} fill={tones.right} />
    </g>
  );
}

function SvgBudgetLine({ line, theme }: { line: NonNullable<CounterSpec['budgetLine']>; theme: ThemeName }) {
  const p = palette3d(theme);
  const color = line.tone === 'over' ? p.over : p.ink3;
  // Same boxes as the scene, in painter's order.
  const boxes = budgetDashBoxes(line).sort((a, b) => depthCompare(a.center, b.center));
  return (
    <g>
      {boxes.map((b, i) => (
        <IsoBox key={i} at={[b.center[0], b.center[1] - b.size[1] / 2, b.center[2]]} size={b.size} color={color} />
      ))}
    </g>
  );
}

export function CounterSvg({ spec, theme }: IsoSvgTwinProps<CounterSpec>) {
  const { plinth, jar } = spec;
  return (
    <g>
      <SvgPlinth w={plinth.w} d={plinth.d} variant="ledger" at={plinth.at} />
      <SvgBalang at={jar.at} height={jar.height} fill={jar.fill} lid={jar.lid} lidColor={jar.lidColor} seed={`counter-${spec.tripId}`} />
      {spec.ghostBlock ? <IsoGhostBox at={spec.ghostBlock.at} size={spec.ghostBlock.size} /> : null}
      {/* Blocks run along +X at one depth: ascending x is painter's order. */}
      {spec.blocks.map((b) => (
        <g key={b.category}>
          <SvgCategoryBlock category={b.category} height={b.height} at={b.at} />
          {b.clamped ? <SvgZigzag block={b} theme={theme} /> : null}
        </g>
      ))}
      {spec.budgetLine ? <SvgBudgetLine line={spec.budgetLine} theme={theme} /> : null}
    </g>
  );
}
