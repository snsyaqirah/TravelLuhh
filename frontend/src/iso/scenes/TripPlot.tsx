// S2 TripPlot in WebGL. Draws TripPlotSpec and adds the only motion this scene has (§10: motion reports a
// change, nothing idles):
//  - live: a coinOut event for this trip sends one coin from the jar to that day's stack (450ms), then the
//    stack shows its new count;
//  - demo / draft: when the spec changes, new jar coins drop in and new stack coins fly over from the jar
//    (at most 24 animated, 8ms apart, the rest snap), a closing lid drops onto the jar, and freshly laid
//    draft stones drop in row by row.
// Under reduced motion none of that runs: every spec renders in its final pose.
import { useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react';
import type { Group } from 'three';
import { appEvents } from '@/lib/appEvents';
import { useIso } from '@/iso/canvas/context';
import { faceToneMaterial } from '@/iso/material/FaceToneMaterial';
import { stoneIndexForDate, type PlotJar, type PlotStone, type TripPlotSpec } from '@/iso/mappers/tripPlot';
import {
  Balang,
  CoinFlight,
  CoinInstances,
  CoinStack,
  DayStones,
  GhostJar,
  IOUSlip,
  IsoEdges,
  Plinth,
  Signpost,
  isoGeometry,
} from '@/iso/primitives';
import { COIN_PILE, COIN_STACK, JAR_REF_HEIGHT, LID, balangCoinCount, coinFillHeight, stoneTop } from '@/iso/shapes';
import type { Vec3 } from '@/iso/specs';
import { COIN_STAGGER_MS, MAX_ANIMATED_COINS, easings } from '@/iso/tween';
import type { IsoSceneProps } from '@/iso/types';

// ---------------------------------------------------------------- director state

type Landing = { kind: 'stack'; index: number; grow: boolean } | { kind: 'jar'; id: string } | { kind: 'none' };

interface Flight {
  key: string;
  from: Vec3;
  to: Vec3;
  delay: number;
  lift: number;
  tint: 0 | 1 | 2;
  land: Landing;
}

interface Director {
  flights: Flight[];
  /** Stack counts shown while coins are still flying to them (stone index → count). */
  stack: Record<number, number>;
  /** Jar coin counts shown while coins are still dropping in (jar id → count). */
  jar: Record<string, number>;
  /** Coins in the air per target ('s3', 'jjar'). */
  pending: Record<string, number>;
  /** Lids dropping onto their jars (jar id → launch key). */
  lids: Record<string, number>;
}

type Action =
  | { type: 'reset' }
  | { type: 'launch'; flights: Flight[]; stack?: Record<number, number>; jar?: Record<string, number>; keepHeld?: boolean; lids?: Record<string, number> }
  | { type: 'land'; key: string }
  | { type: 'lidDone'; id: string };

const EMPTY: Director = { flights: [], stack: {}, jar: {}, pending: {}, lids: {} };

const pendingKey = (l: Landing) => (l.kind === 'stack' ? `s${l.index}` : l.kind === 'jar' ? `j${l.id}` : '');

function reduce(state: Director, action: Action): Director {
  switch (action.type) {
    case 'reset':
      return EMPTY;
    case 'launch': {
      const stack = { ...state.stack };
      const jar = { ...state.jar };
      for (const [k, v] of Object.entries(action.stack ?? {})) if (!(action.keepHeld && Number(k) in stack)) stack[Number(k)] = v;
      for (const [k, v] of Object.entries(action.jar ?? {})) if (!(action.keepHeld && k in jar)) jar[k] = v;
      const pending = { ...state.pending };
      for (const f of action.flights) {
        const pk = pendingKey(f.land);
        if (pk) pending[pk] = (pending[pk] ?? 0) + 1;
      }
      return { flights: [...state.flights, ...action.flights], stack, jar, pending, lids: { ...state.lids, ...action.lids } };
    }
    case 'land': {
      const f = state.flights.find((x) => x.key === action.key);
      if (!f) return state;
      const flights = state.flights.filter((x) => x.key !== action.key);
      const pk = pendingKey(f.land);
      if (!pk) return { ...state, flights };
      const pending = { ...state.pending, [pk]: Math.max(0, (state.pending[pk] ?? 1) - 1) };
      const stack = { ...state.stack };
      const jar = { ...state.jar };
      if (f.land.kind === 'stack') {
        if (f.land.grow && f.land.index in stack) stack[f.land.index] += 1;
        if (pending[pk] === 0) delete stack[f.land.index];
      } else if (f.land.kind === 'jar') {
        if (f.land.id in jar) jar[f.land.id] += 1;
        if (pending[pk] === 0) delete jar[f.land.id];
      }
      if (pending[pk] === 0) delete pending[pk];
      return { ...state, flights, stack, jar, pending };
    }
    case 'lidDone': {
      const lids = { ...state.lids };
      delete lids[action.id];
      return { ...state, lids };
    }
  }
}

// ---------------------------------------------------------------- geometry helpers

const jarScale = (j: PlotJar) => j.height / JAR_REF_HEIGHT;

/** Where a coin leaves the jar: out of the lid slot, or over the open mouth. */
function jarMouth(j: PlotJar): Vec3 {
  const s = jarScale(j);
  const top = j.lid === 'closed' ? JAR_REF_HEIGHT + LID.h : JAR_REF_HEIGHT;
  return [j.at[0], top * s + 0.05, j.at[2]];
}

/** Centre of the n-th coin (0-based) of a stack standing on `stone`. */
function stackCoinAt(stone: PlotStone, n: number): Vec3 {
  return [stone.at[0], stoneTop(stone.state) + COIN_STACK.h / 2 + n * COIN_STACK.pitch, stone.at[2]];
}

const sameStones = (a: TripPlotSpec, b: TripPlotSpec) => a.layoutKey === b.layoutKey && a.stones.length === b.stones.length;

// ---------------------------------------------------------------- pieces

/** A lid lowering onto its jar (drop easing, 450ms). Lids move, they never fade (§10). */
function FallingLid({ jar, launchKey, onDone }: { jar: PlotJar; launchKey: number; onDone: (id: string) => void }) {
  const { theme, palette, tweens } = useIso();
  const ref = useRef<Group>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const s = jarScale(jar);
  const rest = (JAR_REF_HEIGHT + LID.h / 2) * s;
  const lift = 1.4 * s;
  useLayoutEffect(() => {
    const g = ref.current;
    if (!g) return;
    const id = `lid-${jar.id}-${launchKey}`;
    g.position.y = rest + lift;
    tweens.tween(id, {
      from: rest + lift,
      to: rest,
      duration: 450,
      ease: easings.drop,
      onUpdate: (v) => {
        g.position.y = v;
      },
      onDone: () => done.current(jar.id),
    });
    return () => tweens.cancel(id);
  }, [jar.id, launchKey, rest, lift, tweens]);
  const body = isoGeometry.cylinderGeo(LID.r, LID.r, LID.h, 24);
  const slot = isoGeometry.boxGeo(LID.slot[0], LID.slot[1], LID.slot[2]);
  const offsets = jar.slots === 3 ? [-0.2, 0, 0.2] : [0];
  const c = Math.SQRT1_2;
  return (
    <group ref={ref} position={[jar.at[0], rest + lift, jar.at[2]]} scale={s}>
      <mesh geometry={body} material={faceToneMaterial(palette.lid[jar.lidColor], theme, { curved: true })}>
        <IsoEdges geometry={body} />
      </mesh>
      {offsets.map((o) => (
        <mesh
          key={o}
          geometry={slot}
          material={faceToneMaterial(palette.shade, theme)}
          position={[o * c, LID.h / 2 + 0.004, o * c]}
          rotation={[0, Math.PI / 4, 0]}
        />
      ))}
    </group>
  );
}

/** Draft step 2: freshly laid stones drop in row by row (90ms apart). */
function DroppingStones({ stones, animate }: { stones: PlotStone[]; animate: boolean }) {
  const { tweens } = useIso();
  const rows = useMemo(() => {
    const out: PlotStone[][] = [];
    for (const s of stones) (out[s.row] ??= []).push(s);
    return out.filter(Boolean);
  }, [stones]);
  const refs = useRef<Array<Group | null>>([]);
  // Keyed by layoutKey, so a mount is a new set of stones: drop them once, never again on re-render.
  useLayoutEffect(() => {
    if (!animate) return;
    const groups = refs.current.slice();
    const ids = groups.map((g, r) => {
      const id = `stone-row-${r}`;
      if (!g) return id;
      g.position.y = 1.2;
      tweens.tween(id, {
        from: 1.2,
        to: 0,
        duration: 450,
        delay: r * 90,
        ease: easings.drop,
        onUpdate: (v) => {
          g.position.y = v;
        },
      });
      return id;
    });
    return () => {
      ids.forEach((id) => tweens.cancel(id));
      groups.forEach((g) => g && (g.position.y = 0));
    };
    // mount-only by design (see above)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      {rows.map((row, r) => (
        <group
          key={r}
          ref={(el) => {
            refs.current[r] = el;
          }}
        >
          <DayStones stones={row} />
        </group>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- scene

export default function TripPlotScene({ spec, reducedMotion }: IsoSceneProps<TripPlotSpec>) {
  const { tier } = useIso();
  const capacity = tier === 'lite' ? COIN_PILE.lite.capacity : COIN_PILE.high.capacity;
  const [state, dispatch] = useReducer(reduce, EMPTY);

  const latest = useRef({ spec, state, reducedMotion, capacity });
  latest.current = { spec, state, reducedMotion, capacity };
  const seq = useRef(0);
  const nextKey = () => `f${++seq.current}`;
  const lidSeq = useRef(0);

  // Stage-to-stage diffs (demo and draft): animate what grew since the last spec.
  const prevSpec = useRef<TripPlotSpec | null>(null);
  const firstLayout = useRef<string | null>(null);
  useLayoutEffect(() => {
    const prev = prevSpec.current;
    prevSpec.current = spec;
    if (firstLayout.current === null) firstLayout.current = spec.layoutKey;
    if (!prev) return;
    if (!sameStones(prev, spec)) {
      dispatch({ type: 'reset' });
      return;
    }
    if (reducedMotion || spec.mode === 'live') return;
    const held = latest.current.state;
    const flights: Flight[] = [];
    const stackHolds: Record<number, number> = {};
    const jarHolds: Record<string, number> = {};
    const lids: Record<string, number> = {};
    // Each coin in flight is its own draw call; with several jars on stage, fewer flights keep the scene
    // under 60 calls while they're in the air.
    let budget = spec.jars.length > 1 ? 12 : MAX_ANIMATED_COINS;
    let n = 0;

    // New coins in a jar drop in from above the mouth.
    for (const j of spec.jars) {
      const before = prev.jars.find((x) => x.id === j.id);
      if (!before || j.ghost || before.ghost || before.height !== j.height) continue;
      const shown = held.jar[j.id] ?? balangCoinCount(before.fill, capacity);
      const target = balangCoinCount(j.fill, capacity);
      if (target > shown && budget > 0) {
        const hold = Math.max(shown, target - budget);
        const s = jarScale(j);
        jarHolds[j.id] = hold;
        for (let k = hold; k < target; k++) {
          const a = (k * 2.399) % (Math.PI * 2);
          const r = 0.35 * s;
          const y = coinFillHeight(((k + 1) / capacity) * COIN_PILE.high.capacity, false) * s;
          flights.push({
            key: nextKey(),
            from: [j.at[0] + Math.cos(a) * r * 0.5, (JAR_REF_HEIGHT + 0.9) * s, j.at[2] + Math.sin(a) * r * 0.5],
            to: [j.at[0] + Math.cos(a) * r, Math.max(0.05, y), j.at[2] + Math.sin(a) * r],
            delay: n++ * COIN_STAGGER_MS,
            lift: 0.08,
            tint: (k % 3) as 0 | 1 | 2,
            land: { kind: 'jar', id: j.id },
          });
          budget -= 1;
        }
      }
      if (before.lid !== 'closed' && j.lid === 'closed') lids[j.id] = ++lidSeq.current;
    }

    // New coins on a day's stack fly over from the jar.
    const source = spec.jars.find((j) => !j.ghost);
    if (source) {
      spec.stones.forEach((st, i) => {
        const shown = held.stack[i] ?? prev.stones[i]?.coins ?? 0;
        if (st.coins <= shown || budget <= 0) return;
        const animated = Math.min(st.coins - shown, budget);
        const hold = st.coins - animated;
        stackHolds[i] = hold;
        for (let k = 0; k < animated; k++) {
          flights.push({
            key: nextKey(),
            from: jarMouth(source),
            to: stackCoinAt(st, hold + k),
            delay: n++ * COIN_STAGGER_MS,
            lift: 0.8,
            tint: ((i + k) % 3) as 0 | 1 | 2,
            land: { kind: 'stack', index: i, grow: true },
          });
        }
        budget -= animated;
      });
    }

    // Draft step 5: once the lid is on, one coin goes in through the slot.
    if (spec.mode === 'draft' && Object.keys(lids).length > 0) {
      for (const j of spec.jars) {
        if (!(j.id in lids)) continue;
        const s = jarScale(j);
        flights.push({
          key: nextKey(),
          from: [j.at[0], (JAR_REF_HEIGHT + LID.h + 1.1) * s, j.at[2]],
          to: [j.at[0], (JAR_REF_HEIGHT + LID.h) * s, j.at[2]],
          delay: 450,
          lift: 0.05,
          tint: 1,
          land: { kind: 'none' },
        });
        break;
      }
    }

    if (flights.length || Object.keys(lids).length) {
      dispatch({ type: 'launch', flights, stack: stackHolds, jar: jarHolds, lids });
    }
    // capacity/reducedMotion are read at diff time; only a new spec starts a diff
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec]);

  // Live: one coin per coinOut for this trip, from the jar to that date's stack.
  useEffect(() => {
    if (spec.mode !== 'live' || spec.tripId == null) return;
    const tripId = spec.tripId;
    return appEvents.on((e) => {
      if (e.type !== 'coinOut' || e.tripId !== tripId) return;
      const { spec: s, state: held, reducedMotion: rm } = latest.current;
      if (rm) return;
      const i = stoneIndexForDate(s.stones, e.date);
      const stone = s.stones[i];
      const source = s.jars.find((j) => !j.ghost);
      if (!stone || stone.state === 'future' || !source) return;
      const shown = held.stack[i] ?? stone.coins;
      const inAir = held.pending[`s${i}`] ?? 0;
      dispatch({
        type: 'launch',
        keepHeld: true,
        stack: { [i]: shown },
        flights: [
          {
            key: nextKey(),
            from: jarMouth(source),
            to: stackCoinAt(stone, Math.min(shown + inAir, PLOT_MAX_STACK)),
            delay: 0,
            lift: 0.8,
            tint: (i % 3) as 0 | 1 | 2,
            land: { kind: 'stack', index: i, grow: false },
          },
        ],
      });
    });
  }, [spec.mode, spec.tripId]);

  // A different trip or layout: drop anything in the air.
  useEffect(() => {
    dispatch({ type: 'reset' });
  }, [spec.tripId]);

  const animateRows = spec.mode === 'draft' && !reducedMotion && firstLayout.current !== null && firstLayout.current !== spec.layoutKey;

  return (
    <group>
      <Plinth w={spec.plinth.w} d={spec.plinth.d} position={spec.plinth.at} />

      {spec.jars.map((j) =>
        j.ghost ? (
          <GhostJar key={j.id} height={j.height} position={j.at} />
        ) : (
          <Balang
            key={j.id}
            height={j.height}
            fill={j.fill}
            coins={state.jar[j.id] ?? balangCoinCount(j.fill, capacity)}
            capacity={capacity}
            lid={j.id in state.lids ? 'off' : j.lid}
            lidColor={j.lidColor}
            lidYaw={j.lidYaw}
            slots={j.slots}
            seed={j.seed}
            position={j.at}
          />
        ),
      )}
      {spec.jars.map((j) =>
        j.id in state.lids ? (
          <FallingLid key={`lid-${j.id}`} jar={j} launchKey={state.lids[j.id]} onDone={(id) => dispatch({ type: 'lidDone', id })} />
        ) : null,
      )}

      {spec.mode === 'draft' ? (
        <DroppingStones key={spec.layoutKey} stones={spec.stones} animate={animateRows} />
      ) : (
        <DayStones stones={spec.stones} />
      )}

      <CoinInstances capacity={448}>
        {spec.stones.map((st, i) => {
          const count = state.stack[i] ?? st.coins;
          return count > 0 ? (
            <CoinStack key={st.index} at={[st.at[0], stoneTop(st.state), st.at[2]]} count={count} seed={st.seed} />
          ) : null;
        })}
      </CoinInstances>

      {spec.signpost ? <Signpost position={spec.signpost.at} /> : null}
      {spec.iou ? <IOUSlip position={spec.iou.at} rotY={spec.iou.rotY} /> : null}

      {state.flights.map((f) => (
        <CoinFlight
          key={f.key}
          from={f.from}
          to={f.to}
          launchKey={f.key}
          delay={f.delay}
          lift={f.lift}
          tint={f.tint}
          onLanded={() => dispatch({ type: 'land', key: f.key })}
        />
      ))}
    </group>
  );
}

/** A coin can't land higher than this on a stack while others are still in the air. */
const PLOT_MAX_STACK = 12;
