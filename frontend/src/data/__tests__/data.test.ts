import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORY_ORDER } from '@/design/tokens';
import { CURRENCY_CODES } from '@/lib/currency';
import { isGlyphName } from '@/components/glyphs/names';
import * as countriesMod from '@/data/countries';
import * as categoriesMod from '@/data/categories';
import * as packingMod from '@/data/packing';
import * as itineraryMod from '@/data/itinerary';
import * as notesMod from '@/data/notes';
import * as seasonsMod from '@/data/seasons';
import { POPULAR_FROM_MY, countries, expenseCategories, getCountryByCode, getRegion, searchCountries, seasons } from '@/data/countries';
import { CATEGORIES, categoryMeta, sortByCategory } from '@/data/categories';
import { PACKING_CATEGORIES, PACKING_PRESETS, guessPackingCategory, packingCategoryMeta, presetAdditions } from '@/data/packing';
import { ITINERARY_CATEGORIES, itineraryCategoryMeta, normalizeItineraryCategory } from '@/data/itinerary';
import { NOTE_CATEGORIES, QUICK_INFO_FIELDS, QUICK_INFO_KEY_PATTERN, noteCategoryMeta } from '@/data/notes';
import { SEASON_META } from '@/data/seasons';

// Same ranges as scripts/check-look.sh, plus regional-indicator letters (flag emoji) and variation selectors.
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]|\u{FE0F}/u;

function strings(value: unknown, seen = new Set<unknown>()): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'function' || value === null || typeof value !== 'object' || seen.has(value)) return [];
  seen.add(value);
  return Object.values(value as Record<string, unknown>).flatMap((v) => strings(v, seen));
}

describe('data catalogues', () => {
  it('contain no emoji and no hard-coded hex colours', () => {
    for (const mod of [countriesMod, categoriesMod, packingMod, itineraryMod, notesMod, seasonsMod]) {
      for (const s of strings(mod)) {
        expect(s).not.toMatch(EMOJI);
        expect(s).not.toMatch(/^#[0-9a-f]{3,8}$/i);
      }
    }
  });

  it('only reference glyphs that exist', () => {
    const glyphs = [
      ...CATEGORIES.map((c) => c.glyph),
      ...PACKING_CATEGORIES.map((c) => c.glyph),
      ...PACKING_PRESETS.map((p) => p.glyph),
      ...ITINERARY_CATEGORIES.map((c) => c.glyph),
      ...NOTE_CATEGORIES.map((c) => c.glyph),
      ...SEASON_META.map((s) => s.glyph),
      ...expenseCategories.map((c) => c.glyph),
      ...seasons.map((s) => s.glyph),
    ];
    for (const g of glyphs) expect(isGlyphName(g)).toBe(true);
  });
});

describe('countries', () => {
  it('has the 45 destinations, each with a region, capital and a known currency', () => {
    expect(countries).toHaveLength(45);
    expect(new Set(countries.map((c) => c.code)).size).toBe(45);
    for (const c of countries) {
      expect(['asia', 'europe', 'americas', 'africa_me', 'oceania']).toContain(c.region);
      expect(c.capital.length).toBeGreaterThan(0);
      expect(CURRENCY_CODES).toContain(c.currency);
    }
  });

  it('groups regions the way PassportStamp shapes them (§5.4)', () => {
    const codes = (r: string) => countries.filter((c) => c.region === r).map((c) => c.code).sort();
    expect(codes('asia')).toEqual(['CN', 'HK', 'ID', 'IN', 'JP', 'KR', 'MY', 'PH', 'SG', 'TH', 'TW', 'VN']);
    expect(codes('africa_me')).toEqual(['AE', 'EG', 'MA', 'SA', 'ZA']);
    expect(codes('oceania')).toEqual(['AU', 'NZ']);
    expect(codes('americas')).toEqual(['AR', 'BR', 'CA', 'CL', 'CO', 'MX', 'PE', 'US']);
    expect(codes('europe')).toHaveLength(18);
    expect(getRegion('jp')).toBe('asia');
    expect(getRegion('XX')).toBeNull();
  });

  it('keeps Popular from MY to the spec list, all in the catalogue', () => {
    expect(POPULAR_FROM_MY).toEqual(['JP', 'KR', 'TH', 'ID', 'SG', 'VN', 'CN', 'AU']);
    for (const c of POPULAR_FROM_MY) expect(getCountryByCode(c)).toBeDefined();
  });

  it('looks codes up case-insensitively', () => {
    expect(getCountryByCode(' jp ')?.name).toBe('Japan');
    expect(getCountryByCode(undefined)).toBeUndefined();
  });

  it('searches by name, code, capital, currency and the names people type', () => {
    expect(searchCountries('ja')[0].code).toBe('JP');
    expect(searchCountries('jepun')[0].code).toBe('JP');
    expect(searchCountries('korea')[0].code).toBe('KR');
    expect(searchCountries('bali')[0].code).toBe('ID');
    expect(searchCountries('bogota')[0].code).toBe('CO');
    expect(searchCountries('THB')[0].code).toBe('TH');
    expect(searchCountries('uk')[0].code).toBe('GB');
    expect(searchCountries('mekah')[0].code).toBe('SA');
    expect(searchCountries('umrah')[0].code).toBe('SA');
    expect(searchCountries('')).toHaveLength(45);
    expect(searchCountries('zzz')).toEqual([]);
  });

  it('keeps the legacy exports building without emoji', () => {
    expect(expenseCategories.map((c) => c.value)).toEqual([...CATEGORY_ORDER]);
    expect(expenseCategories.map((c) => c.icon)).toEqual(['STY', 'TRN', 'ACT', 'PKG', 'FNB', 'SHP', 'MSC']);
    for (const c of expenseCategories) expect(c.color).toMatch(/^hsl\(var\(--cat-[a-z]+\)\)$/);
    expect(seasons.map((s) => s.value)).toEqual(['spring', 'summer', 'autumn', 'winter']);
    expect(countriesMod.getCurrencySymbol('MYR')).toBe('RM');
    expect(countriesMod.getCurrencySymbol('USD')).toBe('USD');
    expect(countriesMod.currencies[0].code).toBe('MYR');
  });
});

describe('categories', () => {
  it('follows the fixed order, labels and codes of §3.3', () => {
    expect(CATEGORIES.map((c) => [c.label, c.code, c.cssVar])).toEqual([
      ['Stay', 'STY', '--cat-stay'],
      ['Transport', 'TRN', '--cat-transport'],
      ['Activities', 'ACT', '--cat-activities'],
      ['Packages', 'PKG', '--cat-packages'],
      ['Food', 'FNB', '--cat-food'],
      ['Shopping', 'SHP', '--cat-shopping'],
      ['Other', 'MSC', '--cat-other'],
    ]);
    expect(CATEGORIES.map((c) => c.order)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('treats unknown values as Other and sorts stably in the fixed order', () => {
    expect(categoryMeta('nope').key).toBe('other');
    expect(categoryMeta(null).key).toBe('other');
    const rows = [
      { id: 1, c: 'food' },
      { id: 2, c: 'accommodation' },
      { id: 3, c: 'food' },
      { id: 4, c: 'weird' },
      { id: 5, c: 'bundle' },
    ];
    expect(sortByCategory(rows, (r) => r.c).map((r) => r.id)).toEqual([2, 5, 1, 3, 4]);
  });
});

describe('packing', () => {
  it('lists the 10 categories in suitcase order with their fabric tones', () => {
    expect(PACKING_CATEGORIES.map((c) => c.key)).toEqual([
      'documents', 'clothing', 'personal', 'health', 'electronics', 'gear', 'work', 'food', 'religious', 'general',
    ]);
    expect(packingCategoryMeta('clothing').fabric).toBe('khaki');
    expect(packingCategoryMeta('documents').fabric).toBe('passport');
    expect(packingCategoryMeta(null).key).toBe('general');
    expect(packingCategoryMeta(' Electronics ').key).toBe('electronics');
  });

  it('has the five presets with valid, unique items', () => {
    expect(PACKING_PRESETS.map((p) => p.key)).toEqual(['general', 'beach', 'hiking', 'business', 'umrah']);
    expect(PACKING_PRESETS.find((p) => p.key === 'umrah')?.label).toBe('Umrah & Hajj');
    for (const p of PACKING_PRESETS) {
      expect(new Set(p.items.map((i) => i.label.toLowerCase())).size).toBe(p.items.length);
      for (const i of p.items) expect(packingCategoryMeta(i.category).key).toBe(i.category);
    }
  });

  it('mirrors the server preset lists (PackingListService)', () => {
    const java = readFileSync(
      resolve(__dirname, '../../../../backend/src/main/java/com/travelluhh/service/PackingListService.java'),
      'utf8',
    );
    const server: Record<string, string[]> = {};
    for (const block of java.split('presets.put(').slice(1)) {
      const key = /^"([a-z]+)"/.exec(block)?.[1];
      if (!key) continue;
      server[key] = Array.from(block.split('));')[0].matchAll(/new PresetItem\("([^"]+)", "([a-z]+)"\)/g), (m) => `${m[1]}|${m[2]}`);
    }
    for (const p of PACKING_PRESETS) expect(p.items.map((i) => `${i.label}|${i.category}`)).toEqual(server[p.key]);
  });

  it('guesses the category of every preset item from its label', () => {
    for (const p of PACKING_PRESETS) for (const i of p.items) expect([i.label, guessPackingCategory(i.label)]).toEqual([i.label, i.category]);
    expect(guessPackingCategory('Spare phone charger')).toBe('electronics');
    expect(guessPackingCategory('Telekung')).toBe('religious');
    expect(guessPackingCategory('Something odd')).toBe('general');
  });

  it('previews only what the server will add', () => {
    expect(presetAdditions('general', ['phone CHARGER', 'Snacks']).map((i) => i.label)).not.toContain('Phone charger');
    expect(presetAdditions('general', [])).toHaveLength(8);
  });
});

describe('itinerary', () => {
  it('reuses the expense categories plus Sightseeing', () => {
    expect(ITINERARY_CATEGORIES.map((c) => c.key)).toEqual([
      'accommodation', 'transportation', 'activities', 'sightseeing', 'bundle', 'food', 'shopping', 'other',
    ]);
    expect(itineraryCategoryMeta('sightseeing').expenseCategory).toBe('activities');
  });

  it('normalises legacy values', () => {
    expect(normalizeItineraryCategory('transport')).toBe('transportation');
    expect(normalizeItineraryCategory('activity')).toBe('activities');
    expect(normalizeItineraryCategory('Food')).toBe('food');
    expect(normalizeItineraryCategory('')).toBeNull();
    expect(normalizeItineraryCategory('karaoke')).toBe('other');
  });
});

describe('notes', () => {
  it('has the six note categories and valid quick-info keys', () => {
    expect(NOTE_CATEGORIES.map((c) => c.key)).toEqual(['local_tips', 'food', 'transport', 'safety', 'emergency', 'custom']);
    expect(noteCategoryMeta('unknown').key).toBe('custom');
    for (const f of QUICK_INFO_FIELDS) expect(f.key).toMatch(QUICK_INFO_KEY_PATTERN);
    expect(QUICK_INFO_FIELDS.map((f) => f.key)).toEqual(expect.arrayContaining(['language', 'plug', 'tipping', 'emergency_number']));
  });
});

describe('seasons', () => {
  it('includes Tropical', () => {
    expect(SEASON_META.map((s) => s.label)).toEqual(['Spring', 'Summer', 'Autumn', 'Winter', 'Tropical']);
  });
});
