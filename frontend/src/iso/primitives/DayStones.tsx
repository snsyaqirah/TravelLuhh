// Day stones (§7.6 #6). One InstancedMesh per solid state, ghost fill + one merged dashed-line mesh for
// future days, an instanced stamp rim under over-allowance days, and a brass loop around selected days.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { BufferGeometry, Float32BufferAttribute, Matrix4, type InstancedMesh } from 'three';
import { useIso } from '@/iso/canvas/context';
import { faceToneMaterial, lineMaterial } from '@/iso/material/FaceToneMaterial';
import { DashedLines } from '@/iso/primitives/Ghost';
import { Pennant } from '@/iso/primitives/Pennant';
import { boxGeo, edgesGeo } from '@/iso/primitives/geometries';
import { STONE } from '@/iso/shapes';
import type { Vec3 } from '@/iso/specs';
import type { StoneState } from '@/iso/types';

export interface DayStone {
  /** Base centre of the stone (where it sits on the plinth). */
  at: Vec3;
  state: StoneState;
  /** Day spend above the daily allowance → stamp rim. */
  over?: boolean;
  /** Days tab selection → brass loop. */
  selected?: boolean;
}

export interface DayStonesProps {
  stones: DayStone[];
  /** Draw the pennant on today's stone (default true). */
  pennant?: boolean;
}

const mtx = new Matrix4();

function stoneMatrix(s: DayStone, out: Matrix4): Matrix4 {
  const raise = s.state === 'today' ? STONE.todayRaise : 0;
  const h = STONE.size[1] + raise;
  // Today's stone is taller rather than floating: same footprint, raised top.
  return out.makeScale(1, h / STONE.size[1], 1).setPosition(s.at[0], s.at[1] + h / 2, s.at[2]);
}

function InstancedStones({ stones, color, kind }: { stones: DayStone[]; color: string; kind: 'stone' | 'rim' }) {
  const { theme } = useIso();
  const ref = useRef<InstancedMesh>(null);
  const geo = kind === 'stone' ? boxGeo(...STONE.size) : boxGeo(...STONE.rim);
  const mat = faceToneMaterial(color, theme);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    stones.forEach((s, i) => {
      if (kind === 'stone') mesh.setMatrixAt(i, stoneMatrix(s, mtx));
      else mesh.setMatrixAt(i, mtx.makeTranslation(s.at[0], s.at[1] + STONE.size[1] / 2 + STONE.rimDrop, s.at[2]));
    });
    mesh.count = stones.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [stones, kind, mat]);
  if (stones.length === 0) return null;
  return <instancedMesh ref={ref} args={[geo, mat, stones.length]} frustumCulled={false} />;
}

/** One merged LineSegments geometry: the stone's edges copied to every future stone. */
function useMergedEdges(stones: DayStone[], source: BufferGeometry, inflate = 0): BufferGeometry | null {
  const geometry = useMemo(() => {
    if (stones.length === 0) return null;
    const base = source.getAttribute('position');
    const out = new Float32Array(base.count * 3 * stones.length);
    stones.forEach((s, i) => {
      for (let v = 0; v < base.count; v++) {
        const o = (i * base.count + v) * 3;
        out[o] = base.getX(v) * (1 + inflate) + s.at[0];
        out[o + 1] = base.getY(v) + s.at[1] + STONE.size[1] / 2;
        out[o + 2] = base.getZ(v) * (1 + inflate) + s.at[2];
      }
    });
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(out, 3));
    return g;
  }, [stones, source, inflate]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  return geometry;
}

function SelectedLoops({ stones }: { stones: DayStone[] }) {
  const { palette } = useIso();
  const geometry = useMemo(() => {
    if (stones.length === 0) return null;
    const h = (STONE.size[0] + STONE.selectPad * 2) / 2;
    const corners: Array<[number, number]> = [
      [-h, -h],
      [h, -h],
      [h, h],
      [-h, h],
    ];
    const pts: number[] = [];
    for (const s of stones) {
      const y = s.at[1] + 0.006;
      for (let i = 0; i < 4; i++) {
        const a = corners[i];
        const b = corners[(i + 1) % 4];
        pts.push(s.at[0] + a[0], y, s.at[2] + a[1], s.at[0] + b[0], y, s.at[2] + b[1]);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pts, 3));
    return g;
  }, [stones]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return <lineSegments geometry={geometry} material={lineMaterial(palette.brass)} renderOrder={5} />;
}

export function DayStones({ stones, pennant = true }: DayStonesProps) {
  const { palette } = useIso();
  const groups = useMemo(() => {
    const past: DayStone[] = [];
    const today: DayStone[] = [];
    const future: DayStone[] = [];
    for (const s of stones) (s.state === 'past' ? past : s.state === 'today' ? today : future).push(s);
    return {
      past,
      today,
      future,
      over: stones.filter((s) => s.over && s.state !== 'future'),
      selected: stones.filter((s) => s.selected),
    };
  }, [stones]);
  const futureEdges = useMergedEdges(groups.future, edgesGeo(boxGeo(...STONE.size), 20));

  return (
    <group>
      <InstancedStones stones={groups.over} color={palette.over} kind="rim" />
      <InstancedStones stones={groups.past} color={palette.stone.past} kind="stone" />
      <InstancedStones stones={groups.today} color={palette.stone.today} kind="stone" />
      <InstancedStones stones={groups.future} color={palette.leaf} kind="stone" />
      {futureEdges ? <DashedLines geometry={futureEdges} /> : null}
      <SelectedLoops stones={groups.selected} />
      {pennant
        ? groups.today.map((s) => (
            <Pennant
              key={`${s.at[0]},${s.at[2]}`}
              position={[s.at[0] - 0.18, s.at[1] + STONE.size[1] + STONE.todayRaise, s.at[2] - 0.18]}
            />
          ))
        : null}
    </group>
  );
}
