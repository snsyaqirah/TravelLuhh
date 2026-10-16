// S5 Kampung, WebGL (§8). Lazy chunk. A village can hold dozens of houses and a jar per year, so instead of one
// KampungHouse / Balang per trip (6–11 draw calls each) every part type is merged into one mesh: houses, jars,
// roads and shadows come to about 25 draw calls at any size. Same geometry builders and materials as the
// primitives, so it looks identical. Static: rebuilt only when the spec changes. Panning is IsoStage's job.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Matrix4, Quaternion, Shape, ShapeGeometry, Vector2, Vector3, type BufferGeometry, type InstancedMesh } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useIso } from '@/iso/canvas/context';
import { circleFootprint, rectFootprint, shadowHull } from '@/iso/geometry2d';
import { edgeMaterial, faceToneMaterial, flatMaterial, glassMaterials } from '@/iso/material/FaceToneMaterial';
import { Ghost, Plinth, SHADOW_Y } from '@/iso/primitives';
import {
  boxGeo,
  cylinderGeo,
  edgesGeo,
  flagGeo,
  houseGeos,
  jarGeo,
  jarSilhouetteGeo,
  jarTicksGeo,
  roadGeo,
} from '@/iso/primitives/geometries';
import {
  COIN_PILE,
  HOUSE,
  JAR_MAX_R,
  JAR_REF_HEIGHT,
  LAYER,
  LID,
  PENNANT,
  ROAD,
  balangCoinCount,
  coinPileLayout,
  roadDashCount,
} from '@/iso/shapes';
import type { IsoSceneProps } from '@/iso/types';
import type { KampungHouseSpec, KampungJarSpec, KampungSpec } from '@/iso/mappers/kampung';

/** Year jars always use the lite pile (60 bigger coins): small jars, and it keeps several jars under 30k triangles. */
const PILE = COIN_PILE.lite;
const FLAG_POLE = 0.45;

type Parts = Record<string, BufferGeometry[]>;

function push(parts: Parts, key: string, g: BufferGeometry, m: Matrix4) {
  (parts[key] ??= []).push(g.clone().applyMatrix4(m));
}

/** Merge each part list into one geometry and free the clones. */
function mergeParts(parts: Parts): Record<string, BufferGeometry> {
  const out: Record<string, BufferGeometry> = {};
  for (const [key, list] of Object.entries(parts)) {
    const merged = list.length ? mergeGeometries(list, false) : null;
    list.forEach((g) => g.dispose());
    if (merged) out[key] = merged;
  }
  return out;
}

function useDisposeAll(geos: Record<string, BufferGeometry>) {
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos]);
}

const T = new Matrix4();
const S = new Matrix4();

function houseParts(houses: KampungHouseSpec[]) {
  const parts: Parts = {};
  for (const h of houses) {
    const g = houseGeos(h.footprint, h.floors);
    const m = T.clone().makeTranslation(h.at[0], h.at[1], h.at[2]);
    push(parts, 'stilts', g.stilts, m);
    push(parts, 'body', g.body, m);
    push(parts, h.roof === 'over' ? 'roofOver' : 'roofUnder', g.roof, m);
    push(parts, 'door', g.door, m);
    push(parts, 'edges', g.edges, m);
    if (h.firstVisit) {
      // Same pennant as KampungHouse: on the ridge's +X end.
      const px = h.at[0] + h.footprint / 2 - 0.05;
      const py = h.at[1] + g.height - 0.02;
      push(parts, 'pole', cylinderGeo(PENNANT.poleR, PENNANT.poleR, FLAG_POLE, 6), T.clone().makeTranslation(px, py + FLAG_POLE / 2, h.at[2]));
      push(parts, 'flag', flagGeo(PENNANT.flagW, PENNANT.flagH), T.clone().makeTranslation(px + PENNANT.poleR, py + FLAG_POLE - PENNANT.flagH - 0.01, h.at[2]));
    }
  }
  return mergeParts(parts);
}

const jarMatrix = (j: KampungJarSpec) => {
  const s = j.height / JAR_REF_HEIGHT;
  return T.clone().makeTranslation(j.at[0], j.at[1], j.at[2]).multiply(S.clone().makeScale(s, s, s));
};

function jarParts(jars: KampungJarSpec[]) {
  const parts: Parts = {};
  const lid = cylinderGeo(LID.r, LID.r, LID.h, 24);
  const slot = boxGeo(LID.slot[0], LID.slot[1], LID.slot[2]);
  const lidAt = new Matrix4().makeTranslation(0, JAR_REF_HEIGHT + LID.h / 2, 0);
  const slotAt = new Matrix4().makeTranslation(0, JAR_REF_HEIGHT + LID.h + 0.004, 0).multiply(new Matrix4().makeRotationY(Math.PI / 4));
  for (const j of jars) {
    const m = jarMatrix(j);
    push(parts, 'glass', jarGeo(), m);
    push(parts, 'outline', jarSilhouetteGeo(), m);
    push(parts, 'ticks', jarTicksGeo(), m);
    push(parts, 'lid', lid, m.clone().multiply(lidAt));
    push(parts, 'lidEdges', edgesGeo(lid), m.clone().multiply(lidAt));
    push(parts, 'slot', slot, m.clone().multiply(slotAt));
  }
  return mergeParts(parts);
}

function roadParts(roads: KampungSpec['roads']) {
  const parts: Parts = {};
  const dash = boxGeo(...ROAD.dash);
  for (const r of roads) {
    push(parts, 'road', roadGeo(r.length), T.clone().makeTranslation(r.at[0], r.at[1], r.at[2]));
    const n = roadDashCount(r.length);
    const start = r.at[0] - ((n - 1) * ROAD.dashPitch) / 2;
    for (let i = 0; i < n; i++) push(parts, 'dash', dash, T.clone().makeTranslation(start + i * ROAD.dashPitch, ROAD.h + ROAD.dash[1] / 2, r.at[2]));
  }
  return mergeParts(parts);
}

function shadowGeometry(spec: KampungSpec): ShapeGeometry | null {
  const shape = (hull: Array<[number, number]>) => new Shape(hull.map(([x, z]) => new Vector2(x, -z)));
  const shapes = [
    ...spec.houses.map((h) => {
      const hgt = HOUSE.stiltH + HOUSE.floorH * h.floors + HOUSE.roofH;
      return shape(shadowHull(rectFootprint(h.footprint, h.footprint, h.at[0], h.at[2]), hgt));
    }),
    ...spec.jars.map((j) => {
      const s = j.height / JAR_REF_HEIGHT;
      return shape(shadowHull(circleFootprint(JAR_MAX_R * s, 16, j.at[0], j.at[2]), (JAR_REF_HEIGHT + LID.h) * s));
    }),
  ];
  return shapes.length ? new ShapeGeometry(shapes) : null;
}

const pose = new Matrix4();
const q = new Quaternion();
const v = new Vector3();
const axis = new Vector3();
const one = new Vector3(1, 1, 1);

/** All year jars' coins: one InstancedMesh per tint for the whole village. */
function Coins({ jars }: { jars: KampungJarSpec[] }) {
  const { theme, palette } = useIso();
  const refs = [useRef<InstancedMesh>(null), useRef<InstancedMesh>(null), useRef<InstancedMesh>(null)];
  const geo = cylinderGeo(PILE.r, PILE.r, PILE.h, PILE.segments);
  const mats = palette.coins.map((hex) => faceToneMaterial(hex, theme, { curved: true }));
  const coins = useMemo(
    () =>
      jars.flatMap((j) => {
        const m = jarMatrix(j);
        return coinPileLayout(balangCoinCount(j.fill, PILE.capacity), `kampung-${j.year}`, true).map((c) => {
          axis.set(c.axis[0], c.axis[1], c.axis[2]);
          q.setFromAxisAngle(axis, c.angle);
          v.set(c.position[0], c.position[1], c.position[2]);
          return { tint: c.tint, matrix: m.clone().multiply(pose.compose(v, q, one)) };
        });
      }),
    [jars],
  );
  const capacity = Math.max(1, coins.length);
  useLayoutEffect(() => {
    refs.forEach((ref, tint) => {
      const mesh = ref.current;
      if (!mesh) return;
      let i = 0;
      for (const c of coins) if (c.tint === tint) mesh.setMatrixAt(i++, c.matrix);
      mesh.count = i;
      mesh.instanceMatrix.needsUpdate = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are stable
  }, [coins, mats[0], mats[1], mats[2]]);
  return (
    <>
      {refs.map((ref, tint) => (
        <instancedMesh key={`${tint}-${capacity}`} ref={ref} args={[geo, mats[tint], capacity]} renderOrder={1} frustumCulled={false} />
      ))}
    </>
  );
}

function Village({ spec }: { spec: KampungSpec }) {
  const { theme, tier, palette } = useIso();
  const edges = tier !== 'lite';
  const houses = useMemo(() => houseParts(spec.houses), [spec.houses]);
  const jars = useMemo(() => jarParts(spec.jars), [spec.jars]);
  const roads = useMemo(() => roadParts(spec.roads), [spec.roads]);
  const shadows = useMemo(() => shadowGeometry(spec), [spec]);
  useDisposeAll(houses);
  useDisposeAll(jars);
  useDisposeAll(roads);
  useEffect(() => () => shadows?.dispose(), [shadows]);
  const glass = glassMaterials(theme);
  const face = (hex: string, curved = false) => faceToneMaterial(hex, theme, { curved });
  return (
    <group>
      {roads.road ? <mesh geometry={roads.road} material={face(palette.ruleStrong)} renderOrder={LAYER.ground} /> : null}
      {roads.dash ? <mesh geometry={roads.dash} material={face(palette.leaf)} renderOrder={LAYER.ground} /> : null}
      {shadows ? (
        <mesh
          geometry={shadows}
          material={flatMaterial(palette.shadow, { polygonOffset: -1, depthWrite: false })}
          renderOrder={LAYER.shadow}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, SHADOW_Y, 0]}
        />
      ) : null}
      {houses.stilts ? <mesh geometry={houses.stilts} material={face(palette.house.stilts, true)} /> : null}
      {houses.body ? <mesh geometry={houses.body} material={face(palette.house.body)} /> : null}
      {houses.roofUnder ? <mesh geometry={houses.roofUnder} material={face(palette.roof.under)} /> : null}
      {houses.roofOver ? <mesh geometry={houses.roofOver} material={face(palette.roof.over)} /> : null}
      {houses.door ? <mesh geometry={houses.door} material={face(palette.house.door)} /> : null}
      {edges && houses.edges ? <lineSegments geometry={houses.edges} material={edgeMaterial(theme)} renderOrder={5} /> : null}
      {houses.pole ? <mesh geometry={houses.pole} material={face(palette.ink2, true)} /> : null}
      {houses.flag ? <mesh geometry={houses.flag} material={face(palette.brass)} /> : null}
      <Coins jars={spec.jars} />
      {jars.ticks ? <mesh geometry={jars.ticks} material={face(palette.ink3)} /> : null}
      {jars.glass ? <mesh geometry={jars.glass} material={glass.back} renderOrder={2} /> : null}
      {jars.glass ? <mesh geometry={jars.glass} material={glass.front} renderOrder={3} /> : null}
      {jars.outline ? <lineSegments geometry={jars.outline} material={glass.line} renderOrder={4} /> : null}
      {jars.lid ? <mesh geometry={jars.lid} material={face(palette.lid.lidHome, true)} /> : null}
      {edges && jars.lidEdges ? <lineSegments geometry={jars.lidEdges} material={edgeMaterial(theme)} renderOrder={5} /> : null}
      {jars.slot ? <mesh geometry={jars.slot} material={face(palette.shade)} /> : null}
    </group>
  );
}

/** Empty kampung: one sketch house standing on the ground (no stilts). */
function GhostHouse({ at, footprint }: { at: [number, number, number]; footprint: number }) {
  const g = houseGeos(footprint, 1);
  const p: [number, number, number] = [at[0], at[1] - HOUSE.stiltH, at[2]];
  return (
    <>
      <Ghost of={g.body} position={p} />
      <Ghost of={g.roof} position={p} />
    </>
  );
}

export default function KampungScene({ spec }: IsoSceneProps<KampungSpec>) {
  const { plinth } = spec;
  return (
    <group>
      <Plinth w={plinth.w} d={plinth.d} position={plinth.at} />
      <Village spec={spec} />
      {spec.ghost ? <GhostHouse at={spec.ghost.at} footprint={spec.ghost.footprint} /> : null}
    </group>
  );
}
