// Every glyph's geometry and default hue. Geometry compiles once, on first use.
import { compileGlyph, type CompiledPart, type GlyphBox, type GlyphGeometry } from './kit';
import type { GlyphName } from './names';
import type { GlyphTone } from './palette';
import { activities, food, other, packages, shopping, sightseeing, stay, transport } from './defs/expense';
import { PACKING_DEFS } from './defs/packing';
import { NOTE_DEFS, PRESET_DEFS, SEASON_DEFS } from './defs/sets';

interface GlyphEntry {
  geometry: GlyphGeometry;
  /** Main colour when no `tone` is passed. Expense glyphs wear their category hue. */
  hue: GlyphTone;
}

// Non-category glyphs stay inside the brand palette (fund, brass, leaf/paper, ink, the suitcase shell), and
// stamp red only where it means something (emergency).
const ENTRIES: Record<GlyphName, GlyphEntry> = {
  stay: { geometry: stay, hue: 'accommodation' },
  transport: { geometry: transport, hue: 'transportation' },
  activities: { geometry: activities, hue: 'activities' },
  packages: { geometry: packages, hue: 'bundle' },
  food: { geometry: food, hue: 'food' },
  shopping: { geometry: shopping, hue: 'shopping' },
  other: { geometry: other, hue: 'other' },
  sightseeing: { geometry: sightseeing, hue: 'ink' },

  'packing-documents': { geometry: PACKING_DEFS.documents, hue: 'ink' },
  'packing-clothing': { geometry: PACKING_DEFS.clothing, hue: 'brass' },
  'packing-personal': { geometry: PACKING_DEFS.personal, hue: 'fund' },
  'packing-health': { geometry: PACKING_DEFS.health, hue: 'fund' },
  'packing-electronics': { geometry: PACKING_DEFS.electronics, hue: 'paper' },
  'packing-gear': { geometry: PACKING_DEFS.gear, hue: 'soil' },
  'packing-work': { geometry: PACKING_DEFS.work, hue: 'shell' },
  'packing-food': { geometry: PACKING_DEFS.food, hue: 'fund' },
  'packing-religious': { geometry: PACKING_DEFS.religious, hue: 'fund' },
  'packing-general': { geometry: PACKING_DEFS.general, hue: 'brass' },

  'preset-general': { geometry: PRESET_DEFS.general, hue: 'shell' },
  'preset-beach': { geometry: PRESET_DEFS.beach, hue: 'brass' },
  'preset-hiking': { geometry: PRESET_DEFS.hiking, hue: 'fund' },
  'preset-business': { geometry: PRESET_DEFS.business, hue: 'ink' },
  'preset-umrah': { geometry: PRESET_DEFS.umrah, hue: 'fund' },

  'season-spring': { geometry: SEASON_DEFS.spring, hue: 'paper' },
  'season-summer': { geometry: SEASON_DEFS.summer, hue: 'brass' },
  'season-autumn': { geometry: SEASON_DEFS.autumn, hue: 'shell' },
  'season-winter': { geometry: SEASON_DEFS.winter, hue: 'paper' },
  'season-tropical': { geometry: SEASON_DEFS.tropical, hue: 'fund' },

  'note-local_tips': { geometry: NOTE_DEFS.local_tips, hue: 'brass' },
  'note-food': { geometry: NOTE_DEFS.food, hue: 'paper' },
  'note-transport': { geometry: NOTE_DEFS.transport, hue: 'fund' },
  'note-safety': { geometry: NOTE_DEFS.safety, hue: 'fund' },
  'note-emergency': { geometry: NOTE_DEFS.emergency, hue: 'stamp' },
  'note-custom': { geometry: NOTE_DEFS.custom, hue: 'paper' },
};

export interface CompiledGlyph {
  parts: CompiledPart[];
  box: GlyphBox;
  hue: GlyphTone;
}

const cache = new Map<GlyphName, CompiledGlyph>();

export function getGlyph(name: GlyphName): CompiledGlyph {
  let hit = cache.get(name);
  if (!hit) {
    const entry = ENTRIES[name];
    hit = { ...compileGlyph(entry.geometry), hue: entry.hue };
    cache.set(name, hit);
  }
  return hit;
}

/** Default hue of a glyph (its category, or its brand tone). */
export const glyphDefaultTone = (name: GlyphName): GlyphTone => ENTRIES[name].hue;
