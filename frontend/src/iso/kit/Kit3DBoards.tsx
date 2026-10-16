// WebGL kit boards (§14). Lazy chunk: imported only by the dev IsoKit page.
import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThemeName } from '@/design/tokens';
import { IsoCanvas } from '@/iso/canvas/IsoCanvas';
import { circleFootprint, rectFootprint } from '@/iso/geometry2d';
import {
  Balang,
  CategoryBlock,
  CoinFlight,
  CoinInstances,
  CoinPile,
  CoinStack,
  DayStones,
  GhostBox,
  GhostJar,
  HardShadow,
  IOUSlip,
  KampungHouse,
  PackedItems,
  Pennant,
  Plinth,
  Road,
  Shelf,
  Signpost,
  Suitcase,
} from '@/iso/primitives';
import { addVec as add, kitCaseItems, kitCategories, kitPacked, kitStacks, kitStones } from '@/iso/kit/cells';
import {
  MOTION,
  MOTION_BOUNDS,
  PRIMITIVE_BOUNDS,
  PRIMITIVE_CELLS,
  STATE_BOUNDS,
  STATE_PLOTS,
  cellCenter,
  type CellId,
} from '@/iso/kit/layout';
import type { Vec3 } from '@/iso/specs';
import type { IsoTier, IsoView } from '@/iso/types';

const CELLS: Record<CellId, (c: Vec3) => ReactNode> = {
  plinth: (c) => <Plinth w={3} d={2} variant="ledger" position={c} />,
  shadow: (c) => (
    <>
      <HardShadow footprint={rectFootprint(1, 1)} h={2} position={c} />
      <GhostBox size={[1, 2, 1]} position={c} />
    </>
  ),
  coinPile: (c) => (
    <group position={c}>
      <HardShadow footprint={circleFootprint(0.7)} h={0.4} />
      <CoinPile count={40} seed="kit-pile" />
    </group>
  ),
  coinStacks: (c) => (
    <>
      {kitStacks(c).map((s) => (
        <CoinStack key={s.seed} at={s.at} count={s.count} seed={s.seed} />
      ))}
    </>
  ),
  balangClosed: (c) => <Balang height={2.4} fill={0.62} seed="kit-a" lid="closed" lidColor="lidUpcoming" position={c} />,
  balangTilted: (c) => (
    <>
      <Balang height={2.0} fill={0} seed="kit-b" lid="tilted" lidColor="lidOnTheRoad" position={add(c, [-0.3, 0, -0.4])} />
      <IOUSlip position={add(c, [0.95, 0, -0.1])} />
    </>
  ),
  balangOff: (c) => <Balang height={2.0} fill={0.3} seed="kit-c" lid="off" lidColor="lidHome" position={c} />,
  balangShared: (c) => <Balang height={1.6} fill={0.85} seed="kit-d" slots={3} lidColor="lidUpcoming" position={c} />,
  dayStones: (c) => (
    <>
      <DayStones stones={kitStones(c)} />
      <CoinStack at={add(c, [-0.75, 0.08, -0.4])} count={4} seed="ds1" />
      <CoinStack at={add(c, [0, 0.08, -0.4])} count={9} seed="ds2" />
      <CoinStack at={add(c, [0.75, 0.14, -0.4])} count={2} seed="ds3" />
    </>
  ),
  pennantSignpost: (c) => (
    <>
      <Pennant position={add(c, [-0.8, 0, 0.5])} />
      <Signpost position={add(c, [0.4, 0, -0.4])} />
    </>
  ),
  ghosts: (c) => (
    <>
      <GhostJar height={1.6} position={add(c, [0.35, 0, -0.35])} />
      <GhostBox size={[0.6, 0.6, 0.6]} position={add(c, [-0.9, 0, 0.6])} />
    </>
  ),
  iouSlip: (c) => (
    <>
      <IOUSlip position={c} />
      <IOUSlip position={add(c, [0.5, 0, 0.45])} rotY={-0.3} />
    </>
  ),
  categories: (c) => (
    <>
      {kitCategories(c).map((b) => (
        <CategoryBlock key={b.category} category={b.category} height={b.height} position={b.at} />
      ))}
    </>
  ),
  suitcaseOpen: (c) => (
    <>
      <Suitcase lidAngle={70} position={c} />
      <PackedItems items={kitCaseItems(c)} />
    </>
  ),
  suitcaseClosed: (c) => <Suitcase lidAngle={0} buckled position={c} />,
  packedItems: (c) => <PackedItems items={kitPacked(c)} />,
  shelf: (c) => (
    <>
      <Shelf slots={1} position={add(c, [0, 0.9, 0])} />
      <Balang height={1.6} fill={0.4} seed="kit-e" lidColor="lidOnTheRoad" position={add(c, [0, 0.9, 0])} shadow={false} />
    </>
  ),
  houses: (c) => (
    <>
      <KampungHouse footprint={1.1} floors={2} roof="under" firstVisit position={add(c, [-0.7, 0, 0.5])} />
      <KampungHouse footprint={0.9} floors={1} roof="over" position={add(c, [0.8, 0, -0.5])} />
    </>
  ),
  road: (c) => <Road length={3.2} position={c} />,
};

export interface FrameStats {
  frames: number;
  calls: number;
  triangles: number;
}

interface BoardProps {
  theme: ThemeName;
  tier: IsoTier;
  reducedMotion: boolean;
  view: (w: number, h: number) => IsoView;
  /** Only these cells (focus mode). */
  cells?: CellId[];
  /** Called after every rendered frame (kit perf readout; proves 0 fps at idle). */
  onFrame?: (s: FrameStats) => void;
}

/** Reads renderer stats after each frame. Priority -1 keeps r3f's own render call. */
function Stats({ onFrame }: { onFrame?: (s: FrameStats) => void }) {
  const frames = useRef(0);
  useFrame(({ gl }) => {
    frames.current += 1;
    // info is from the previous frame here (we run before render); fine for a readout.
    onFrame?.({ frames: frames.current, calls: gl.info.render.calls, triangles: gl.info.render.triangles });
  }, -1);
  return null;
}

export function PrimitiveBoard3D({ theme, tier, reducedMotion, view, cells, onFrame }: BoardProps) {
  const list = cells ? PRIMITIVE_CELLS.filter((c) => cells.includes(c.id)) : PRIMITIVE_CELLS;
  return (
    <IsoCanvas bounds={PRIMITIVE_BOUNDS} view={view} theme={theme} tier={tier} dpr={tier === 'lite' ? 1 : [1, 2]} reducedMotion={reducedMotion}>
      <Stats onFrame={onFrame} />
      <CoinInstances>
        {list.map((cell) => {
          const c = cellCenter(cell.col, cell.row);
          return <group key={cell.id}>{CELLS[cell.id](c)}</group>;
        })}
      </CoinInstances>
    </IsoCanvas>
  );
}

export function StateBoard3D({ theme, tier, reducedMotion, view, onFrame }: BoardProps) {
  return (
    <IsoCanvas bounds={STATE_BOUNDS} view={view} theme={theme} tier={tier} dpr={tier === 'lite' ? 1 : [1, 2]} reducedMotion={reducedMotion}>
      <Stats onFrame={onFrame} />
      <CoinInstances>
        {STATE_PLOTS.map((p) => (
          <group key={p.key}>
            <Plinth w={p.plinth.w} d={p.plinth.d} position={p.plinth.at} />
            <Balang height={p.jar.height} fill={p.jar.fill} lid={p.jar.lid} lidColor={p.jar.lidColor} seed={`state-${p.key}`} position={p.jar.at} />
            <DayStones stones={p.stones} />
            {p.stacks.map((s) => (
              <CoinStack key={s.seed} at={s.at} count={s.count} seed={s.seed} />
            ))}
            <Signpost position={p.signpost} />
          </group>
        ))}
      </CoinInstances>
    </IsoCanvas>
  );
}

export interface MotionState {
  jarFill: number;
  stack: number;
  launchKey: number | null;
  onLanded: () => void;
}

/** Motion demo: one coin leaves the jar for today's stone (450ms parabola, one bounce), then counts update. */
export function MotionBoard3D({ theme, tier, reducedMotion, view, onFrame, motion }: BoardProps & { motion: MotionState }) {
  const { stone, stackTop, jar, mouth } = MOTION;
  const nextCoin: Vec3 = [stone[0], stackTop + 0.025 + motion.stack * 0.055, stone[2]];
  return (
    <IsoCanvas bounds={MOTION_BOUNDS} view={view} theme={theme} tier={tier} dpr={tier === 'lite' ? 1 : [1, 2]} reducedMotion={reducedMotion}>
      <Stats onFrame={onFrame} />
      <Plinth w={4.2} d={2.6} position={[0.2, 0, 0]} />
      <Balang height={2.0} fill={motion.jarFill} seed="motion" lidColor="lidOnTheRoad" lid="off" position={jar} />
      <DayStones stones={[{ at: stone, state: 'today' }]} pennant={false} />
      <CoinStack at={[stone[0], stackTop, stone[2]]} count={motion.stack} seed="motion-stack" />
      <CoinFlight from={mouth} to={nextCoin} launchKey={motion.launchKey} onLanded={motion.onLanded} lift={0.9} />
    </IsoCanvas>
  );
}

/** Single entry for React.lazy. */
export default function KitBoard3D({
  board,
  motion,
  ...rest
}: BoardProps & { board: 'primitives' | 'states' | 'motion'; motion?: MotionState }) {
  if (board === 'motion' && motion) return <MotionBoard3D {...rest} motion={motion} />;
  return board === 'primitives' ? <PrimitiveBoard3D {...rest} /> : <StateBoard3D {...rest} />;
}
