import { circleFootprint, convexHull, rectFootprint, shadowHull } from '@/iso/geometry2d';
import { COIN_PILE, coinFillHeight, coinPileLayout, coinStackLayout, jarRadiusAt, lidPose, JAR_MAX_R } from '@/iso/shapes';
import { colorOf, palette3d } from '@/iso/palette3d';
import { apply, chain, rotationX, rotationY, trs } from '@/iso/svg/affine';
import { Euler, Matrix4, Vector3 } from 'three';

describe('shadow hull', () => {
  it('extends the footprint by half the height along +X', () => {
    const hull = shadowHull(rectFootprint(1, 1), 2);
    const xs = hull.map((p) => p[0]);
    expect(Math.min(...xs)).toBeCloseTo(-0.5);
    expect(Math.max(...xs)).toBeCloseTo(1.5);
    expect(hull).toHaveLength(4);
  });
  it('round footprints use 16 samples', () => {
    expect(circleFootprint(1)).toHaveLength(16);
    expect(convexHull(circleFootprint(1))).toHaveLength(16);
  });
});

describe('coin layouts', () => {
  it('caps at capacity and is deterministic', () => {
    expect(coinPileLayout(500, 't1')).toHaveLength(COIN_PILE.high.capacity);
    expect(coinPileLayout(500, 't1', true)).toHaveLength(COIN_PILE.lite.capacity);
    expect(coinPileLayout(37, 't1')).toEqual(coinPileLayout(37, 't1'));
    expect(coinPileLayout(0, 't1')).toEqual([]);
  });
  it('keeps coins inside the jar wall and below the interior height', () => {
    for (const lite of [false, true]) {
      const cfg = lite ? COIN_PILE.lite : COIN_PILE.high;
      for (const c of coinPileLayout(cfg.capacity, 'x', lite)) {
        const r = Math.hypot(c.position[0], c.position[2]) + cfg.r;
        expect(r).toBeLessThan(jarRadiusAt(c.position[1]));
        expect(c.position[1]).toBeLessThan(2.4 * 0.85 + 0.05);
        expect(Math.abs(c.angle)).toBeLessThanOrEqual(COIN_PILE.tilt);
      }
    }
  });
  it('fills bottom-up', () => {
    const coins = coinPileLayout(20, 'b');
    const layers = coins.map((c) => Math.round((c.position[1] - 0.06) / 0.136));
    expect(Math.max(...layers)).toBe(2); // 8 + 8 + 4
  });
  it('fill height tracks the share of capacity', () => {
    expect(coinFillHeight(60)).toBeCloseTo(0.5 * 2.04);
    expect(coinFillHeight(30, true)).toBeCloseTo(0.5 * 2.04);
  });
  it('stacks rise by the pitch', () => {
    const s = coinStackLayout(3, 'd1');
    expect(s[2].position[1] - s[0].position[1]).toBeCloseTo(0.11);
  });
});

describe('lid pose', () => {
  it('tilted lid rests on the ground in front of the jar', () => {
    const pose = lidPose('tilted')!;
    expect(pose.rotation[0]).toBeCloseTo(1.2);
    expect(pose.position[2]).toBeGreaterThan(JAR_MAX_R);
    expect(lidPose('off')).toBeNull();
    expect(lidPose('closed')!.position[1]).toBeCloseTo(2.51);
  });
});

describe('palette3d', () => {
  it('resolves spec keys per theme', () => {
    expect(colorOf('lidOnTheRoad', 'light')).toBe('#D8A93B');
    expect(colorOf('lidHome', 'dark')).toBe('#4A5850');
    expect(colorOf('cat:food', 'light')).toBe('#AD7A18');
    expect(colorOf('denim', 'dark')).toBe('#515E6E');
    expect(colorOf('ground', 'dark')).toBe('#26302A');
    expect(palette3d('light').shadow).toBe('#C6BDAD');
    expect(() => colorOf('nope' as never, 'light')).toThrow();
  });
});

describe('affine matches three Object3D transforms', () => {
  it('trs = T·R(XYZ)·S', () => {
    const p: [number, number, number] = [1, 2, 3];
    const r: [number, number, number] = [0.3, -1.1, 0.7];
    const ref = new Matrix4().makeRotationFromEuler(new Euler(...r, 'XYZ'));
    ref.scale(new Vector3(2, 2, 2)).setPosition(...p);
    const v = new Vector3(0.5, -0.25, 1.5).applyMatrix4(ref);
    const ours = apply(trs(p, r, 2), [0.5, -0.25, 1.5]);
    expect(ours[0]).toBeCloseTo(v.x, 9);
    expect(ours[1]).toBeCloseTo(v.y, 9);
    expect(ours[2]).toBeCloseTo(v.z, 9);
  });
  it('chain applies parent after child', () => {
    const out = apply(chain(rotationY(Math.PI / 2), rotationX(Math.PI / 2)), [0, 1, 0]);
    // child rotX(90°) sends +Y to +Z; parent rotY(90°) sends +Z to +X
    expect(out[0]).toBeCloseTo(1, 9);
    expect(out[1]).toBeCloseTo(0, 9);
    expect(out[2]).toBeCloseTo(0, 9);
  });
});
