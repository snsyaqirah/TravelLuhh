import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { categoryColors, CATEGORY_ORDER, tokens } from '@/design/tokens';
import { faceTones } from '@/iso/faceTones';
import { CategoryGlyph, CountryChip, GLYPH_GROUPS, GLYPH_NAMES, IsoGlyph, categoryGlyph, glyphCategory } from '@/components/glyphs';
import { getGlyph } from '@/components/glyphs/registry';

const fills = (c: HTMLElement) =>
  Array.from(c.querySelectorAll('path'))
    .map((p) => p.getAttribute('fill'))
    .filter((f): f is string => !!f && f !== 'none')
    .map((f) => f.toUpperCase());

describe('glyph set', () => {
  it('has the spec groups: 7 expense, sightseeing, 10 packing, 5 presets, 5 seasons, 6 notes', () => {
    expect(GLYPH_GROUPS.map((g) => g.names.length)).toEqual([7, 1, 10, 5, 5, 6]);
    expect(new Set(GLYPH_NAMES).size).toBe(GLYPH_NAMES.length);
  });

  it.each(GLYPH_NAMES)('%s compiles inside the 24 grid with room for the outline', (name) => {
    const g = getGlyph(name);
    expect(g.parts.length).toBeGreaterThan(0);
    for (const p of g.parts) expect(p.d).not.toMatch(/NaN|Infinity/);
    expect(g.box.minX).toBeGreaterThanOrEqual(0.9);
    expect(g.box.minY).toBeGreaterThanOrEqual(0.9);
    expect(g.box.maxX).toBeLessThanOrEqual(23.1);
    expect(g.box.maxY).toBeLessThanOrEqual(23.1);
    // Long side uses the grid: nothing renders as a speck.
    expect(Math.max(g.box.maxX - g.box.minX, g.box.maxY - g.box.minY)).toBeGreaterThan(19);
  });

  it('maps every expense category to its glyph and back', () => {
    for (const key of CATEGORY_ORDER) expect(glyphCategory(categoryGlyph(key))).toBe(key);
    expect(categoryGlyph('accommodation')).toBe('stay');
    expect(categoryGlyph('bundle')).toBe('packages');
  });
});

describe('<IsoGlyph>', () => {
  it('paints a box glyph with exactly the 3D face tones of its category hue', () => {
    const { container } = render(<IsoGlyph name="other" theme="light" />);
    const tones = faceTones(categoryColors.light.other, 'light');
    expect(fills(container)).toEqual(expect.arrayContaining([tones.top, tones.left, tones.right]));
  });

  it('switches to the dark category hue in the dark theme', () => {
    const { container } = render(<CategoryGlyph category="accommodation" theme="dark" />);
    const f = fills(container);
    expect(f).toContain(faceTones(categoryColors.dark.accommodation, 'dark').left);
    expect(f).not.toContain(categoryColors.light.accommodation);
  });

  it('takes a tone override (token name or hex)', () => {
    const { container } = render(<IsoGlyph name="other" theme="light" tone="fund" />);
    expect(fills(container)).toContain(tokens.light.fund);
    const hex = render(<IsoGlyph name="other" theme="light" tone="#336699" />);
    expect(fills(hex.container)).toContain('#336699');
  });

  it('sketch paints every face in leaf tones', () => {
    const { container } = render(<IsoGlyph name="stay" theme="light" sketch />);
    const leaf = faceTones(tokens.light.leaf, 'light');
    const allowed = new Set([leaf.top, leaf.left, leaf.right]);
    // Blended faces (roof slopes) mix two leaf tones; everything stays at least as light as the right tone.
    for (const f of fills(container)) expect(allowed.has(f) || parseInt(f.slice(1, 3), 16) >= 0xb0).toBe(true);
  });

  it('keeps the outline at the requested CSS width at any size', () => {
    const { container } = render(<IsoGlyph name="other" size={48} theme="light" />);
    // Outlined faces: a fill and no explicit stroke colour (so currentColor). Detail lines are thinner by design.
    const stroked = Array.from(container.querySelectorAll('path')).filter((p) => p.getAttribute('fill') && !p.getAttribute('stroke'));
    expect(stroked.length).toBeGreaterThan(0);
    for (const p of stroked) expect(Number(p.getAttribute('stroke-width'))).toBeCloseTo((1.5 * 24) / 48, 5);
  });

  it('softens outlines in dark only', () => {
    const light = render(<IsoGlyph name="other" theme="light" />);
    expect(light.container.querySelector('path[stroke-opacity]')).toBeNull();
    const dark = render(<IsoGlyph name="other" theme="dark" />);
    expect(dark.container.querySelector('path[stroke-opacity]')?.getAttribute('stroke-opacity')).toBe('0.72');
  });

  it('is decorative by default and labelled when given a title', () => {
    const plain = render(<IsoGlyph name="stay" theme="light" />);
    expect(plain.container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    const named = render(<IsoGlyph name="stay" theme="light" title="Stay" />);
    const svg = named.getByRole('img', { name: 'Stay' });
    expect(svg).not.toHaveAttribute('aria-hidden');
  });

  it('falls back to Other for unknown categories', () => {
    const { container } = render(<CategoryGlyph category="spaceship" theme="light" />);
    expect(container.querySelector('svg')).toHaveAttribute('data-glyph', 'other');
  });
});

describe('<CountryChip>', () => {
  it('shows the ISO code and reads the country name', () => {
    const { container, getByText } = render(<CountryChip code="jp" />);
    expect(getByText('JP')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.sr-only')).toHaveTextContent('Japan');
    expect(container.firstChild).toHaveAttribute('title', 'Japan');
  });

  it('can read the letters instead, or hide entirely next to a written name', () => {
    const code = render(<CountryChip code="KR" announce="code" />);
    expect(code.container.querySelector('.sr-only')).toBeNull();
    expect(code.getByText('KR')).not.toHaveAttribute('aria-hidden');
    const none = render(<CountryChip code="KR" announce="none" />);
    expect(none.container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders unknown codes as given, without a fake name', () => {
    // Kazakhstan isn't in the destination catalogue
    const { container, getByText } = render(<CountryChip code="KZ" />);
    expect(getByText('KZ')).toBeInTheDocument();
    expect(container.querySelector('.sr-only')).toBeNull();
  });
});
