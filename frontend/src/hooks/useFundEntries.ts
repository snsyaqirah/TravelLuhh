import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FundEntry, FundEntryInput } from '@/types';
import { fundService } from '@/services/fundService';
import { AppError, getErrorMessage, toAppError } from '@/lib/axios';
import { invalidateKeys, queryKeys } from '@/lib/queryClient';
import { toId } from '@/lib/ids';
import { appEvents } from '@/lib/appEvents';

const EMPTY: FundEntry[] = [];

/** Travel fund entries ("Drop in"). The jar maths stays in useFund, fed by trip.savedAmount. */
export function useFundEntries(tripId: number | string | undefined, opts: { enabled?: boolean } = {}) {
  const id = toId(tripId);
  const qc = useQueryClient();
  const key = queryKeys.fund(id ?? 0);

  const query = useQuery({
    queryKey: key,
    queryFn: () => fundService.get(id as number),
    enabled: id !== undefined && opts.enabled !== false,
  });

  const refresh = () =>
    id ? invalidateKeys(qc, [key, queryKeys.trip(id), queryKeys.tripsAll, queryKeys.activity(id)]) : Promise.resolve();

  const add = useMutation({
    mutationFn: (data: FundEntryInput) => {
      if (!id) throw new AppError('This trip could not be found.');
      if (!Number.isFinite(data.amount) || data.amount === 0) throw new AppError('Enter an amount to drop in.');
      return fundService.add(id, data);
    },
    onSuccess: (entry) => {
      void refresh();
      if (id) appEvents.emit({ type: 'fundIn', tripId: id, amount: entry.amount });
    },
  });

  const remove = useMutation({
    mutationFn: async (entryId: number) => {
      if (!id) throw new AppError('This trip could not be found.');
      await fundService.remove(id, entryId);
      return entryId;
    },
    onSuccess: () => void refresh(),
  });

  const { mutateAsync: addAsync } = add;
  const { mutateAsync: removeAsync } = remove;
  const fail = (e: unknown) => Promise.reject(toAppError(e));

  return {
    summary: query.data ?? null,
    entries: query.data?.entries ?? EMPTY,
    saved: query.data?.saved ?? 0,
    target: query.data?.target ?? 0,
    isLoading: query.isLoading,
    error: query.error ? getErrorMessage(query.error) : null,
    refetch: query.refetch,
    addEntry: useCallback((data: FundEntryInput) => addAsync(data).catch(fail), [addAsync]),
    deleteEntry: useCallback((entryId: number) => removeAsync(entryId).then(() => undefined, fail), [removeAsync]),
    isSaving: add.isPending,
  };
}
