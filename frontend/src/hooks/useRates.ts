import { useQuery } from '@tanstack/react-query';
import type { Rates } from '@/types';
import { queryKeys } from '@/lib/queryClient';
import { addCalendarDays, toISODate } from '@/lib/dates';
import { currencyService, FX_TTL_MS, readCachedRates, type RatePoint } from '@/services/currencyService';

export interface RatesState {
  /** rates[X] = X per 1 base. Null until the first load (or when nothing is cached and the API is down). */
  rates: Rates | null;
  /** Publication date of the rates ('YYYY-MM-DD'). */
  date: string | null;
  /** When we fetched them (ms epoch). */
  fetchedAt: number | null;
  /** Showing cached rates older than 12 h, or the last refresh failed. */
  isStale: boolean;
  isLoading: boolean;
  /** Human-readable, only when there is nothing to show at all. */
  error: string | null;
  refetch: () => void;
}

/**
 * Latest Frankfurter rates with `base` (the home currency) as the unit. Cached 12 h in localStorage
 * (travelluhh_fx_<BASE>); a cached table is shown immediately and refreshed in the background.
 */
export function useRates(base: string | null | undefined): RatesState {
  const b = (base ?? '').toUpperCase();
  const cached = b ? readCachedRates(b) : null;
  const q = useQuery({
    queryKey: queryKeys.rates(b || 'NONE'),
    queryFn: () => currencyService.getLatestRates(b),
    enabled: Boolean(b),
    staleTime: FX_TTL_MS,
    gcTime: 2 * FX_TTL_MS,
    refetchOnWindowFocus: false,
    initialData: cached?.rates,
    initialDataUpdatedAt: cached?.fetchedAt,
    retry: 1,
  });

  const rates = q.data ?? null;
  const fetchedAt = rates ? (q.dataUpdatedAt || cached?.fetchedAt || null) : null;
  const old = fetchedAt != null && Date.now() - fetchedAt > FX_TTL_MS;
  return {
    rates,
    date: rates?.date || null,
    fetchedAt,
    isStale: Boolean(rates) && (old || q.isError),
    isLoading: q.isLoading,
    error: !rates && q.isError ? "Live rates aren't loading right now." : null,
    refetch: () => {
      void q.refetch();
    },
  };
}

export interface RateHistoryRow {
  code: string;
  /** Latest rate in the window. */
  rate: number;
  /** Relative change over the window, e.g. 0.004 for +0.4%. Null with fewer than 2 points. */
  delta7d: number | null;
  series: number[];
}

/** Last ~7 days per quote for the DeparturesBoard sparklines. */
export function useRateHistory(base: string | null | undefined, quotes: string[], days = 8) {
  const b = (base ?? '').toUpperCase();
  const to = toISODate(new Date());
  const from = toISODate(addCalendarDays(new Date(), -Math.max(2, days)));
  const q = useQuery({
    queryKey: queryKeys.rateHistory(b || 'NONE', quotes, from, to),
    queryFn: () => currencyService.getRateHistory(b, quotes, from, to),
    enabled: Boolean(b) && quotes.length > 0,
    staleTime: FX_TTL_MS,
    refetchOnWindowFocus: false,
  });
  const rows: RateHistoryRow[] = quotes
    .map((code) => code.toUpperCase())
    .filter((code) => code !== b)
    .map((code) => {
      const points: RatePoint[] = q.data?.[code] ?? [];
      const series = points.map((p) => p.rate);
      const first = series[0];
      const last = series[series.length - 1];
      return {
        code,
        rate: last ?? NaN,
        delta7d: series.length >= 2 && first > 0 ? (last - first) / first : null,
        series,
      };
    });
  return { rows, isLoading: q.isLoading, error: q.isError ? "Live rates aren't loading right now." : null };
}
