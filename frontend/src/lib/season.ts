// Season from the start month and hemisphere (spec §2.5). Meteorological seasons: Mar–May spring,
// Jun–Aug summer, Sep–Nov autumn, Dec–Feb winter; southern destinations shift by 6 months.
// Countries without real seasons (hasSeason=false) are 'tropical'.
import type { Season, Trip } from '@/types';
import { getCountryByCode } from '@/data/countries';
import { isValidDate, parseLocalDate } from '@/lib/dates';

export const SOUTHERN_HEMISPHERE: ReadonlySet<string> = new Set(['AU', 'NZ', 'AR', 'CL', 'ZA']);

const NORTH_BY_MONTH: Season[] = [
  'winter', 'winter', 'spring', 'spring', 'spring', 'summer',
  'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter',
];

export const SEASON_LABELS: Record<Season, string> = {
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
  tropical: 'Tropical',
};

/**
 * @param hasSeason pass the country's flag when you already have it; otherwise it is looked up in
 *   data/countries (unknown countries count as seasonal).
 */
export function getSeason(
  countryCode: string | null | undefined,
  startDate: string | Date,
  hasSeason?: boolean
): Season {
  const code = (countryCode ?? '').toUpperCase();
  const seasonal = hasSeason ?? getCountryByCode(code)?.hasSeason ?? true;
  if (!seasonal) return 'tropical';
  const d = typeof startDate === 'string' ? parseLocalDate(startDate) : startDate;
  if (!isValidDate(d)) return 'tropical';
  const month = SOUTHERN_HEMISPHERE.has(code) ? (d.getMonth() + 6) % 12 : d.getMonth();
  return NORTH_BY_MONTH[month];
}

/** The trip's saved season if it has one, otherwise derived from its destination and start date. */
export function seasonForTrip(trip: Pick<Trip, 'destinationCountry' | 'startDate' | 'season'>): Season {
  return trip.season ?? getSeason(trip.destinationCountry, trip.startDate);
}

export function seasonLabel(season: Season | null | undefined): string {
  return season ? SEASON_LABELS[season] : '';
}
