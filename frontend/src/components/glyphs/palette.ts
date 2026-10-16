// Colour roles for glyph faces, resolved per theme from tokens.ts / palette3d (never hard-coded per glyph), then
// split into top/left/right with the shared faceTones so a glyph matches the 3D prop it stands for.
import { categoryColors, CATEGORY_ORDER, tokens, type CategoryKey, type ThemeName } from '@/design/tokens';
import { faceColor, faceTones } from '@/iso/faceTones';
import { palette3d } from '@/iso/palette3d';
import type { Shading, ToneRole } from './kit';

/** Named colours a glyph's main hue can take besides a category. */
export const NAMED_TONES = ['fund', 'brass', 'stamp', 'paper', 'ink', 'shell', 'soil'] as const;
export type NamedTone = (typeof NAMED_TONES)[number];

/** A category key (its --cat-* hue), a named token tone, or a hex colour. */
export type GlyphTone = CategoryKey | NamedTone | `#${string}`;

const isCategory = (t: string): t is CategoryKey => (CATEGORY_ORDER as readonly string[]).includes(t);

/** Hex for a fixed role. `paper` is a light object in both themes; `ink` a dark one. */
export function roleHex(role: Exclude<ToneRole, 'hue'>, theme: ThemeName): string {
  const t = tokens[theme];
  const p = palette3d(theme);
  switch (role) {
    case 'paper':
      // Dark mode: a light object stays light, but muted so it doesn't glare on the night palette.
      return theme === 'light' ? t.leaf : t.ink2;
    case 'ink':
      // Light: ink-3 rather than ink, so the faces stay distinguishable from the ink outline.
      return theme === 'light' ? t.ink3 : t.ruleStrong;
    case 'shade':
      return t.shade;
    case 'fund':
      return t.fund;
    case 'brass':
      return t.brass;
    case 'stamp':
      return t.stamp;
    case 'shell':
      return p.suitcase.shell;
    case 'ground':
      return p.ground;
    case 'soil':
      return p.soil;
  }
}

/** Hex for a GlyphTone in a theme. */
export function toneHex(tone: GlyphTone, theme: ThemeName): string {
  if (tone.startsWith('#')) return tone;
  if (isCategory(tone)) return categoryColors[theme][tone];
  return roleHex(tone as NamedTone, theme);
}

/** Final fill colour for one face. `sketch` paints every role in leaf, like the 3D Ghost state. */
export function resolveFill(role: ToneRole, shade: Shading, hueHex: string, theme: ThemeName, sketch = false): string {
  const base = sketch ? tokens[theme].leaf : role === 'hue' ? hueHex : roleHex(role, theme);
  const tones = faceTones(base, theme);
  if (typeof shade === 'string') return tones[shade];
  return faceColor(shade.n, tones, shade.curved);
}
