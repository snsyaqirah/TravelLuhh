// "Where to?" (§9.5 step 1, and the Edit sheet): a search field over the 44 destinations, "Popular from MY"
// chips, and ruled result rows (ISO chip, name, local currency). Enter in the search box takes the top match.
import { useId, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { CountryChip } from '@/components/glyphs';
import { countries, getCountryByCode, POPULAR_FROM_MY, searchCountries, type Destination } from '@/data/countries';
import { currencyPrefix } from '@/lib/money';
import { FieldError, FieldLabel } from '@/components/trips/fields/FieldBits';

export interface CountrySearchProps {
  value: string | null;
  onChange: (code: string) => void;
  /** The traveller's home country ('MY'): labels the popular chips. */
  homeCountry?: string | null;
  /** Inline error, shown right under the search field. */
  error?: ReactNode;
  autoFocus?: boolean;
  /** Max result rows while searching. */
  limit?: number;
  className?: string;
}

function currencyNote(c: Destination): string {
  const p = currencyPrefix(c.currency);
  return p === c.currency ? c.currency : `${p} ${c.currency}`;
}

function ResultRow({ c, selected, onPick }: { c: Destination; selected: boolean; onPick: (code: string) => void }) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => onPick(c.code)}
        className={cn(
          'flex min-h-12 w-full items-center gap-3 border-b border-rule px-3 text-left transition-colors duration-micro hover:bg-accent',
          selected && 'bg-fund-tint shadow-[inset_3px_0_0_0_hsl(var(--fund))]',
        )}
      >
        <CountryChip code={c.code} announce="none" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] leading-5 text-ink">{c.name}</span>
          <span className="block truncate text-[13px] leading-4 text-ink-2">{c.capital}</span>
        </span>
        <span className="type-ledger shrink-0 text-[13px] text-ink-2">{currencyNote(c)}</span>
      </button>
    </li>
  );
}

export function CountrySearch({
  value,
  onChange,
  homeCountry,
  error,
  autoFocus,
  limit = 8,
  className,
}: CountrySearchProps) {
  const id = useId();
  const errorId = `${id}-err`;
  const invalid = Boolean(error);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const results = useMemo(() => (query.trim() ? searchCountries(query).slice(0, limit) : []), [query, limit]);
  const selected = getCountryByCode(value);
  const home = (homeCountry ?? 'MY').toUpperCase();
  const popular = useMemo(() => POPULAR_FROM_MY.filter((c) => c !== home).map((c) => getCountryByCode(c)).filter(Boolean) as Destination[], [home]);

  const pick = (code: string) => {
    onChange(code);
    setQuery('');
    setShowAll(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim()) {
      // Enter takes the top match rather than submitting the step.
      e.preventDefault();
      if (results[0]) pick(results[0].code);
    }
    if (e.key === 'Escape' && query) {
      e.preventDefault();
      setQuery('');
    }
  };

  const list = query.trim() ? results : showAll ? countries : [];

  return (
    <div className={className}>
      {selected ? (
        <div className="mb-5 flex min-h-14 items-center gap-3 rounded-lg border border-rule bg-card px-4 py-3" aria-live="polite">
          <CountryChip code={selected.code} announce="none" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-[22px] font-medium leading-7 text-ink">{selected.name}</p>
            <p className="type-ledger text-[13px] leading-5 text-ink-2">
              {selected.capital} · pays in {currencyNote(selected)}
            </p>
          </div>
        </div>
      ) : null}

      <FieldLabel htmlFor={`${id}-q`}>{selected ? 'Somewhere else?' : `Search ${countries.length} places`}</FieldLabel>
      <div className="relative mt-1.5">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-3" strokeWidth={1.75} />
        <Input
          id={`${id}-q`}
          type="search"
          autoComplete="off"
          autoFocus={autoFocus}
          enterKeyHint="search"
          placeholder="Japan, Seoul, Bali…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          aria-invalid={invalid || undefined}
          aria-describedby={[invalid ? errorId : null, `${id}-status`].filter(Boolean).join(' ')}
          aria-controls={`${id}-list`}
          className="pl-10"
        />
      </div>
      <FieldError id={errorId}>{error}</FieldError>
      <p id={`${id}-status`} className="sr-only" aria-live="polite">
        {query.trim() ? (results.length ? `${results.length} ${results.length === 1 ? 'place matches' : 'places match'}. Enter picks ${results[0].name}.` : 'No places match.') : ''}
      </p>

      {!query.trim() ? (
        <div className="mt-5">
          <p className="type-overline text-ink-2">{home === 'MY' ? 'Popular from MY' : 'Popular'}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {popular.map((c) => {
              const on = c.code === value;
              return (
                <li key={c.code}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => pick(c.code)}
                    className={cn(
                      'pressable inline-flex h-11 items-center gap-2 rounded-sm border px-3 text-[15px] transition-colors duration-micro',
                      on ? 'border-fund bg-fund text-on-fund' : 'border-rule-strong bg-leaf text-ink hover:border-ink',
                    )}
                  >
                    <CountryChip code={c.code} announce="none" tone={on ? 'onFund' : 'ink'} size="sm" />
                    <span>{c.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {list.length ? (
        <ul id={`${id}-list`} aria-label={query.trim() ? 'Matching places' : 'All places'} className="mt-4 overflow-hidden rounded-lg border border-rule bg-leaf [&>li:last-child>button]:border-b-0">
          {list.map((c) => (
            <ResultRow key={c.code} c={c} selected={c.code === value} onPick={pick} />
          ))}
        </ul>
      ) : query.trim() ? (
        <p className="type-body-s mt-4 text-ink-2">
          Nothing matches “{query.trim()}”. Try the country, its capital, or its currency.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="type-body-s mt-4 inline-flex min-h-11 items-center text-ink underline decoration-rule-strong underline-offset-[3px] hover:decoration-ink"
        >
          See all {countries.length} places
        </button>
      )}
      {showAll && !query.trim() ? (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="type-body-s mt-2 inline-flex min-h-11 items-center text-ink underline decoration-rule-strong underline-offset-[3px] hover:decoration-ink"
        >
          Hide the list
        </button>
      ) : null}
    </div>
  );
}
