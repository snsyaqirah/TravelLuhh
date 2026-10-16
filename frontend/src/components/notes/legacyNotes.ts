// One-time move of notes that the old Notes tab kept in localStorage (before destination_notes had an API).
//
// Old shapes (EditableDestinationNotes, removed in the revamp):
//   travelluhh_notes_<tripId>    JSON array of { id, category, title, content, createdAt },
//                                category ∈ local_tips | food | transport | safety | emergency | custom
//   travelluhh_destinfo_<tripId> JSON object { timezone, language, emergency, voltage, tipping }
// The old tab wrote destinfo with placeholder defaults as soon as it opened, so values equal to those defaults
// were never typed by anyone and are not moved.
//
// Idempotent: anything already on the server (same category, title and text; or a quick-info key that
// already has a value) is skipped, and the keys are only removed once every remaining entry has saved.
import type { Note, NoteInput } from '@/types';
import { QUICK_INFO_FIELDS, QUICK_INFO_KEY_PATTERN, isNoteCategory } from '@/data/notes';

export const legacyNotesKey = (tripId: number) => `travelluhh_notes_${tripId}`;
export const legacyInfoKey = (tripId: number) => `travelluhh_destinfo_${tripId}`;

/** What the old tab pre-filled; never user input. */
export const LEGACY_INFO_DEFAULTS: Readonly<Record<string, string>> = {
  timezone: 'UTC+0',
  language: 'Local language',
  emergency: '112 (Emergency)',
  voltage: '220V',
  tipping: '10-15%',
};

export interface LegacyData {
  notes: NoteInput[];
  quickInfo: Array<{ infoKey: string; content: string }>;
  /** Whether either key exists at all (so we know to clean up, even when nothing is worth moving). */
  present: boolean;
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function readJson(key: string): unknown {
  try {
    const raw = storage()?.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : undefined;
  } catch {
    return undefined;
  }
}

function hasKey(key: string): boolean {
  try {
    const s = storage();
    return !!s && s.getItem(key) !== null;
  } catch {
    return false;
  }
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Reads and cleans both legacy keys for a trip. Never throws. */
export function readLegacyNotes(tripId: number): LegacyData {
  const present = hasKey(legacyNotesKey(tripId)) || hasKey(legacyInfoKey(tripId));
  const notes: NoteInput[] = [];
  const rawNotes = readJson(legacyNotesKey(tripId));
  if (Array.isArray(rawNotes)) {
    for (const n of rawNotes) {
      if (!n || typeof n !== 'object') continue;
      const o = n as Record<string, unknown>;
      const content = str(o.content);
      const title = str(o.title);
      if (!content && !title) continue;
      const cat = str(o.category);
      notes.push({
        noteType: 'custom',
        infoKey: isNoteCategory(cat) ? cat : 'custom',
        title: title ? title.slice(0, 255) : undefined,
        // content is required server-side; a title-only note keeps its title as the text
        content: (content || title).slice(0, 20000),
      });
    }
  }

  const quickInfo: LegacyData['quickInfo'] = [];
  const rawInfo = readJson(legacyInfoKey(tripId));
  if (rawInfo && typeof rawInfo === 'object' && !Array.isArray(rawInfo)) {
    const o = rawInfo as Record<string, unknown>;
    for (const f of QUICK_INFO_FIELDS) {
      if (!f.legacyKey) continue;
      const v = str(o[f.legacyKey]);
      if (!v || v === LEGACY_INFO_DEFAULTS[f.legacyKey]) continue;
      if (!QUICK_INFO_KEY_PATTERN.test(f.key)) continue;
      quickInfo.push({ infoKey: f.key, content: v.slice(0, 20000) });
    }
  }
  return { notes, quickInfo, present };
}

const norm = (s: string | null | undefined) => (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/** Entries not on the server yet. */
export function planMigration(legacy: LegacyData, existing: readonly Note[]): LegacyData {
  const haveNote = new Set(
    existing.filter((n) => n.noteType === 'custom').map((n) => `${norm(n.infoKey)}|${norm(n.title)}|${norm(n.content)}`)
  );
  const haveInfo = new Set(
    existing.filter((n) => n.noteType === 'quick_info' && n.content.trim()).map((n) => norm(n.infoKey))
  );
  return {
    present: legacy.present,
    notes: legacy.notes.filter((n) => !haveNote.has(`${norm(n.infoKey)}|${norm(n.title)}|${norm(n.content)}`)),
    quickInfo: legacy.quickInfo.filter((q) => !haveInfo.has(q.infoKey)),
  };
}

export function clearLegacyNotes(tripId: number): void {
  try {
    storage()?.removeItem(legacyNotesKey(tripId));
    storage()?.removeItem(legacyInfoKey(tripId));
  } catch {
    // storage blocked: nothing to clean
  }
}

export interface MigrationApi {
  createNote: (data: NoteInput) => Promise<unknown>;
}

export type MigrationResult = { status: 'none' } | { status: 'moved'; count: number } | { status: 'cleaned' } | { status: 'failed'; error: unknown };

/**
 * Posts whatever the old device-only tab left behind, then removes the keys. Returns 'moved' with the number of
 * entries posted (toast), 'cleaned' when the keys only held defaults or duplicates, 'none' when there were no
 * keys, 'failed' (keys kept, so the next visit retries; entries that did save are skipped then).
 */
export async function migrateLegacyNotes(tripId: number, existing: readonly Note[], api: MigrationApi): Promise<MigrationResult> {
  const legacy = readLegacyNotes(tripId);
  if (!legacy.present) return { status: 'none' };
  const todo = planMigration(legacy, existing);
  const posts: NoteInput[] = [
    ...todo.quickInfo.map((q): NoteInput => ({ noteType: 'quick_info', infoKey: q.infoKey, content: q.content })),
    ...todo.notes,
  ];
  try {
    // One at a time: keeps the server's oldest-first order the same as the old list.
    for (const p of posts) await api.createNote(p);
  } catch (error) {
    return { status: 'failed', error };
  }
  clearLegacyNotes(tripId);
  return posts.length ? { status: 'moved', count: posts.length } : { status: 'cleaned' };
}
