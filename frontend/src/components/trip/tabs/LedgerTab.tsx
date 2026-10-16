// Ledger tab (spec §9.6): the trip's passbook. Search, category chips and a ?day= filter on top; entries
// grouped by day underneath with the running BAKI (the money that went into the tabung is printed too, so the
// balance is honest). Phones get a two-line list with swipe-to-delete; wide containers get the Passbook table
// with its BAKI column. Tapping an entry opens ?sheet=expense&id=…; deleting has a 5 s Undo.
import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { Trip } from '@/types';
import type { FundState } from '@/hooks/useFund';
import { useExpenses } from '@/hooks/useExpenses';
import { useFundEntries } from '@/hooks/useFundEntries';
import { formatMoney } from '@/lib/money';
import { CATEGORY_META, isCategoryKey, type CategoryKey } from '@/data/categories';
import { CategoryGlyph } from '@/components/glyphs';
import { BalangMark } from '@/components/brand/Wordmark';
import { Passbook } from '@/components/motifs/Passbook';
import { GhostOutline } from '@/components/motifs/GhostOutline';
import { isGroupTrip } from '@/components/motifs/tripMeta';
import type { PassbookLine } from '@/components/motifs/passbookMath';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTripSheet } from '@/components/trip/useTripSheet';
import { LedgerToolbar } from '@/components/ledger/LedgerToolbar';
import { LedgerList } from '@/components/ledger/LedgerList';
import { shortDay } from '@/components/ledger/ledgerUi';
import { isISODate } from '@/components/ledger/expenseDraft';
import { buildLedger, countByCategory, filterLedger, hasFilters, type LedgerGlyphs } from '@/components/ledger/ledgerModel';
import { flushExpenseRemovals, removeExpenseWithUndo } from '@/components/ledger/pendingDeletes';

export interface LedgerTabProps {
  trip: Trip;
  fund: FundState;
  canEdit: boolean;
}

const GLYPHS: LedgerGlyphs = {
  expense: (c) => <CategoryGlyph category={c} size={24} />,
  sub: (c) => <CategoryGlyph category={c ?? 'other'} size={20} sketch={!c} />,
  fund: () => <BalangMark size={22} />,
};

export function LedgerTab({ trip, fund, canEdit }: LedgerTabProps) {
  const [params, setParams] = useSearchParams();
  const rawDay = params.get('day');
  const rawCat = params.get('cat');
  const day = isISODate(rawDay) ? rawDay : null;
  const cat: CategoryKey | null = isCategoryKey(rawCat) ? rawCat : null;
  const [query, setQuery] = useState('');
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const sheet = useTripSheet();

  const qc = useQueryClient();
  const live = isGroupTrip(trip) && fund.phase === 'onTheRoad';
  // useExpenses already hides entries waiting on their Undo window.
  const { expenses, isLoading, error, refetch } = useExpenses(trip.id, { live });
  // Pending deletes go out at once when the ledger unmounts or the route changes (§9.6).
  useEffect(() => () => flushExpenseRemovals(), [pathname]);
  const saving = fund.mode === 'saving';
  const fundQ = useFundEntries(trip.id, { enabled: saving });
  const fundReady = !saving || (!fundQ.isLoading && !fundQ.error);
  const fundEntries = saving ? fundQ.entries : null;

  const entries = useMemo(
    () => buildLedger({ trip, expenses, fundEntries, mode: saving ? 'saving' : 'budget', glyphs: GLYPHS }),
    [trip, expenses, fundEntries, saving],
  );
  const balance = fundReady && (fund.hasBudget || saving);
  const filtered = useMemo(
    () => filterLedger(entries, { day, cat, q: query }, { currency: trip.currency, balance }),
    [entries, day, cat, query, trip.currency, balance],
  );
  const counts = useMemo(() => countByCategory(expenses), [expenses]);

  const setParam = (key: 'day' | 'cat', value: string | null) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (value) p.set(key, value);
        else p.delete(key);
        return p;
      },
      { replace: true },
    );
  const clearAll = () => {
    setQuery('');
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete('day');
        p.delete('cat');
        return p;
      },
      { replace: true },
    );
  };

  const openRow = (line: PassbookLine) => {
    if (typeof line.id === 'number') sheet.open('expense', { id: line.id });
    // Fund rows and FUND SET live on the Fund tab.
    else navigate({ pathname: `/trips/${trip.id}/fund` });
  };
  const deleteRow = (line: PassbookLine) => {
    const e = expenses.find((x) => x.id === line.id);
    if (e) removeExpenseWithUndo(qc, e);
  };
  const logSpend = canEdit ? () => sheet.open('log-spend') : undefined;

  if (isLoading && !expenses.length) return <LedgerSkeleton />;

  if (error && !expenses.length) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-rule border-l-[3px] border-l-stamp bg-leaf p-4">
        <p className="type-body text-ink">{error}</p>
        <Button type="button" variant="secondary" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const empty = expenses.length === 0;
  const filteredOut = !empty && filtered.rows.length === 0;
  const showRows = empty ? saving && filtered.rows.length > 0 : filtered.rows.length > 0;
  const caption = `${trip.name} ledger`;
  // "Over today" compares a whole day's spend with the allowance; a category or search filter only shows part of it.
  const dayAllowance = cat || query.trim() ? null : fund.dailyAllowance;

  return (
    <section aria-label="Ledger" className="flex flex-col gap-4">
      {!empty ? (
        <LedgerToolbar
          query={query}
          onQuery={setQuery}
          cat={cat}
          onCat={(c) => setParam('cat', c)}
          day={day}
          onClearDay={() => setParam('day', null)}
          counts={counts}
          onLogSpend={logSpend}
        />
      ) : null}

      {error ? (
        <div role="status" className="type-body-s flex flex-wrap items-center gap-x-3 border-l-[3px] border-brass bg-leaf px-3 py-2 text-ink">
          <span>{error} Showing what was already loaded.</span>
          <button type="button" onClick={() => void refetch()} className="inline-flex min-h-11 items-center underline underline-offset-[3px]">
            Try again
          </button>
        </div>
      ) : null}

      {saving && fundQ.error ? (
        <div role="status" className="type-body-s flex flex-wrap items-center gap-x-3 border-l-[3px] border-brass bg-leaf px-3 py-2 text-ink">
          <span>The tabung entries didn't load, so the running balance is hidden.</span>
          <button type="button" onClick={() => void fundQ.refetch()} className="inline-flex min-h-11 items-center underline underline-offset-[3px]">
            Try again
          </button>
        </div>
      ) : null}

      {empty ? <LedgerEmpty canEdit={canEdit} onLogSpend={logSpend} /> : null}

      {filteredOut ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-rule bg-leaf px-4 py-4">
          <p className="type-body text-ink">{filteredMessage(query, cat, day)}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" className="h-11" onClick={clearAll}>
              Show the whole ledger
            </Button>
            {logSpend ? (
              <Button type="button" variant="ghost" size="sm" className="h-11" onClick={logSpend}>
                <Plus aria-hidden="true" />
                Log spend
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {showRows ? (
        <>
          {!empty ? (
            <p className="type-ledger flex flex-wrap gap-x-2 text-[13px] text-ink-2" aria-live="polite">
              <span>
                {hasFilters({ day, cat, q: query }) ? `${filtered.count} of ${filtered.totalCount}` : filtered.totalCount}{' '}
                {filtered.totalCount === 1 ? 'entry' : 'entries'}
              </span>
              <span aria-hidden="true">·</span>
              <span>{formatMoney(filtered.total, trip.currency)} out</span>
              {balance && !filtered.showBalance ? <span className="basis-full text-ink-3">The running BAKI shows on the full ledger.</span> : null}
            </p>
          ) : (
            <p className="type-overline text-ink-2">Into the tabung so far</p>
          )}
          <div className="[container-type:inline-size]">
            <LedgerList
              className="[@container(min-width:640px)]:hidden"
              rows={filtered.rows}
              currency={trip.currency}
              showBalance={filtered.showBalance}
              openingBalance={filtered.openingBalance}
              tripStart={trip.startDate}
              tripEnd={trip.endDate}
              dailyAllowance={dayAllowance}
              onRowClick={openRow}
              canDelete={(line) => canEdit && typeof line.id === 'number'}
              onDelete={deleteRow}
              caption={caption}
            />
            <Passbook
              className="hidden [@container(min-width:640px)]:block"
              layout="table"
              rows={filtered.rows}
              currency={trip.currency}
              showBalance={filtered.showBalance}
              openingBalance={filtered.openingBalance}
              newestFirst
              tripStart={trip.startDate}
              tripEnd={trip.endDate}
              dailyAllowance={dayAllowance}
              onRowClick={openRow}
              caption={caption}
            />
          </div>
        </>
      ) : null}
    </section>
  );
}

function filteredMessage(query: string, cat: CategoryKey | null, day: string | null): string {
  const q = query.trim();
  let s = q ? `Nothing matches "${q}"` : day && !cat ? 'Nothing logged' : 'No entries';
  if (cat) s += ` in ${CATEGORY_META[cat].label}`;
  if (day) s += ` on ${shortDay(day)}`;
  return `${s}.`;
}

function LedgerEmpty({ canEdit, onLogSpend }: { canEdit: boolean; onLogSpend?: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-lg border border-rule bg-leaf p-5 sm:flex-row sm:items-center sm:gap-6">
      <GhostOutline kind="jar" height={96} className="shrink-0 text-ink-3" />
      <div className="flex flex-col items-start gap-2">
        <p className="type-title text-ink">Nothing in the ledger yet.</p>
        <p className="type-body text-ink-2">The first teh tarik counts too.</p>
        {canEdit && onLogSpend ? (
          <Button type="button" onClick={onLogSpend} className="mt-2">
            <Plus aria-hidden="true" />
            Log spend
          </Button>
        ) : (
          <p className="type-body-s text-ink-3">You're viewing this trip. Owners and editors log the spends.</p>
        )}
      </div>
    </div>
  );
}

function LedgerSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">Loading the ledger</span>
      <Skeleton className="h-11 w-full [--ledger-row:2.75rem] md:w-[360px]" />
      <div className="flex gap-2 overflow-hidden">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-11 w-24 shrink-0 [--ledger-row:2.75rem]" />
        ))}
      </div>
      <Skeleton className="h-[392px] w-full rounded-lg [--ledger-row:56px]" />
    </div>
  );
}

export default LedgerTab;
