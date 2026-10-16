// Home's rates (§9.3): a DeparturesBoard of three favourites against the home currency (7-day change and a
// sparkline), and "All rates", which opens the converter sheet. If the 7-day history won't load, the board
// still shows today's rates without the change column.
import { useMemo, useState } from 'react';
import { useRateHistory, useRates } from '@/hooks/useRates';
import { currencyService } from '@/services/currencyService';
import { DeparturesBoard, type DeparturesRow } from '@/components/motifs';
import { AllRatesSheet, HOME_RATES_COUNT } from '@/components/currency/CurrencyConverter';

export function RatesPanel({ home, className }: { home: string; className?: string }) {
  const [favorites, setFavorites] = useState(() => currencyService.getFavoritesOrDefault(home, HOME_RATES_COUNT));
  const [open, setOpen] = useState(false);
  const history = useRateHistory(home, favorites);
  const latest = useRates(home);

  const rows: DeparturesRow[] = useMemo(() => {
    const ok = history.rows.filter((r) => Number.isFinite(r.rate));
    if (ok.length === history.rows.length && ok.length) return ok;
    // History missing: today's table, no change data.
    if (latest.rates) {
      return favorites
        .map((code) => ({ code, rate: latest.rates?.rates[code] ?? NaN, delta7d: null, series: [] }))
        .filter((r) => Number.isFinite(r.rate));
    }
    return ok;
  }, [history.rows, latest.rates, favorites]);

  const loading = (history.isLoading || latest.isLoading) && rows.length === 0;
  const error = rows.length === 0 && !loading ? (history.error ?? latest.error ?? "Live rates aren't loading right now.") : null;

  return (
    <section aria-labelledby="home-rates" className={className}>
      <h2 id="home-rates" className="type-overline mb-2 text-ink-2">
        Rates
      </h2>
      <DeparturesBoard
        rows={rows}
        base={home}
        date={latest.date}
        loading={loading}
        error={error}
        footer={
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            className="inline-flex min-h-11 items-center text-[15px] font-medium text-ink underline decoration-rule-strong underline-offset-[3px] hover:decoration-ink"
          >
            All rates and converter
          </button>
        }
      />
      <AllRatesSheet
        open={open}
        onOpenChange={setOpen}
        base={home}
        favorites={favorites}
        onFavoritesChange={setFavorites}
      />
    </section>
  );
}
