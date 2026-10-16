import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MemberBudget, MemberBudgetInput } from '@/types';
import { budgetService } from '@/services/budgetService';
import { AppError, getErrorMessage, toAppError } from '@/lib/axios';
import { queryKeys } from '@/lib/queryClient';
import { toId } from '@/lib/ids';

const EMPTY: MemberBudget[] = [];

/** Separated-mode jars: one allocation per member. */
export function useBudgets(tripId: number | string | undefined, opts: { enabled?: boolean } = {}) {
  const id = toId(tripId);
  const qc = useQueryClient();
  const key = queryKeys.budgets(id ?? 0);

  const query = useQuery({
    queryKey: key,
    queryFn: () => budgetService.list(id as number),
    enabled: id !== undefined && opts.enabled !== false,
  });

  const save = useMutation({
    mutationFn: (rows: MemberBudgetInput[]) => {
      if (!id) throw new AppError('This trip could not be found.');
      return budgetService.save(id, rows);
    },
    onSuccess: (rows) => {
      qc.setQueryData(key, rows);
      if (id) void qc.invalidateQueries({ queryKey: queryKeys.activity(id) });
    },
  });
  const { mutateAsync: saveAsync } = save;

  const budgets = query.data ?? EMPTY;
  return {
    budgets,
    totalAllocated: budgets.reduce((s, b) => s + b.allocated, 0),
    isLoading: query.isLoading,
    error: query.error ? getErrorMessage(query.error) : null,
    refetch: query.refetch,
    /** Owner only. allocated 0 removes a member's jar. */
    saveBudgets: useCallback(
      (rows: MemberBudgetInput[]) => saveAsync(rows).catch((e) => Promise.reject(toAppError(e))),
      [saveAsync]
    ),
    isSaving: save.isPending,
  };
}
