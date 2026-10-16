// Destination catalogue: 45 countries with currency, capital, season flag and region (spec §2.5, §5.4, §9.5).
// Countries show as ISO code chips (components/glyphs/CountryChip), never flags. Season logic lives in lib/season,
// money formatting in lib/money, the currency list in lib/currency.
import type { Country, Region } from '@/types';
import { CATEGORY_ORDER, categoryColorVar } from '@/design/tokens';
import { CATEGORY_CODES, CATEGORY_LABELS } from '@/lib/categories';
import { CURRENCIES } from '@/lib/currency';
import { currencyPrefix } from '@/lib/money';
import { categoryGlyph, type ExpenseGlyph, type GlyphName } from '@/components/glyphs/names';

/** A destination always has a region (stamp shape) and a capital (trip-name suggestion). */
export type Destination = Country & { region: Region; capital: string };

const c = (code: string, name: string, currency: string, hasSeason: boolean, region: Region, capital: string): Destination => ({
  code,
  name,
  currency,
  hasSeason,
  region,
  capital,
});

export const countries: Destination[] = [
  // Asia (PassportStamp circle)
  c('MY', 'Malaysia', 'MYR', false, 'asia', 'Kuala Lumpur'),
  c('SG', 'Singapore', 'SGD', false, 'asia', 'Singapore'),
  c('TH', 'Thailand', 'THB', false, 'asia', 'Bangkok'),
  c('ID', 'Indonesia', 'IDR', false, 'asia', 'Jakarta'),
  c('VN', 'Vietnam', 'VND', false, 'asia', 'Hanoi'),
  c('PH', 'Philippines', 'PHP', false, 'asia', 'Manila'),
  c('JP', 'Japan', 'JPY', true, 'asia', 'Tokyo'),
  c('KR', 'South Korea', 'KRW', true, 'asia', 'Seoul'),
  c('CN', 'China', 'CNY', true, 'asia', 'Beijing'),
  c('TW', 'Taiwan', 'TWD', true, 'asia', 'Taipei'),
  c('HK', 'Hong Kong', 'HKD', false, 'asia', 'Hong Kong'),
  c('IN', 'India', 'INR', false, 'asia', 'New Delhi'),
  // Europe (rectangle)
  c('GB', 'United Kingdom', 'GBP', true, 'europe', 'London'),
  c('IE', 'Ireland', 'EUR', true, 'europe', 'Dublin'),
  c('FR', 'France', 'EUR', true, 'europe', 'Paris'),
  c('DE', 'Germany', 'EUR', true, 'europe', 'Berlin'),
  c('NL', 'Netherlands', 'EUR', true, 'europe', 'Amsterdam'),
  c('BE', 'Belgium', 'EUR', true, 'europe', 'Brussels'),
  c('CH', 'Switzerland', 'CHF', true, 'europe', 'Bern'),
  c('AT', 'Austria', 'EUR', true, 'europe', 'Vienna'),
  c('IT', 'Italy', 'EUR', true, 'europe', 'Rome'),
  c('ES', 'Spain', 'EUR', true, 'europe', 'Madrid'),
  c('PT', 'Portugal', 'EUR', true, 'europe', 'Lisbon'),
  c('GR', 'Greece', 'EUR', true, 'europe', 'Athens'),
  c('CZ', 'Czech Republic', 'CZK', true, 'europe', 'Prague'),
  c('PL', 'Poland', 'PLN', true, 'europe', 'Warsaw'),
  c('SE', 'Sweden', 'SEK', true, 'europe', 'Stockholm'),
  c('NO', 'Norway', 'NOK', true, 'europe', 'Oslo'),
  c('DK', 'Denmark', 'DKK', true, 'europe', 'Copenhagen'),
  c('FI', 'Finland', 'EUR', true, 'europe', 'Helsinki'),
  // Americas (octagon)
  c('US', 'United States', 'USD', true, 'americas', 'Washington, D.C.'),
  c('CA', 'Canada', 'CAD', true, 'americas', 'Ottawa'),
  c('MX', 'Mexico', 'MXN', false, 'americas', 'Mexico City'),
  c('BR', 'Brazil', 'BRL', false, 'americas', 'Brasília'),
  c('AR', 'Argentina', 'ARS', true, 'americas', 'Buenos Aires'),
  c('CL', 'Chile', 'CLP', true, 'americas', 'Santiago'),
  c('CO', 'Colombia', 'COP', false, 'americas', 'Bogotá'),
  c('PE', 'Peru', 'PEN', false, 'americas', 'Lima'),
  // Africa and the Middle East (triangle)
  c('AE', 'United Arab Emirates', 'AED', false, 'africa_me', 'Abu Dhabi'),
  c('SA', 'Saudi Arabia', 'SAR', false, 'africa_me', 'Riyadh'),
  c('EG', 'Egypt', 'EGP', false, 'africa_me', 'Cairo'),
  c('MA', 'Morocco', 'MAD', false, 'africa_me', 'Rabat'),
  c('ZA', 'South Africa', 'ZAR', true, 'africa_me', 'Pretoria'),
  // Oceania (oval)
  c('AU', 'Australia', 'AUD', true, 'oceania', 'Canberra'),
  c('NZ', 'New Zealand', 'NZD', true, 'oceania', 'Wellington'),
];

/** "Popular from MY" chips on Create step 1 (§9.5). */
export const POPULAR_FROM_MY: readonly string[] = ['JP', 'KR', 'TH', 'ID', 'SG', 'VN', 'CN', 'AU'];

export const REGION_LABELS: Record<Region, string> = {
  asia: 'Asia',
  europe: 'Europe',
  americas: 'Americas',
  africa_me: 'Africa & Middle East',
  oceania: 'Oceania',
};

const BY_CODE = new Map(countries.map((x) => [x.code, x]));

export function getCountryByCode(code: string | null | undefined): Destination | undefined {
  return code ? BY_CODE.get(code.trim().toUpperCase()) : undefined;
}

/** Region for a stamp shape; null for codes outside the catalogue. */
export function getRegion(code: string | null | undefined): Region | null {
  return getCountryByCode(code)?.region ?? null;
}

// Names people actually type, including the Malay ones.
const ALIASES: Record<string, string[]> = {
  JP: ['jepun', 'nihon'],
  KR: ['korea', 'korea selatan'],
  CN: ['china', 'beijing', 'shanghai'],
  TH: ['siam', 'bangkok', 'phuket'],
  ID: ['bali', 'jakarta'],
  VN: ['viet nam', 'saigon', 'ho chi minh'],
  GB: ['uk', 'england', 'britain', 'great britain', 'scotland', 'london'],
  US: ['usa', 'america', 'amerika syarikat', 'new york'],
  AE: ['uae', 'dubai', 'emiriah arab bersatu'],
  SA: ['saudi', 'arab saudi', 'makkah', 'mekah', 'mecca', 'madinah', 'medina', 'jeddah', 'umrah'],
  NL: ['holland'],
  CZ: ['czechia'],
  CH: ['swiss'],
  TW: ['taipei'],
  AU: ['sydney', 'melbourne'],
};

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Countries matching a search query by name, code, capital, currency or a common alias. Prefix matches on the
 * name or code rank first. An empty query returns the whole list.
 */
export function searchCountries(query: string): Destination[] {
  const q = fold(query);
  if (!q) return countries.slice();
  const scored = countries
    .map((x) => {
      const name = fold(x.name);
      const code = x.code.toLowerCase();
      const hay = [fold(x.capital), x.currency.toLowerCase(), ...(ALIASES[x.code] ?? [])];
      const score =
        code === q || name.startsWith(q) ? 0 : name.includes(q) ? 1 : hay.some((h) => h.startsWith(q)) ? 2 : hay.some((h) => h.includes(q)) ? 3 : -1;
      return { x, score };
    })
    .filter((s) => s.score >= 0);
  return scored.sort((a, b) => a.score - b.score || a.x.name.localeCompare(b.x.name)).map((s) => s.x);
}

/**
 * Currency pickers. Same list and order as lib/currency (MYR first). `symbol` is the unambiguous prefix from
 * lib/money ('RM', '¥', or the ISO code), never a bare '$'.
 */
export const currencies: { code: string; name: string; symbol: string }[] = CURRENCIES.map((x) => ({
  code: x.code,
  name: x.name,
  symbol: x.prefix,
}));

/**
 * @deprecated Use CATEGORIES / CATEGORY_META from data/categories and render `<CategoryGlyph>`.
 * Kept so older screens build: `icon` is now the three-letter code (no emoji) and `color` is the theme-aware
 * `hsl(var(--cat-x))` (no hex), in the fixed category order.
 */
export const expenseCategories: { value: string; label: string; icon: string; color: string; code: string; glyph: ExpenseGlyph }[] =
  CATEGORY_ORDER.map((key) => ({
    value: key,
    label: CATEGORY_LABELS[key],
    icon: CATEGORY_CODES[key],
    color: categoryColorVar(key),
    code: CATEGORY_CODES[key],
    glyph: categoryGlyph(key),
  }));

/**
 * @deprecated Use SEASON_META from data/seasons (it includes Tropical). `icon` is empty now; render
 * `<IsoGlyph name={season.glyph}>` instead.
 */
export const seasons: { value: string; label: string; icon: string; glyph: GlyphName }[] = [
  { value: 'spring', label: 'Spring', icon: '', glyph: 'season-spring' },
  { value: 'summer', label: 'Summer', icon: '', glyph: 'season-summer' },
  { value: 'autumn', label: 'Autumn', icon: '', glyph: 'season-autumn' },
  { value: 'winter', label: 'Winter', icon: '', glyph: 'season-winter' },
];

/** @deprecated Use formatMoney / currencyPrefix from lib/money. Returns the same unambiguous prefix. */
export function getCurrencySymbol(code: string): string {
  return currencyPrefix(code) || code;
}

/** @deprecated Use categoryColor from data/categories. Returns `hsl(var(--cat-x))`; unknown values are Other. */
export function getCategoryColor(category: string): string {
  const key = (CATEGORY_ORDER as readonly string[]).includes(category) ? (category as (typeof CATEGORY_ORDER)[number]) : 'other';
  return categoryColorVar(key);
}
