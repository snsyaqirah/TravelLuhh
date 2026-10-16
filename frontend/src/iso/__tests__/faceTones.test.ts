import { Color } from 'three';
import { faceColor, faceTones, facesCamera, hexToRgb, mixHex, rgbToHex } from '@/iso/faceTones';

describe('faceTones (spec §7.3 examples)', () => {
  it('light ground #E4DCCB → #C9C0B1 / #ABA193', () => {
    expect(faceTones('#E4DCCB', 'light')).toEqual({ top: '#E4DCCB', left: '#C9C0B1', right: '#ABA193' });
  });
  it('light fund #17583F → #1D513B / #234A37', () => {
    expect(faceTones('#17583F', 'light')).toEqual({ top: '#17583F', left: '#1D513B', right: '#234A37' });
  });
  it('light brass #D8A93B → #BF9538 / #A38034', () => {
    expect(faceTones('#D8A93B', 'light')).toEqual({ top: '#D8A93B', left: '#BF9538', right: '#A38034' });
  });
  it('dark mixes toward #050807 at .80 / .60', () => {
    const t = faceTones('#E3B65A', 'dark');
    expect(t.top).toBe('#E3B65A');
    expect(t.left).toBe(mixHex('#050807', '#E3B65A', 0.8));
    expect(t.right).toBe(mixHex('#050807', '#E3B65A', 0.6));
    expect(t.left).toBe('#B79349');
  });
  it('accepts lowercase and short hex', () => {
    expect(faceTones('#e4dccb', 'light').left).toBe('#C9C0B1');
    expect(hexToRgb('#abc')).toEqual([0xaa, 0xbb, 0xcc]);
    expect(rgbToHex([300, -4, 16.4])).toBe('#FF0010');
  });
});

describe('faceColor mirrors the shader', () => {
  const tones = faceTones('#D8A93B', 'light');
  it('axis-aligned normals give the exact tones', () => {
    expect(faceColor([0, 1, 0], tones)).toBe(tones.top);
    expect(faceColor([0, 0, 1], tones)).toBe(tones.left);
    expect(faceColor([1, 0, 0], tones)).toBe(tones.right);
  });
  it('blends in linear space for a 45° normal, like three does', () => {
    const c = new Color(tones.top).lerp(new Color(tones.right), 0.5); // linear working space
    expect(faceColor([1, 1, 0], tones)).toBe(`#${c.getHexString().toUpperCase()}`);
  });
  it('snaps when curved', () => {
    expect(faceColor([0.6, 0.8, 0], tones, true)).toBe(tones.top);
    expect(faceColor([0.8, 0, 0.6], tones, true)).toBe(tones.right);
    expect(faceColor([0.6, 0, 0.8], tones, true)).toBe(tones.left);
  });
  it('knows which faces the camera sees', () => {
    expect(facesCamera([0, 1, 0])).toBe(true);
    expect(facesCamera([-1, 0, 0])).toBe(false);
    expect(facesCamera([-0.5, 0, 0.9])).toBe(true);
  });
});
