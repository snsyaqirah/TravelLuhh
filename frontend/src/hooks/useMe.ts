import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { User } from '@/types';
import { userService } from '@/services/userService';
import { useAuth } from '@/context/AuthContext';
import { getErrorMessage } from '@/lib/axios';
import { queryKeys } from '@/lib/queryClient';

const same = (a: User | null | undefined, b: User | null | undefined) => JSON.stringify(a) === JSON.stringify(b);

/** The signed-in user from /users/me, kept in sync with AuthContext. */
export function useMe() {
  const { user, isAuthenticated, updateUser, updateProfile, changePassword, isGoogleOnly } = useAuth();
  const [isChangingPassword, setChanging] = useState(false);

  const query = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => userService.getMe(),
    enabled: isAuthenticated,
    initialData: user ?? undefined,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (query.data && !same(query.data, user)) updateUser(query.data);
    // user is deliberately not a dependency: only push server data into the context, never back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, updateUser]);


  return {
    user: query.data ?? user,
    isLoading: query.isLoading,
    error: query.error ? getErrorMessage(query.error) : null,
    refetch: query.refetch,
    updateProfile,
    /** Hidden for Google-only accounts (isGoogleOnly). */
    /** Resolves the server's confirmation sentence; rejects with an AppError (wrong current password is a 400). */
    changePassword: useCallback(
      async (currentPassword: string, newPassword: string) => {
        setChanging(true);
        try {
          return await changePassword(currentPassword, newPassword);
        } finally {
          setChanging(false);
        }
      },
      [changePassword]
    ),
    isChangingPassword,
    isGoogleOnly,
  };
}
