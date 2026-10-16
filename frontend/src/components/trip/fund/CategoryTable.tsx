// "Where it went": one ledger row per category with spend, in the fixed category order (§9.6 Fund tab 1).
// Each row opens the ledger filtered to that category.
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { CategoryGlyph } from '@/components/glyphs';
import { CATEGORY_META } from '@/data/categories';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { tabPath } from '@/components/trip/tripTabs';
import { sharePercent, type CategoryRow } from '@/components/trip/fund/fundMath';

export interface CategoryTableProps {
  tripId: number;
  rows: readonly CategoryRow[];
  total: number;
  count: number;
  currency: string;
}

const GRID = 'grid grid-cols-[28px_minmax(0,1fr)_auto_44px_28px] items-center gap-x-3 md:grid-cols-[28px_minmax(0,1fr)_auto_56px_40px_20px]';

export function CategoryTable({ tripId, rows, total, count, currency }: CategoryTableProps) {
  return (
    <div className="border-y border-rule">
      <div aria-hidden="true" className={cn(GRID, 'type-overline h-8 border-b border-rule text-ink-3')}>
        <span />
        <span>Category</span>
        <span className="text-right">Spent</span>
        <span className="text-right">Share</span>
        <span className="text-right">#</span>
        <span className="hidden md:block" />
      </div>
      <ol>
        {rows.map((row, i) => {
          const meta = CATEGORY_META[row.key];
          const amount = formatMoney(row.amount, currency);
          const pct = sharePercent(row.share);
          return (
            <li key={row.key} className={cn('border-b border-rule last:border-b-0', i % 2 === 1 && 'bg-stripe')}>
              <Link
                to={tabPath(tripId, 'ledger', { cat: row.key })}
                aria-label={`${meta.label}: ${amount}, ${pct} of spent, ${row.count} ${row.count === 1 ? 'entry' : 'entries'}. Open in the ledger.`}
                className={cn(GRID, 'min-h-12 py-1.5 text-ink hover:bg-sunken')}
              >
                <CategoryGlyph category={row.key} size={24} />
                <span className="type-body truncate">{meta.label}</span>
                <span className="type-ledger whitespace-nowrap text-right">{amount}</span>
                <span className="type-ledger text-right text-ink-2">{pct}</span>
                <span className="type-ledger text-right text-ink-3">{row.count}</span>
                <ChevronRight aria-hidden="true" className="hidden h-4 w-4 text-ink-3 md:block" strokeWidth={1.75} />
              </Link>
            </li>
          );
        })}
      </ol>
      <div className={cn(GRID, 'h-11 border-t border-rule-strong')}>
        <span />
        <span className="type-overline text-ink-2">Total</span>
        <span className="type-ledger whitespace-nowrap text-right font-medium text-ink">{formatMoney(total, currency)}</span>
        <span className="type-ledger text-right text-ink-2">{rows.length ? '100%' : '0%'}</span>
        <span className="type-ledger text-right text-ink-3">{count}</span>
        <span className="hidden md:block" />
      </div>
    </div>
  );
}
