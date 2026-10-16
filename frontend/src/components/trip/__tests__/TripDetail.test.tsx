// Trip page shell: :tab routing, the one-sheet-at-a-time rule, viewer guards and the not-found state.
// Data hooks, the scene, the tabs and the sheets are stand-ins; this is about what the page wires together.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { Trip } from '@/types';
import TripDetail from '@/pages/TripDetail';

vi.setConfig({ testTimeout: 20_000 });

const state = vi.hoisted(() => ({
  trip: null as unknown,
  notFound: false,
  error: null as string | null,
}));

vi.mock('@/hooks/useTrips', () => ({
  useTrip: () => ({
    trip: state.trip,
    isLoading: false,
    error: state.error,
    notFound: state.notFound,
    refetch: vi.fn(),
  }),
  useTrips: () => ({ setArchived: vi.fn() }),
}));

const expense = { id: 5, tripId: 2, description: 'Ichiran Shinjuku', amount: 98.73, currency: 'MYR', category: 'food', expenseDate: '2026-10-12' };
vi.mock('@/hooks/useExpenses', () => ({
  useExpenses: () => ({
    expenses: [expense],
    isLoading: false,
    totalSpent: 98.73,
    totalsByCategory: { food: 98.73 },
    spentByDay: { '2026-10-12': 98.73 },
  }),
}));
vi.mock('@/hooks/usePacking', () => ({ usePacking: () => ({ items: [], total: 11 }) }));
vi.mock('@/hooks/useItinerary', () => ({ useItinerary: () => ({ items: [{}, {}] }) }));
vi.mock('@/hooks/useNotes', () => ({ useNotes: () => ({ customNotes: [{}] }) }));
vi.mock('@/hooks/useRates', () => ({ useRates: () => ({ rates: null, date: null, isStale: false, isLoading: false, error: null }) }));
vi.mock('@/hooks/useMembers', () => ({ useMembers: () => ({ leaveTrip: vi.fn(), isSaving: false }) }));
vi.mock('@/hooks/useToday', () => ({ useToday: () => new Date(2026, 9, 16) }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 3, name: 'Syaqirah', country: 'MY', currency: 'MYR' } }) }));

vi.mock('@/components/trip/TripStage', () => ({ TripStage: ({ tab }: { tab: string }) => <div>stage:{tab}</div> }));
vi.mock('@/components/trips/DeleteTripDialog', () => ({ DeleteTripDialog: () => null }));
vi.mock('@/components/trip/tabs/FundTab', () => ({ FundTab: () => <div>tab:fund</div> }));
vi.mock('@/components/trip/tabs/LedgerTab', () => ({ LedgerTab: () => <div>tab:ledger</div> }));
vi.mock('@/components/trip/tabs/DaysTab', () => ({
  DaysTab: ({ selectedDay, onSelectDay }: { selectedDay: string | null; onSelectDay: (d: string) => void }) => (
    <button type="button" onClick={() => onSelectDay('2026-10-14')}>
      tab:days {selectedDay ?? 'none'}
    </button>
  ),
}));
vi.mock('@/components/trip/tabs/PackTab', () => ({ PackTab: () => <div>tab:pack</div> }));
vi.mock('@/components/trip/tabs/NotesTab', () => ({ NotesTab: () => <div>tab:notes</div> }));
vi.mock('@/components/trip/sheets/LogSpendSheet', () => ({
  LogSpendSheet: ({ expense: e }: { expense?: { description: string } }) => <div>sheet:log-spend {e?.description ?? 'new'}</div>,
}));
vi.mock('@/components/trip/sheets/ExpenseDetailSheet', () => ({
  ExpenseDetailSheet: ({ expenseId, onEdit }: { expenseId: number; onEdit: (e: typeof expense) => void }) => (
    <button type="button" onClick={() => onEdit(expense)}>
      sheet:expense {expenseId}
    </button>
  ),
}));
vi.mock('@/components/trip/sheets/LogbookSheet', () => ({ LogbookSheet: ({ tripId }: { tripId: number }) => <div>sheet:logbook {tripId}</div> }));
vi.mock('@/components/trip/sheets/DropInSheet', () => ({ DropInSheet: () => <div>sheet:drop-in</div> }));
vi.mock('@/components/trips/TripEditSheet', () => ({ TripEditSheet: () => <div>sheet:edit</div> }));

function makeTrip(over: Partial<Trip> = {}): Trip {
  return {
    id: 2,
    ownerId: 3,
    name: 'Tokyo autumn',
    destinationCountry: 'JP',
    startDate: '2026-10-12',
    endDate: '2026-10-20',
    budget: 4000,
    currency: 'MYR',
    budgetType: 'shared',
    isArchived: false,
    createdAt: '2026-07-01T00:00:00',
    updatedAt: '2026-07-01T00:00:00',
    members: [],
    memberCount: 3,
    totalExpenses: 98.73,
    savedAmount: 0,
    myRole: 'owner',
    ...over,
  };
}

function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{pathname + search}</output>;
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path="/trips/:tripId/:tab"
          element={
            <>
              <TripDetail />
              <Where />
            </>
          }
        />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );
}

const where = () => screen.getByTestId('where').textContent;

afterEach(() => {
  cleanup();
  state.trip = null;
  state.notFound = false;
  state.error = null;
});

describe('TripDetail tabs', () => {
  it('renders the tab named in the URL, with counts on the tab row', () => {
    state.trip = makeTrip();
    renderAt('/trips/2/ledger');
    expect(screen.getByText('tab:ledger')).toBeInTheDocument();
    expect(screen.getByText('stage:ledger')).toBeInTheDocument();
    const ledgerTab = screen.getByRole('tab', { name: /Ledger/ });
    expect(ledgerTab).toHaveAttribute('aria-selected', 'true');
    expect(ledgerTab).toHaveTextContent('1');
    expect(screen.getByRole('tab', { name: /Days/ })).toHaveTextContent('2');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', ledgerTab.id);
  });

  it('switching tabs rewrites :tab, closes sheets and keeps ?day only where the plot draws', () => {
    state.trip = makeTrip();
    renderAt('/trips/2/ledger?day=2026-10-14&cat=food&sheet=logbook');
    fireEvent.click(screen.getByRole('tab', { name: /Days/ }));
    expect(where()).toBe('/trips/2/days?day=2026-10-14');
    expect(screen.getByText('tab:days 2026-10-14')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Fund/ }));
    expect(where()).toBe('/trips/2/fund');
    expect(screen.getByText('tab:fund')).toBeInTheDocument();
  });

  it('Days tab day selection writes ?day', () => {
    state.trip = makeTrip();
    renderAt('/trips/2/days');
    fireEvent.click(screen.getByText('tab:days none'));
    expect(where()).toBe('/trips/2/days?day=2026-10-14');
  });
});

describe('TripDetail sheets', () => {
  it('renders exactly the sheet in ?sheet', () => {
    state.trip = makeTrip();
    renderAt('/trips/2/fund?sheet=logbook');
    expect(screen.getByText('sheet:logbook 2')).toBeInTheDocument();
    expect(screen.queryByText(/sheet:log-spend/)).toBeNull();
  });

  it('expense receipt → Edit opens log-spend with that expense', () => {
    state.trip = makeTrip();
    renderAt('/trips/2/ledger?sheet=expense&id=5');
    fireEvent.click(screen.getByText('sheet:expense 5'));
    expect(where()).toBe('/trips/2/ledger?sheet=log-spend&id=5');
    expect(screen.getByText('sheet:log-spend Ichiran Shinjuku')).toBeInTheDocument();
  });

  it('the header clock opens the logbook', () => {
    state.trip = makeTrip();
    renderAt('/trips/2/fund');
    fireEvent.click(screen.getByRole('button', { name: 'Logbook' }));
    expect(where()).toBe('/trips/2/fund?sheet=logbook');
  });

  it('a viewer landing on a write sheet gets it closed, and sees no edit controls', () => {
    state.trip = makeTrip({ myRole: 'viewer' });
    renderAt('/trips/2/fund?sheet=drop-in');
    expect(screen.queryByText('sheet:drop-in')).toBeNull();
    expect(where()).toBe('/trips/2/fund');
    expect(screen.getByText('You can view')).toBeInTheDocument();
  });

  it('an editor can open drop-in', () => {
    state.trip = makeTrip({ myRole: 'editor' });
    renderAt('/trips/2/fund?sheet=drop-in');
    expect(screen.getByText('sheet:drop-in')).toBeInTheDocument();
  });
});

describe('TripDetail states', () => {
  it('shows Trip not found with a way back', () => {
    state.notFound = true;
    renderAt('/trips/99/fund');
    expect(screen.getByRole('heading', { name: 'Trip not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Trips/ })).toHaveAttribute('href', '/trips');
  });

  it('shows the load error with a retry', () => {
    state.error = "Alamak, can't reach the server. Your entries are safe. Try again in a moment.";
    renderAt('/trips/2/fund');
    expect(screen.getByRole('alert')).toHaveTextContent("can't reach the server");
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('shows the over-budget notice with a way to where it went', () => {
    state.trip = makeTrip({ budget: 50 });
    renderAt('/trips/2/ledger');
    expect(screen.getByText(/Over by RM\s48\.73\. Happens\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Here's where it went/ }));
    expect(where()).toBe('/trips/2/fund');
  });
});
