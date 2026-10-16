import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PackingItem, PackingPreset } from '@/types';
import { packingService } from '@/services/packingService';
import { AppError, getErrorMessage, toAppError } from '@/lib/axios';
import { queryKeys } from '@/lib/queryClient';
import { toId } from '@/lib/ids';
import { appEvents } from '@/lib/appEvents';

const EMPTY: PackingItem[] = [];

export function usePacking(tripId: number | string | undefined) {
  const id = toId(tripId);
  const qc = useQueryClient();
  const key = queryKeys.packing(id ?? 0);
  const toggleKey = ['packing-toggle', id ?? 0];

  const query = useQuery({
    queryKey: key,
    queryFn: () => packingService.getItems(id as number),
    enabled: id !== undefined,
  });

  const touchActivity = () => {
    if (id) void qc.invalidateQueries({ queryKey: queryKeys.activity(id) });
  };

  const setChecked = (itemId: number, checked: boolean) =>
    qc.setQueryData<PackingItem[]>(key, (old) => old?.map((i) => (i.id === itemId ? { ...i, isChecked: checked } : i)));

  // Optimistic: the box hops into the case on tap; a failure puts it back.
  const toggle = useMutation({
    mutationKey: toggleKey,
    mutationFn: (itemId: number) => {
      if (!id) throw new AppError('This trip could not be found.');
      return packingService.toggleItem(id, itemId);
    },
    onMutate: async (itemId: number) => {
      await qc.cancelQueries({ queryKey: key });
      const before = qc.getQueryData<PackingItem[]>(key)?.find((i) => i.id === itemId);
      if (!before || !id) return { before };
      setChecked(itemId, !before.isChecked);
      appEvents.emit({ type: 'packToggled', tripId: id, itemId, checked: !before.isChecked });
      return { before };
    },
    onError: (_err, itemId, ctx) => {
      if (ctx?.before && id) {
        setChecked(itemId, ctx.before.isChecked);
        appEvents.emit({ type: 'packToggled', tripId: id, itemId, checked: ctx.before.isChecked });
      }
    },
    onSuccess: (item) => {
      qc.setQueryData<PackingItem[]>(key, (old) => old?.map((i) => (i.id === item.id ? item : i)));
    },
    onSettled: () => {
      // Refetch only once the last rapid tap has landed, so rows don't flicker back and forth.
      if (qc.isMutating({ mutationKey: toggleKey }) <= 1) void qc.invalidateQueries({ queryKey: key });
      touchActivity();
    },
  });

  const add = useMutation({
    mutationFn: ({ label, category }: { label: string; category?: string }) => {
      if (!id) throw new AppError('This trip could not be found.');
      return packingService.addItem(id, label.trim(), category);
    },
    onSuccess: (item) => {
      qc.setQueryData<PackingItem[]>(key, (old) => [...(old ?? []), item]);
      touchActivity();
    },
  });

  const remove = useMutation({
    mutationFn: async (itemId: number) => {
      if (!id) throw new AppError('This trip could not be found.');
      await packingService.deleteItem(id, itemId);
      return itemId;
    },
    onSuccess: (itemId) => {
      qc.setQueryData<PackingItem[]>(key, (old) => old?.filter((i) => i.id !== itemId));
      touchActivity();
    },
  });

  const preset = useMutation({
    mutationFn: (name: PackingPreset | string) => {
      if (!id) throw new AppError('This trip could not be found.');
      return packingService.addPreset(id, name);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key });
      touchActivity();
    },
  });

  const { mutateAsync: toggleAsync } = toggle;
  const { mutateAsync: addAsync } = add;
  const { mutateAsync: removeAsync } = remove;
  const { mutateAsync: presetAsync } = preset;

  const items = query.data ?? EMPTY;
  const packedCount = useMemo(() => items.filter((i) => i.isChecked).length, [items]);

  return {
    items,
    packedCount,
    total: items.length,
    /** 0..1 */
    progress: items.length ? packedCount / items.length : 0,
    isLoading: query.isLoading,
    error: query.error ? getErrorMessage(query.error) : null,
    refetch: query.refetch,
    toggleItem: useCallback(
      (itemId: number) => toggleAsync(itemId).then(() => undefined, (e) => Promise.reject(toAppError(e))),
      [toggleAsync]
    ),
    addItem: useCallback(
      (label: string, category?: string) =>
        addAsync({ label, category }).catch((e) => Promise.reject(toAppError(e))),
      [addAsync]
    ),
    deleteItem: useCallback(
      (itemId: number) => removeAsync(itemId).then(() => undefined, (e) => Promise.reject(toAppError(e))),
      [removeAsync]
    ),
    addPreset: useCallback(
      (name: PackingPreset | string) => presetAsync(name).catch((e) => Promise.reject(toAppError(e))),
      [presetAsync]
    ),
    isAddingPreset: preset.isPending,
  };
}
