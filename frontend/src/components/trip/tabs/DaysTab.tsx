// Days tab (§9.6): a strip of day stubs and the selected day as a transit line. Selecting a day reports it up
// (TripDetail puts it in ?day= and highlights that stone on the TripPlot stage). Editors add, edit and remove
// stops; a removed stop can be undone for 5 s before the DELETE is sent.
import { useCallback, useId, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { CreateItineraryItemRequest, ItineraryItem, Trip } from '@/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GhostOutline } from '@/components/motifs';
import { useItinerary } from '@/hooks/useItinerary';
import { useExpenses } from '@/hooks/useExpenses';
import { useToday } from '@/hooks/useToday';
import { useUndoableDelete } from '@/hooks/useUndoableDelete';
import { queryKeys } from '@/lib/queryClient';
import { formatMoney } from '@/lib/money';
import { DayStrip } from '@/components/itinerary/DayStrip';
import { DayTimeline } from '@/components/itinerary/DayTimeline';
import { StopSheet } from '@/components/itinerary/StopSheet';
import { dayTabId, resolveSelectedDay, stopCount, tripDayStubs } from '@/components/itinerary/days';

export interface DaysTabProps {
  trip: Trip;
  canEdit: boolean;
  /** 'YYYY-MM-DD' from ?day=, or null for the default (today on the road, else the first day). */
  selectedDay: string | null;
  onSelectDay: (isoDate: string) => void;
}

const EMPTY: ItineraryItem[] = [];

function DaysSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[88px] w-[84px] shrink-0 rounded-lg" />
        ))}
      </div>
      <Skeleton className="mt-6 h-6 w-48" />
      <div className="mt-5 space-y-3 pl-[84px]">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    </div>
  );
}

export function DaysTab({ trip, canEdit, selectedDay, onSelectDay }: DaysTabProps) {
  const today = useToday();
  const { pathname } = useLocation();
  const uid = useId();
  const panelId = `${uid}-day-panel`;

  const { items, isLoading, error, refetch, addItem, updateItem, deleteItem } = useItinerary(trip.id);
  const { spentByDay } = useExpenses(trip.id);

  const undoable = useUndoableDelete<ItineraryItem>({
    queryKey: queryKeys.itinerary(trip.id),
    remove: (item) => deleteItem(item.id),
    message: (item) => `Removed "${item.title}".`,
    flushKey: pathname,
  });
  const { pendingIds } = undoable;

  const visible = useMemo(
    () => (pendingIds.size ? items.filter((i) => !pendingIds.has(i.id)) : items),
    [items, pendingIds]
  );
  const byDate = useMemo(() => {
    const out: Record<string, ItineraryItem[]> = {};
    for (const i of visible) (out[i.itemDate] ??= []).push(i);
    return out;
  }, [visible]);
  const counts = useMemo(() => Object.fromEntries(Object.entries(byDate).map(([d, list]) => [d, list.length])), [byDate]);

  const stubs = useMemo(
    () => tripDayStubs(trip, today, Object.keys(byDate)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the dates matter
    [trip.startDate, trip.endDate, today, byDate]
  );
  const day = resolveSelectedDay(trip, selectedDay, stubs, today);
  const stub = stubs.find((s) => s.iso === day);
  const dayItems = byDate[day] ?? EMPTY;
  const spent = spentByDay[day] ?? 0;

  const [sheet, setSheet] = useState<{ open: boolean; item: ItineraryItem | null }>({ open: false, item: null });
  const openAdd = () => setSheet({ open: true, item: null });
  const openEdit = useCallback((item: ItineraryItem) => setSheet({ open: true, item }), []);
  const submit = (data: CreateItineraryItemRequest) =>
    sheet.item ? updateItem(sheet.item.id, data) : addItem(data).then((it) => (it.itemDate !== day ? onSelectDay(it.itemDate) : undefined));

  if (isLoading) return <DaysSkeleton />;

  if (error && !items.length) {
    return (
      <div role="alert" className="border-l-[3px] border-stamp bg-stamp-tint px-4 py-3">
        <p className="type-body text-ink">{error}</p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const dayOverline = stub
    ? [
        stub.index ? `Day ${stub.index} of ${stubs.filter((s) => s.index !== null).length}` : stub.overline === 'BEFORE' ? 'Before the trip' : 'After the trip',
        stub.isToday ? 'Today' : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <div>
      <DayStrip
        days={stubs}
        selected={day}
        onSelect={onSelectDay}
        counts={counts}
        spentByDay={spentByDay}
        currency={trip.currency}
        panelId={panelId}
        idBase={uid}
      />

      <section id={panelId} role="tabpanel" aria-labelledby={dayTabId(uid, day)} tabIndex={-1} className="mt-6 max-w-[760px] outline-none">
        <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <p className="type-overline text-ink-2">{dayOverline}</p>
            <h2 className="type-display-3 mt-1 text-ink">{stub?.long ?? day}</h2>
            <p className="type-body-s mt-1.5 text-ink-2">
              {dayItems.length ? stopCount(dayItems.length) : 'No stops'}
              {spent > 0 ? (
                <>
                  {' · '}
                  <Link
                    to={`/trips/${trip.id}/ledger?day=${day}`}
                    className="text-ink underline decoration-rule-strong underline-offset-[3px] hover:decoration-ink"
                  >
                    Spent this day <span className="font-mono">{formatMoney(spent, trip.currency)}</span>
                    <span aria-hidden="true"> →</span>
                  </Link>
                </>
              ) : null}
            </p>
          </div>
          {canEdit && dayItems.length ? (
            <Button variant="secondary" onClick={openAdd}>
              <Plus aria-hidden="true" />
              Add stop
            </Button>
          ) : null}
        </header>

        <div className="mt-5">
          {dayItems.length ? (
            <DayTimeline items={dayItems} now={new Date()} canEdit={canEdit} onEdit={openEdit} onDelete={undoable.remove} />
          ) : (
            <div className="flex items-center gap-4 rounded-lg border border-dashed border-rule-strong px-4 py-5">
              <GhostOutline kind="ticket" height={44} className="shrink-0" />
              <div className="min-w-0">
                <p className="type-body text-ink">Free day. Makan, jalan, or sleep in.</p>
                {canEdit ? (
                  <Button variant="secondary" size="sm" className="mt-3" onClick={openAdd}>
                    <Plus aria-hidden="true" />
                    Add stop
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </section>

      {canEdit ? (
        <StopSheet
          open={sheet.open}
          onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
          trip={trip}
          defaultDate={stub?.index ? day : trip.startDate}
          item={sheet.item}
          onSubmit={submit}
        />
      ) : null}
    </div>
  );
}
