import { Color, ShaderLib, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from 'three';
import { edgeMaterial, faceToneMaterial, glassMaterials } from '@/iso/material/FaceToneMaterial';
import { isoResourceCount, releaseIsoResources, retainIsoResources } from '@/iso/material/cache';
import { faceTones } from '@/iso/faceTones';

function compile(hex: string, curved = false) {
  const m = faceToneMaterial(hex, 'light', { curved });
  const shader = {
    uniforms: {},
    vertexShader: ShaderLib.basic.vertexShader,
    fragmentShader: ShaderLib.basic.fragmentShader,
  } as unknown as WebGLProgramParametersWithUniforms;
  m.onBeforeCompile(shader, {} as WebGLRenderer);
  return { m, shader: shader as unknown as { uniforms: Record<string, { value: unknown }>; vertexShader: string; fragmentShader: string } };
}

describe('FaceToneMaterial', () => {
  afterEach(() => {
    retainIsoResources();
    releaseIsoResources();
  });

  it('injects into the three r170 basic shader chunks (fails loudly if three renames them)', () => {
    const { shader } = compile('#D8A93B');
    expect(shader.vertexShader).toContain('vFtNormal = normalize( mat3( modelMatrix ) * ftN );');
    expect(shader.vertexShader).toContain('ftN = mat3( instanceMatrix ) * ftN;');
    expect(shader.fragmentShader).toContain('diffuseColor.rgb = ftC;');
    expect(shader.fragmentShader.indexOf('#include <color_fragment>')).toBeLessThan(shader.fragmentShader.indexOf('diffuseColor.rgb = ftC;'));
  });

  it('carries the three face tones as linear uniforms', () => {
    const { shader } = compile('#D8A93B', true);
    const t = faceTones('#D8A93B', 'light');
    expect((shader.uniforms.uTop.value as Color).getHexString()).toBe(new Color(t.top).getHexString());
    expect((shader.uniforms.uLeft.value as Color).getHexString()).toBe(t.left.slice(1).toLowerCase());
    expect((shader.uniforms.uRight.value as Color).getHexString()).toBe(t.right.slice(1).toLowerCase());
    expect(shader.uniforms.uCurved.value).toBe(1);
  });

  it('is cached per hex|theme|curved and shares one program key', () => {
    const a = faceToneMaterial('#17583F', 'light');
    expect(faceToneMaterial('#17583f', 'light')).toBe(a);
    expect(faceToneMaterial('#17583F', 'dark')).not.toBe(a);
    expect(faceToneMaterial('#17583F', 'light', { curved: true })).not.toBe(a);
    expect(a.customProgramCacheKey()).toBe(faceToneMaterial('#B03A2A', 'dark').customProgramCacheKey());
  });

  it('frees everything when the last canvas releases', () => {
    retainIsoResources();
    retainIsoResources();
    const mat = faceToneMaterial('#123456', 'light');
    const dispose = vi.spyOn(mat, 'dispose');
    edgeMaterial('light');
    glassMaterials('dark');
    expect(isoResourceCount()).toBeGreaterThan(3);
    releaseIsoResources();
    expect(dispose).not.toHaveBeenCalled();
    releaseIsoResources();
    expect(dispose).toHaveBeenCalled();
    expect(isoResourceCount()).toBe(0);
  });

  it('glass is the only transparent mesh material, drawn back then front', () => {
    const g = glassMaterials('light');
    expect(g.back.transparent && g.front.transparent).toBe(true);
    expect(g.back.depthWrite || g.front.depthWrite).toBe(false);
    expect(g.back.opacity).toBe(0.35);
    expect(g.front.opacity).toBe(0.1);
    expect(faceToneMaterial('#E4DCCB', 'light').transparent).toBe(false);
  });
});
