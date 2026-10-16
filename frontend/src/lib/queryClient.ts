import { QueryClient, type QueryKey } from '@tanstack/react-query';
import { getErrorStatus } from '@/lib/axios';

/** Statuses that will not get better by asking again. */
const NO_RETRY = new Set([400, 401, 403, 404, 409, 422]);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        const status = getErrorStatus(error);
        if (status !== undefined && NO_RETRY.has(status)) return false;
        return failureCount < 1;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

/** Query keys. Prefix keys ('trips', 'fx') invalidate every variant below them. */
export const queryKeys = {
  me: ['me'] as const,
  tripsAll: ['trips'] as const,
  trips: (archived = false) => ['trips', { archived }] as const,
  trip: (tripId: number) => ['trip', tripId] as const,
  expenses: (tripId: number) => ['expenses', tripId] as const,
  itinerary: (tripId: number) => ['itinerary', tripId] as const,
  packing: (tripId: number) => ['packing', tripId] as const,
  members: (tripId: number) => ['members', tripId] as const,
  budgets: (tripId: number) => ['budgets', tripId] as const,
  notes: (tripId: number) => ['notes', tripId] as const,
  fund: (tripId: number) => ['fund', tripId] as const,
  settlement: (tripId: number) => ['settlement', tripId] as const,
  activity: (tripId: number) => ['activity', tripId] as const,
  ratesAll: ['fx'] as const,
  rates: (base: string) => ['fx', base.toUpperCase()] as const,
  rateHistory: (base: string, quotes: string[], from: string, to: string) =>
    ['fx-history', base.toUpperCase(), [...quotes].sort().join(','), from, to] as const,
} satisfies Record<string, QueryKey | ((...args: never[]) => QueryKey)>;

/** Everything whose numbers move when an expense is added, edited or removed. */
export function moneyKeys(tripId: number): QueryKey[] {
  return [
    queryKeys.expenses(tripId),
    queryKeys.trip(tripId),
    queryKeys.tripsAll,
    queryKeys.settlement(tripId),
    queryKeys.activity(tripId),
    queryKeys.budgets(tripId),
  ];
}

export function invalidateKeys(client: QueryClient, keys: QueryKey[]): Promise<void> {
  return Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey }))).then(() => undefined);
}
