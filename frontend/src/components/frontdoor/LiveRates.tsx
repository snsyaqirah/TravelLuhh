// Live rates on the Landing (§9.1): what RM 1 buys in the four currencies Malaysians travel on most, from
// Frankfurter, with 7-day sparklines. If the API is down the board says so and offers a retry.
import { useQueryClient } from '@tanstack/react-query';
import { DeparturesBoard } from '@/components/motifs/DeparturesBoard';
import { useRateHistory, useRates } from '@/hooks/useRates';

const BASE = 'MYR';
const QUOTES = ['JPY', 'THB', 'SGD', 'KRW'];

export function LiveRates({ className }: { className?: string }) {
  const history = useRateHistory(BASE, QUOTES);
  const latest = useRates(BASE);
  const qc = useQueryClient();
  const rows = history.rows.filter((r) => Number.isFinite(r.rate) && r.rate > 0);
  const failed = Boolean(history.error) || (!history.isLoading && rows.length === 0);

  const retry = () => {
    void qc.invalidateQueries({ queryKey: ['fx-history'] });
    latest.refetch();
  };

  return (
    <DeparturesBoard
      className={className}
      rows={failed || history.isLoading ? [] : rows}
      base={BASE}
      date={latest.date}
      loading={history.isLoading}
      error={failed ? "Live rates aren't loading right now." : null}
      footer={
        failed ? (
          <button
            type="button"
            onClick={retry}
            className="type-body-s inline-flex min-h-11 items-center text-ink underline decoration-rule-strong underline-offset-[3px] hover:decoration-ink"
          >
            Try again
          </button>
        ) : (
          <p className="type-body-s py-1 text-ink-2">Change over the last 7 days. ▲ means your ringgit buys more.</p>
        )
      }
    />
  );
}
