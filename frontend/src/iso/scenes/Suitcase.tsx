// S4 Suitcase, WebGL (§8). Lazy chunk. The lid swings on its hinge to 100° × (1 − p)^0.6; ticking an item makes
// its box hop from the waiting pile into its slot (350ms arc), unticking hops it back out. Other boxes slide to
// make room when a category in front of them grows.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { BufferGeometry, LineSegments, Mesh } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FabricKey } from '@/design/tokens';
import { appEvents } from '@/lib/appEvents';
import { useIso } from '@/iso/canvas/context';
import { faceToneMaterial, ghostLineMaterial } from '@/iso/material/FaceToneMaterial';
import { PackedItems, Plinth, Suitcase, type PackedItem } from '@/iso/primitives';
import { boxBaseGeo, edgesGeo, packedBoxGeo, passportSlabGeo } from '@/iso/primitives/geometries';
import { PACKED } from '@/iso/shapes';
import type { Vec3 } from '@/iso/specs';
import { arcPoint, easings } from '@/iso/tween';
import type { IsoSceneProps } from '@/iso/types';
import { ghostXZ, GHOST_CAP, type SuitcaseGhost, type SuitcaseSpec } from '@/iso/mappers/suitcase';

const LID_MS = 450;
const HOP_MS = 350;
const SLIDE_MS = 250;
/** A tick's event and its new data arrive a render apart; older events are stale. */
const PENDING_TTL = 2000;

const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Every waiting sketch box in one mesh and one dashed outline (2 draw calls for up to 12 boxes). */
function GhostPile({ ghosts }: { ghosts: SuitcaseGhost[] }) {
  const { theme, palette } = useIso();
  const lines = useRef<LineSegments>(null);
  const key = ghosts.map((g) => `${g.at.join(',')}|${g.size.join(',')}`).join(';');
  const geos = useMemo(() => {
    if (!ghosts.length) return null;
    const faces: BufferGeometry[] = [];
    const edges: BufferGeometry[] = [];
    for (const g of ghosts) {
      const base = boxBaseGeo(g.size[0], g.size[1], g.size[2]);
      faces.push(base.clone().translate(g.at[0], g.at[1], g.at[2]));
      edges.push(edgesGeo(base).clone().translate(g.at[0], g.at[1], g.at[2]));
    }
    const out = { faces: mergeGeometries(faces, false), edges: mergeGeometries(edges, false) };
    faces.forEach((f) => f.dispose());
    edges.forEach((e) => e.dispose());
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` covers positions and sizes
  }, [key]);
  useEffect(
    () => () => {
      geos?.faces?.dispose();
      geos?.edges?.dispose();
    },
    [geos],
  );
  useLayoutEffect(() => {
    lines.current?.computeLineDistances();
  }, [geos]);
  if (!geos?.faces || !geos.edges) return null;
  return (
    <group>
      <mesh geometry={geos.faces} material={faceToneMaterial(palette.leaf, theme)} />
      <lineSegments ref={lines} geometry={geos.edges} material={ghostLineMaterial(theme)} renderOrder={5} />
    </group>
  );
}

interface Hop {
  id: number;
  from: Vec3;
  to: Vec3;
  tone: FabricKey;
  slab: boolean;
  /** Box key hidden until this hop lands. */
  hides: string | null;
}

function HopBox({ hop, onDone }: { hop: Hop; onDone: (hop: Hop) => void }) {
  const { theme, palette, tweens } = useIso();
  const ref = useRef<Mesh>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const geo = hop.slab ? passportSlabGeo() : packedBoxGeo();
  const half = (hop.slab ? PACKED.slab[1] : PACKED.box[1]) / 2;
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const a: Vec3 = [hop.from[0], hop.from[1] + half, hop.from[2]];
    const b: Vec3 = [hop.to[0], hop.to[1] + half, hop.to[2]];
    const id = `suitcase-hop-${hop.id}`;
    mesh.position.set(...a);
    tweens.tween(id, {
      from: 0,
      to: 1,
      duration: HOP_MS,
      ease: easings.out,
      onUpdate: (t) => {
        const p = arcPoint(a, b, 0.55, t);
        mesh.position.set(p[0], p[1], p[2]);
        mesh.rotation.y = (1 - t) * 0.6;
      },
      onDone: () => done.current(hop),
    });
    return () => tweens.cancel(id);
  }, [hop, half, tweens]);
  return <mesh ref={ref} geometry={geo} material={faceToneMaterial(palette.fabric[hop.tone], theme, { curved: !hop.slab })} />;
}

interface PendingTick {
  checked: boolean;
  from: Vec3;
  tone: FabricKey;
  slab: boolean;
  at: number;
}

/** Where an unpacked item waits when the pile is full: the far corner of the pile. */
const PILE_OVERFLOW: Vec3 = [ghostXZ(GHOST_CAP - 1)[0], 0, ghostXZ(GHOST_CAP - 1)[1]];

export default function SuitcaseScene({ spec }: IsoSceneProps<SuitcaseSpec>) {
  const { tweens } = useIso();

  // ---- lid: rotates on its hinge, never fades
  const lidRef = useRef(spec.lidAngle);
  const [lid, setLid] = useState(spec.lidAngle);
  useEffect(() => {
    const from = lidRef.current;
    if (Math.abs(from - spec.lidAngle) < 0.01) return;
    tweens.tween('suitcase-lid', {
      from,
      to: spec.lidAngle,
      duration: LID_MS,
      ease: easings.out,
      onUpdate: (v) => {
        lidRef.current = v;
        setLid(v);
      },
    });
  }, [spec.lidAngle, tweens]);
  useEffect(() => () => tweens.cancel('suitcase-lid'), [tweens]);

  // ---- events → pending ticks, resolved against the next spec
  const specRef = useRef(spec);
  const pending = useRef(new Map<number, PendingTick>());
  useEffect(
    () =>
      appEvents.on((e) => {
        if (e.type !== 'packToggled' || e.tripId !== specRef.current.tripId) return;
        const s = specRef.current;
        if (e.checked) {
          const g = s.ghosts.find((x) => x.itemId === e.itemId);
          pending.current.set(e.itemId, { checked: true, from: g ? g.at : PILE_OVERFLOW, tone: 'linen', slab: false, at: Date.now() });
        } else {
          const b = s.boxes.find((x) => x.itemIds.includes(e.itemId));
          if (b) pending.current.set(e.itemId, { checked: false, from: b.at, tone: b.tone, slab: b.slab, at: Date.now() });
        }
      }),
    [],
  );

  // ---- layout changes: slide moved boxes, hop new ones in and removed ones out
  const shown = useRef(new Map<string, Vec3>());
  const [slide, setSlide] = useState<{ from: Map<string, Vec3>; t: number }>(() => ({ from: new Map(), t: 1 }));
  const [hops, setHops] = useState<Hop[]>([]);
  const hopSeq = useRef(0);

  useEffect(() => {
    const prev = specRef.current;
    specRef.current = spec;
    if (prev === spec) return;
    const now = Date.now();
    const prevKeys = new Set(prev.boxes.map((b) => b.key));
    const next: Hop[] = [];
    pending.current.forEach((tick, itemId) => {
      pending.current.delete(itemId);
      if (now - tick.at > PENDING_TTL) return;
      if (tick.checked) {
        const b = spec.boxes.find((x) => x.itemIds.includes(itemId));
        if (!b) return;
        next.push({ id: ++hopSeq.current, from: tick.from, to: b.at, tone: b.tone, slab: b.slab, hides: prevKeys.has(b.key) ? null : b.key });
      } else {
        const g = spec.ghosts.find((x) => x.itemId === itemId);
        next.push({ id: ++hopSeq.current, from: tick.from, to: g ? g.at : PILE_OVERFLOW, tone: tick.tone, slab: tick.slab, hides: null });
      }
    });
    if (next.length) setHops((h) => [...h, ...next].slice(-8));
    // Slide boxes that kept their key but changed slot.
    const from = new Map(shown.current);
    const moved = spec.boxes.some((b) => {
      const was = from.get(b.key);
      return was && (was[0] !== b.at[0] || was[1] !== b.at[1] || was[2] !== b.at[2]);
    });
    if (moved) {
      setSlide({ from, t: 0 });
      tweens.tween('suitcase-slide', { from: 0, to: 1, duration: SLIDE_MS, ease: easings.out, onUpdate: (t) => setSlide({ from, t }) });
    } else {
      setSlide({ from: new Map(), t: 1 });
    }
  }, [spec, tweens]);
  useEffect(() => () => tweens.cancel('suitcase-slide'), [tweens]);

  const landed = useCallback((hop: Hop) => setHops((h) => h.filter((x) => x.id !== hop.id)), []);

  const hidden = useMemo(() => new Set(hops.map((h) => h.hides).filter((k): k is string => !!k)), [hops]);
  const items: PackedItem[] = [];
  const positions = new Map<string, Vec3>();
  for (const b of spec.boxes) {
    const start = slide.from.get(b.key) ?? b.at;
    const at = slide.t >= 1 ? b.at : lerp3(start, b.at, slide.t);
    positions.set(b.key, at);
    if (!hidden.has(b.key)) items.push({ at, tone: b.tone, rotY: b.rotY });
  }
  shown.current = positions;

  const { plinth } = spec;
  return (
    <group>
      <Plinth w={plinth.w} d={plinth.d} position={plinth.at} />
      <Suitcase lidAngle={lid} buckled={spec.done && lid < 0.5} position={spec.case.at} />
      <PackedItems items={items} />
      <GhostPile ghosts={spec.ghosts} />
      {hops.map((h) => (
        <HopBox key={h.id} hop={h} onDone={landed} />
      ))}
    </group>
  );
}
