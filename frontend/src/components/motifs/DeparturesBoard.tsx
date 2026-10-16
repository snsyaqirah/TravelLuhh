// Rates as a departures board (§5.4): a sunken panel of mono rows, CODE · RATE · 7-day change · sparkline.
// Change is fund or stamp *and* ▲/▼, never colour alone. Up means your base currency buys more.
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { formatDayMonth, formatShortDate } from '@/lib/dates';
import { formatRate } from '@/lib/money';

export interface DeparturesRow {
  code: string;
  rate: number;
  /** Relative change over the window (0.004 = +0.4%). null with too little history. */
  delta7d: number | null;
  series: number[];
}

export interface DeparturesBoardProps {
  rows: readonly DeparturesRow[];
  /** The 1 unit each rate is quoted against, e.g. 'MYR'. */
  base: string;
  /** Rates date ('YYYY-MM-DD'). */
  date?: string | null;
  /** Source shown in the header (default Frankfurter). */
  source?: string;
  loading?: boolean;
  /** Shown instead of rows, e.g. "Live rates aren't loading right now." */
  error?: string | null;
  /** Under the rows, e.g. an "All rates" button. */
  footer?: ReactNode;
  className?: string;
}

const FLAT = 0.0005;

function Delta({ delta }: { delta: number | null }) {
  if (delta == null || !Number.isFinite(delta)) {
    return (
      // ink-3 is too light on sunken at this size
      <span className="text-ink-2">
        <span aria-hidden="true">—</span>
        <span className="sr-only">no change data</span>
      </span>
    );
  }
  const pct = `${(Math.abs(delta) * 100).toFixed(1)}%`;
  if (Math.abs(delta) < FLAT) {
    return (
      <span className="text-ink-2">
        <span aria-hidden="true">= {pct}</span>
        <span className="sr-only">flat</span>
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span className={up ? 'text-fund' : 'text-stamp'}>
      <span aria-hidden="true">
        {up ? '▲' : '▼'}
        {pct}
      </span>
      <span className="sr-only">
        {up ? 'up' : 'down'} {pct}
      </span>
    </span>
  );
}

/** 48×16 line in ink-2 with a dot on the latest point. */
export function Sparkline({ series, className }: { series: readonly number[]; className?: string }) {
  const W = 48;
  const H = 16;
  const pts = series.filter((n) => Number.isFinite(n));
  if (pts.length < 2) return <svg aria-hidden="true" width={W} height={H} className={className} />;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const pad = 3; // keeps the 2px line and the end dot inside the box
  const xy = pts.map((v, i) => [pad + (i / (pts.length - 1)) * (W - pad * 2), max === min ? H / 2 : pad + (1 - (v - min) / span) * (H - pad * 2)]);
  const [ex, ey] = xy[xy.length - 1];
  return (
    <svg aria-hidden="true" width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={cn('text-ink-2', className)}>
      <polyline
        points={xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={ex} cy={ey} r={2.5} fill="currentColor" />
    </svg>
  );
}

export function DeparturesBoard({
  rows,
  base,
  date,
  source = 'Frankfurter',
  loading,
  error,
  footer,
  className,
}: DeparturesBoardProps) {
  const b = base.toUpperCase();
  const stamp = date ? formatDayMonth(date) : '';
  const header = ['RATES', source.toUpperCase(), stamp].filter(Boolean).join(' · ');
  return (
    <section className={cn('bg-sunken px-4 py-3 font-mono', className)} aria-label={`Exchange rates for 1 ${b}`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="type-overline text-ink-2">{header}</p>
        <p className="type-overline text-ink-2">1 {b} =</p>
      </div>
      {error && !rows.length ? (
        <p className="type-body-s mt-3 border-t border-rule pt-3 font-sans text-ink-2">{error}</p>
      ) : (
        <table className="mt-2 w-full border-collapse text-[14px] leading-5 tabular-nums">
          <caption className="sr-only">
            1 {b} in other currencies{date ? `, rates from ${formatShortDate(date)}` : ''}, with the change over 7 days
          </caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">Currency</th>
              <th scope="col">Rate</th>
              <th scope="col">7-day change</th>
              <th scope="col">Trend</th>
            </tr>
          </thead>
          <tbody>
            {loading && !rows.length
              ? [0, 1, 2].map((i) => (
                  <tr key={i} className="h-10 border-t border-rule">
                    <td colSpan={4}>
                      <span className="block h-3 w-2/3 bg-rule/60" />
                    </td>
                  </tr>
                ))
              : rows.map((row) => (
                  <tr key={row.code} className="h-10 border-t border-rule">
                    <th scope="row" className="w-14 text-left font-semibold tracking-[0.08em] text-ink">
                      {row.code}
                    </th>
                    <td className="text-right text-ink">{formatRate(row.rate)}</td>
                    <td className="w-20 whitespace-nowrap text-right text-[13px]">
                      <Delta delta={row.delta7d} />
                    </td>
                    <td className="w-[60px] pl-3 text-right align-middle">
                      <Sparkline series={row.series} className="ml-auto block" />
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      )}
      {footer ? <div className="mt-2 border-t border-rule pt-2 font-sans">{footer}</div> : null}
    </section>
  );
}
