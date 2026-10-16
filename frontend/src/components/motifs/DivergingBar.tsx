// Kongsi balances (§5.4): one 40px row per person, a bar out from a centre axis. Owes runs left in stamp,
// is owed runs right in fund. The amount carries its sign and a spoken sentence, so colour is never the cue.
// The amount sits at the bar's root, on the free side of the axis: at 375px there is no room for a figure past
// the far end of a full-length bar.
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';

export interface DivergingRow {
  name: string;
  /** paid − share: positive is owed money, negative owes. */
  net: number;
}

export interface DivergingBarProps {
  rows: readonly DivergingRow[];
  currency: string;
  className?: string;
}

const SQUARE = 0.005;

// A full bar stops 4px short of the cell edge.
const barWidth = (ratio: number) => `calc((50% - 4px) * ${ratio.toFixed(4)})`;

export function DivergingBar({ rows, currency, className }: DivergingBarProps) {
  const max = Math.max(0, ...rows.map((r) => Math.abs(r.net)));
  return (
    <ul className={cn('w-full', className)}>
      {rows.map((row, i) => {
        const amount = Math.abs(row.net);
        const square = amount < SQUARE;
        const owes = !square && row.net < 0;
        const ratio = max > 0 && !square ? Math.max(amount / max, 0.02) : 0;
        const money = formatMoney(amount, currency);
        const sentence = square ? `${row.name} is square` : owes ? `${row.name} owes ${money}` : `${row.name} is owed ${money}`;
        return (
          <li key={`${row.name}-${i}`} className="grid h-10 grid-cols-[minmax(0,5.5rem)_1fr] md:grid-cols-[minmax(0,8rem)_1fr] items-center gap-3 border-b border-rule last:border-b-0">
            <span className="sr-only">{sentence}</span>
            <span aria-hidden="true" className="truncate font-sans text-[15px] font-medium text-ink">
              {row.name}
            </span>
            <span
              aria-hidden="true"
              className="type-ledger relative h-full text-[13px]"
              // --bar resolves its % against this cell when used on the absolutely placed bar
              style={{ ['--bar' as string]: barWidth(ratio) }}
            >
              {/* centre axis */}
              <span className="absolute inset-y-1.5 left-1/2 w-px bg-ink-3" />
              {square ? (
                <span className="absolute left-1/2 top-1/2 ml-2 -translate-y-1/2 text-ink-3">square</span>
              ) : owes ? (
                <>
                  <span className="absolute right-1/2 top-1/2 h-3 w-[var(--bar)] -translate-y-1/2 bg-stamp" />
                  <span className="absolute left-1/2 top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap text-stamp">
                    −{money}
                  </span>
                </>
              ) : (
                <>
                  <span className="absolute left-1/2 top-1/2 h-3 w-[var(--bar)] -translate-y-1/2 bg-fund" />
                  <span className="absolute right-1/2 top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap text-fund">
                    +{money}
                  </span>
                </>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
