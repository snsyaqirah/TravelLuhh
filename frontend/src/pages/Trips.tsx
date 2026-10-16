// Trips (§9.4): every trip as a boarding pass, grouped ON THE ROAD → UPCOMING (soonest first) → HOME (latest
// first), with LedgerTabs synced to ?filter=. Archived trips sit behind a quiet "Archived (n)" link
// (?archived=1) where they can be unarchived. Each ticket's ⋯ offers only what the person may do.
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { Trip } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useTrips } from '@/hooks/useTrips';
import { useToday } from '@/hooks/useToday';
import { getErrorMessage } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GhostOutline, LedgerTabs, ledgerPanelId, ledgerTabId } from '@/components/motifs';
import { TripListItem } from '@/components/trips/TripListItem';
import { tripPermissions } from '@/components/trips/tripActions';
import { DeleteTripDialog } from '@/components/trips/DeleteTripDialog';
import {
  EMPTY_FILTER_COPY,
  FILTER_LABELS,
  filterCounts,
  groupTrips,
  paddedCount,
  parseTripFilter,
  TRIP_FILTERS,
  visibleGroups,
  type TripFilter,
} from '@/components/trips/tripGroups';

const TABS_ID = 'trips-filter';

function ListSkeleton() {
  return (
    <div role="status" aria-busy="true" className="grid gap-4 lg:max-w-[880px] xl:max-w-none xl:grid-cols-2">
      <span className="sr-only">Loading your trips</span>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-[152px] rounded-lg [--ledger-row:38px]" />
      ))}
    </div>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 border-l-[3px] border-stamp bg-stamp-tint px-4 py-4">
      <p className="type-body text-ink">{message}</p>
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function StartButton({ className }: { className?: string }) {
  return (
    <Button asChild className={className}>
      <Link to="/trips/new">
        <Plus aria-hidden="true" />
        Start a tabung
      </Link>
    </Button>
  );
}

export default function Trips() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const today = useToday();
  const archivedView = params.get('archived') === '1';
  const filter = parseTripFilter(params.get('filter'));
  const homeCountry = user?.country ?? 'MY';

  const active = useTrips();
  const archived = useTrips({ archived: true });
  const [deleting, setDeleting] = useState<Trip | null>(null);

  const list = archivedView ? archived : active;
  const groups = groupTrips(active.trips, today);
  const counts = filterCounts(groups);
  const shown = visibleGroups(groups, filter);

  const setFilter = (key: TripFilter) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (key === 'all') p.delete('filter');
        else p.set('filter', key);
        return p;
      },
      { replace: true },
    );

  const archive = async (trip: Trip, value: boolean) => {
    try {
      await active.setArchived(trip.id, value);
      if (value) {
        toast.success(`${trip.name} archived.`, {
          description: 'It stays on your passport. Find it under Archived.',
          action: { label: 'Undo', onClick: () => void active.setArchived(trip.id, false).catch((e) => toast.error(getErrorMessage(e))) },
        });
      } else {
        toast.success(`${trip.name} is back on your list.`);
      }
    } catch (e) {
      toast.error(getErrorMessage(e, value ? "The trip wasn't archived. Try again." : "The trip wasn't unarchived. Try again."));
    }
  };

  const itemProps = (trip: Trip) => {
    const { canEdit, isOwner } = tripPermissions(trip);
    return {
      trip,
      today,
      homeCountry,
      onEdit: canEdit ? (t: Trip) => navigate(`/trips/${t.id}/edit`) : undefined,
      onArchive: isOwner && !trip.isArchived ? (t: Trip) => void archive(t, true) : undefined,
      onUnarchive: isOwner && trip.isArchived ? (t: Trip) => void archive(t, false) : undefined,
      onDelete: isOwner ? (t: Trip) => setDeleting(t) : undefined,
    };
  };

  const archivedCount = archived.trips.length;

  // ── Archived view ────────────────────────────────────────────────────────────────────────────────
  if (archivedView) {
    const sorted = [...archived.trips].sort((a, b) => b.endDate.localeCompare(a.endDate));
    return (
      <div className="flex flex-col gap-6 lg:gap-8">
        <header>
          <Link to="/trips" className="type-body-s inline-flex min-h-11 items-center text-ink-2 underline decoration-rule-strong underline-offset-[3px] hover:text-ink">
            All trips
          </Link>
          <h1 className="type-display-2 text-ink">
            Archived <span className="type-ledger align-middle text-[15px] text-ink-3 lg:text-[18px]">{paddedCount(sorted.length)}</span>
          </h1>
          <p className="type-body-s mt-1 text-ink-2">Off your shelf and out of the totals. Still on your passport.</p>
        </header>
        {list.isLoading ? (
          <ListSkeleton />
        ) : list.error && !sorted.length ? (
          <LoadError message={list.error} onRetry={() => void list.refetch()} />
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-start gap-4">
            <GhostOutline kind="ticket" />
            <p className="type-body text-ink-2">Nothing archived. Archive a trip from its ⋯ menu to tidy your list.</p>
          </div>
        ) : (
          <ul className="grid gap-4 lg:max-w-[880px] xl:max-w-none xl:grid-cols-2">
            {sorted.map((trip) => (
              <li key={trip.id}>
                <TripListItem {...itemProps(trip)} />
              </li>
            ))}
          </ul>
        )}
        <DeleteTripDialog trip={deleting} onOpenChange={(o) => !o && setDeleting(null)} />
      </div>
    );
  }

  // ── Main list ────────────────────────────────────────────────────────────────────────────────────
  const noTrips = !active.isLoading && !active.error && active.trips.length === 0;

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="type-display-2 text-ink">
          Trips{' '}
          {!active.isLoading ? (
            <span className="type-ledger align-middle text-[15px] text-ink-3 lg:text-[18px]">
              <span className="sr-only">, </span>
              {paddedCount(counts.all)}
            </span>
          ) : null}
        </h1>
        <StartButton className="hidden md:inline-flex" />
      </header>

      {active.isLoading ? (
        <ListSkeleton />
      ) : active.error && active.trips.length === 0 ? (
        <LoadError message={active.error} onRetry={() => void active.refetch()} />
      ) : noTrips ? (
        <div className="flex flex-col items-start gap-4 border-t border-rule pt-8">
          <GhostOutline kind="ticket" height={88} />
          <p className="type-display-3 max-w-[22ch] text-ink">No trips yet. Your passport's looking very clean.</p>
          <StartButton />
        </div>
      ) : (
        <>
          <LedgerTabs
            ariaLabel="Show trips"
            idBase={TABS_ID}
            value={filter}
            onChange={setFilter}
            tabs={TRIP_FILTERS.map((key) => ({ key, label: FILTER_LABELS[key], count: counts[key] }))}
          />
          <div role="tabpanel" id={ledgerPanelId(TABS_ID, filter)} aria-labelledby={ledgerTabId(TABS_ID, filter)} className="flex flex-col gap-8 lg:gap-10">
            {shown.length === 0 ? (
              <div className="flex flex-col items-start gap-4">
                <GhostOutline kind="ticket" />
                <p className="type-body text-ink-2">{EMPTY_FILTER_COPY[filter]}</p>
                {filter === 'upcoming' ? <StartButton /> : null}
              </div>
            ) : (
              shown.map((g) => (
                <section key={g.phase} aria-labelledby={`trips-${g.phase}`}>
                  <h2 id={`trips-${g.phase}`} className={filter === 'all' ? 'type-overline mb-3 text-ink-2' : 'sr-only'}>
                    {g.label} <span className="text-ink-3">· {g.trips.length}</span>
                  </h2>
                  <ul className="grid gap-4 lg:max-w-[880px] xl:max-w-none xl:grid-cols-2">
                    {g.trips.map((trip) => (
                      <li key={trip.id}>
                        <TripListItem {...itemProps(trip)} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>
        </>
      )}

      {archivedCount > 0 ? (
        <p className="border-t border-rule pt-4">
          <Link
            to="/trips?archived=1"
            className="type-body-s inline-flex min-h-11 items-center text-ink-2 underline decoration-rule-strong underline-offset-[3px] hover:text-ink hover:decoration-ink"
          >
            Archived <span className="ml-1 font-mono">({archivedCount})</span>
          </Link>
        </p>
      ) : null}

      <DeleteTripDialog trip={deleting} onOpenChange={(o) => !o && setDeleting(null)} />
    </div>
  );
}
