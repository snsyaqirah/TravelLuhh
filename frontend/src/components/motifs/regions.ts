// Passport-stamp regions (spec §5.4). The stamp's outline says where you went before you read it:
// circle = Asia, rectangle = Europe, octagon = Americas, triangle = Africa + Middle East, oval = Oceania.
// countries.ts (E5) carries `region` for the destination list; this table is the fallback for those 44 and for
// any other code a trip might hold.
import { getRegion } from '@/data/countries';
import type { Region } from '@/types';

export type { Region } from '@/types';

export type StampShape = 'circle' | 'rect' | 'octagon' | 'triangle' | 'oval';

export const REGION_SHAPE: Record<Region, StampShape> = {
  asia: 'circle',
  europe: 'rect',
  americas: 'octagon',
  africa_me: 'triangle',
  oceania: 'oval',
};

const GROUPS: Record<Region, string> = {
  asia: 'MY SG TH ID VN PH JP KR CN TW HK IN BN KH LA MM LK NP BD MV PK MN MO KZ UZ KG TJ TM BT TL KP AF',
  europe:
    'GB DE FR IT ES NL BE CH AT SE NO DK FI IE PT GR PL CZ IS HU RO BG HR SI SK EE LV LT LU MT CY RU UA BY MD RS ME AL BA MK XK MC VA SM AD LI TR GE AM AZ FO GI',
  americas:
    'US CA MX BR CO PE AR CL EC UY PY BO VE GY SR PA CR NI HN SV GT BZ CU DO HT JM BS BB TT PR AW CW',
  africa_me:
    'EG MA ZA AE SA QA OM BH KW JO IL PS LB SY IQ IR YE TN DZ LY SD ET KE TZ UG RW NG GH SN CI CM MU SC MG MZ ZW ZM BW NA AO',
  oceania: 'AU NZ FJ PG WS TO VU SB NC PF GU FM KI',
};

/** ISO alpha-2 → region, for every code we know a shape for. */
export const REGION_BY_CODE: Readonly<Record<string, Region>> = Object.freeze(
  Object.fromEntries(
    (Object.keys(GROUPS) as Region[]).flatMap((region) => GROUPS[region].split(' ').map((code) => [code, region])),
  ),
);

/**
 * Region for a country code: the destination catalogue's `getRegion` (one source of truth for the 44), then the
 * table above for any other code, then `fallback` (Asia: most TravelLuhh trips start and end in the region).
 */
export function regionOf(code: string | null | undefined, fallback: Region = 'asia'): Region {
  const c = (code ?? '').trim().toUpperCase();
  if (!c) return fallback;
  return getRegion(c) ?? REGION_BY_CODE[c] ?? fallback;
}

export function stampShapeFor(region: Region): StampShape {
  return REGION_SHAPE[region] ?? 'circle';
}
