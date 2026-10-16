import { Vector3, OrthographicCamera } from 'three';
import {
  CAMERA_OFFSET,
  SCREEN_RIGHT,
  computeView,
  depthCompare,
  fitZoom,
  isoProject,
  maxPan,
  projectBounds,
  snap,
  toScreen,
  viewBoxFor,
  viewBoxForBounds,
} from '@/iso/projection';
import type { Vec3 } from '@/iso/specs';

/** What the WebGL camera does: r3f orthographic frustum = ±size/2 in px, divided by zoom. */
function cameraPixel(p: Vec3, zoom: number, center: Vec3, w: number, h: number): [number, number] {
  const cam = new OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 400);
  cam.position.set(center[0] + CAMERA_OFFSET[0], center[1] + CAMERA_OFFSET[1], center[2] + CAMERA_OFFSET[2]);
  cam.up.set(0, 1, 0);
  cam.lookAt(center[0], center[1], center[2]);
  cam.zoom = zoom;
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  const v = new Vector3(...p).project(cam);
  return [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h];
}

describe('isoProject', () => {
  it('maps the axes to the spec screen directions', () => {
    expect(isoProject([0, 0, 0])).toEqual([0, 0]);
    const [xx, xy] = isoProject([1, 0, 0]); // +X runs right-down
    expect(xx).toBeCloseTo(0.70711, 4);
    expect(xy).toBeCloseTo(0.40825, 4);
    const [zx, zy] = isoProject([0, 0, 1]); // +Z runs left-down
    expect(zx).toBeCloseTo(-0.70711, 4);
    expect(zy).toBeCloseTo(0.40825, 4);
    const [yx, yy] = isoProject([0, 1, 0]); // +Y up
    expect(yx).toBeCloseTo(0, 6);
    expect(yy).toBeCloseTo(-0.8165, 4);
  });

  it('moves exactly one screen unit right along SCREEN_RIGHT', () => {
    const [x, y] = isoProject(SCREEN_RIGHT);
    expect(x).toBeCloseTo(1, 6);
    expect(y).toBeCloseTo(0, 6);
  });
});

describe('toScreen is pixel-identical to the three.js camera', () => {
  const cases: Array<{ p: Vec3; zoom: number; center: Vec3; w: number; h: number }> = [
    { p: [0, 0, 0], zoom: 60, center: [0, 0, 0], w: 375, h: 220 },
    { p: [2.8, 0.08, 1.25], zoom: 41.3, center: [4.2, 0.6, 1.4], w: 375, h: 220 },
    { p: [-3, 2.4, 5], zoom: 88, center: [1, 1, 1], w: 1024, h: 320 },
    { p: [8.45, 0, 2.8], zoom: 23.7, center: [4.2, 1.2, 1.4], w: 343, h: 160 },
  ];
  it.each(cases)('point $p at zoom $zoom', ({ p, zoom, center, w, h }) => {
    const [ax, ay] = toScreen(p, zoom, center, w, h);
    const [bx, by] = cameraPixel(p, zoom, center, w, h);
    expect(Math.abs(ax - bx)).toBeLessThan(1e-3);
    expect(Math.abs(ay - by)).toBeLessThan(1e-3);
  });
});

describe('fitZoom / computeView', () => {
  const b = { min: [0, -0.4, 0] as Vec3, max: [8.45, 2.7, 2.8] as Vec3 };

  it('fits every corner inside the slot with the padding', () => {
    const w = 375;
    const h = 220;
    const view = computeView(b, w, h);
    expect(view.zoom).toBeCloseTo(fitZoom(b, w, h), 9);
    const corners: Vec3[] = [];
    for (const x of [b.min[0], b.max[0]]) for (const y of [b.min[1], b.max[1]]) for (const z of [b.min[2], b.max[2]]) corners.push([x, y, z]);
    const pxs = corners.map((c) => toScreen(c, view.zoom, view.center, w, h));
    const minX = Math.min(...pxs.map((q) => q[0]));
    const maxX = Math.max(...pxs.map((q) => q[0]));
    const minY = Math.min(...pxs.map((q) => q[1]));
    const maxY = Math.max(...pxs.map((q) => q[1]));
    expect(minX).toBeGreaterThanOrEqual(w * 0.08 - 1e-6);
    expect(maxX).toBeLessThanOrEqual(w * 0.92 + 1e-6);
    expect(minY).toBeGreaterThanOrEqual(h * 0.08 - 1e-6);
    expect(maxY).toBeLessThanOrEqual(h * 0.92 + 1e-6);
    // one axis is tight: the fit is not needlessly small
    expect(Math.min(minX - w * 0.08, minY - h * 0.08)).toBeLessThan(1e-6);
  });

  it('never returns zero or NaN zoom for degenerate input', () => {
    const flat = { min: [1, 1, 1] as Vec3, max: [1, 1, 1] as Vec3 };
    expect(fitZoom(flat, 0, 0)).toBeGreaterThan(0);
    expect(Number.isFinite(fitZoom(flat, 300, 200))).toBe(true);
  });

  it('height fit pans along screen-right and clamps to the scene', () => {
    const wide = { min: [0, 0, 0] as Vec3, max: [30, 2, 2] as Vec3 };
    const w = 375;
    const h = 320;
    const v0 = computeView(wide, w, h, { fit: 'height' });
    const limit = maxPan(wide, w, v0.zoom);
    expect(limit).toBeGreaterThan(0);
    const v1 = computeView(wide, w, h, { fit: 'height', pan: 1e6 });
    const [cx0] = isoProject(v0.center);
    const [cx1] = isoProject(v1.center);
    expect(cx1 - cx0).toBeCloseTo(limit, 6);
    expect(isoProject(v1.center)[1]).toBeCloseTo(isoProject(v0.center)[1], 9);
  });

  it('viewBoxForBounds equals the contain view at any aspect (meet)', () => {
    const [vx, vy, vw, vh] = viewBoxForBounds(b);
    for (const [w, h] of [
      [375, 220],
      [1024, 320],
      [200, 600],
    ]) {
      const view = computeView(b, w, h);
      const [ax, ay, aw, ah] = viewBoxFor(view, w, h);
      // meet scales the bounds viewBox by min(w/vw, h/vh) and centres it
      const s = Math.min(w / vw, h / vh);
      expect(s).toBeCloseTo(view.zoom, 6);
      expect(ax + aw / 2).toBeCloseTo(vx + vw / 2, 6);
      expect(ay + ah / 2).toBeCloseTo(vy + vh / 2, 6);
    }
  });
});

describe('helpers', () => {
  it('projectBounds spans the projected corners', () => {
    const r = projectBounds({ min: [0, 0, 0], max: [1, 1, 1] });
    expect(r.maxX - r.minX).toBeCloseTo(2 * 0.70711, 4);
  });

  it('snaps to the 0.25 grid', () => {
    expect(snap(1.13)).toBe(1.25);
    expect(snap(-0.12)).toBe(-0);
  });

  it('orders far before near, then low before high', () => {
    const items: Vec3[] = [
      [2, 0, 2],
      [0, 0, 0],
      [1, 1, 1],
      [1, 0, 1],
    ];
    expect(items.sort(depthCompare)).toEqual([
      [0, 0, 0],
      [1, 0, 1],
      [1, 1, 1],
      [2, 0, 2],
    ]);
  });
});
