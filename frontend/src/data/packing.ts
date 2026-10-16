// Packing categories and quick-pack presets (spec §8 S4, §9.6 Pack tab). Plain text only, no emoji.
import type { PackingPreset } from '@/types';
import type { FabricKey } from '@/design/tokens';
import { PACKING_CATEGORY_KEYS, type GlyphName, type PackingCategory } from '@/components/glyphs/names';

export { PACKING_CATEGORY_KEYS, type PackingCategory };

export interface PackingCategoryMeta {
  key: PackingCategory;
  label: string;
  glyph: GlyphName;
  /** Position in the suitcase fill order (documents first, general last). */
  order: number;
  /** Fabric tone of its boxes in the 3D suitcase. */
  fabric: FabricKey;
}

const LABELS: Record<PackingCategory, string> = {
  documents: 'Documents',
  clothing: 'Clothing',
  personal: 'Personal care',
  health: 'Health',
  electronics: 'Electronics',
  gear: 'Gear',
  work: 'Work',
  food: 'Food',
  religious: 'Religious',
  general: 'General',
};

// §8 S4: clothing khaki, documents passport slab, electronics denim, health/personal clay, gear/work sage,
// food/religious/general linen.
const FABRIC: Record<PackingCategory, FabricKey> = {
  documents: 'passport',
  clothing: 'khaki',
  personal: 'clay',
  health: 'clay',
  electronics: 'denim',
  gear: 'sage',
  work: 'sage',
  food: 'linen',
  religious: 'linen',
  general: 'linen',
};

export const PACKING_CATEGORIES: readonly PackingCategoryMeta[] = PACKING_CATEGORY_KEYS.map((key, order) => ({
  key,
  label: LABELS[key],
  glyph: `packing-${key}` as const,
  order,
  fabric: FABRIC[key],
}));

export const PACKING_CATEGORY_META = Object.fromEntries(PACKING_CATEGORIES.map((c) => [c.key, c])) as Readonly<
  Record<PackingCategory, PackingCategoryMeta>
>;

export const isPackingCategory = (x: unknown): x is PackingCategory =>
  typeof x === 'string' && (PACKING_CATEGORY_KEYS as readonly string[]).includes(x);

/** Stored values are free text; anything unknown or empty files under General. */
export function packingCategoryMeta(raw: string | null | undefined): PackingCategoryMeta {
  const key = (raw ?? '').trim().toLowerCase();
  return isPackingCategory(key) ? PACKING_CATEGORY_META[key] : PACKING_CATEGORY_META.general;
}

// Keyword guesses for quick-add, so "Phone charger" lands under Electronics without a picker. First match wins,
// so the more specific groups come first.
const GUESSES: Array<[PackingCategory, RegExp]> = [
  ['documents', /\b(passports?|visas?|ic|mykad|tickets?|boarding pass|insurance|itinerary|booking|licen[cs]e|documents?|id card|copies)\b/i],
  ['religious', /\b(prayer|sejadah|telekung|quran|tasbih|kopiah|songkok|qibla)\b/i],
  ['health', /\b(medic\w*|panadol|paracetamol|pills?|vitamins?|first aid|plasters?|sunscreen|sunblock|after-sun|masks?|sanitiser|sanitizer|inhaler|ointment|repellent)\b/i],
  ['electronics', /\b(charger|cables?|adapter|adaptor|power ?bank|phone|laptop|camera|headphones?|earphones?|earbuds|kindle|tablet|ipad|sim|plug)\b/i],
  ['work', /\b(business cards?|name cards?|notebook|pens?|folder|portfolio|lanyard)\b/i],
  ['personal', /\b(toothbrush|toothpaste|shampoo|soap|deodorant|razor|comb|toiletr\w*|skincare|moisturi[sz]er|lotion|tissues?|wet wipes)\b/i],
  ['food', /\b(snacks?|maggi|instant noodles?|sambal|serunding|biscuits?|coffee|tea|food)\b/i],
  ['clothing', /\b(shirts?|t-?shirts?|pants|trousers|jeans|shorts|dress|attire|jacket|coat|raincoat|sweater|hoodie|socks|underwear|shoes|sandals|slippers|flip ?flops|boots|swimwear|swimsuit|ihram|sunglasses|hat|cap|tudung|scarf|gloves|clothes|pyjamas?|baju)\b/i],
  ['gear', /\b(backpack|bag|umbrella|torch|headlamp|lock|bottle|poles?|tent|sleeping bag|snorkel\w*|goggles|towel|map|gps)\b/i],
];

/** Best-guess category for a free-text label; General when nothing matches. */
export function guessPackingCategory(label: string): PackingCategory {
  return GUESSES.find(([, re]) => re.test(label))?.[0] ?? 'general';
}

export interface PresetItem {
  label: string;
  category: PackingCategory;
}

export interface PackingPresetMeta {
  key: PackingPreset;
  label: string;
  glyph: GlyphName;
  /**
   * What `POST /packing/preset` adds, mirrored from PackingListService so the UI can preview it ("Adds 8 items").
   * The server skips labels already on the list.
   */
  items: readonly PresetItem[];
}

const it = (label: string, category: PackingCategory): PresetItem => ({ label, category });

export const PACKING_PRESETS: readonly PackingPresetMeta[] = [
  {
    key: 'general',
    label: 'General',
    glyph: 'preset-general',
    items: [
      it('Passport & documents', 'documents'),
      it('Phone charger', 'electronics'),
      it('Medications', 'health'),
      it('Clothes', 'clothing'),
      it('Toiletries', 'personal'),
      it('Travel adapter', 'electronics'),
      it('Power bank', 'electronics'),
      it('Snacks', 'food'),
    ],
  },
  {
    key: 'beach',
    label: 'Beach',
    glyph: 'preset-beach',
    items: [
      it('Sunscreen SPF 50+', 'health'),
      it('Swimwear', 'clothing'),
      it('Beach towel', 'gear'),
      it('Flip flops', 'clothing'),
      it('Sunglasses', 'clothing'),
      it('Snorkeling gear', 'gear'),
      it('Waterproof bag', 'gear'),
      it('After-sun lotion', 'health'),
    ],
  },
  {
    key: 'hiking',
    label: 'Hiking',
    glyph: 'preset-hiking',
    items: [
      it('Hiking boots', 'clothing'),
      it('Backpack', 'gear'),
      it('Water bottle', 'gear'),
      it('First aid kit', 'health'),
      it('Sunscreen', 'health'),
      it('Trail map / GPS', 'gear'),
      it('Raincoat', 'clothing'),
      it('Headlamp', 'gear'),
      it('Energy snacks', 'food'),
      it('Trekking poles', 'gear'),
    ],
  },
  {
    key: 'business',
    label: 'Business',
    glyph: 'preset-business',
    items: [
      it('Business cards', 'work'),
      it('Laptop + charger', 'electronics'),
      it('Formal attire', 'clothing'),
      it('Notebook & pen', 'work'),
      it('Travel adapter', 'electronics'),
      it('Power bank', 'electronics'),
      it('Dress shoes', 'clothing'),
      it('Portfolio/folder', 'work'),
    ],
  },
  {
    key: 'umrah',
    label: 'Umrah & Hajj',
    glyph: 'preset-umrah',
    items: [
      it('Ihram', 'clothing'),
      it('Prayer mat', 'religious'),
      it('Quran', 'religious'),
      it('Tasbih', 'religious'),
      it('Comfortable walking shoes', 'clothing'),
      it('Sunscreen', 'health'),
      it('Water bottle', 'gear'),
      it('Umbrella', 'gear'),
      it('Medication', 'health'),
      it('Sandals', 'clothing'),
    ],
  },
];

export const PACKING_PRESET_META = Object.fromEntries(PACKING_PRESETS.map((p) => [p.key, p])) as Readonly<
  Record<PackingPreset, PackingPresetMeta>
>;

/** Preset items not already on the list (case-insensitive), as the server will add them. */
export function presetAdditions(preset: PackingPreset, existingLabels: readonly string[]): PresetItem[] {
  const have = new Set(existingLabels.map((l) => l.trim().toLowerCase()));
  return PACKING_PRESET_META[preset].items.filter((i) => !have.has(i.label.toLowerCase()));
}
