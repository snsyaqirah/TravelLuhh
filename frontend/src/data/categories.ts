// Expense category catalogue (spec §3.3): label, code, glyph, colour variable and fixed order in one place.
// Labels and codes come from lib/categories (E2); the hue lives in CSS (--cat-*) and tokens.ts, never here.
import {
  CATEGORY_CSS_KEY,
  CATEGORY_ORDER,
  categoryColorVar,
  categoryColors,
  type CategoryKey,
  type ThemeName,
} from '@/design/tokens';
import { CATEGORY_CODES, CATEGORY_LABELS, isCategoryKey } from '@/lib/categories';
import { categoryGlyph, type ExpenseGlyph } from '@/components/glyphs/names';

export { CATEGORY_ORDER, isCategoryKey, type CategoryKey };

export interface CategoryMeta {
  key: CategoryKey;
  /** 'Stay' */
  label: string;
  /** 'STY': mono labels, scene labels, the mobile ledger's second line. */
  code: string;
  /** IsoGlyph name: 'stay'. */
  glyph: ExpenseGlyph;
  /** Tailwind / CSS key: 'stay' → bg-cat-stay, --cat-stay. */
  cssKey: string;
  /** '--cat-stay' */
  cssVar: string;
  /** 'hsl(var(--cat-stay))', theme-aware. For SVG fills, chart cells and inline styles; never for text. */
  color: string;
  /** Position in the fixed order (0 = Stay). */
  order: number;
  /** Description suggestions for the Log spend sheet. */
  suggestions: readonly string[];
}

const SUGGESTIONS: Record<CategoryKey, readonly string[]> = {
  accommodation: ['Hotel night', 'Hostel bed', 'Homestay', 'Late checkout'],
  transportation: ['Grab', 'Train ticket', 'Flight', 'Bus fare', 'Airport transfer'],
  activities: ['Tickets', 'Museum entry', 'Day tour', 'Theme park'],
  bundle: ['Tour package', 'Day pass', 'Flight + hotel'],
  food: ['Nasi lemak', 'Breakfast', 'Lunch', 'Dinner', 'Coffee', 'Groceries'],
  shopping: ['Souvenirs', 'Gifts', 'Clothes', 'Snacks to bring home'],
  other: ['SIM card', 'Travel insurance', 'Laundry', 'Locker'],
};

export const CATEGORY_META: Readonly<Record<CategoryKey, CategoryMeta>> = Object.fromEntries(
  CATEGORY_ORDER.map((key, order) => {
    const cssKey = CATEGORY_CSS_KEY[key];
    const meta: CategoryMeta = {
      key,
      label: CATEGORY_LABELS[key],
      code: CATEGORY_CODES[key],
      glyph: categoryGlyph(key),
      cssKey,
      cssVar: `--cat-${cssKey}`,
      color: categoryColorVar(key),
      order,
      suggestions: SUGGESTIONS[key],
    };
    return [key, meta];
  }),
) as Record<CategoryKey, CategoryMeta>;

/** All seven, in the fixed order: Stay, Transport, Activities, Packages, Food, Shopping, Other. */
export const CATEGORIES: readonly CategoryMeta[] = CATEGORY_ORDER.map((k) => CATEGORY_META[k]);

/** Meta for any stored value; unknown, empty or legacy values count as Other. */
export function categoryMeta(key: string | null | undefined): CategoryMeta {
  return isCategoryKey(key) ? CATEGORY_META[key] : CATEGORY_META.other;
}

/** `hsl(var(--cat-x))`, optionally with alpha. Same as tokens' categoryColorVar, re-exported for data users. */
export const categoryColor = (key: CategoryKey, alpha?: number): string => categoryColorVar(key, alpha);

/** Hex for a theme, for canvas/3D code that can't read CSS variables. */
export const categoryHex = (key: CategoryKey, theme: ThemeName): string => categoryColors[theme][key];

/** Comparator for the fixed order; unknown values sort last, as Other. */
export function compareCategory(a: string | null | undefined, b: string | null | undefined): number {
  return categoryMeta(a).order - categoryMeta(b).order;
}

/** Stable sort by the fixed category order. Colour follows the category, never its rank (§3.3). */
export function sortByCategory<T>(items: readonly T[], keyOf: (item: T) => string | null | undefined): T[] {
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => compareCategory(keyOf(a.item), keyOf(b.item)) || a.i - b.i)
    .map((x) => x.item);
}
