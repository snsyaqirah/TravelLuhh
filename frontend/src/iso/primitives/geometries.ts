// Cached procedural geometry for the primitive library. Every builder is keyed, built once, shared by all
// canvases and freed with the rest of the iso cache. Base-anchored variants have their base on y = 0.
import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  EdgesGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  LatheGeometry,
  Matrix4,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  TorusGeometry,
  Vector2,
} from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CategoryKey } from '@/design/tokens';
import { cached } from '@/iso/material/cache';
import {
  BLOCK,
  HOUSE,
  JAR_BASE_R,
  JAR_INTERIOR,
  JAR_MOUTH_R,
  JAR_PROFILE,
  JAR_REF_HEIGHT,
  PACKED,
  SHELF,
  SIGNPOST,
  SUITCASE,
  TICK_FRACTIONS,
  jarRadiusAt,
  shelfLength,
} from '@/iso/shapes';

const r2 = (v: number) => Math.round(v * 1000) / 1000;
const k = (...parts: Array<string | number>) => parts.map((p) => (typeof p === 'number' ? r2(p) : p)).join('|');

const translate = (g: BufferGeometry, x: number, y: number, z: number) => g.applyMatrix4(new Matrix4().makeTranslation(x, y, z));

/** Merge parts and drop attributes not every part has (ExtrudeGeometry adds groups/uv variants). */
function merge(parts: BufferGeometry[]): BufferGeometry {
  const clean = parts.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(n.attributes)) if (name !== 'position' && name !== 'normal') n.deleteAttribute(name);
    n.clearGroups();
    return n;
  });
  const merged = mergeGeometries(clean, false);
  if (!merged) throw new Error('iso: mergeGeometries failed');
  return merged;
}

export function boxGeo(w: number, h: number, d: number): BufferGeometry {
  return cached(k('geo:box', w, h, d), () => new BoxGeometry(w, h, d));
}

/** Box with its base on y = 0. */
export function boxBaseGeo(w: number, h: number, d: number): BufferGeometry {
  return cached(k('geo:boxbase', w, h, d), () => translate(new BoxGeometry(w, h, d), 0, h / 2, 0));
}

export function cylinderGeo(rTop: number, rBottom: number, h: number, segments: number): BufferGeometry {
  return cached(k('geo:cyl', rTop, rBottom, h, segments), () => new CylinderGeometry(rTop, rBottom, h, segments));
}

/** EdgesGeometry (default 20°, §7.4) for any cached geometry. */
export function edgesGeo(source: BufferGeometry, threshold = 20): BufferGeometry {
  return cached(k('geo:edges', source.uuid, threshold), () => new EdgesGeometry(source, threshold));
}

// ---------- Plinth ----------
/** Plane for the ledger texture; UVs scaled so one texture repeat = 4 world units whatever the size. */
export function ledgerPlaneGeo(w: number, d: number): BufferGeometry {
  return cached(k('geo:ledger', w, d), () => {
    const g = new PlaneGeometry(w, d);
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / 4, (uv.getY(i) * d) / 4);
    return g;
  });
}

// ---------- Balang ----------
export function jarGeo(): BufferGeometry {
  return cached('geo:jar', () => new LatheGeometry(JAR_PROFILE.map(([r, y]) => new Vector2(r, y)), 24));
}

function ringPoints(r: number, y: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    out.push(Math.cos(a0) * r, y, Math.sin(a0) * r, Math.cos(a1) * r, y, Math.sin(a1) * r);
  }
  return out;
}

/**
 * Jar silhouette as line segments (§7.4): the profile swept at ±the screen-right azimuth, plus a ring at
 * the mouth and one at the base. That is what makes it read as a drawn glass jar.
 */
export function jarSilhouetteGeo(): BufferGeometry {
  return cached('geo:jar-sil', () => {
    const pts: number[] = [];
    const c = Math.SQRT1_2;
    for (const s of [1, -1]) {
      for (let i = 1; i < JAR_PROFILE.length - 1; i++) {
        const [ra, ya] = JAR_PROFILE[i];
        const [rb, yb] = JAR_PROFILE[i + 1];
        pts.push(s * ra * c, ya, -s * ra * c, s * rb * c, yb, -s * rb * c);
      }
    }
    pts.push(...ringPoints(JAR_MOUTH_R, JAR_REF_HEIGHT, 32), ...ringPoints(JAR_BASE_R, 0, 32));
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pts, 3));
    return g;
  });
}

/** Three tick marks on the jar's back wall at 25/50/75% of the interior height. */
export function jarTicksGeo(): BufferGeometry {
  return cached('geo:jar-ticks', () => {
    const interior = JAR_REF_HEIGHT * JAR_INTERIOR;
    const parts = TICK_FRACTIONS.map((f) => {
      const y = f * interior;
      const r = jarRadiusAt(y) - 0.03;
      const g = new BoxGeometry(0.12, 0.012, 0.012);
      g.applyMatrix4(new Matrix4().makeRotationY(Math.PI / 4));
      return translate(g, -r * Math.SQRT1_2, y, -r * Math.SQRT1_2);
    });
    return merge(parts);
  });
}

// ---------- Rounded box (same construction as drei's RoundedBox; we need the geometry to instance it) ----------
export function roundedBoxGeo(w: number, h: number, d: number, radius: number, smoothness = 2): BufferGeometry {
  return cached(k('geo:rbox', w, h, d, radius, smoothness), () => {
    const eps = 0.00001;
    const r = radius - eps;
    const shape = new Shape();
    shape.absarc(eps, eps, eps, -Math.PI / 2, -Math.PI, true);
    shape.absarc(eps, h - r * 2, eps, Math.PI, Math.PI / 2, true);
    shape.absarc(w - r * 2, h - r * 2, eps, Math.PI / 2, 0, true);
    shape.absarc(w - r * 2, eps, eps, 0, -Math.PI / 2, true);
    const g = new ExtrudeGeometry(shape, {
      depth: d - radius * 2,
      bevelEnabled: true,
      bevelSegments: smoothness * 2,
      steps: 1,
      bevelSize: radius - eps,
      bevelThickness: radius,
      curveSegments: smoothness,
    });
    g.center();
    return toCreasedNormals(g, 0.4);
  });
}

export function packedBoxGeo(): BufferGeometry {
  const [w, h, d] = PACKED.box;
  return roundedBoxGeo(w, h, d, PACKED.radius, 2);
}

export function passportSlabGeo(): BufferGeometry {
  const [w, h, d] = PACKED.slab;
  return boxGeo(w, h, d);
}

// ---------- Gable (roofs) ----------
/** Triangular prism: width along X, height `h`, ridge running along Z for `depth`. Base on y = 0. */
export function gableGeo(width: number, h: number, depth: number): BufferGeometry {
  return cached(k('geo:gable', width, h, depth), () => {
    const s = new Shape();
    s.moveTo(-width / 2, 0);
    s.lineTo(width / 2, 0);
    s.lineTo(0, h);
    s.closePath();
    const g = new ExtrudeGeometry(s, { depth, bevelEnabled: false, steps: 1 });
    return translate(g, 0, 0, -depth / 2);
  });
}

// ---------- Signpost ----------
/** Arrow board pointing +X, extruded along Z (centred). Origin at the post. */
export function arrowBoardGeo(): BufferGeometry {
  return cached('geo:arrow', () => {
    const L = SIGNPOST.boardLen;
    const H = SIGNPOST.boardH;
    const s = new Shape();
    s.moveTo(-0.06, -H / 2);
    s.lineTo(L - 0.1, -H / 2);
    s.lineTo(L, 0);
    s.lineTo(L - 0.1, H / 2);
    s.lineTo(-0.06, H / 2);
    s.closePath();
    const g = new ExtrudeGeometry(s, { depth: SIGNPOST.depth, bevelEnabled: false });
    return translate(g, 0, 0, -SIGNPOST.depth / 2);
  });
}

// ---------- Category props (merged per material at first use) ----------
export interface PropParts {
  /** Parts in the category colour */
  main?: BufferGeometry;
  /** Parts in leaf (paper) */
  paper?: BufferGeometry;
  /** Parts in shade (gaps, handles) */
  shade?: BufferGeometry;
  /** Parts in soil (wood) */
  wood?: BufferGeometry;
  /** Curved parts that snap to cut-paper tones */
  curved?: boolean;
  /** Pennant (activities) is drawn by the Pennant primitive. */
  pennant?: boolean;
}

function halfTorus(r: number, tube: number): BufferGeometry {
  return new TorusGeometry(r, tube, 6, 12, Math.PI);
}

export function categoryPropGeo(category: CategoryKey): PropParts {
  const key = `geo:prop|${category}`;
  const get = (part: string, build: () => BufferGeometry) => cached(`${key}|${part}`, build);
  switch (category) {
    case 'accommodation':
      return { main: gableGeo(0.9, 0.35, 0.9) };
    case 'transportation':
      return {
        paper: get('paper', () =>
          merge([
            translate(new BoxGeometry(0.6, 0.14, 0.14), 0, 0.1, 0),
            translate(new BoxGeometry(0.12, 0.03, 0.6), 0.02, 0.11, 0),
            translate(new BoxGeometry(0.1, 0.14, 0.03), -0.25, 0.2, 0),
          ]),
        ),
      };
    case 'activities':
      return { pennant: true };
    case 'bundle':
      return {
        main: get('main', () => translate(new BoxGeometry(0.5, 0.3, 0.5), 0, 0.15, 0)),
        paper: get('paper', () =>
          merge([
            translate(new BoxGeometry(0.52, 0.31, 0.06), 0, 0.155, 0),
            translate(new BoxGeometry(0.06, 0.31, 0.52), 0, 0.155, 0),
          ]),
        ),
      };
    case 'food':
      return {
        curved: true,
        paper: get('paper', () => {
          const handle = halfTorus(0.07, 0.02);
          handle.applyMatrix4(new Matrix4().makeRotationZ(-Math.PI / 2));
          return merge([
            translate(new CylinderGeometry(0.22, 0.22, 0.03, 20), 0, 0.015, 0),
            translate(new CylinderGeometry(0.14, 0.12, 0.18, 18), 0, 0.12, 0),
            translate(handle, 0.14, 0.12, 0),
          ]);
        }),
      };
    case 'shopping':
      return {
        paper: get('paper', () => translate(new BoxGeometry(0.36, 0.4, 0.2), 0, 0.2, 0)),
        shade: get('shade', () => translate(halfTorus(0.1, 0.015), 0, 0.4, 0)),
      };
    case 'other':
    default:
      return {
        wood: get('wood', () => translate(new BoxGeometry(0.5, 0.4, 0.5), 0, 0.2, 0)),
        shade: get('shade', () => {
          const parts: BufferGeometry[] = [];
          for (const y of [0.4 / 3, 0.8 / 3]) {
            parts.push(translate(new BoxGeometry(0.012, 0.012, 0.5), 0.251, y, 0)); // +X face
            parts.push(translate(new BoxGeometry(0.5, 0.012, 0.012), 0, y, 0.251)); // +Z face
          }
          for (const x of [-0.5 / 6, 0.5 / 6]) parts.push(translate(new BoxGeometry(0.012, 0.012, 0.5), x, 0.401, 0)); // top
          return merge(parts);
        }),
      };
  }
}

/** Height a category prop adds above its block (for shadows and label placement). */
export const PROP_HEIGHT: Record<CategoryKey, number> = {
  accommodation: 0.35,
  transportation: 0.27,
  activities: 0.6,
  bundle: 0.31,
  food: 0.21,
  shopping: 0.5,
  other: 0.4,
};

export const BLOCK_SIZE = BLOCK;

// ---------- Suitcase ----------
/** Open-topped shell (base slab + 4 walls), base on y = 0, centred in x/z. */
export function suitcaseShellGeo(): BufferGeometry {
  return cached('geo:case-shell', () => {
    const { w, d, baseH, wall, wallH } = SUITCASE;
    return merge([
      translate(new BoxGeometry(w, baseH, d), 0, baseH / 2, 0),
      translate(new BoxGeometry(w, wallH, wall), 0, wallH / 2, -d / 2 + wall / 2),
      translate(new BoxGeometry(w, wallH, wall), 0, wallH / 2, d / 2 - wall / 2),
      translate(new BoxGeometry(wall, wallH, d - 2 * wall), -w / 2 + wall / 2, wallH / 2, 0),
      translate(new BoxGeometry(wall, wallH, d - 2 * wall), w / 2 - wall / 2, wallH / 2, 0),
    ]);
  });
}

/** Four brass corner caps on the bottom corners of a shell. */
export function suitcaseCornersGeo(): BufferGeometry {
  return cached('geo:case-corners', () => {
    const { w, d, corner } = SUITCASE;
    const c = corner / 2 - 0.01;
    return merge(
      [
        [-w / 2 + c, -d / 2 + c],
        [w / 2 - c, -d / 2 + c],
        [w / 2 - c, d / 2 - c],
        [-w / 2 + c, d / 2 - c],
      ].map(([x, z]) => translate(new BoxGeometry(corner, corner, corner), x, corner / 2 - 0.005, z)),
    );
  });
}

export function suitcaseHandleGeo(): BufferGeometry {
  return cached('geo:case-handle', () => {
    const g = halfTorus(0.2, 0.03);
    g.applyMatrix4(new Matrix4().makeRotationX(Math.PI / 2)); // arc in the ground plane, bulging toward +Z
    return translate(g, 0, 0.3, SUITCASE.d / 2);
  });
}

// ---------- Shelf ----------
export function shelfGeo(slots: number): BufferGeometry {
  return cached(k('geo:shelf', slots), () => {
    const L = shelfLength(slots);
    const { plankH, d, rail, bracket } = SHELF;
    const tri = new Shape();
    tri.moveTo(-d / 2, -plankH);
    tri.lineTo(-d / 2, -plankH - bracket);
    tri.lineTo(-d / 2 + bracket, -plankH);
    tri.closePath();
    const bracketGeo = (x: number) => {
      // Shape is drawn in (z, y); extrude along X.
      const g = new ExtrudeGeometry(tri, { depth: 0.08, bevelEnabled: false });
      g.applyMatrix4(new Matrix4().makeRotationY(-Math.PI / 2));
      return translate(g, x + 0.04, 0, 0);
    };
    return merge([
      translate(new BoxGeometry(L, plankH, d), 0, -plankH / 2, 0),
      translate(new BoxGeometry(L, rail, rail), 0, rail / 2, -d / 2 + rail / 2),
      bracketGeo(-L / 2 + 0.3),
      bracketGeo(L / 2 - 0.3),
    ]);
  });
}

// ---------- Kampung house ----------
export interface HouseGeos {
  stilts: BufferGeometry;
  body: BufferGeometry;
  roof: BufferGeometry;
  door: BufferGeometry;
  edges: BufferGeometry;
  height: number;
}

export function houseGeos(footprint: number, floors: number): HouseGeos {
  const base = k('geo:house', footprint, floors);
  const f = footprint;
  const bodyH = HOUSE.floorH * floors;
  const inset = 0.1;
  const stilts = cached(`${base}|stilts`, () =>
    merge(
      [
        [-f / 2 + inset, -f / 2 + inset],
        [f / 2 - inset, -f / 2 + inset],
        [f / 2 - inset, f / 2 - inset],
        [-f / 2 + inset, f / 2 - inset],
      ].map(([x, z]) => translate(new CylinderGeometry(HOUSE.stiltR, HOUSE.stiltR, HOUSE.stiltH, 6), x, HOUSE.stiltH / 2, z)),
    ),
  );
  const body = cached(`${base}|body`, () => translate(new BoxGeometry(f, bodyH, f), 0, HOUSE.stiltH + bodyH / 2, 0));
  // Ridge along X: the long slope faces +Z (left on screen), the gable end faces +X.
  const roof = cached(`${base}|roof`, () => {
    const span = f + HOUSE.overhang * 2;
    const g = gableGeo(span, HOUSE.roofH, span).clone();
    g.applyMatrix4(new Matrix4().makeRotationY(Math.PI / 2));
    return translate(g, 0, HOUSE.stiltH + bodyH, 0);
  });
  const door = cached(`${base}|door`, () => {
    const [dw, dh, dd] = HOUSE.door;
    return translate(new BoxGeometry(dw, dh, dd), 0, HOUSE.stiltH + dh / 2, f / 2 + dd / 2 - 0.005);
  });
  const edges = cached(`${base}|edges`, () => {
    const a = new EdgesGeometry(body, 20);
    const b = new EdgesGeometry(roof, 20);
    const g = mergeGeometries([a, b], false) ?? a;
    if (g !== a) a.dispose();
    b.dispose();
    return g;
  });
  return { stilts, body, roof, door, edges, height: HOUSE.stiltH + bodyH + HOUSE.roofH };
}

// ---------- Road ----------
export function roadGeo(length: number): BufferGeometry {
  return cached(k('geo:road', length), () => translate(new BoxGeometry(length, 0.02, 0.8), 0, 0.01, 0));
}

// ---------- Hard shadow ----------
export function shadowShapeGeo(hull: ReadonlyArray<readonly [number, number]>): BufferGeometry {
  // ShapeGeometry lies in XY; the mesh is rotated −90° about X, so shape (x, y) lands on world (x, 0, −y).
  const s = new Shape(hull.map(([x, z]) => new Vector2(x, -z)));
  return new ShapeGeometry(s);
}

/** Flag triangle for the pennant, in the XY plane (faces +Z, the left face). */
export function flagGeo(w: number, h: number): BufferGeometry {
  return cached(k('geo:flag', w, h), () => {
    const s = new Shape();
    s.moveTo(0, 0);
    s.lineTo(w, h / 2);
    s.lineTo(0, h);
    s.closePath();
    return new ShapeGeometry(s);
  });
}
