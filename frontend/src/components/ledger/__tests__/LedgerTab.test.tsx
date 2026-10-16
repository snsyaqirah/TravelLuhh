import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { Expense, Trip } from '@/types';

vi.mock('@/services/expenseService', () => ({
  expenseService: {
    getExpensesByTrip: vi.fn(),
    createExpense: vi.fn(),
    updateExpense: vi.fn(),
    deleteExpense: vi.fn(),
  },
}));
vi.mock('@/services/fundService', () => ({ fundService: { get: vi.fn(), add: vi.fn(), remove: vi.fn() } }));

import { expenseService } from '@/services/expenseService';
import { computeFund } from '@/hooks/useFund';
import { LedgerTab } from '@/components/trip/tabs/LedgerTab';
import { resetPendingDeletesForTests, undoExpenseRemoval } from '../pendingDeletes';

const trip = {
  id: 2,
  ownerId: 3,
  name: 'Tokyo autumn',
  destinationCountry: 'JP',
  startDate: '2026-10-12',
  endDate: '2026-10-20',
  budget: 4000,
  currency: 'MYR',
  budgetType: 'solo',
  isArchived: false,
  createdAt: '2026-07-01T10:00:00',
  updatedAt: '2026-07-01T10:00:00',
  totalExpenses: 487.82,
  savedAmount: 0,
  myRole: 'owner',
} as Trip;

const mk = (id: number, date: string, description: string, amount: number, p: Partial<Expense> = {}): Expense => ({
  id,
  tripId: 2,
  description,
  amount,
  currency: 'MYR',
  originalAmount: amount,
  originalCurrency: 'MYR',
  category: 'food',
  expenseDate: date,
  createdAt: `${date}T12:00:00`,
  updatedAt: `${date}T12:00:00`,
  ...p,
});

const ramen = mk(13, '2026-10-12', 'Ramen Ichiran', 98.73, { originalAmount: 3200, originalCurrency: 'JPY', fxRate: 0.03085467 });
const nikko = mk(18, '2026-10-14', 'Tobu Nikko pass x3', 259.5, { category: 'transportation' });
const yuba = mk(19, '2026-10-14', 'Yuba lunch set', 129.59);

function Where() {
  const { search } = useLocation();
  return <output data-testid="search">{search}</output>;
}

function setup(path = '/trips/2/ledger', canEdit = true) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const fund = computeFund(trip, new Date(2026, 9, 16, 10));
  const ui = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/trips/:tripId/:tab"
            element={
              <>
                <LedgerTab trip={trip} fund={fund} canEdit={canEdit} />
                <Where />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { qc, ...ui };
}

/** The phone list (the desktop table is in the DOM too; container queries don't run in jsdom). */
const list = () => screen.getByRole('region', { name: 'Tokyo autumn ledger' });
const rowLabels = () =>
  within(list())
    .queryAllByRole('button')
    .map((b) => b.textContent ?? '')
    .filter((t) => /Ramen|Nikko|Yuba|Fund set|FUND SET/i.test(t));

function swipeLeft(label: string, distance = 220) {
  const button = within(list()).getByRole('button', { name: label });
  const surface = button.closest('li')!.children[1] as HTMLElement;
  fireEvent.pointerDown(surface, { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: 320, clientY: 20 });
  fireEvent.pointerMove(surface, { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: 300, clientY: 21 });
  fireEvent.pointerMove(surface, { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: 320 - distance, clientY: 22 });
  fireEvent.pointerUp(surface, { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: 320 - distance, clientY: 22 });
}

beforeEach(() => {
  vi.mocked(expenseService.getExpensesByTrip).mockResolvedValue([yuba, nikko, ramen]);
  vi.mocked(expenseService.deleteExpense).mockResolvedValue(undefined);
});

afterEach(() => {
  resetPendingDeletesForTests();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('LedgerTab filters', () => {
  it('shows every entry with FUND SET, newest day first', { timeout: 20_000 }, async () => {
    setup();
    await waitFor(() => expect(rowLabels()).toHaveLength(4));
    expect(rowLabels()).toEqual(['Yuba lunch set', 'Tobu Nikko pass x3', 'Ramen Ichiran', 'Fund set']);
    expect(screen.getByText('3 entries')).toBeInTheDocument();
  });

  it('?day= shows that day and its chip clears it', async () => {
    setup('/trips/2/ledger?day=2026-10-14');
    await waitFor(() => expect(rowLabels()).toEqual(['Yuba lunch set', 'Tobu Nikko pass x3']));
    expect(screen.getByText('2 of 3 entries')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear the day filter, Wed 14 Oct' }));
    await waitFor(() => expect(rowLabels()).toHaveLength(4));
    expect(screen.getByTestId('search').textContent).toBe('');
  });

  it('category chips toggle ?cat= and search narrows further', { timeout: 20_000 }, async () => {
    setup();
    await waitFor(() => expect(rowLabels()).toHaveLength(4));
    const food = screen.getByRole('button', { name: /^Food/ });
    fireEvent.click(food);
    expect(food).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('search').textContent).toBe('?cat=food');
    expect(rowLabels()).toEqual(['Yuba lunch set', 'Ramen Ichiran']);
    expect(screen.getByText('The running BAKI shows on the full ledger.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search the ledger'), { target: { value: 'ramen' } });
    expect(rowLabels()).toEqual(['Ramen Ichiran']);
    fireEvent.change(screen.getByLabelText('Search the ledger'), { target: { value: 'onsen' } });
    expect(screen.getByText('Nothing matches "onsen" in Food.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show the whole ledger' }));
    await waitFor(() => expect(rowLabels()).toHaveLength(4));
  });

  it('viewers get no write controls', async () => {
    vi.mocked(expenseService.getExpensesByTrip).mockResolvedValue([]);
    setup('/trips/2/ledger', false);
    expect(await screen.findByText('Nothing in the ledger yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /log spend/i })).not.toBeInTheDocument();
  });
});

describe('LedgerTab delete with undo', () => {
  it('swipe-left removes the row at once and sends the DELETE when the 5 s run out', async () => {
    setup();
    await waitFor(() => expect(rowLabels()).toHaveLength(4));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    act(() => swipeLeft('Yuba lunch set'));
    expect(rowLabels()).not.toContain('Yuba lunch set');
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(expenseService.deleteExpense).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(expenseService.deleteExpense).toHaveBeenCalledWith(19);
  });

  it('a short swipe only reveals Delete; tapping it removes the row', async () => {
    setup();
    await waitFor(() => expect(rowLabels()).toHaveLength(4));
    act(() => swipeLeft('Tobu Nikko pass x3', 70));
    expect(rowLabels()).toContain('Tobu Nikko pass x3');
    fireEvent.click(within(list()).getByRole('button', { name: 'Delete "Tobu Nikko pass x3"' }));
    expect(rowLabels()).not.toContain('Tobu Nikko pass x3');
    expect(expenseService.deleteExpense).not.toHaveBeenCalled();
  });

  it('Undo puts the row back and nothing is deleted', async () => {
    setup();
    await waitFor(() => expect(rowLabels()).toHaveLength(4));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    act(() => swipeLeft('Ramen Ichiran'));
    expect(rowLabels()).not.toContain('Ramen Ichiran');
    act(() => undoExpenseRemoval(13));
    expect(rowLabels()).toContain('Ramen Ichiran');
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(expenseService.deleteExpense).not.toHaveBeenCalled();
  });

  it('leaving the ledger sends a pending DELETE immediately', async () => {
    const { unmount } = setup();
    await waitFor(() => expect(rowLabels()).toHaveLength(4));
    act(() => swipeLeft('Yuba lunch set'));
    expect(expenseService.deleteExpense).not.toHaveBeenCalled();
    unmount();
    expect(expenseService.deleteExpense).toHaveBeenCalledWith(19);
  });

  it('mouse drags never delete (touch only)', async () => {
    setup();
    await waitFor(() => expect(rowLabels()).toHaveLength(4));
    const surface = within(list()).getByRole('button', { name: 'Ramen Ichiran' }).closest('li')!.children[1] as HTMLElement;
    fireEvent.pointerDown(surface, { pointerId: 2, pointerType: 'mouse', isPrimary: true, clientX: 320, clientY: 20 });
    fireEvent.pointerMove(surface, { pointerId: 2, pointerType: 'mouse', isPrimary: true, clientX: 40, clientY: 20 });
    fireEvent.pointerUp(surface, { pointerId: 2, pointerType: 'mouse', isPrimary: true, clientX: 40, clientY: 20 });
    expect(rowLabels()).toContain('Ramen Ichiran');
  });
});
