import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

// Sheets on the trip page live in the URL (?sheet=…&id=…) so Back closes them and links can open them.
// The shell hides the BottomBar whenever ?sheet is present.
//
// History: opening a sheet from the app pushes one entry marked with IN_APP_SHEET_STATE. Closing it (X, Esc,
// Save) goes back over that entry, so the next Back leaves the trip page instead of landing on the same page
// again. A sheet reached by a link or a reload of a deep link has no marker: closing it replaces the entry.
// Handing one sheet to the next (receipt → Edit) replaces the entry and keeps its marker, so Save → Back never
// reopens the receipt.
export const TRIP_SHEETS = ['log-spend', 'logbook', 'edit', 'people', 'drop-in', 'expense'] as const;
export type TripSheet = (typeof TRIP_SHEETS)[number];

/** Location state for a sheet entry pushed from inside the app (also used by the shell's FAB). */
export const IN_APP_SHEET_STATE = { inAppSheet: true } as const;

export function isTripSheet(value: string | null): value is TripSheet {
  return value !== null && (TRIP_SHEETS as readonly string[]).includes(value);
}

function isInAppSheetEntry(state: unknown): boolean {
  return typeof state === 'object' && state !== null && (state as { inAppSheet?: unknown }).inAppSheet === true;
}

export interface OpenSheetOptions {
  id?: number;
  /** Swap the sheet in place (sheet-to-sheet hand-off) instead of adding a history entry. */
  replace?: boolean;
}

export interface TripSheetState {
  sheet: TripSheet | null;
  /** Entity id for sheets that need one, e.g. ?sheet=expense&id=42 (also the expense being edited in log-spend). */
  id: number | null;
  open: (sheet: TripSheet, opts?: OpenSheetOptions) => void;
  close: () => void;
}

export function useTripSheet(): TripSheetState {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const raw = params.get('sheet');
  const sheet = isTripSheet(raw) ? raw : null;
  const idParam = Number(params.get('id'));
  const id = Number.isFinite(idParam) && idParam > 0 ? idParam : null;
  const inApp = Boolean(sheet) && isInAppSheetEntry(location.state);
  const entryKey = location.key;
  // One close per history entry: a second close() before the Back lands (Save then onOpenChange) must not
  // step back a second time and leave the trip.
  const closedKey = useRef<string | null>(null);
  useEffect(() => {
    // A new entry (or Forward back onto this one) can be closed again.
    closedKey.current = null;
  }, [entryKey]);

  const open = useCallback(
    (next: TripSheet, opts?: OpenSheetOptions) => {
      const replace = Boolean(opts?.replace);
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set('sheet', next);
          if (opts?.id !== undefined) p.set('id', String(opts.id));
          else p.delete('id');
          return p;
        },
        // A hand-off keeps the current entry's marker: in-app stays in-app, a deep link stays a deep link.
        replace ? { replace: true, state: inApp ? IN_APP_SHEET_STATE : null } : { state: IN_APP_SHEET_STATE },
      );
    },
    [setParams, inApp],
  );

  const close = useCallback(() => {
    if (closedKey.current === entryKey) return;
    if (inApp) {
      closedKey.current = entryKey;
      navigate(-1);
      return;
    }
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete('sheet');
        p.delete('id');
        return p;
      },
      { replace: true },
    );
  }, [setParams, navigate, inApp, entryKey]);

  return { sheet, id, open, close };
}
