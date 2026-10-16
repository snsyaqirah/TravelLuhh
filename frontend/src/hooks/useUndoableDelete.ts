// Delete with undo (spec §9.6 ledger): the row leaves the cache at once, a snackbar offers Undo for 5 s, and
// the DELETE is only sent when the timer ends — or immediately when the component unmounts, `flushKey`
// changes (route change) or the page is being hidden. No confirm dialog.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/axios';

export interface UndoableDeleteOptions<T extends { id: number }> {
  /** List cache the item lives in (an array of T). */
  queryKey: QueryKey;
  /** Sends the DELETE. */
  remove: (item: T) => Promise<unknown>;
  /** Snackbar text, e.g. 'Removed "Ramen Ichiran".' */
  message: (item: T) => string;
  onCommitted?: (item: T) => void;
  onFailed?: (item: T, error: unknown) => void;
  timeoutMs?: number;
  undoLabel?: string;
  /** Pending deletes are sent when this value changes. Pass the current pathname. */
  flushKey?: unknown;
}

interface Pending<T> {
  item: T;
  index: number;
  timer: number;
  toastId: string | number;
}

export interface UndoableDelete<T> {
  /** Remove now (visually), delete for real after the undo window. */
  remove: (item: T) => void;
  undo: (id: number) => void;
  /** Send every pending DELETE now. */
  flush: () => void;
  /** Ids hidden but not yet deleted; filter them out of anything rendered from a refetched list. */
  pendingIds: ReadonlySet<number>;
}

export function useUndoableDelete<T extends { id: number }>(opts: UndoableDeleteOptions<T>): UndoableDelete<T> {
  const qc = useQueryClient();
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const pending = useRef(new Map<number, Pending<T>>());
  const [pendingIds, setPendingIds] = useState<ReadonlySet<number>>(() => new Set());
  const mounted = useRef(true);

  const syncIds = useCallback(() => {
    if (mounted.current) setPendingIds(new Set(pending.current.keys()));
  }, []);

  const restore = useCallback(
    (p: Pending<T>) => {
      qc.setQueryData<T[]>(optsRef.current.queryKey, (old) => {
        if (!old || old.some((x) => x.id === p.item.id)) return old;
        const copy = [...old];
        copy.splice(Math.min(p.index, copy.length), 0, p.item);
        return copy;
      });
    },
    [qc]
  );

  const commit = useCallback(
    (id: number) => {
      const p = pending.current.get(id);
      if (!p) return;
      window.clearTimeout(p.timer);
      pending.current.delete(id);
      toast.dismiss(p.toastId);
      syncIds();
      const { remove, onCommitted, onFailed } = optsRef.current;
      remove(p.item).then(
        () => onCommitted?.(p.item),
        (err) => {
          restore(p);
          toast.error(getErrorMessage(err));
          onFailed?.(p.item, err);
        }
      );
    },
    [restore, syncIds]
  );

  const flush = useCallback(() => {
    for (const id of Array.from(pending.current.keys())) commit(id);
  }, [commit]);

  const undo = useCallback(
    (id: number) => {
      const p = pending.current.get(id);
      if (!p) return;
      window.clearTimeout(p.timer);
      pending.current.delete(id);
      toast.dismiss(p.toastId);
      restore(p);
      syncIds();
    },
    [restore, syncIds]
  );

  const remove = useCallback(
    (item: T) => {
      if (pending.current.has(item.id)) return;
      const { queryKey, message, timeoutMs = 5000, undoLabel = 'Undo' } = optsRef.current;
      let index = 0;
      qc.setQueryData<T[]>(queryKey, (old) => {
        if (!old) return old;
        index = Math.max(0, old.findIndex((x) => x.id === item.id));
        return old.filter((x) => x.id !== item.id);
      });
      const toastId = toast(message(item), {
        duration: timeoutMs,
        action: { label: undoLabel, onClick: () => undo(item.id) },
      });
      const timer = window.setTimeout(() => commit(item.id), timeoutMs);
      pending.current.set(item.id, { item, index, timer, toastId });
      syncIds();
    },
    [qc, commit, undo, syncIds]
  );

  // Route change (flushKey) and unmount: send what is pending rather than lose it.
  useEffect(() => {
    return () => flush();
  }, [opts.flushKey, flush]);

  useEffect(() => {
    mounted.current = true;
    const onHide = () => flush();
    window.addEventListener('pagehide', onHide);
    return () => {
      mounted.current = false;
      window.removeEventListener('pagehide', onHide);
    };
  }, [flush]);

  return { remove, undo, flush, pendingIds };
}
