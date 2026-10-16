import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

// Sheets on the trip page live in the URL (?sheet=…&id=…) so Back closes them and links can open them.
// The shell hides the BottomBar whenever ?sheet is present.
export const TRIP_SHEETS = ['log-spend', 'logbook', 'edit', 'people', 'drop-in', 'expense'] as const;
export type TripSheet = (typeof TRIP_SHEETS)[number];

export function isTripSheet(value: string | null): value is TripSheet {
  return value !== null && (TRIP_SHEETS as readonly string[]).includes(value);
}

export interface TripSheetState {
  sheet: TripSheet | null;
  /** Entity id for sheets that need one, e.g. ?sheet=expense&id=42 (also the expense being edited in log-spend). */
  id: number | null;
  open: (sheet: TripSheet, opts?: { id?: number }) => void;
  close: () => void;
}

export function useTripSheet(): TripSheetState {
  const [params, setParams] = useSearchParams();
  const raw = params.get('sheet');
  const sheet = isTripSheet(raw) ? raw : null;
  const idParam = Number(params.get('id'));
  const id = Number.isFinite(idParam) && idParam > 0 ? idParam : null;

  const open = useCallback(
    (next: TripSheet, opts?: { id?: number }) => {
      setParams((prev) => {
        const p = new URLSearchParams(prev);
        p.set('sheet', next);
        if (opts?.id !== undefined) p.set('id', String(opts.id));
        else p.delete('id');
        return p;
      });
    },
    [setParams],
  );

  const close = useCallback(() => {
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete('sheet');
        p.delete('id');
        return p;
      },
      { replace: true },
    );
  }, [setParams]);

  return { sheet, id, open, close };
}
