import { useQuery } from '@tanstack/react-query';
import type { Activity } from '@/types';
import { activityService } from '@/services/activityService';
import { getErrorMessage } from '@/lib/axios';
import { queryKeys } from '@/lib/queryClient';
import { toId } from '@/lib/ids';

const EMPTY: Activity[] = [];
const LIVE_POLL_MS = 25_000;

/** Logbook: newest first, max 100. */
export function useActivity(tripId: number | string | undefined, opts: { enabled?: boolean; live?: boolean } = {}) {
  const id = toId(tripId);
  const query = useQuery({
    queryKey: queryKeys.activity(id ?? 0),
    queryFn: () => activityService.list(id as number),
    enabled: id !== undefined && opts.enabled !== false,
    refetchInterval: opts.live ? LIVE_POLL_MS : false,
  });
  return {
    activities: query.data ?? EMPTY,
    isLoading: query.isLoading,
    error: query.error ? getErrorMessage(query.error) : null,
    refetch: query.refetch,
  };
}
