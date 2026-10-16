import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Member, Role } from '@/types';
import { memberService } from '@/services/memberService';
import { AppError, getErrorMessage, toAppError } from '@/lib/axios';
import { invalidateKeys, queryKeys } from '@/lib/queryClient';
import { toId } from '@/lib/ids';

const EMPTY: Member[] = [];
type MemberRole = Exclude<Role, 'owner'>;

export function useMembers(tripId: number | string | undefined, opts: { enabled?: boolean } = {}) {
  const id = toId(tripId);
  const qc = useQueryClient();
  const key = queryKeys.members(id ?? 0);

  const query = useQuery({
    queryKey: key,
    queryFn: () => memberService.list(id as number),
    enabled: id !== undefined && opts.enabled !== false,
  });

  const refresh = () =>
    id
      ? invalidateKeys(qc, [
          key,
          queryKeys.trip(id),
          queryKeys.tripsAll,
          queryKeys.activity(id),
          queryKeys.settlement(id),
          queryKeys.budgets(id),
        ])
      : Promise.resolve();

  const need = () => {
    if (!id) throw new AppError('This trip could not be found.');
    return id;
  };

  const add = useMutation({
    mutationFn: ({ email, role }: { email: string; role: MemberRole }) =>
      memberService.add(need(), { email: email.trim(), role }),
    onSuccess: () => void refresh(),
  });
  const changeRole = useMutation({
    mutationFn: ({ memberId, role }: { memberId: number; role: MemberRole }) =>
      memberService.updateRole(need(), memberId, role),
    onSuccess: () => void refresh(),
  });
  const remove = useMutation({
    mutationFn: (memberId: number) => memberService.remove(need(), memberId),
    onSuccess: () => void refresh(),
  });
  const leave = useMutation({
    mutationFn: () => memberService.leave(need()),
    onSuccess: () => {
      if (!id) return;
      qc.removeQueries({ queryKey: queryKeys.trip(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.tripsAll });
    },
  });

  const { mutateAsync: addAsync } = add;
  const { mutateAsync: roleAsync } = changeRole;
  const { mutateAsync: removeAsync } = remove;
  const { mutateAsync: leaveAsync } = leave;
  const fail = (e: unknown) => Promise.reject(toAppError(e));

  return {
    members: query.data ?? EMPTY,
    isLoading: query.isLoading,
    error: query.error ? getErrorMessage(query.error) : null,
    refetch: query.refetch,
    /** Owner only. Rejects with the server's message (no account yet → 404, already in → 409). */
    addMember: useCallback((email: string, role: MemberRole) => addAsync({ email, role }).catch(fail), [addAsync]),
    updateRole: useCallback(
      (memberId: number, role: MemberRole) => roleAsync({ memberId, role }).catch(fail),
      [roleAsync]
    ),
    removeMember: useCallback((memberId: number) => removeAsync(memberId).catch(fail), [removeAsync]),
    leaveTrip: useCallback(() => leaveAsync().catch(fail), [leaveAsync]),
    isSaving: add.isPending || changeRole.isPending || remove.isPending || leave.isPending,
  };
}
