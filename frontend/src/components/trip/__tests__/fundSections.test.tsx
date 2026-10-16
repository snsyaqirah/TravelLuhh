// Figures (budget vs saving mode), Kongsi (WhatsApp text, settled, separated) and Jars (sum hint, save).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { MemberBudget, Settlement, Trip } from '@/types';
import { computeFund } from '@/hooks/useFund';
import { TripFigures } from '@/components/trip/TripFigures';
import { KongsiSection } from '@/components/settlement/KongsiSection';
import { BudgetAllocationPanel } from '@/components/members/BudgetAllocationPanel';

const state = vi.hoisted(() => ({
  settlement: null as unknown,
  budgets: [] as unknown[],
  saveBudgets: vi.fn(async (rows: unknown) => rows),
}));

vi.mock('@/hooks/useRates', () => ({
  useRates: () => ({ rates: { base: 'MYR', date: '2026-10-15', rates: { JPY: 32.41 } }, date: '2026-10-15', isStale: false, isLoading: false, error: null }),
}));
vi.mock('@/hooks/useSettlement', () => ({
  useSettlement: () => ({ settlement: state.settlement, isLoading: false, error: null, refetch: vi.fn() }),
}));
vi.mock('@/hooks/useBudgets', () => ({
  useBudgets: () => ({
    budgets: state.budgets,
    totalAllocated: (state.budgets as MemberBudget[]).reduce((s, b) => s + b.allocated, 0),
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    saveBudgets: state.saveBudgets,
    isSaving: false,
  }),
}));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 3, name: 'Syaqirah' } }) }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const today = new Date(2026, 9, 16);
const sp = (el: HTMLElement | null) => (el?.textContent ?? '').replace(/\u00a0/g, ' ');

const tokyo = {
  id: 2,
  name: 'Tokyo autumn',
  destinationCountry: 'JP',
  startDate: '2026-10-12',
  endDate: '2026-10-20',
  budget: 4000,
  currency: 'MYR',
  budgetType: 'shared',
  memberCount: 3,
} as Trip;

afterEach(() => {
  cleanup();
  state.settlement = null;
  state.budgets = [];
  state.saveBudgets.mockClear();
});

describe('TripFigures', () => {
  it('budget mode: the jar is the budget minus spend, no saved line', () => {
    const fund = computeFund({ ...tokyo, totalExpenses: 1000, savedAmount: 0 }, today);
    const { container } = render(<TripFigures trip={tokyo} fund={fund} />);
    expect(sp(container)).toContain('RM 3,000');
    expect(sp(container)).not.toContain('Saved RM');
    expect(sp(container)).toContain('1 MYR = 32.41 JPY · 15 Oct');
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '3000');
  });

  it('saving mode: the jar is saved minus spend, plus the saved line', () => {
    const fund = computeFund({ ...tokyo, totalExpenses: 2868.45, savedAmount: 3350 }, today);
    const { container } = render(<TripFigures trip={tokyo} fund={fund} />);
    expect(sp(container)).toContain('RM 481.55');
    expect(sp(container)).toContain('Saved RM 3,350 of RM 4,000 · RM 650 to go');
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '481.55');
  });

  it('over budget: the hero says over, in words as well as colour', () => {
    const fund = computeFund({ ...tokyo, totalExpenses: 4240 }, today);
    const { container } = render(<TripFigures trip={tokyo} fund={fund} />);
    expect(sp(container)).toMatch(/RM 240(\.00)? over/);
    expect(sp(container)).toContain('Over by RM 240.');
  });
});

describe('KongsiSection', () => {
  const shared: Settlement = {
    totalSpent: 2868.45,
    currency: 'MYR',
    perPerson: 956.15,
    balances: [
      { userId: 3, name: 'Syaqirah', paid: 666.46, share: 956.15, net: -289.69 },
      { userId: 1, name: 'Aiman Hakim', paid: 1861.36, share: 956.15, net: 905.21 },
      { userId: 2, name: 'Siti Aisyah', paid: 340.63, share: 956.15, net: -615.52 },
    ],
    transactions: [
      { fromUserId: 2, fromName: 'Siti Aisyah', toUserId: 1, toName: 'Aiman Hakim', amount: 615.52 },
      { fromUserId: 3, fromName: 'Syaqirah', toUserId: 1, toName: 'Aiman Hakim', amount: 289.69 },
    ],
  };

  it('copies the settle-up text for WhatsApp, and plain amounts for bank apps', async () => {
    state.settlement = shared;
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    render(<KongsiSection trip={tokyo} />);

    expect(screen.getByText('Siti → Aiman')).toBeInTheDocument();
    expect(screen.getByText('You → Aiman')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copy for WhatsApp' }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        'Tokyo autumn settle-up\nSiti Aisyah → Aiman Hakim RM 615.52\nSyaqirah → Aiman Hakim RM 289.69'
      )
    );

    fireEvent.click(screen.getByRole('button', { name: /Copy RM\s615\.52/ }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith('615.52'));
  });

  it('all square earns the SETTLED stamp', () => {
    state.settlement = { ...shared, balances: shared.balances.map((b) => ({ ...b, net: 0 })), transactions: [] };
    render(<KongsiSection trip={tokyo} />);
    expect(screen.getByText('All square. Nobody owes anybody.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy for WhatsApp' })).toBeNull();
  });

  it('separated trips owe nobody by design', () => {
    state.settlement = { ...shared, transactions: [] };
    render(<KongsiSection trip={{ ...tokyo, budgetType: 'separated' }} />);
    expect(screen.getByText(/Everyone pays from their own jar/)).toBeInTheDocument();
  });

  it('nothing spent yet', () => {
    state.settlement = { ...shared, totalSpent: 0, transactions: [] };
    render(<KongsiSection trip={tokyo} />);
    expect(screen.getByText(/Nothing to split yet/)).toBeInTheDocument();
  });
});

describe('BudgetAllocationPanel (jars)', () => {
  const penang = { id: 3, name: 'Penang makan trip', budget: 1500, currency: 'MYR' };
  const rows: MemberBudget[] = [
    { userId: 1, name: 'Aiman Hakim', allocated: 550, spent: 229, remaining: 321 },
    { userId: 2, name: 'Siti Aisyah', allocated: 450, spent: 79, remaining: 371 },
    { userId: 3, name: 'Syaqirah', allocated: 0, spent: 79, remaining: -79 },
  ];

  it('shows each jar, and no jar is not "over"', () => {
    state.budgets = rows;
    const { container } = render(<BudgetAllocationPanel trip={penang} canManage={false} phase="upcoming" />);
    expect(sp(container)).toContain('RM 321 left');
    expect(sp(container)).toContain('no jar');
    expect(sp(container)).not.toContain('RM 79 over');
    expect(sp(container)).toContain("RM 500 of the RM 1,500 budget isn't in a jar yet.");
    expect(screen.queryByRole('button', { name: 'Set jars' })).toBeNull();
  });

  it('the owner edits inline; the hint follows the sum; save sends every row', async () => {
    state.budgets = rows;
    const { container } = render(<BudgetAllocationPanel trip={penang} canManage phase="upcoming" />);
    fireEvent.click(screen.getByRole('button', { name: 'Set jars' }));
    fireEvent.change(screen.getByLabelText('Syaqirah'), { target: { value: '600' } });
    expect(sp(container)).toContain('RM 100 more than the RM 1,500 budget.');
    fireEvent.change(screen.getByLabelText('Syaqirah'), { target: { value: '500' } });
    expect(sp(container)).toContain('RM 1,500 in jars, the whole budget.');
    fireEvent.change(screen.getByLabelText('Siti Aisyah'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save jars' }));
    await waitFor(() =>
      expect(state.saveBudgets).toHaveBeenCalledWith([
        { userId: 1, allocated: 550 },
        { userId: 2, allocated: 0 },
        { userId: 3, allocated: 500 },
      ])
    );
  });

  it('rejects an amount it cannot use, naming whose jar', () => {
    state.budgets = rows;
    render(<BudgetAllocationPanel trip={penang} canManage phase="upcoming" />);
    fireEvent.click(screen.getByRole('button', { name: 'Set jars' }));
    fireEvent.change(screen.getByLabelText('Aiman Hakim'), { target: { value: '12.345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save jars' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Aiman Hakim: Use at most 2 decimals.');
    expect(state.saveBudgets).not.toHaveBeenCalled();
  });
});
