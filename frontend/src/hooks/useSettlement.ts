import { useQuery } from '@tanstack/react-query';
import { settlementService } from '@/services/settlementService';
import { getErrorMessage } from '@/lib/axios';
import { queryKeys } from '@/lib/queryClient';
import { toId } from '@/lib/ids';

const LIVE_POLL_MS = 25_000;

/** Kongsi: who paid what and the fewest transfers to square up. */
export function useSettlement(tripId: number | string | undefined, opts: { enabled?: boolean; live?: boolean } = {}) {
  const id = toId(tripId);
  const query = useQuery({
    queryKey: queryKeys.settlement(id ?? 0),
    queryFn: () => settlementService.get(id as number),
    enabled: id !== undefined && opts.enabled !== false,
    refetchInterval: opts.live ? LIVE_POLL_MS : false,
  });
  const settlement = query.data ?? null;
  return {
    settlement,
    /** No transfers needed (and something was spent). */
    isSettled: Boolean(settlement && settlement.totalSpent > 0 && settlement.transactions.length === 0),
    isLoading: query.isLoading,
    error: query.error ? getErrorMessage(query.error) : null,
    refetch: query.refetch,
  };
}
