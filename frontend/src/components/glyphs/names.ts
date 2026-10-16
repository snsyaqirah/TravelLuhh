// Glyph names (spec §5.5). Expense glyphs use the spec's short names; the other sets are prefixed because the
// spec reuses words across sets (food is a kopi cup, a food tin and a bowl).
import type { CategoryKey } from '@/design/tokens';
import type { NoteCategory, PackingPreset, Season } from '@/types';

export const EXPENSE_GLYPHS = ['stay', 'transport', 'activities', 'packages', 'food', 'shopping', 'other'] as const;
export type ExpenseGlyph = (typeof EXPENSE_GLYPHS)[number];

/** Packing categories, in the order the suitcase fills (§8 S4). */
export const PACKING_CATEGORY_KEYS = [
  'documents',
  'clothing',
  'personal',
  'health',
  'electronics',
  'gear',
  'work',
  'food',
  'religious',
  'general',
] as const;
export type PackingCategory = (typeof PACKING_CATEGORY_KEYS)[number];

export const PACKING_PRESET_KEYS = ['general', 'beach', 'hiking', 'business', 'umrah'] as const satisfies readonly PackingPreset[];
export const SEASON_KEYS = ['spring', 'summer', 'autumn', 'winter', 'tropical'] as const satisfies readonly Season[];
export const NOTE_CATEGORY_KEYS = [
  'local_tips',
  'food',
  'transport',
  'safety',
  'emergency',
  'custom',
] as const satisfies readonly NoteCategory[];

export type GlyphName =
  | ExpenseGlyph
  | 'sightseeing'
  | `packing-${PackingCategory}`
  | `preset-${PackingPreset}`
  | `season-${Season}`
  | `note-${NoteCategory}`;

export const GLYPH_GROUPS: ReadonlyArray<{ group: string; names: readonly GlyphName[] }> = [
  { group: 'Expense', names: EXPENSE_GLYPHS },
  { group: 'Itinerary', names: ['sightseeing'] },
  { group: 'Packing', names: PACKING_CATEGORY_KEYS.map((k) => `packing-${k}` as const) },
  { group: 'Presets', names: PACKING_PRESET_KEYS.map((k) => `preset-${k}` as const) },
  { group: 'Seasons', names: SEASON_KEYS.map((k) => `season-${k}` as const) },
  { group: 'Notes', names: NOTE_CATEGORY_KEYS.map((k) => `note-${k}` as const) },
];

export const GLYPH_NAMES: readonly GlyphName[] = GLYPH_GROUPS.flatMap((g) => g.names);

const EXPENSE_BY_CATEGORY: Record<CategoryKey, ExpenseGlyph> = {
  accommodation: 'stay',
  transportation: 'transport',
  activities: 'activities',
  bundle: 'packages',
  food: 'food',
  shopping: 'shopping',
  other: 'other',
};

/** Glyph for an expense category key ('accommodation' → 'stay'). */
export const categoryGlyph = (key: CategoryKey): ExpenseGlyph => EXPENSE_BY_CATEGORY[key];

/** Category whose hue an expense glyph wears ('stay' → 'accommodation'). */
export const glyphCategory = (name: GlyphName): CategoryKey | null =>
  (Object.keys(EXPENSE_BY_CATEGORY) as CategoryKey[]).find((k) => EXPENSE_BY_CATEGORY[k] === name) ?? null;

export const packingGlyph = (c: PackingCategory): GlyphName => `packing-${c}`;
export const presetGlyph = (p: PackingPreset): GlyphName => `preset-${p}`;
export const seasonGlyph = (s: Season): GlyphName => `season-${s}`;
export const noteGlyph = (c: NoteCategory): GlyphName => `note-${c}`;

export const isGlyphName = (x: unknown): x is GlyphName => typeof x === 'string' && (GLYPH_NAMES as readonly string[]).includes(x);
