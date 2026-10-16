// SVG twins of the kit boards: the same cells drawn with svg/primitives, in painter's order.
import type { ReactNode } from 'react';
import { circleFootprint, rectFootprint } from '@/iso/geometry2d';
import { depthCompare } from '@/iso/projection';
import type { Vec3 } from '@/iso/specs';
import { IsoGhostBox, IsoShadow } from '@/iso/svg/IsoSvg';
import { sortByDepth } from '@/iso/svg/isoSvgCore';
import {
  SvgBalang,
  SvgCategoryBlock,
  SvgCoinStack,
  SvgDayStones,
  SvgGhostJar,
  SvgIOUSlip,
  SvgKampungHouse,
  SvgPackedItems,
  SvgPennant,
  SvgPlinth,
  SvgRoad,
  SvgShelf,
  SvgSignpost,
  SvgSuitcase,
} from '@/iso/svg/primitives';
import { addVec as add, kitCaseItems, kitCategories, kitPacked, kitStacks, kitStones } from '@/iso/kit/cells';
import { MOTION, PRIMITIVE_CELLS, STATE_PLOTS, cellCenter, type CellId } from '@/iso/kit/layout';

/** Sort a list of [position, element] pairs into painter's order. */
const painter = (items: Array<[Vec3, ReactNode]>) =>
  items
    .slice()
    .sort((a, b) => depthCompare(a[0], b[0]))
    .map(([, el]) => el);

const CELLS: Record<CellId, (c: Vec3) => ReactNode> = {
  plinth: (c) => <SvgPlinth w={3} d={2} variant="ledger" at={c} />,
  shadow: (c) => (
    <>
      <IsoShadow at={c} footprint={rectFootprint(1, 1)} h={2} />
      <IsoGhostBox at={c} size={[1, 2, 1]} />
    </>
  ),
  coinPile: (c) => (
    <>
      <IsoShadow at={c} footprint={circleFootprint(0.7)} h={0.4} />
      {/* A loose pile has no jar silhouette to clip against: show it as a low stack. */}
      <SvgCoinStack at={c} count={6} seed="kit-pile" />
    </>
  ),
  coinStacks: (c) => <>{painter(kitStacks(c).map((s) => [s.at, <SvgCoinStack key={s.seed} at={s.at} count={s.count} seed={s.seed} />]))}</>,
  balangClosed: (c) => <SvgBalang at={c} height={2.4} fill={0.62} lid="closed" lidColor="lidUpcoming" />,
  balangTilted: (c) => (
    <>
      <SvgBalang at={add(c, [-0.3, 0, -0.4])} height={2.0} fill={0} lid="tilted" lidColor="lidOnTheRoad" />
      <SvgIOUSlip at={add(c, [0.95, 0, -0.1])} />
    </>
  ),
  balangOff: (c) => <SvgBalang at={c} height={2.0} fill={0.3} lid="off" lidColor="lidHome" />,
  balangShared: (c) => <SvgBalang at={c} height={1.6} fill={0.85} slots={3} lidColor="lidUpcoming" />,
  dayStones: (c) => {
    const stones = kitStones(c);
    const stacks: Array<{ at: Vec3; count: number; seed: string }> = [
      { at: add(c, [-0.75, 0.08, -0.4]), count: 4, seed: 'ds1' },
      { at: add(c, [0, 0.08, -0.4]), count: 9, seed: 'ds2' },
      { at: add(c, [0.75, 0.14, -0.4]), count: 2, seed: 'ds3' },
    ];
    // Each stack sits on its stone: draw stone then stack, per stone, in depth order.
    return (
      <>
        {painter(
          stones.map((s, i) => [
            s.at,
            <g key={i}>
              <SvgDayStones stones={[s]} />
              {stacks
                .filter((k) => k.at[0] === s.at[0] && k.at[2] === s.at[2])
                .map((k) => (
                  <SvgCoinStack key={k.seed} at={k.at} count={k.count} seed={k.seed} />
                ))}
            </g>,
          ]),
        )}
      </>
    );
  },
  pennantSignpost: (c) => (
    <>
      {painter([
        [add(c, [-0.8, 0, 0.5]), <SvgPennant key="p" at={add(c, [-0.8, 0, 0.5])} />],
        [add(c, [0.4, 0, -0.4]), <SvgSignpost key="s" at={add(c, [0.4, 0, -0.4])} />],
      ])}
    </>
  ),
  ghosts: (c) => (
    <>
      <SvgGhostJar at={add(c, [0.35, 0, -0.35])} height={1.6} />
      <IsoGhostBox at={add(c, [-0.9, 0, 0.6])} size={[0.6, 0.6, 0.6]} />
    </>
  ),
  iouSlip: (c) => (
    <>
      <SvgIOUSlip at={c} />
      <SvgIOUSlip at={add(c, [0.5, 0, 0.45])} rotY={-0.3} />
    </>
  ),
  categories: (c) => (
    <>
      {sortByDepth(kitCategories(c), (b) => b.at).map((b) => (
        <SvgCategoryBlock key={b.category} category={b.category} height={b.height} at={b.at} />
      ))}
    </>
  ),
  suitcaseOpen: (c) => (
    <>
      <SvgSuitcase at={c} lidAngle={70} />
      <SvgPackedItems items={kitCaseItems(c)} />
    </>
  ),
  suitcaseClosed: (c) => <SvgSuitcase at={c} lidAngle={0} buckled />,
  packedItems: (c) => <SvgPackedItems items={kitPacked(c)} />,
  shelf: (c) => (
    <>
      <SvgShelf slots={1} at={add(c, [0, 0.9, 0])} />
      <SvgBalang at={add(c, [0, 0.9, 0])} height={1.6} fill={0.4} lidColor="lidOnTheRoad" shadow={false} />
    </>
  ),
  houses: (c) => (
    <>
      <SvgKampungHouse at={add(c, [0.8, 0, -0.5])} footprint={0.9} floors={1} roof="over" />
      <SvgKampungHouse at={add(c, [-0.7, 0, 0.5])} footprint={1.1} floors={2} roof="under" firstVisit />
    </>
  ),
  road: (c) => <SvgRoad at={c} length={3.2} />,
};

export function PrimitiveBoardSvg({ cells: only }: { cells?: CellId[] }) {
  const list = only ? PRIMITIVE_CELLS.filter((c) => only.includes(c.id)) : PRIMITIVE_CELLS;
  const cells = sortByDepth(list, (cell) => cellCenter(cell.col, cell.row));
  return (
    <g>
      {cells.map((cell) => (
        <g key={cell.id}>{CELLS[cell.id](cellCenter(cell.col, cell.row))}</g>
      ))}
    </g>
  );
}

export function StateBoardSvg() {
  return (
    <g>
      {STATE_PLOTS.map((p) => {
        const jar = p.jar;
        const stoneEls: Array<[Vec3, ReactNode]> = p.stones.map((s, i) => {
          const stack = p.stacks.find((k) => k.at[0] === s.at[0] && k.at[2] === s.at[2]);
          return [
            s.at,
            <g key={`s${i}`}>
              <SvgDayStones stones={[s]} />
              {stack ? <SvgCoinStack at={stack.at} count={stack.count} seed={stack.seed} /> : null}
            </g>,
          ];
        });
        return (
          <g key={p.key}>
            <SvgPlinth w={p.plinth.w} d={p.plinth.d} at={p.plinth.at} />
            {painter([
              [jar.at, <SvgBalang key="jar" at={jar.at} height={jar.height} fill={jar.fill} lid={jar.lid} lidColor={jar.lidColor} />],
              ...stoneEls,
              [p.signpost, <SvgSignpost key="sign" at={p.signpost} />],
            ])}
          </g>
        );
      })}
    </g>
  );
}


/** Static twin of the motion board (the twin never animates). */
export function MotionBoardSvg({ jarFill, stack }: { jarFill: number; stack: number }) {
  const { stone, stackTop, jar } = MOTION;
  return (
    <g>
      <SvgPlinth w={4.2} d={2.6} at={[0.2, 0, 0]} />
      <SvgBalang at={jar} height={2.0} fill={jarFill} lid="off" lidColor="lidOnTheRoad" />
      <SvgDayStones stones={[{ at: stone, state: 'today' }]} pennant={false} />
      <SvgCoinStack at={[stone[0], stackTop, stone[2]]} count={stack} seed="motion-stack" />
    </g>
  );
}
