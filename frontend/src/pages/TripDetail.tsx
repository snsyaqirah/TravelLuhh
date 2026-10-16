// Trip detail /trips/:tripId/:tab (§9.6). Header, one scene stage with the figures beside it, the budget
// notice, sticky ledger tabs synced to :tab, and exactly one URL sheet (?sheet=…) at a time.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTrip } from '@/hooks/useTrips';
import { useExpenses } from '@/hooks/useExpenses';
import { useFund } from '@/hooks/useFund';
import { usePacking } from '@/hooks/usePacking';
import { useItinerary } from '@/hooks/useItinerary';
import { useNotes } from '@/hooks/useNotes';
import { useToday } from '@/hooks/useToday';
import { useRates } from '@/hooks/useRates';
import { useShellChrome } from '@/components/shell/chrome';
import { AppSkeleton } from '@/components/shell/AppSkeleton';
import { isTripTab } from '@/components/shell/routeMeta';
import { GhostOutline, LedgerTabs, NoticeSlip, ledgerPanelId, ledgerTabId, useSessionDismissed } from '@/components/motifs';
import { Button } from '@/components/ui/button';
import { TripHeader } from '@/components/trip/TripHeader';
import { TripStage } from '@/components/trip/TripStage';
import { TripFigures } from '@/components/trip/TripFigures';
import { useTripSheet } from '@/components/trip/useTripSheet';
import {
  TAB_LABELS,
  TRIP_TABS,
  WRITE_SHEETS,
  canEditTrip,
  isTripOwner,
  searchForTab,
  type TripTab,
} from '@/components/trip/tripTabs';
import { FundTab } from '@/components/trip/tabs/FundTab';
import { LedgerTab } from '@/components/trip/tabs/LedgerTab';
import { DaysTab } from '@/components/trip/tabs/DaysTab';
import { PackTab } from '@/components/trip/tabs/PackTab';
import { NotesTab } from '@/components/trip/tabs/NotesTab';
import { LogSpendSheet } from '@/components/trip/sheets/LogSpendSheet';
import { ExpenseDetailSheet } from '@/components/trip/sheets/ExpenseDetailSheet';
import { LogbookSheet } from '@/components/trip/sheets/LogbookSheet';
// TEMP-STUB import { PeopleSheet } from '@/components/trip/sheets/PeopleSheet';
import { DropInSheet } from '@/components/trip/sheets/DropInSheet';
import { TripEditSheet } from '@/components/trips/TripEditSheet';
import { fundNotice } from '@/lib/fundCopy';
import { isLiveTrip } from '@/lib/phase';
import { cn } from '@/lib/utils';
import type { Expense, Trip } from '@/types';
import type { FundState } from '@/hooks/useFund';

const ID_BASE = 'trip';
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const OVER_TAIL = " Here's where it went →";

/**
 * LedgerTabs calls scrollIntoView({ block: 'nearest' }) on its active tab when it mounts or the tabs change,
 * which scrolls the whole page down to the tab row on load (REQUEST to the motif owner: scroll the tab list
 * sideways only). Until then, put the window back where it was when this render started.
 */
function useHoldWindowScroll(deps: unknown[]) {
  const y = useRef(0);
  y.current = typeof window === 'undefined' ? 0 : window.scrollY;
  useLayoutEffect(() => {
    if (Math.abs(window.scrollY - y.current) > 1) window.scrollTo({ top: y.current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function TripNotFound() {
  return (
    <div className="flex flex-col items-start gap-4 py-8 md:py-16">
      <GhostOutline kind="ticket" height={96} />
      <h1 className="type-display-2 text-ink">Trip not found</h1>
      <p className="type-body max-w-[46ch] text-ink-2">
        It may have been deleted, or you're not on this trip any more. Ask the owner to add you back if you need it.
      </p>
      <Button asChild variant="secondary">
        <Link to="/trips">
          <ChevronLeft aria-hidden="true" />
          Back to Trips
        </Link>
      </Button>
    </div>
  );
}

function TripLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-4 py-8 md:py-16">
      <GhostOutline kind="ticket" height={96} />
      <h1 className="type-display-3 text-ink">This trip didn't load</h1>
      <p className="type-body max-w-[46ch] text-ink-2">{message}</p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={onRetry}>Try again</Button>
        <Button asChild variant="secondary">
          <Link to="/trips">Back to Trips</Link>
        </Button>
      </div>
    </div>
  );
}

export default function TripDetail() {
  const { tripId = '', tab: tabParam } = useParams<{ tripId: string; tab: string }>();
  const tab: TripTab = isTripTab(tabParam) ? tabParam : 'fund';
  const [params, setParams] = useSearchParams();
  const { search } = useLocation();
  const navigate = useNavigate();
  const today = useToday();
  const { user } = useAuth();
  const { sheet, id: sheetId, open, close } = useTripSheet();

  // Group trips on the road poll (§0.1 isLiveTrip); everything else loads once and refreshes on writes.
  const [live, setLive] = useState(false);
  const { trip, isLoading, error, notFound, refetch } = useTrip(tripId, { live });
  const nextLive = isLiveTrip(trip, today);
  if (nextLive !== live) setLive(nextLive);

  const enabled = Boolean(trip);
  const tid = trip?.id;
  const expensesQ = useExpenses(tid, { live, enabled });
  const packing = usePacking(tid);
  const itinerary = useItinerary(tid);
  const notes = useNotes(tid);
  const rates = useRates(trip?.currency);

  // While the expenses list loads, the trip's own spent_amount stands in.
  const fund = useFund(trip, { spent: expensesQ.isLoading ? undefined : expensesQ.totalSpent });

  const canEdit = canEditTrip(trip);
  const owner = isTripOwner(trip);

  useShellChrome({ title: trip?.name, backTo: '/trips', backLabel: 'Back to Trips' });

  // A viewer who lands on a write sheet by URL (or a stale link) gets it closed instead of a dead form.
  useEffect(() => {
    if (trip && sheet && WRITE_SHEETS.has(sheet) && !canEdit) close();
  }, [trip, sheet, canEdit, close]);

  const dayParam = params.get('day');
  const selectedDay = dayParam && ISO_DAY.test(dayParam) ? dayParam : null;

  const onSelectDay = useCallback(
    (iso: string) =>
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set('day', iso);
          return p;
        },
        { replace: true }
      ),
    [setParams]
  );

  const goTab = useCallback(
    (next: TripTab) => navigate({ pathname: `/trips/${tripId}/${next}`, search: searchForTab(search, next) }, { replace: true }),
    [navigate, tripId, search]
  );

  // "Here's where it went →" lands on the Fund tab's category table.
  const scrollToCategories = useRef(false);
  const showWhereItWent = () => {
    if (tab !== 'fund') {
      scrollToCategories.current = true;
      goTab('fund');
    } else document.getElementById('categories')?.scrollIntoView({ block: 'start' });
  };
  useEffect(() => {
    if (tab !== 'fund' || !scrollToCategories.current) return;
    const t = window.setTimeout(() => {
      const el = document.getElementById('categories');
      if (el) {
        scrollToCategories.current = false;
        el.scrollIntoView({ block: 'start' });
      }
    }, 60);
    return () => window.clearTimeout(t);
  }, [tab, expensesQ.isLoading]);

  const notice = fund ? fundNotice(fund) : null;
  const [noticeDismissed, dismissNotice] = useSessionDismissed(`${tid ?? 'trip'}:${notice?.id ?? 'none'}`);

  const tabs = useMemo(
    () =>
      TRIP_TABS.map((key) => ({
        key,
        label: TAB_LABELS[key],
        count:
          key === 'ledger'
            ? expensesQ.expenses.length
            : key === 'days'
              ? itinerary.items.length
              : key === 'pack'
                ? packing.total
                : key === 'notes'
                  ? notes.customNotes.length
                  : undefined,
      })),
    [expensesQ.expenses.length, itinerary.items.length, packing.total, notes.customNotes.length]
  );

  useHoldWindowScroll([tab, tabs, Boolean(trip)]);

  if (!trip) {
    if (notFound) return <TripNotFound />;
    if (error && !isLoading) {
      return (
        <TripLoadError
          message={error}
          onRetry={() => void refetch()}
        />
      );
    }
    return <AppSkeleton />;
  }
  if (!fund) return <AppSkeleton />;

  const editingExpense = sheet === 'log-spend' && sheetId ? expensesQ.expenses.find((e) => e.id === sheetId) : undefined;
  const onSheetChange = (o: boolean) => {
    if (!o) close();
  };

  let panel;
  switch (tab) {
    case 'ledger':
      panel = <LedgerTab trip={trip} fund={fund} canEdit={canEdit} />;
      break;
    case 'days':
      panel = <DaysTab trip={trip} canEdit={canEdit} selectedDay={selectedDay} onSelectDay={onSelectDay} />;
      break;
    case 'pack':
      panel = <PackTab trip={trip} canEdit={canEdit} />;
      break;
    case 'notes':
      panel = <NotesTab trip={trip} canEdit={canEdit} />;
      break;
    default:
      panel = <FundTab trip={trip} fund={fund} canEdit={canEdit} />;
  }

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <TripHeader
        trip={trip}
        fund={fund}
        expenses={expensesQ.expenses}
        homeCountry={user?.country}
        today={today}
        canEdit={canEdit}
        isOwner={owner}
        onOpenSheet={(s) => open(s)}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        <div className="min-w-0 lg:col-span-7">
          <TripStage
            trip={trip}
            tab={tab}
            fund={fund}
            expenses={expensesQ.expenses}
            byCategory={expensesQ.totalsByCategory}
            packingItems={packing.items}
            homeCountry={user?.country}
            today={today}
            selectedDay={tab === 'fund' || tab === 'pack' ? null : selectedDay}
            rates={rates.rates}
          />
        </div>
        <TripFigures trip={trip} fund={fund} homeCurrency={user?.currency} className="min-w-0 lg:col-span-5" />
      </div>

      {notice && !noticeDismissed ? (
        <NoticeSlip
          level={notice.level}
          onDismiss={dismissNotice}
          action={
            notice.id === 'over' ? (
              <button
                type="button"
                onClick={showWhereItWent}
                className="font-medium text-ink underline decoration-rule-strong underline-offset-[3px] hover:decoration-ink"
              >
                Here's where it went →
              </button>
            ) : undefined
          }
        >
          {notice.id === 'over' ? notice.text.replace(OVER_TAIL, '') : notice.text}
        </NoticeSlip>
      ) : null}

      <div className="flex flex-col">
        <div
          className={cn(
            'sticky top-[calc(52px+env(safe-area-inset-top))] z-20 -mx-4 bg-paper px-4 md:top-0 md:-mx-6 md:px-6'
          )}
        >
          <LedgerTabs tabs={tabs} value={tab} onChange={goTab} ariaLabel="Trip sections" idBase={ID_BASE} />
        </div>
        <div
          role="tabpanel"
          id={ledgerPanelId(ID_BASE, tab)}
          aria-labelledby={ledgerTabId(ID_BASE, tab)}
          tabIndex={-1}
          className="pt-6 outline-none [--passbook-sticky-top:calc(96px+env(safe-area-inset-top))] md:[--passbook-sticky-top:44px] lg:pt-8"
        >
          {panel}
        </div>
      </div>

      {sheet === 'log-spend' && canEdit ? (
        <LogSpendSheet trip={trip} open onOpenChange={onSheetChange} expense={editingExpense} />
      ) : sheet === 'expense' && sheetId ? (
        <ExpenseDetailSheet
          trip={trip}
          expenseId={sheetId}
          open
          onOpenChange={onSheetChange}
          onEdit={(e) => open('log-spend', { id: e.id })}
        />
      ) : sheet === 'logbook' ? (
        <LogbookSheet tripId={trip.id} open onOpenChange={onSheetChange} />
      ) : sheet === 'edit' && canEdit ? (
        <TripEditSheet trip={trip} open onOpenChange={onSheetChange} />
      ) : sheet === 'people' ? (
        <PeopleSheet trip={trip} open onOpenChange={onSheetChange} />
      ) : sheet === 'drop-in' && canEdit ? (
        <DropInSheet trip={trip} open onOpenChange={onSheetChange} />
      ) : null}
    </div>
  );
}

// ── TEMP-STUBS: teammates' components not landed yet; replaced by the real imports before hand-off ──
function PeopleSheet(_: { trip: Trip; open: boolean; onOpenChange: (o: boolean) => void }) {
  return null;
}
