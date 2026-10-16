import { memo, useMemo, type SVGProps } from 'react';
import { CATEGORY_ORDER, type CategoryKey, type ThemeName } from '@/design/tokens';
import { useThemeName } from '@/components/theme/ThemeProvider';
import { GRID, type CompiledPart } from './kit';
import { categoryGlyph, type GlyphName } from './names';
import { resolveFill, toneHex, type GlyphTone } from './palette';
import { getGlyph } from './registry';

export interface IsoGlyphProps extends Omit<SVGProps<SVGSVGElement>, 'name' | 'children' | 'ref' | 'strokeWidth'> {
  name: GlyphName;
  /** Rendered size in CSS px (square). Drawn on a 24 grid; reads down to 20. */
  size?: number;
  /** Main colour. Defaults to the glyph's category hue (expense glyphs) or its brand tone. */
  tone?: GlyphTone;
  /** Force a palette (side-by-side previews, SVG twins). Defaults to the app's resolved theme. */
  theme?: ThemeName;
  /** Accessible name. Leave it out when a visible label sits next to the glyph (the usual case). */
  title?: string;
  /** Outline width in CSS px, constant at every size. Outlines use currentColor. */
  strokeWidth?: number;
  /**
   * Opacity of the currentColor outlines only (faces stay solid). Defaults to 1 in light and .72 in dark, where a
   * full-strength cream outline drowns the hue (the 3D edges are softer in dark too, §7.4).
   */
  outlineOpacity?: number;
  /** Paint every face in leaf tones, like the 3D sketch state (inactive filters, ghosts). */
  sketch?: boolean;
}

type Painted =
  | { kind: 'fill'; d: string; fill: string; stroke: boolean }
  | { kind: 'line'; d: string; weight: number }
  | { kind: 'tube'; d: string; core: number; fill: string };

const DARK_OUTLINE_OPACITY = 0.72;

const paintCache = new Map<string, Painted[]>();

function paint(name: GlyphName, parts: CompiledPart[], hueHex: string, theme: ThemeName, sketch: boolean): Painted[] {
  const key = `${name}|${hueHex}|${theme}|${sketch ? 1 : 0}`;
  let hit = paintCache.get(key);
  if (!hit) {
    hit = parts.map((p): Painted => {
      if (p.kind === 'line') return p;
      const fill = resolveFill(p.tone, p.shade, hueHex, theme, sketch);
      return p.kind === 'fill' ? { kind: 'fill', d: p.d, fill, stroke: p.stroke } : { kind: 'tube', d: p.d, core: p.core, fill };
    });
    paintCache.set(key, hit);
  }
  return hit;
}

/**
 * Iso glyph (spec §5.5): a tiny 3D object in the shared projection, faces shaded with the 3D face tones and
 * outlined in currentColor. Decorative by default (aria-hidden); pass `title` when it stands alone.
 */
export const IsoGlyph = memo(function IsoGlyph({
  name,
  size = 24,
  tone,
  theme: themeProp,
  title,
  strokeWidth = 1.5,
  outlineOpacity,
  sketch = false,
  className,
  ...rest
}: IsoGlyphProps) {
  const appTheme = useThemeName();
  const theme = themeProp ?? appTheme;
  const glyph = getGlyph(name);
  const hueHex = toneHex(tone ?? glyph.hue, theme);
  const painted = useMemo(() => paint(name, glyph.parts, hueHex, theme, sketch), [name, glyph, hueHex, theme, sketch]);
  // Strokes are specified in CSS px, so convert to grid units for this size.
  const unit = GRID / Math.max(size, 1);
  const sw = strokeWidth * unit;
  const hair = 0.5 * unit;
  const oo = outlineOpacity ?? (theme === 'dark' ? DARK_OUTLINE_OPACITY : 1);
  const so = oo >= 1 ? undefined : oo;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${GRID} ${GRID}`}
      fill="none"
      className={className}
      focusable="false"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      data-glyph={name}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <g stroke="currentColor" strokeLinejoin="round" strokeLinecap="round">
        {painted.map((p, i) => {
          if (p.kind === 'fill')
            return p.stroke ? (
              <path key={i} d={p.d} fill={p.fill} strokeWidth={sw} strokeOpacity={so} />
            ) : (
              <path key={i} d={p.d} fill={p.fill} stroke={p.fill} strokeWidth={hair} />
            );
          if (p.kind === 'line') return <path key={i} d={p.d} strokeWidth={sw * p.weight} strokeOpacity={so} />;
          return (
            <g key={i}>
              <path d={p.d} strokeWidth={p.core + 2 * sw} strokeOpacity={so} />
              <path d={p.d} stroke={p.fill} strokeWidth={p.core} />
            </g>
          );
        })}
      </g>
    </svg>
  );
});

const isCategoryKey = (x: unknown): x is CategoryKey => typeof x === 'string' && (CATEGORY_ORDER as readonly string[]).includes(x);

export interface CategoryGlyphProps extends Omit<IsoGlyphProps, 'name'> {
  /** An expense category key. Unknown or empty values fall back to Other. */
  category: CategoryKey | string | null | undefined;
}

/** Expense category glyph in its category hue: `<CategoryGlyph category={expense.category} />`. */
export function CategoryGlyph({ category, ...rest }: CategoryGlyphProps) {
  return <IsoGlyph name={categoryGlyph(isCategoryKey(category) ? category : 'other')} {...rest} />;
}
