// Pure helpers for the quick-info panel (§9.6 Notes).
import type { Note } from '@/types';
import { QUICK_INFO_FIELDS, type QuickInfoField } from '@/data/notes';

const prettyKey = (key: string) => key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/** The catalogue's fields, then any other key someone saved (kept, never hidden). */
export function quickInfoRows(quickInfo: Readonly<Record<string, Note>>): QuickInfoField[] {
  const known = new Set(QUICK_INFO_FIELDS.map((f) => f.key));
  const extra = Object.keys(quickInfo)
    .filter((k) => !known.has(k))
    .sort()
    .map((key): QuickInfoField => ({ key, label: prettyKey(key), hint: '' }));
  return [...QUICK_INFO_FIELDS, ...extra];
}

/** "4 of 6 filled" for the collapsed header on phones. */
export function quickInfoSummary(quickInfo: Readonly<Record<string, Note>>): string {
  const rows = quickInfoRows(quickInfo);
  const filled = rows.filter((r) => quickInfo[r.key]?.content.trim()).length;
  return `${filled} of ${rows.length} filled`;
}
