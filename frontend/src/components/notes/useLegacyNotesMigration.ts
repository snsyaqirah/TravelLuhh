// Runs the one-time localStorage → API move for a trip's notes (see legacyNotes.ts), once the trip's notes
// have loaded and only for people who can write. Viewers leave the keys alone for an editor to move.
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { Note, NoteInput } from '@/types';
import { migrateLegacyNotes } from './legacyNotes';

/** Trips already handled this page load: React StrictMode and remounts must not post twice. */
const started = new Set<number>();

export const MIGRATED_TOAST = 'Moved your notes from this device to the trip.';

export interface LegacyMigrationOptions {
  /** Notes finished loading without an error. */
  ready: boolean;
  canEdit: boolean;
  notes: readonly Note[];
  createNote: (data: NoteInput) => Promise<unknown>;
}

export function useLegacyNotesMigration(tripId: number, { ready, canEdit, notes, createNote }: LegacyMigrationOptions) {
  const latest = useRef({ notes, createNote });
  latest.current = { notes, createNote };

  useEffect(() => {
    if (!ready || !canEdit || started.has(tripId)) return;
    started.add(tripId);
    void migrateLegacyNotes(tripId, latest.current.notes, { createNote: (d) => latest.current.createNote(d) }).then((r) => {
      if (r.status === 'moved') toast(MIGRATED_TOAST);
      // keys are kept on failure; allow another try on the next visit
      if (r.status === 'failed') started.delete(tripId);
    });
  }, [tripId, ready, canEdit]);
}

/** Tests only. */
export function resetLegacyMigrationGuard() {
  started.clear();
}
