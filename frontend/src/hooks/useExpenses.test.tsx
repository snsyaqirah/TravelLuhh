import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Expense, Trip } from '@/types';
import { appEvents, type AppEvent } from '@/lib/appEvents';

vi.mock('@/services/expenseService', () => ({
  expenseService: {
    getExpensesByTrip: vi.fn(),
    createExpense: vi.fn(),
    updateExpense: vi.fn(),
    deleteExpense: vi.fn(),
  },
}));
vi.mock('@/services/tripService', () => ({ tripService: { getTripById: vi.fn() } }));
vi.mock('@/services/currencyService', () => ({ currencyService: { getRate: vi.fn() } }));

import { expenseService } from '@/services/expenseService';
import { tripService } from '@/services/tripService';
import { currencyService } from '@/services/currencyService';
import { useExpenses } from './useExpenses';
import { removeExpenseWithUndo, resetPendingDeletesForTests, undoExpenseRemoval } from '@/components/ledger/pendingDeletes';
import { API_BASE_URL } from '@/lib/axios';

const trip = { id: 9, currency: 'MYR', budget: 4000, startDate: '2026-11-12', endDate: '2026-11-20' } as Trip;
const ramen: Expense = {
  id: 1,
  tripId: 9,
  description: 'Ramen Ichiran',
  amount: 82.51,
  currency: 'MYR',
  category: 'food',
  expenseDate: '2026-11-14',
  createdAt: '2026-11-14T21:04:00',
  updatedAt: '2026-11-14T21:04:00',
};
const grab: Expense = { ...ramen, id: 2, description: 'Grab to Shinjuku', category: 'transportation', amount: 30 };

let events: AppEvent[] = [];
let off: () => void;

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { qc, wrapper };
}

beforeEach(() => {
  vi.mocked(expenseService.getExpensesByTrip).mockResolvedValue([ramen, grab]);
  vi.mocked(tripService.getTripById).mockResolvedValue(trip);
  vi.mocked(expenseService.deleteExpense).mockResolvedValue(undefined);
  events = [];
  off = appEvents.on((e) => events.push(e));
});

afterEach(() => {
  off();
  resetPendingDeletesForTests();
  vi.clearAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (document as { visibilityState?: string }).visibilityState;
  localStorage.clear();
});

function hidePage() {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useExpenses', () => {
  it('loads with a string route param and totals in the trip currency', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useExpenses('9'), { wrapper });
    await waitFor(() => expect(result.current.expenses).toHaveLength(2));
    expect(expenseService.getExpensesByTrip).toHaveBeenCalledWith(9);
    expect(result.current.getTotalSpent()).toBeCloseTo(112.51, 6);
    expect(result.current.totalsByCategory.food).toBeCloseTo(82.51, 6);
    expect(result.current.spentByDay['2026-11-14']).toBeCloseTo(112.51, 6);
  });

  it('converts a foreign-currency spend to the trip currency before sending, then emits coinOut', async () => {
    vi.mocked(currencyService.getRate).mockResolvedValue({ rate: 0.025784, date: '2026-10-15' });
    vi.mocked(expenseService.createExpense).mockImplementation(async (body) => ({ ...ramen, id: 3, ...body }) as Expense);
    const { wrapper } = setup();
    const { result } = renderHook(() => useExpenses(9), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.createExpense({ amount: 3200, currency: 'JPY', category: 'food', description: ' Ramen ', date: '2026-11-14' });
    });

    expect(expenseService.createExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        tripId: 9,
        description: 'Ramen',
        amount: 82.51,
        currency: 'MYR',
        originalAmount: 3200,
        originalCurrency: 'JPY',
        fxRate: 0.025784,
        expenseDate: '2026-11-14',
      })
    );
    expect(events).toContainEqual({ type: 'coinOut', tripId: 9, date: '2026-11-14', category: 'food', amount: 82.51 });
  });

  it('refuses to send a foreign amount when there is no rate', async () => {
    vi.mocked(currencyService.getRate).mockResolvedValue(null);
    const { wrapper } = setup();
    const { result } = renderHook(() => useExpenses(9), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await expect(
      result.current.createExpense({ amount: 100000, currency: 'VND', category: 'food', description: 'Pho', expenseDate: '2026-11-14' })
    ).rejects.toThrow('No rate for VND today. Enter the amount in MYR instead.');
    expect(expenseService.createExpense).not.toHaveBeenCalled();
  });

  it('removeWithUndo hides the row at once and undo brings it back without a DELETE', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useExpenses(9), { wrapper });
    await waitFor(() => expect(result.current.expenses).toHaveLength(2));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    act(() => result.current.removeWithUndo(ramen));
    expect(result.current.expenses.map((e) => e.id)).toEqual([2]);
    act(() => result.current.undoRemove(ramen.id));
    expect(result.current.expenses.map((e) => e.id)).toEqual([1, 2]);
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(expenseService.deleteExpense).not.toHaveBeenCalled();
  });

  it('sends the DELETE after 5 s and emits coinBack', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useExpenses(9), { wrapper });
    await waitFor(() => expect(result.current.expenses).toHaveLength(2));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    act(() => result.current.removeWithUndo(ramen));
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(expenseService.deleteExpense).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(expenseService.deleteExpense).toHaveBeenCalledWith(1);
    expect(events).toContainEqual({ type: 'coinBack', tripId: 9, date: '2026-11-14', category: 'food', amount: 82.51 });
  });

  it('sends a pending DELETE immediately on unmount', async () => {
    const { wrapper } = setup();
    const { result, unmount } = renderHook(() => useExpenses(9), { wrapper });
    await waitFor(() => expect(result.current.expenses).toHaveLength(2));
    act(() => result.current.removeWithUndo(grab));
    expect(expenseService.deleteExpense).not.toHaveBeenCalled();
    unmount();
    expect(expenseService.deleteExpense).toHaveBeenCalledWith(2);
  });

  it('an entry removed from a ledger row or receipt stays hidden from every consumer, even when a refetch brings it back', async () => {
    const { wrapper, qc } = setup();
    const figures = renderHook(() => useExpenses(9), { wrapper }); // TripDetail: figures, stage, counts
    const fundTab = renderHook(() => useExpenses('9'), { wrapper }); // FundTab / export
    await waitFor(() => expect(figures.result.current.expenses).toHaveLength(2));
    act(() => removeExpenseWithUndo(qc, ramen));
    // a 25 s live poll or a focus refetch inside the 5 s undo window returns the row from the server
    await act(async () => {
      await figures.result.current.refetch();
    });
    expect(qc.getQueryData<Expense[]>(['expenses', 9])?.map((e) => e.id)).toEqual([1, 2]);
    for (const r of [figures.result, fundTab.result]) {
      expect(r.current.expenses.map((e) => e.id)).toEqual([2]);
      expect(r.current.totalSpent).toBe(30);
      expect(r.current.totalsByCategory.food).toBeUndefined();
    }
    act(() => undoExpenseRemoval(ramen.id));
    expect(figures.result.current.expenses.map((e) => e.id)).toEqual([1, 2]);
    expect(expenseService.deleteExpense).not.toHaveBeenCalled();
  });

  it('when the page is hidden, pending DELETEs go out with fetch keepalive and the bearer token', async () => {
    localStorage.setItem('travelluhh_token', 'acc-1');
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const { wrapper, qc } = setup();
    const { result } = renderHook(() => useExpenses(9), { wrapper });
    await waitFor(() => expect(result.current.expenses).toHaveLength(2));
    act(() => result.current.removeWithUndo(grab)); // hook-held undo
    act(() => removeExpenseWithUndo(qc, ramen)); // ledger / receipt undo
    await act(async () => {
      hidePage();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const id of [1, 2]) {
      expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/expenses/${id}`, {
        method: 'DELETE',
        keepalive: true,
        headers: { Authorization: 'Bearer acc-1' },
      });
    }
    expect(expenseService.deleteExpense).not.toHaveBeenCalled();
    await waitFor(() => expect(events.filter((e) => e.type === 'coinBack')).toHaveLength(2));
  });

  it('pagehide flushes too; an expired token falls back to the normal (refreshing) DELETE', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    const { wrapper } = setup();
    const { result } = renderHook(() => useExpenses(9), { wrapper });
    await waitFor(() => expect(result.current.expenses).toHaveLength(2));
    act(() => result.current.removeWithUndo(ramen));
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(expenseService.deleteExpense).toHaveBeenCalledWith(1));
  });

  it('puts the row back if the DELETE fails', async () => {
    vi.mocked(expenseService.deleteExpense).mockRejectedValue(new Error('Server said no'));
    const { wrapper, qc } = setup();
    const { result } = renderHook(() => useExpenses(9), { wrapper });
    await waitFor(() => expect(result.current.expenses).toHaveLength(2));
    act(() => result.current.removeWithUndo(ramen));
    await act(async () => {
      result.current.flushRemovals();
    });
    await waitFor(() => expect(qc.getQueryData<Expense[]>(['expenses', 9])?.map((e) => e.id)).toEqual([1, 2]));
  });
});
