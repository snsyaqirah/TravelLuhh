// S3 Counter, WebGL (§8). Lazy chunk. The jar and the category blocks share one baseline; blocks spring to
// new heights (~400ms) and a coin arcs from the jar to its block when a spend lands (coinOut) or back (coinBack).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Matrix4, Shape, ShapeGeometry, Vector2, type Group, type InstancedMesh, type Mesh } from 'three';
import { appEvents, type AppEvent } from '@/lib/appEvents';
import { useIso } from '@/iso/canvas/context';
import { rectFootprint, shadowHull } from '@/iso/geometry2d';
import { faceToneMaterial, flatMaterial } from '@/iso/material/FaceToneMaterial';
import { cached } from '@/iso/material/cache';
import { Balang, CategoryProp, CoinFlight, GhostBox, IsoEdges, Plinth, SHADOW_Y } from '@/iso/primitives';
import { boxBaseGeo, boxGeo, PROP_HEIGHT } from '@/iso/primitives/geometries';
import { BLOCK, LAYER } from '@/iso/shapes';
import type { Vec3 } from '@/iso/specs';
import type { IsoSceneProps } from '@/iso/types';
import {
  ZIGZAG,
  budgetDashBoxes,
  zigzagBand,
  type CounterBlockSpec,
  type CounterSpec,
} from '@/iso/mappers/counter';

const SPRING_SMOOTH = 0.1; // maath smoothTime: settles in about 400ms

/** Paper break band for a clamped block, one per visible side face (+Z left, +X right). */
function zigzagGeo() {
  return cached(`geo:counter-zigzag|${BLOCK.w}`, () => {
    const shape = new Shape(zigzagBand(BLOCK.w).map(([u, v]) => new Vector2(u, v)));
    return new ShapeGeometry(shape);
  });
}

function ZigzagCap() {
  const { theme, palette } = useIso();
  const geo = zigzagGeo();
  const mat = faceToneMaterial(palette.leaf, theme);
  const off = 0.006;
  return (
    <>
      <mesh geometry={geo} material={mat} position={[0, 0, BLOCK.d / 2 + off]} />
      <mesh geometry={geo} material={mat} position={[BLOCK.w / 2 + off, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
    </>
  );
}

function CounterBlock({ block, grow }: { block: CounterBlockSpec; grow: boolean }) {
  const { theme, palette, tweens } = useIso();
  const root = useRef<Group>(null);
  const body = useRef<Mesh>(null);
  const top = useRef<Group>(null);
  const cap = useRef<Group>(null);
  // A block that appears mid-session (first spend in a category) grows from the floor; on mount it doesn't.
  const h = useRef({ v: grow ? BLOCK.minH : block.height });
  // When a new category slots in ahead of it, a block slides along the row to make room.
  const x = useRef({ v: block.at[0] });
  const id = `counter-block-${block.category}`;
  const geo = boxBaseGeo(BLOCK.w, 1, BLOCK.d);

  const apply = useCallback((v: number) => {
    body.current?.scale.set(1, v, 1);
    top.current?.position.set(0, v, 0);
    cap.current?.position.set(0, v - ZIGZAG.capH, 0);
  }, []);

  useLayoutEffect(() => {
    apply(h.current.v);
    tweens.spring(id, { target: h.current, key: 'v', to: block.height, smoothTime: SPRING_SMOOTH, onUpdate: apply });
  }, [block.height, id, tweens, apply]);

  const targetX = block.at[0];
  useLayoutEffect(() => {
    tweens.spring(`${id}-x`, {
      target: x.current,
      key: 'v',
      to: targetX,
      smoothTime: SPRING_SMOOTH,
      onUpdate: (v) => root.current?.position.setX(v),
    });
  }, [targetX, id, tweens]);

  useEffect(
    () => () => {
      tweens.cancel(id);
      tweens.cancel(`${id}-x`);
    },
    [id, tweens],
  );

  return (
    <group ref={root} position={[x.current.v, block.at[1], block.at[2]]}>
      <mesh ref={body} geometry={geo} material={faceToneMaterial(palette.category[block.category], theme)} scale={[1, h.current.v, 1]}>
        <IsoEdges geometry={geo} />
      </mesh>
      {block.clamped ? (
        <group ref={cap} position={[0, h.current.v - ZIGZAG.capH, 0]}>
          <ZigzagCap />
        </group>
      ) : null}
      <group ref={top} position={[0, h.current.v, 0]}>
        <CategoryProp category={block.category} />
      </group>
    </group>
  );
}

/** Every block's hard shadow in one mesh (one draw call instead of seven). */
function RowShadows({ blocks }: { blocks: CounterBlockSpec[] }) {
  const { palette } = useIso();
  const key = blocks.map((b) => `${b.at[0]},${b.at[2]},${b.height.toFixed(3)},${b.category}`).join(';');
  const geometry = useMemo(() => {
    const shapes = blocks.map((b) => {
      const hull = shadowHull(rectFootprint(BLOCK.w, BLOCK.d, b.at[0], b.at[2]), b.height + PROP_HEIGHT[b.category]);
      return new Shape(hull.map(([x, z]) => new Vector2(x, -z)));
    });
    return shapes.length ? new ShapeGeometry(shapes) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures everything the hulls use
  }, [key]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return (
    <mesh
      geometry={geometry}
      material={flatMaterial(palette.shadow, { polygonOffset: -1, depthWrite: false })}
      renderOrder={LAYER.shadow}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, SHADOW_Y, 0]}
    />
  );
}

const mtx = new Matrix4();

/** The dashed budget line (and its end posts) as thin instanced boxes, so it stays ≥ 1 CSS px on phones. */
function BudgetLine({ line }: { line: NonNullable<CounterSpec['budgetLine']> }) {
  const { theme, palette } = useIso();
  const ref = useRef<InstancedMesh>(null);
  const boxes = useMemo(() => budgetDashBoxes(line), [line]);
  const mat = faceToneMaterial(line.tone === 'over' ? palette.over : palette.ink3, theme);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    boxes.forEach((b, i) => {
      mtx.makeScale(b.size[0], b.size[1], b.size[2]).setPosition(b.center[0], b.center[1], b.center[2]);
      mesh.setMatrixAt(i, mtx);
    });
    mesh.count = boxes.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [boxes, mat]);
  return <instancedMesh ref={ref} args={[boxGeo(1, 1, 1), mat, boxes.length]} frustumCulled={false} />;
}

interface Flight {
  key: number;
  from: Vec3;
  to: Vec3;
}

type MoneyEvent = Extract<AppEvent, { type: 'coinOut' | 'coinBack' }>;

/** Coins in the air for live spends. Events arrive just before the new spec, so they wait for it. */
function useCoinFlights(spec: CounterSpec) {
  const [flights, setFlights] = useState<Flight[]>([]);
  const specRef = useRef(spec);
  specRef.current = spec;
  const pending = useRef<MoneyEvent[]>([]);
  const seq = useRef(0);
  const timer = useRef<number | null>(null);

  const flush = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const s = specRef.current;
    const next: Flight[] = [];
    for (const e of pending.current.splice(0)) {
      const block = s.blocks.find((b) => b.category === e.category);
      if (!block) continue;
      // Land on the block's top, front-left of its prop, where the coin stays visible.
      const top: Vec3 = [block.at[0] - 0.22, block.height + 0.03, block.at[2] + 0.22];
      next.push(e.type === 'coinOut' ? { key: ++seq.current, from: s.jar.mouth, to: top } : { key: ++seq.current, from: top, to: s.jar.mouth });
    }
    if (next.length) setFlights((f) => [...f, ...next].slice(-6));
  }, []);

  useEffect(
    () =>
      appEvents.on((e) => {
        if ((e.type !== 'coinOut' && e.type !== 'coinBack') || e.tripId !== specRef.current.tripId) return;
        pending.current.push(e);
        if (timer.current === null) timer.current = window.setTimeout(flush, 400);
      }),
    [flush],
  );

  // New data (the spend's block) usually lands a render after the event.
  useEffect(() => {
    if (pending.current.length) flush();
  }, [spec, flush]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const landed = useCallback((key: number) => setFlights((f) => f.filter((x) => x.key !== key)), []);
  return { flights, landed };
}

export default function CounterScene({ spec }: IsoSceneProps<CounterSpec>) {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  const { flights, landed } = useCoinFlights(spec);
  const { plinth, jar } = spec;

  return (
    <group>
      <Plinth w={plinth.w} d={plinth.d} variant="ledger" position={plinth.at} />
      <RowShadows blocks={spec.blocks} />
      <Balang
        height={jar.height}
        fill={jar.fill}
        lid={jar.lid}
        lidColor={jar.lidColor}
        seed={`counter-${spec.tripId}`}
        position={jar.at}
      />
      {spec.ghostBlock ? <GhostBox size={spec.ghostBlock.size} position={spec.ghostBlock.at} /> : null}
      {spec.blocks.map((b) => (
        <CounterBlock key={b.category} block={b} grow={mounted.current} />
      ))}
      {spec.budgetLine ? <BudgetLine line={spec.budgetLine} /> : null}
      {flights.map((f) => (
        <CoinFlight key={f.key} from={f.from} to={f.to} launchKey={f.key} lift={0.9} onLanded={() => landed(f.key)} />
      ))}
    </group>
  );
}
