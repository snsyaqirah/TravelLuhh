import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Expense, Rates, Trip } from '@/types';

// The sheet chrome (vaul / Radix) is covered by its own kit; here we only drive the form.
vi.mock('@/components/ledger/LedgerSheet', () => ({
  LedgerSheet: ({ open, title, children, footer }: { open: boolean; title: ReactNode; children: ReactNode; footer?: ReactNode }) =>
    open ? (
      <div role="dialog" aria-label={String(title)}>
        {children}
        {footer}
      </div>
    ) : null,
}));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 3, name: 'Syaqirah' } }) }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), dismiss: vi.fn() }) }));
vi.mock('@/services/expenseService', () => ({
  expenseService: { getExpensesByTrip: vi.fn(), createExpense: vi.fn(), updateExpense: vi.fn(), deleteExpense: vi.fn() },
}));
vi.mock('@/services/tripService', () => ({ tripService: { getTripById: vi.fn() } }));
vi.mock('@/services/currencyService', () => ({
  FX_TTL_MS: 12 * 60 * 60 * 1000,
  readCachedRates: () => null,
  currencyService: { getLatestRates: vi.fn(), getRate: vi.fn(), getRateHistory: vi.fn() },
}));

import { toast } from 'sonner';
import { expenseService } from '@/services/expenseService';
import { currencyService } from '@/services/currencyService';
import { LogSpendSheet } from '@/components/trip/sheets/LogSpendSheet';

const rates: Rates = { base: 'MYR', date: '2026-10-15', rates: { JPY: 32.41 } };
const trip = {
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
  createdAt: '2026-07-01T10:00:00',
  updatedAt: '2026-07-01T10:00:00',
  myRole: 'owner',
  members: [
    { id: 1, userId: 3, name: 'Syaqirah', email: 'sy@x', role: 'owner', joinedAt: '2026-07-01T10:00:00' },
    { id: 2, userId: 1, name: 'Aiman Hakim', email: 'a@x', role: 'editor', joinedAt: '2026-07-02T10:00:00' },
    { id: 3, userId: 2, name: 'Siti Aisyah', email: 's@x', role: 'editor', joinedAt: '2026-07-03T10:00:00' },
  ],
} as Trip;

const donki: Expense = {
  id: 22,
  tripId: 2,
  description: 'Don Quijote haul',
  amount: 241.9,
  currency: 'MYR',
  originalAmount: 7840,
  originalCurrency: 'JPY',
  fxRate: 0.03085467,
  category: 'bundle',
  expenseDate: '2026-10-15',
  addedBy: 2,
  paidBy: 2,
  paidByUser: { id: 2, name: 'Siti Aisyah', email: 's@x' },
  subItems: [
    { id: 5, description: 'KitKat matcha, 3 boxes', amount: 74.06, category: 'shopping' },
    { id: 6, description: 'Sheet masks', amount: 92.57, category: 'shopping' },
    { id: 7, description: 'Tokyo Banana', amount: 75.27, category: 'food' },
  ],
  createdAt: '2026-10-15T17:05:00',
  updatedAt: '2026-10-15T17:05:00',
};

function setup(expense?: Expense) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const onOpenChange = vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <LogSpendSheet trip={trip} open onOpenChange={onOpenChange} expense={expense} />
    </QueryClientProvider>,
  );
  return { qc, onOpenChange };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 16, 10, 0));
  vi.mocked(currencyService.getLatestRates).mockResolvedValue(rates);
  vi.mocked(expenseService.getExpensesByTrip).mockResolvedValue([donki]);
  vi.mocked(expenseService.createExpense).mockImplementation(async (b) => ({ ...donki, id: 40, ...b, subItems: [] }) as Expense);
  vi.mocked(expenseService.updateExpense).mockImplementation(async (id, b) => ({ ...donki, id, ...b }) as Expense);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('LogSpendSheet', () => {
  it('logs yen as ringgit with the original amount and rate, paid by me, and says Masuk', async () => {
    const { onOpenChange } = setup();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '3200' } });
    fireEvent.click(screen.getByRole('radio', { name: 'JPY, Japanese Yen' }));
    expect(await screen.findByText('≈ RM 98.73', { exact: false })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Food' }));
    fireEvent.change(screen.getByLabelText('What was it'), { target: { value: 'Ramen Ichiran' } });
    expect(screen.getByRole('radio', { name: 'Syaqirah (you)' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Masuk, add to ledger' }));

    await waitFor(() => expect(expenseService.createExpense).toHaveBeenCalledTimes(1));
    expect(expenseService.createExpense).toHaveBeenCalledWith({
      tripId: 2,
      description: 'Ramen Ichiran',
      category: 'food',
      expenseDate: '2026-10-16',
      amount: 98.73,
      currency: 'MYR',
      originalAmount: 3200,
      originalCurrency: 'JPY',
      fxRate: 0.030854674,
      notes: undefined,
      paidBy: 3,
      subItems: undefined,
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(toast).toHaveBeenCalledWith('Masuk. ¥ 3,200 to Food.');
  });

  it('shows what is missing and sends nothing; Enter in the amount submits', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Masuk, add to ledger' }));
    expect(await screen.findByText('Enter how much you paid.')).toBeInTheDocument();
    expect(screen.getByText('Pick a category.')).toBeInTheDocument();
    expect(screen.getByLabelText('Amount')).toHaveAttribute('aria-invalid', 'true');

    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '12.50' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Transport' }));
    fireEvent.submit(screen.getByLabelText('Amount').closest('form')!);
    await waitFor(() => expect(expenseService.createExpense).toHaveBeenCalledTimes(1));
    expect(expenseService.createExpense).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 12.5, currency: 'MYR', originalAmount: 12.5, originalCurrency: 'MYR', description: 'Transport' }),
    );
  });

  it('keeps the sheet open with the server message when saving fails', async () => {
    vi.mocked(expenseService.createExpense).mockRejectedValue(
      Object.assign(new Error('Request failed'), { isAxiosError: true, response: { status: 400, data: { message: 'Paid by must be someone on this trip' } } }),
    );
    const { onOpenChange } = setup();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Food' }));
    fireEvent.click(screen.getByRole('button', { name: 'Masuk, add to ledger' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Paid by must be someone on this trip');
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('edit mode prefills the receipt and PUTs it back unchanged to the sen', async () => {
    const { onOpenChange } = setup(donki);
    expect(screen.getByRole('dialog', { name: 'Edit entry' })).toBeInTheDocument();
    expect(screen.getByLabelText('Amount')).toHaveValue('7,840');
    expect(screen.getByRole('radio', { name: 'Packages' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.change(screen.getByLabelText('What was it'), { target: { value: 'Donki haul' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(expenseService.updateExpense).toHaveBeenCalledTimes(1));
    const [id, body] = vi.mocked(expenseService.updateExpense).mock.calls[0];
    expect(id).toBe(22);
    expect(body).toMatchObject({
      tripId: 2,
      description: 'Donki haul',
      amount: 241.9,
      currency: 'MYR',
      originalAmount: 7840,
      originalCurrency: 'JPY',
      fxRate: 0.03085467,
      category: 'bundle',
      expenseDate: '2026-10-15',
      subItems: [
        { description: 'KitKat matcha, 3 boxes', amount: 74.06, category: 'shopping' },
        { description: 'Sheet masks', amount: 92.57, category: 'shopping' },
        { description: 'Tokyo Banana', amount: 75.27, category: 'food' },
      ],
    });
    // the payer wasn't touched, so it's left out (the server keeps it)
    expect(body.paidBy).toBeUndefined();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(toast).toHaveBeenCalledWith('Saved. ¥ 7,840 in Packages.');
  });

  it('edit mode: removing every receipt line sends subItems: [] and a new payer', async () => {
    setup(donki);
    fireEvent.click(screen.getByRole('button', { name: 'Remove the receipt lines' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Aiman Hakim' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(expenseService.updateExpense).toHaveBeenCalledTimes(1));
    const [, body] = vi.mocked(expenseService.updateExpense).mock.calls[0];
    expect(body).toMatchObject({ amount: 241.9, subItems: [], paidBy: 1 });
  });
});
