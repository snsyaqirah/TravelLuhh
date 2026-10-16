// Season chips (spec §2.5): label + glyph. Which season a trip falls in comes from lib/season.
import type { Season } from '@/types';
import { SEASON_LABELS } from '@/lib/season';
import type { GlyphName } from '@/components/glyphs/names';

export interface SeasonMeta {
  key: Season;
  /** 'Autumn'; tropical destinations show 'Tropical'. */
  label: string;
  glyph: GlyphName;
}

export const SEASON_ORDER: readonly Season[] = ['spring', 'summer', 'autumn', 'winter', 'tropical'];

export const SEASON_META: readonly SeasonMeta[] = SEASON_ORDER.map((key) => ({
  key,
  label: SEASON_LABELS[key],
  glyph: `season-${key}` as const,
}));

export function seasonMeta(season: Season): SeasonMeta {
  return SEASON_META.find((s) => s.key === season) ?? SEASON_META[SEASON_META.length - 1];
}
