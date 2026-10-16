// Ledger toolbar (§9.6): a search field, the seven category glyph chips (sketched while off, inked when on)
// and the active filter chips ("Wed 14 Oct ×", "Food ×"). Filters live in the URL (?day=, ?cat=) so the Days
// tab and the Fund tab can link straight to a filtered ledger.
import { useId } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORIES, CATEGORY_META, type CategoryKey } from '@/data/categories';
import { CategoryGlyph } from '@/components/glyphs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { shortDay } from './ledgerUi';

export interface LedgerToolbarProps {
  query: string;
  onQuery: (q: string) => void;
  cat: CategoryKey | null;
  onCat: (cat: CategoryKey | null) => void;
  day: string | null;
  onClearDay: () => void;
  counts: Partial<Record<CategoryKey, number>>;
  /** Shown from md up (phones have the Log spend FAB). */
  onLogSpend?: () => void;
  className?: string;
}

export function LedgerToolbar({ query, onQuery, cat, onCat, day, onClearDay, counts, onLogSpend, className }: LedgerToolbarProps) {
  const uid = useId();
  const searchId = `${uid}-search`;
  const chipsLabel = `${uid}-chips`;
  const active = Boolean(day || cat);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center gap-3">
        <div className="relative min-w-0 flex-1 md:max-w-[360px]">
          <label htmlFor={searchId} className="sr-only">
            Search the ledger
          </label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-3" strokeWidth={1.75} />
          <Input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && query) {
                e.preventDefault();
                onQuery('');
              }
            }}
            placeholder="Search: ramen, Grab, Siti"
            autoComplete="off"
            enterKeyHint="search"
            className="pl-10 pr-11 [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => onQuery('')}
              aria-label="Clear search"
              className="absolute right-0 top-0 inline-flex h-11 w-11 items-center justify-center text-ink-2 hover:text-ink"
            >
              <X className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {onLogSpend ? (
          <Button type="button" onClick={onLogSpend} className="ml-auto hidden md:inline-flex">
            <Plus aria-hidden="true" />
            Log spend
          </Button>
        ) : null}
      </div>

      <div>
        <span id={chipsLabel} className="sr-only">
          Show one category
        </span>
        <div
          role="group"
          aria-labelledby={chipsLabel}
          className="relative -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none md:mx-0 md:flex-wrap md:px-0"
        >
          {CATEGORIES.map((c) => {
            const on = cat === c.key;
            const n = counts[c.key] ?? 0;
            return (
              <button
                key={c.key}
                type="button"
                aria-pressed={on}
                onClick={() => onCat(on ? null : c.key)}
                data-category={c.key}
                className={cn(
                  'pressable inline-flex h-11 shrink-0 items-center gap-2 rounded-sm border pl-2 pr-3 text-[14px] leading-5',
                  on ? 'border-ink bg-fund-tint font-semibold text-ink' : 'border-rule bg-leaf text-ink-2 hover:border-rule-strong hover:text-ink',
                )}
              >
                <CategoryGlyph category={c.key} size={20} sketch={!on} />
                {c.label}
                <span className={cn('font-mono text-[12px]', on ? 'text-ink-2' : 'text-ink-3')}>
                  <span className="sr-only">, </span>
                  {n}
                  <span className="sr-only"> {n === 1 ? 'entry' : 'entries'}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {active ? (
        <div className="flex flex-wrap items-center gap-2" aria-label="Active filters" role="group">
          <span className="type-overline text-ink-3">Showing</span>
          {day ? (
            <button
              type="button"
              onClick={onClearDay}
              aria-label={`Clear the day filter, ${shortDay(day)}`}
              className="pressable inline-flex h-11 items-center gap-1.5 rounded-sm border border-ink bg-leaf pl-2.5 pr-1.5 font-mono text-[13px] text-ink"
            >
              {shortDay(day)}
              <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
          ) : null}
          {cat ? (
            <button
              type="button"
              onClick={() => onCat(null)}
              aria-label={`Clear the category filter, ${CATEGORY_META[cat].label}`}
              className="pressable inline-flex h-11 items-center gap-1.5 rounded-sm border border-ink bg-leaf pl-2 pr-1.5 text-[14px] text-ink"
            >
              <CategoryGlyph category={cat} size={18} />
              {CATEGORY_META[cat].label}
              <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
