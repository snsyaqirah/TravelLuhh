import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateItineraryItemRequest, ItineraryItem } from '@/types';
import { itineraryService } from '@/services/itineraryService';
import { AppError, getErrorMessage, toAppError } from '@/lib/axios';
import { queryKeys } from '@/lib/queryClient';
import { toId } from '@/lib/ids';

const EMPTY: ItineraryItem[] = [];

/** By date, then start time (unscheduled last), then the server's sort order. */
function sortItems(list: ItineraryItem[]): ItineraryItem[] {
  return [...list].sort((a, b) => {
    const d = a.itemDate.localeCompare(b.itemDate);
    if (d) return d;
    if (a.startTime && b.startTime) {
      const t = a.startTime.localeCompare(b.startTime);
      if (t) return t;
    } else if (a.startTime || b.startTime) {
      return a.startTime ? -1 : 1;
    }
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id;
  });
}

export function useItinerary(tripId: number | string | undefined) {
  const id = toId(tripId);
  const qc = useQueryClient();
  const key = queryKeys.itinerary(id ?? 0);

  const query = useQuery({
    queryKey: key,
    queryFn: () => itineraryService.getItems(id as number),
    enabled: id !== undefined,
    select: sortItems,
  });

  const touch = () => {
    void qc.invalidateQueries({ queryKey: key });
    if (id) void qc.invalidateQueries({ queryKey: queryKeys.activity(id) });
  };

  const add = useMutation({
    mutationFn: (data: CreateItineraryItemRequest) => {
      if (!id) throw new AppError('This trip could not be found.');
      return itineraryService.addItem(id, data);
    },
    onSuccess: (item) => {
      qc.setQueryData<ItineraryItem[]>(key, (old) => [...(old ?? []), item]);
      touch();
    },
  });

  const update = useMutation({
    mutationFn: ({ itemId, data }: { itemId: number; data: CreateItineraryItemRequest }) => {
      if (!id) throw new AppError('This trip could not be found.');
      return itineraryService.updateItem(id, itemId, data);
    },
    onSuccess: (item) => {
      qc.setQueryData<ItineraryItem[]>(key, (old) => (old ?? []).map((i) => (i.id === item.id ? item : i)));
      touch();
    },
  });

  const remove = useMutation({
    mutationFn: async (itemId: number) => {
      if (!id) throw new AppError('This trip could not be found.');
      await itineraryService.deleteItem(id, itemId);
      return itemId;
    },
    onSuccess: (itemId) => {
      qc.setQueryData<ItineraryItem[]>(key, (old) => old?.filter((i) => i.id !== itemId));
      touch();
    },
  });

  const { mutateAsync: addAsync } = add;
  const { mutateAsync: updateAsync } = update;
  const { mutateAsync: removeAsync } = remove;

  const items = query.data ?? EMPTY;
  const itemsByDate = useMemo(() => {
    const out: Record<string, ItineraryItem[]> = {};
    for (const i of items) (out[i.itemDate] ??= []).push(i);
    return out;
  }, [items]);

  return {
    items,
    itemsByDate,
    isLoading: query.isLoading,
    error: query.error ? getErrorMessage(query.error) : null,
    refetch: query.refetch,
    addItem: useCallback(
      (data: CreateItineraryItemRequest) => addAsync(data).catch((e) => Promise.reject(toAppError(e))),
      [addAsync]
    ),
    updateItem: useCallback(
      (itemId: number, data: CreateItineraryItemRequest) =>
        updateAsync({ itemId, data }).catch((e) => Promise.reject(toAppError(e))),
      [updateAsync]
    ),
    deleteItem: useCallback(
      (itemId: number) => removeAsync(itemId).then(() => undefined, (e) => Promise.reject(toAppError(e))),
      [removeAsync]
    ),
    isSaving: add.isPending || update.isPending,
  };
}
