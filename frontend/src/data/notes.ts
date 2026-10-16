// Note categories and destination quick-info fields (spec §9.6 Notes tab, API.md Notes). Custom notes store the
// category in `infoKey`; quick info stores the field key there.
import type { NoteCategory } from '@/types';
import { NOTE_CATEGORY_KEYS, type GlyphName } from '@/components/glyphs/names';

export interface NoteCategoryMeta {
  key: NoteCategory;
  label: string;
  glyph: GlyphName;
  /** Placeholder for the note body. */
  hint: string;
}

const NOTE_COPY: Record<NoteCategory, { label: string; hint: string }> = {
  local_tips: { label: 'Local tips', hint: 'Cash or card, queues, what a friend there would tell you.' },
  food: { label: 'Food', hint: 'Where to eat, what to order, halal spots nearby.' },
  transport: { label: 'Getting around', hint: 'Train passes, Grab or taxi, the airport transfer.' },
  safety: { label: 'Safety', hint: 'Areas to skip at night, common scams.' },
  emergency: { label: 'Emergency', hint: 'Embassy, hotel phone, insurance hotline.' },
  custom: { label: 'Note', hint: 'Anything else worth remembering.' },
};

export const NOTE_CATEGORIES: readonly NoteCategoryMeta[] = NOTE_CATEGORY_KEYS.map((key) => ({
  key,
  ...NOTE_COPY[key],
  glyph: `note-${key}` as const,
}));

export const isNoteCategory = (x: unknown): x is NoteCategory =>
  typeof x === 'string' && (NOTE_CATEGORY_KEYS as readonly string[]).includes(x);

/** Meta for a custom note's `infoKey`; anything unknown is a plain note. */
export function noteCategoryMeta(raw: string | null | undefined): NoteCategoryMeta {
  const key = (raw ?? '').trim().toLowerCase();
  return NOTE_CATEGORIES.find((c) => c.key === key) ?? NOTE_CATEGORIES[NOTE_CATEGORIES.length - 1];
}

export interface QuickInfoField {
  /** `infoKey` for `noteType: 'quick_info'` (lower-case, [a-z0-9_]{1,50}). */
  key: string;
  /** Mono key in the Quick info rows. */
  label: string;
  /** Placeholder: what to write, not a value (we don't ship per-country facts). */
  hint: string;
  /** Key the localStorage-only version used, for migrating saved values. */
  legacyKey?: string;
}

export const QUICK_INFO_FIELDS: readonly QuickInfoField[] = [
  { key: 'timezone', label: 'Time zone', hint: 'Hours ahead of or behind home', legacyKey: 'timezone' },
  { key: 'language', label: 'Language', hint: 'What people speak there', legacyKey: 'language' },
  { key: 'emergency_number', label: 'Emergency', hint: 'Police and ambulance numbers', legacyKey: 'emergency' },
  { key: 'plug', label: 'Plug', hint: 'Plug type and voltage', legacyKey: 'voltage' },
  { key: 'tipping', label: 'Tipping', hint: 'Expected or not, and how much', legacyKey: 'tipping' },
  { key: 'visa', label: 'Visa', hint: 'Visa-free days, or what to apply for' },
];

/** Pattern the API accepts for a quick-info key (CONTRACT-CHANGES B2 §3). */
export const QUICK_INFO_KEY_PATTERN = /^[a-z0-9_]{1,50}$/;

export const quickInfoField = (key: string): QuickInfoField | undefined => QUICK_INFO_FIELDS.find((f) => f.key === key);
