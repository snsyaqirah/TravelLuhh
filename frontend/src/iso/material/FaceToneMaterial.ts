// FaceToneMaterial (§7.3): unlit MeshBasicMaterial whose colour comes from the world normal, giving the
// cut-paper three-tone look with no lights. Tones are computed in JS by faceTones(), the same function the
// SVG twins and glyphs use, so all three match. Instancing-aware; curved parts snap to one tone per face.
import {
  BackSide,
  Color,
  DoubleSide,
  FrontSide,
  LineBasicMaterial,
  LineDashedMaterial,
  MeshBasicMaterial,
  type Side,
} from 'three';
import type { ThemeName } from '@/design/tokens';
import { faceTones } from '@/iso/faceTones';
import { palette3d } from '@/iso/palette3d';
import { cached } from '@/iso/material/cache';

const VERT_PARS = /* glsl */ `
varying vec3 vFtNormal;
`;

// Only axis-aligned non-uniform scale is allowed, so mat3(model) keeps face normals on their axis.
const VERT_MAIN = /* glsl */ `
vec3 ftN = normal;
#ifdef USE_INSTANCING
  ftN = mat3( instanceMatrix ) * ftN;
#endif
vFtNormal = normalize( mat3( modelMatrix ) * ftN );
`;

const FRAG_PARS = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uLeft;
uniform vec3 uRight;
uniform float uCurved;
varying vec3 vFtNormal;
`;

const FRAG_MAIN = /* glsl */ `
vec3 ftN = normalize( vFtNormal );
ftN = gl_FrontFacing ? ftN : -ftN;
vec3 ftW = max( ftN, vec3( 0.0 ) );
float ftS = max( ftW.x + ftW.y + ftW.z, 1e-3 );
vec3 ftC = ( uRight * ftW.x + uTop * ftW.y + uLeft * ftW.z ) / ftS;
if ( uCurved > 0.5 ) {
  float ftM = max( ftW.x, max( ftW.y, ftW.z ) );
  ftC = ( ftM == ftW.y ) ? uTop : ( ( ftM == ftW.z ) ? uLeft : uRight );
}
diffuseColor.rgb = ftC;
`;

export interface FaceToneOptions {
  /** Coins, lids, cups, stilts: snap to one tone per fragment (cut paper, no gradient). */
  curved?: boolean;
  /** Thin flat parts seen from both sides (flags, roof planes). */
  doubleSided?: boolean;
}

function createFaceToneMaterial(hex: string, theme: ThemeName, curved: boolean, side: Side): MeshBasicMaterial {
  const tones = faceTones(hex, theme);
  // Color.set(hex) converts sRGB → linear working space; the renderer converts back on output,
  // so a +Y face renders exactly `hex`.
  const uniforms = {
    uTop: { value: new Color(tones.top) },
    uLeft: { value: new Color(tones.left) },
    uRight: { value: new Color(tones.right) },
    uCurved: { value: curved ? 1 : 0 },
  };
  const m = new MeshBasicMaterial({
    color: tones.top,
    side,
    // Push faces back a hair so coplanar edge lines always win the depth test.
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  m.name = `FaceTone ${hex} ${theme}${curved ? ' curved' : ''}`;
  m.userData.faceTone = { hex, theme, curved, uniforms };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_MAIN}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAG_MAIN}`);
  };
  // Same GLSL for every tone: let three share one program; uniforms stay per material.
  m.customProgramCacheKey = () => 'iso-facetone-v1';
  return m;
}

/** Cached FaceToneMaterial for (hex, theme, curved). Never dispose it yourself; the cache does. */
export function faceToneMaterial(hex: string, theme: ThemeName, opts: FaceToneOptions = {}): MeshBasicMaterial {
  const curved = !!opts.curved;
  const side = opts.doubleSided ? DoubleSide : FrontSide;
  const key = `mat:face|${hex.toUpperCase()}|${theme}|${curved ? 1 : 0}|${opts.doubleSided ? 2 : 1}`;
  return cached(key, () => createFaceToneMaterial(hex, theme, curved, side));
}

/** Plain unlit colour (hard shadows, slots, stamp lines): exact hex on every face. */
export function flatMaterial(
  hex: string,
  opts: { polygonOffset?: number; doubleSided?: boolean; depthWrite?: boolean } = {},
): MeshBasicMaterial {
  const off = opts.polygonOffset ?? 0;
  const depthWrite = opts.depthWrite ?? true;
  const key = `mat:flat|${hex.toUpperCase()}|${off}|${opts.doubleSided ? 2 : 1}|${depthWrite ? 1 : 0}`;
  return cached(
    key,
    () =>
      new MeshBasicMaterial({
        color: hex,
        side: opts.doubleSided ? DoubleSide : FrontSide,
        polygonOffset: off !== 0,
        polygonOffsetFactor: off,
        polygonOffsetUnits: off,
        depthWrite,
      }),
  );
}

/** 1-device-pixel edge lines in ink (§7.4). No fat-line shader. */
export function edgeMaterial(theme: ThemeName): LineBasicMaterial {
  const p = palette3d(theme);
  return cached(
    `mat:edge|${theme}`,
    () => new LineBasicMaterial({ color: p.ink, transparent: true, opacity: p.edgeOpacity, depthWrite: false }),
  );
}

/** Ghost sketch lines: ink-3 dashes, opaque. Needs computeLineDistances() on the line object. */
export function ghostLineMaterial(theme: ThemeName): LineDashedMaterial {
  const p = palette3d(theme);
  return cached(
    `mat:ghostline|${theme}`,
    () => new LineDashedMaterial({ color: p.ink3, dashSize: 0.06, gapSize: 0.05 }),
  );
}

/** Solid opaque line (selection loop, budget line). */
export function lineMaterial(hex: string, opts: { dashed?: boolean; dash?: number; gap?: number } = {}): LineBasicMaterial {
  if (opts.dashed) {
    const dash = opts.dash ?? 0.12;
    const gap = opts.gap ?? 0.08;
    return cached(`mat:dash|${hex}|${dash}|${gap}`, () => new LineDashedMaterial({ color: hex, dashSize: dash, gapSize: gap }));
  }
  return cached(`mat:line|${hex}`, () => new LineBasicMaterial({ color: hex }));
}

/** The only transparent mesh materials in the system: balang glass back and front faces (§7.4). */
export function glassMaterials(theme: ThemeName): { back: MeshBasicMaterial; front: MeshBasicMaterial; line: LineBasicMaterial } {
  const p = palette3d(theme);
  return {
    back: cached(
      `mat:glass-back|${theme}`,
      () =>
        new MeshBasicMaterial({
          color: p.glass,
          transparent: true,
          opacity: p.glassBackOpacity,
          depthWrite: false,
          side: BackSide,
        }),
    ),
    front: cached(
      `mat:glass-front|${theme}`,
      () =>
        new MeshBasicMaterial({
          color: p.glass,
          transparent: true,
          opacity: p.glassFrontOpacity,
          depthWrite: false,
          side: FrontSide,
        }),
    ),
    line: cached(
      `mat:glass-line|${theme}`,
      () => new LineBasicMaterial({ color: p.ink, transparent: true, opacity: p.glassLineOpacity, depthWrite: false }),
    ),
  };
}
