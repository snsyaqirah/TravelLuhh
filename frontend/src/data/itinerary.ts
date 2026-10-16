// Itinerary categories (spec §5.5): the seven expense categories plus Sightseeing, so a stop can become a ledger
// entry without remapping. Older rows used 'transport' and 'activity'; normalise them on read.
import type { CategoryKey } from '@/design/tokens';
import type { GlyphName } from '@/components/glyphs/names';
import type { GlyphTone } from '@/components/glyphs/palette';
import { CATEGORY_META, isCategoryKey } from './categories';

export type ItineraryCategory = CategoryKey | 'sightseeing';

export interface ItineraryCategoryMeta {
  key: ItineraryCategory;
  label: string;
  glyph: GlyphName;
  /** Main colour for the glyph: the expense hue, or ink for sightseeing (not a spend category). */
  tone: GlyphTone;
  /** Expense category to pre-select when logging a cost from this stop. */
  expenseCategory: CategoryKey;
}

const fromExpense = (key: CategoryKey): ItineraryCategoryMeta => ({
  key,
  label: CATEGORY_META[key].label,
  glyph: CATEGORY_META[key].glyph,
  tone: key,
  expenseCategory: key,
});

const SIGHTSEEING: ItineraryCategoryMeta = {
  key: 'sightseeing',
  label: 'Sightseeing',
  glyph: 'sightseeing',
  tone: 'ink',
  expenseCategory: 'activities',
};

/** Picker order: the expense order with Sightseeing beside Activities. */
export const ITINERARY_CATEGORIES: readonly ItineraryCategoryMeta[] = [
  fromExpense('accommodation'),
  fromExpense('transportation'),
  fromExpense('activities'),
  SIGHTSEEING,
  fromExpense('bundle'),
  fromExpense('food'),
  fromExpense('shopping'),
  fromExpense('other'),
];

const LEGACY: Record<string, ItineraryCategory> = {
  transport: 'transportation',
  activity: 'activities',
  stay: 'accommodation',
  hotel: 'accommodation',
  package: 'bundle',
  packages: 'bundle',
};

/** Canonical key for a stored value, or null when the stop has no category. Unknown values become Other. */
export function normalizeItineraryCategory(raw: string | null | undefined): ItineraryCategory | null {
  const v = (raw ?? '').trim().toLowerCase();
  if (!v) return null;
  if (v === 'sightseeing') return 'sightseeing';
  if (isCategoryKey(v)) return v;
  return LEGACY[v] ?? 'other';
}

/** Meta for a stored value; uncategorised stops show as Other. */
export function itineraryCategoryMeta(raw: string | null | undefined): ItineraryCategoryMeta {
  const key = normalizeItineraryCategory(raw) ?? 'other';
  return ITINERARY_CATEGORIES.find((c) => c.key === key) ?? fromExpense('other');
}
