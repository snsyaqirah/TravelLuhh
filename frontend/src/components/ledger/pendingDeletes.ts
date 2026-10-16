// Ledger delete with Undo (§9.6) that outlives whichever row or sheet started it. The entry leaves the list at
// once, a 5 s snackbar offers Undo, and the DELETE goes out when the timer ends, when the ledger unmounts or
// the route changes (LedgerTab flushes), or when the page is hidden (sent with fetch keepalive so it isn't
// cancelled with the page). No confirm dialog. useExpenses hides pending ids from every list it returns.
//
// Same behaviour as useExpenses().removeWithUndo, but the pending state lives here rather than in a hook
// instance: the expense detail sheet is unmounted the moment it closes, and a hook-held undo would be sent
// (and its snackbar dismissed) right then.
import { useSyncExternalStore } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Expense } from '@/types';
import { expenseService } from '@/services/expenseService';
import { getErrorMessage } from '@/lib/axios';
import { invalidateKeys, moneyKeys, queryKeys } from '@/lib/queryClient';
import { appEvents } from '@/lib/appEvents';
import { keepaliveDelete, onPageHidden } from '@/lib/keepaliveDelete';
import { apiPaths } from '@/services/apiPaths';

export const UNDO_MS = 5000;

interface Pending {
  expense: Expense;
  qc: QueryClient;
  index: number;
  timer: ReturnType<typeof setTimeout>;
  toastId: string | number;
}

const pending = new Map<number, Pending>();
const listeners = new Set<() => void>();
let snapshot: ReadonlySet<number> = new Set();

function publish() {
  snapshot = new Set(pending.keys());
  listeners.forEach((l) => l());
}

function restore(p: Pending) {
  p.qc.setQueryData<Expense[]>(queryKeys.expenses(p.expense.tripId), (old) => {
    if (!old || old.some((x) => x.id === p.expense.id)) return old;
    const copy = [...old];
    copy.splice(Math.min(p.index, copy.length), 0, p.expense);
    return copy;
  });
}

function commit(id: number, o: { keepalive?: boolean } = {}) {
  const p = pending.get(id);
  if (!p) return;
  clearTimeout(p.timer);
  pending.delete(id);
  toast.dismiss(p.toastId);
  publish();
  const e = p.expense;
  const send = () => expenseService.deleteExpense(e.id);
  (o.keepalive ? keepaliveDelete(apiPaths.expense(e.id), send) : send()).then(
    () => {
      void invalidateKeys(p.qc, moneyKeys(e.tripId));
      appEvents.emit({ type: 'coinBack', tripId: e.tripId, date: e.expenseDate, category: e.category, amount: e.amount });
    },
    (err) => {
      restore(p);
      toast.error(getErrorMessage(err, "That entry wasn't removed. Try again."));
    },
  );
}

/** Put a removed entry back (the snackbar's Undo). */
export function undoExpenseRemoval(id: number) {
  const p = pending.get(id);
  if (!p) return;
  clearTimeout(p.timer);
  pending.delete(id);
  toast.dismiss(p.toastId);
  restore(p);
  publish();
}

/** Send every pending DELETE now (ledger unmount, route change; `keepalive` when the page is going away). */
export function flushExpenseRemovals(o: { keepalive?: boolean } = {}) {
  for (const id of Array.from(pending.keys())) commit(id, o);
}

/** Remove now (visually), delete for real after the undo window. */
export function removeExpenseWithUndo(qc: QueryClient, expense: Expense) {
  if (pending.has(expense.id)) return;
  let index = 0;
  qc.setQueryData<Expense[]>(queryKeys.expenses(expense.tripId), (old) => {
    if (!old) return old;
    index = Math.max(
      0,
      old.findIndex((x) => x.id === expense.id),
    );
    return old.filter((x) => x.id !== expense.id);
  });
  const toastId = toast(`Removed "${expense.description}".`, {
    duration: UNDO_MS,
    action: { label: 'Undo', onClick: () => undoExpenseRemoval(expense.id) },
  });
  const timer = setTimeout(() => commit(expense.id), UNDO_MS);
  pending.set(expense.id, { expense, qc, index, timer, toastId });
  publish();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Ids removed but not yet deleted: filter them out of anything rendered from a refetched list. */
export function usePendingExpenseDeletes(): ReadonlySet<number> {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
}

onPageHidden(() => flushExpenseRemovals({ keepalive: true }));

/** Tests only: forget pending deletes without sending them. */
export function resetPendingDeletesForTests() {
  for (const p of pending.values()) clearTimeout(p.timer);
  pending.clear();
  publish();
}
