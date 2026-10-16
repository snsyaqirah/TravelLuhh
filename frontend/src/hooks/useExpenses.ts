import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
  CreateExpenseInput,
  CreateExpenseRequest,
  Expense,
  ExpenseCategory,
  Trip,
  UpdateExpenseInput,
} from '@/types';
import { expenseService } from '@/services/expenseService';
import { tripService } from '@/services/tripService';
import { currencyService } from '@/services/currencyService';
import { AppError, getErrorMessage, toAppError } from '@/lib/axios';
import { invalidateKeys, moneyKeys, queryKeys } from '@/lib/queryClient';
import { toTripCurrency } from '@/lib/money';
import { toId } from '@/lib/ids';
import { appEvents } from '@/lib/appEvents';
import { useUndoableDelete } from '@/hooks/useUndoableDelete';
import { usePendingExpenseDeletes } from '@/components/ledger/pendingDeletes';
import { apiPaths } from '@/services/apiPaths';

const EMPTY: Expense[] = [];
const LIVE_POLL_MS = 25_000;

/** Newest date first, then newest entry first (matches the API order). */
function sortExpenses(list: Expense[]): Expense[] {
  return [...list].sort(
    (a, b) => b.expenseDate.localeCompare(a.expenseDate) || (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.id - a.id
  );
}

async function tripCurrencyOf(qc: QueryClient, tripId: number): Promise<string | null> {
  try {
    const trip = await qc.ensureQueryData<Trip>({
      queryKey: queryKeys.trip(tripId),
      queryFn: () => tripService.getTripById(tripId),
    });
    return trip?.currency ?? null;
  } catch {
    return null;
  }
}

/**
 * Build the wire body. If the money is still in a foreign currency, convert it to the trip currency here
 * (§2.6) so no caller can send yen to a ringgit trip.
 */
async function toRequest(qc: QueryClient, input: CreateExpenseInput, tripId: number): Promise<CreateExpenseRequest> {
  const expenseDate = input.expenseDate ?? input.date;
  if (!expenseDate) throw new AppError('Pick a date for this spend.');
  let money: Pick<CreateExpenseRequest, 'amount' | 'currency' | 'originalAmount' | 'originalCurrency' | 'fxRate'> = {
    amount: input.amount,
    currency: input.currency,
    originalAmount: input.originalAmount,
    originalCurrency: input.originalCurrency,
    fxRate: input.fxRate,
  };
  if (input.originalAmount == null) {
    const tripCurrency = await tripCurrencyOf(qc, tripId);
    if (tripCurrency && tripCurrency.toUpperCase() !== input.currency.toUpperCase()) {
      const rate = await currencyService.getRate(input.currency, tripCurrency).catch(() => null);
      const converted = rate
        ? toTripCurrency({ amount: input.amount, currency: input.currency }, tripCurrency, null, rate.rate)
        : null;
      if (!converted) {
        throw new AppError(
          `No rate for ${input.currency.toUpperCase()} today. Enter the amount in ${tripCurrency} instead.`
        );
      }
      money = converted;
    }
  }
  const body: CreateExpenseRequest = {
    tripId,
    description: input.description.trim(),
    category: input.category,
    expenseDate,
    ...money,
    notes: input.notes || undefined,
    paidBy: input.paidBy,
    subItems: input.subItems?.length ? input.subItems : undefined,
  };
  return body;
}

export interface UseExpensesOptions {
  /** Poll every 25 s (group trips on the road). */
  live?: boolean;
  enabled?: boolean;
  /** Pending undo-deletes are sent when this changes; pass the pathname. */
  flushKey?: unknown;
}

export function useExpenses(tripId: number | string | undefined, opts: UseExpensesOptions = {}) {
  const id = toId(tripId);
  const qc = useQueryClient();
  const key = queryKeys.expenses(id ?? 0);

  const query = useQuery({
    queryKey: key,
    queryFn: () => expenseService.getExpensesByTrip(id as number),
    enabled: id !== undefined && opts.enabled !== false,
    refetchInterval: opts.live ? LIVE_POLL_MS : false,
  });

  const refreshMoney = useCallback(() => (id ? invalidateKeys(qc, moneyKeys(id)) : Promise.resolve()), [qc, id]);

  const createMutation = useMutation({
    mutationFn: async (input: CreateExpenseInput) => {
      if (!id) throw new AppError('This trip could not be found.');
      return expenseService.createExpense(await toRequest(qc, input, id));
    },
    onSuccess: (expense) => {
      qc.setQueryData<Expense[]>(key, (old) => sortExpenses([expense, ...(old ?? []).filter((e) => e.id !== expense.id)]));
      void refreshMoney();
      appEvents.emit({
        type: 'coinOut',
        tripId: expense.tripId,
        date: expense.expenseDate,
        category: expense.category,
        amount: expense.amount,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (input: UpdateExpenseInput) => {
      const expenseId = toId(input.id);
      if (!id || !expenseId) throw new AppError('That entry could not be found.');
      return expenseService.updateExpense(expenseId, await toRequest(qc, input, id));
    },
    onSuccess: (expense) => {
      qc.setQueryData<Expense[]>(key, (old) => sortExpenses((old ?? []).map((e) => (e.id === expense.id ? expense : e))));
      void refreshMoney();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (expenseId: number) => {
      await expenseService.deleteExpense(expenseId);
      return expenseId;
    },
    onSuccess: (expenseId) => {
      const gone = qc.getQueryData<Expense[]>(key)?.find((e) => e.id === expenseId);
      qc.setQueryData<Expense[]>(key, (old) => old?.filter((e) => e.id !== expenseId));
      void refreshMoney();
      if (gone) {
        appEvents.emit({ type: 'coinBack', tripId: gone.tripId, date: gone.expenseDate, category: gone.category, amount: gone.amount });
      }
    },
  });

  const undoable = useUndoableDelete<Expense>({
    queryKey: key,
    remove: (e) => expenseService.deleteExpense(e.id),
    hidePath: (e) => apiPaths.expense(e.id),
    message: (e) => `Removed "${e.description}".`,
    flushKey: opts.flushKey,
    onCommitted: (e) => {
      void refreshMoney();
      appEvents.emit({ type: 'coinBack', tripId: e.tripId, date: e.expenseDate, category: e.category, amount: e.amount });
    },
  });

  const { mutateAsync: createAsync } = createMutation;
  const { mutateAsync: updateAsync } = updateMutation;
  const { mutateAsync: deleteAsync } = deleteMutation;

  const raw = query.data ?? EMPTY;
  const { pendingIds } = undoable;
  // Entries removed with Undo (from any ledger row or receipt) stay hidden until their DELETE goes out, even
  // when a 25 s poll or a focus refetch brings them back: figures, the scene, counts and exports all agree.
  const sharedPendingIds = usePendingExpenseDeletes();
  const expenses = useMemo(
    () =>
      pendingIds.size || sharedPendingIds.size
        ? raw.filter((e) => !pendingIds.has(e.id) && !sharedPendingIds.has(e.id))
        : raw,
    [raw, pendingIds, sharedPendingIds]
  );

  const totals = useMemo(() => {
    const byCategory = {} as Record<ExpenseCategory, number>;
    const byDay: Record<string, number> = {};
    let total = 0;
    for (const e of expenses) {
      const amount = Number(e.amount) || 0;
      byCategory[e.category] = (byCategory[e.category] ?? 0) + amount;
      byDay[e.expenseDate] = (byDay[e.expenseDate] ?? 0) + amount;
      total += amount;
    }
    return { byCategory, byDay, total };
  }, [expenses]);

  // Imperative helpers keep the pre-revamp signatures and throw an AppError with a readable message.
  const createExpense = useCallback(
    async (input: CreateExpenseInput) => {
      try {
        return await createAsync(input);
      } catch (e) {
        throw toAppError(e, "That spend didn't save. Try again.");
      }
    },
    [createAsync]
  );

  const updateExpense = useCallback(
    async (input: UpdateExpenseInput) => {
      try {
        return await updateAsync(input);
      } catch (e) {
        throw toAppError(e, "Changes didn't save. Try again.");
      }
    },
    [updateAsync]
  );

  const deleteExpense = useCallback(
    async (expenseId: number | string) => {
      const eid = toId(expenseId);
      if (!eid) return;
      try {
        await deleteAsync(eid);
      } catch (e) {
        throw toAppError(e, "That entry wasn't removed. Try again.");
      }
    },
    [deleteAsync]
  );

  const filterByCategory = useCallback((category: ExpenseCategory) => expenses.filter((e) => e.category === category), [expenses]);

  const searchExpenses = useCallback(
    (q: string) => {
      const s = q.trim().toLowerCase();
      if (!s) return expenses;
      return expenses.filter(
        (e) =>
          e.description.toLowerCase().includes(s) ||
          e.category.toLowerCase().includes(s) ||
          (e.notes ?? '').toLowerCase().includes(s)
      );
    },
    [expenses]
  );

  const getTotalByCategory = useCallback(() => totals.byCategory, [totals]);
  const getTotalSpent = useCallback(() => totals.total, [totals]);

  return {
    expenses,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ? getErrorMessage(query.error) : null,
    refetch: query.refetch,
    /** @deprecated use refetch */
    fetchExpenses: query.refetch,
    createExpense,
    updateExpense,
    deleteExpense,
    /** Ledger delete with a 5 s Undo snackbar (§9.6). */
    removeWithUndo: undoable.remove,
    undoRemove: undoable.undo,
    flushRemovals: undoable.flush,
    isSaving: createMutation.isPending || updateMutation.isPending,
    filterByCategory,
    searchExpenses,
    getTotalByCategory,
    getTotalSpent,
    /** Trip currency totals. */
    totalSpent: totals.total,
    totalsByCategory: totals.byCategory,
    /** 'YYYY-MM-DD' → spent that day. */
    spentByDay: totals.byDay,
  };
}
