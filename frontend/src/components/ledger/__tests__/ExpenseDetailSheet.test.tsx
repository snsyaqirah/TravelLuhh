import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Expense, Trip } from '@/types';

vi.mock('@/components/ledger/LedgerSheet', () => ({
  LedgerSheet: ({ open, title, children, footer }: { open: boolean; title: ReactNode; children: ReactNode; footer?: ReactNode }) =>
    open ? (
      <div role="dialog" aria-label={String(title)}>
        {children}
        {footer}
      </div>
    ) : null,
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(() => 't1'), { error: vi.fn(), dismiss: vi.fn() }) }));
vi.mock('@/services/expenseService', () => ({
  expenseService: { getExpensesByTrip: vi.fn(), createExpense: vi.fn(), updateExpense: vi.fn(), deleteExpense: vi.fn() },
}));

import { toast } from 'sonner';
import { expenseService } from '@/services/expenseService';
import { queryKeys } from '@/lib/queryClient';
import { ExpenseDetailSheet } from '@/components/trip/sheets/ExpenseDetailSheet';
import { resetPendingDeletesForTests } from '../pendingDeletes';

const trip = { id: 2, name: 'Tokyo autumn', currency: 'MYR', startDate: '2026-10-12', endDate: '2026-10-20', budgetType: 'shared', myRole: 'editor' } as Trip;
const ramen: Expense = {
  id: 13,
  tripId: 2,
  description: 'Ichiran Shinjuku',
  amount: 98.73,
  currency: 'MYR',
  originalAmount: 3200,
  originalCurrency: 'JPY',
  fxRate: 0.03085467,
  category: 'food',
  expenseDate: '2026-10-12',
  notes: 'Counter seats, 40 min queue',
  addedBy: 2,
  addedByUser: { id: 2, name: 'Siti Aisyah', email: 's@x' },
  paidBy: 1,
  paidByUser: { id: 1, name: 'Aiman Hakim', email: 'a@x' },
  createdAt: '2026-10-12T21:04:00',
  updatedAt: '2026-10-12T21:04:00',
};

function setup(t: Trip = trip) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(queryKeys.expenses(2), [ramen]);
  const onOpenChange = vi.fn();
  const onEdit = vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <ExpenseDetailSheet trip={t} expenseId={13} open onOpenChange={onOpenChange} onEdit={onEdit} />
    </QueryClientProvider>,
  );
  return { qc, onOpenChange, onEdit };
}

beforeEach(() => {
  vi.mocked(expenseService.getExpensesByTrip).mockResolvedValue([ramen]);
  vi.mocked(expenseService.deleteExpense).mockResolvedValue(undefined);
});
afterEach(() => {
  resetPendingDeletesForTests();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('ExpenseDetailSheet', () => {
  it('prints the receipt: original, converted, rate, payer, logger, note', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: 'Ichiran Shinjuku' });
    expect(dialog).toHaveTextContent('¥ 3,200');
    expect(dialog).toHaveTextContent('≈ RM 98.73');
    expect(dialog).toHaveTextContent('1 MYR = 32.41 JPY');
    expect(dialog).toHaveTextContent('Paid byAiman Hakim');
    expect(dialog).toHaveTextContent('Logged bySiti Aisyah');
    expect(dialog).toHaveTextContent('Day 1 of 9');
    expect(dialog).toHaveTextContent('Counter seats, 40 min queue');
  });

  it('Edit hands the entry over; Delete closes and leaves an Undo that outlives the sheet', () => {
    const { qc, onOpenChange, onEdit } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledWith(ramen);

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(toast).toHaveBeenCalledWith('Removed "Ichiran Shinjuku".', expect.objectContaining({ duration: 5000, action: expect.objectContaining({ label: 'Undo' }) }));
    expect(qc.getQueryData<Expense[]>(queryKeys.expenses(2))).toEqual([]);
    expect(expenseService.deleteExpense).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(expenseService.deleteExpense).toHaveBeenCalledWith(13);
  });

  it('viewers see the receipt without Edit or Delete', () => {
    setup({ ...trip, myRole: 'viewer' });
    expect(screen.getByRole('dialog', { name: 'Ichiran Shinjuku' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });
});
