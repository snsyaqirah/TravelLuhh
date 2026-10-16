import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DRAFT_KEY, EMPTY_DRAFT, type CreateDraft } from './createDraft';

const createTrip = vi.fn();
const addFund = vi.fn();

vi.mock('@/iso/IsoStage', () => ({ IsoStage: () => <div data-testid="stage" /> }));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 3, name: 'Syaqirah', email: 's@example.test', currency: 'MYR', country: 'MY', authProvider: 'local' } }),
}));
vi.mock('@/hooks/useRates', () => ({
  useRates: () => ({ rates: { base: 'MYR', date: '2026-10-15', rates: { MYR: 1, JPY: 38.76 } }, date: '2026-10-15', isLoading: false, error: null, isStale: false, fetchedAt: 0, refetch: () => {} }),
}));
vi.mock('@/hooks/useTrips', () => ({ useTrips: () => ({ createTrip }) }));
vi.mock('@/services/fundService', () => ({ fundService: { add: (...a: unknown[]) => addFund(...a) } }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import TripNew from '@/pages/TripNew';
import { toast } from 'sonner';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/trips/new']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/trips/new" element={<TripNew />} />
          <Route path="/trips/:id" element={<p>trip page</p>} />
          <Route path="/trips" element={<p>trips list</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const ready: CreateDraft = {
  ...EMPTY_DRAFT,
  step: 5,
  destinationCountry: 'JP',
  startDate: '2026-11-12',
  endDate: '2026-11-20',
  name: 'Tokyo 9D8N',
  budgetType: 'shared',
  budget: '4,000',
  saved: '300',
};

const stored = () => JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null') as CreateDraft | null;

beforeEach(() => {
  sessionStorage.clear();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  createTrip.mockReset();
  addFund.mockReset();
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 16, 9, 0));
});
afterEach(() => vi.useRealTimers());

describe('Create flow', () => {
  it('blocks Next until a place is picked, with an inline error on the search field', async () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Where to?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText("Pick where you're going.")).toBeInTheDocument();
    const search = screen.getByLabelText('Search 44 places');
    expect(search).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(search).toHaveFocus());
    // still on step 1
    expect(screen.getByRole('heading', { level: 1, name: 'Where to?' })).toBeInTheDocument();
  });

  it('Enter in the search box takes the top match, then the form moves on and saves the draft', async () => {
    renderPage();
    const search = screen.getByLabelText('Search 44 places');
    fireEvent.change(search, { target: { value: 'jepun' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(await screen.findByText('Japan', { selector: 'p' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'When?' })).toBeInTheDocument();
    expect(stored()).toMatchObject({ step: 2, destinationCountry: 'JP', name: 'Tokyo' });
  });

  it('needs dates and a name on step 2', async () => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...EMPTY_DRAFT, step: 2, destinationCountry: 'JP', name: '' }));
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'When?' })).toBeInTheDocument();
    fireEvent.submit(screen.getByRole('button', { name: 'Next' }).closest('form') as HTMLFormElement);
    expect(await screen.findByText('Pick your first day, then your last day.')).toBeInTheDocument();
    expect(screen.getByText('Give the trip a name.')).toBeInTheDocument();
  });

  it('picks up a stored draft after a refresh, but not past a step that is missing its inputs', () => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...ready, step: 3, budgetType: null }));
    const { unmount } = renderPage();
    expect(screen.getByRole('heading', { level: 1, name: "Who's in?" })).toBeInTheDocument();
    unmount();
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...ready, step: 5, startDate: null }));
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'When?' })).toBeInTheDocument();
  });

  it('opens the tabung, drops in what was already saved, clears the draft and lands on the trip', async () => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(ready));
    createTrip.mockResolvedValue({ id: 7, currency: 'MYR' });
    addFund.mockResolvedValue({ id: 1 });
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Check your ticket' })).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open tabung' }));
    });
    expect(createTrip).toHaveBeenCalledWith({
      name: 'Tokyo 9D8N',
      destinationCountry: 'JP',
      startDate: '2026-11-12',
      endDate: '2026-11-20',
      budget: 4000,
      currency: 'MYR',
      budgetType: 'shared',
      season: 'autumn',
    });
    expect(addFund).toHaveBeenCalledWith(7, { amount: 300, entryDate: '2026-10-16', note: 'Already saved' });
    expect(await screen.findByText('trip page')).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith('Tabung opened. Jom!');
    expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('keeps the draft and says so when the trip does not open', async () => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...ready, saved: '' }));
    createTrip.mockRejectedValue(new Error("Alamak, can't reach the server. Your entries are safe. Try again in a moment."));
    renderPage();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open tabung' }));
    });
    expect(toast.error).toHaveBeenCalled();
    expect(addFund).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Open tabung' })).toBeEnabled();
    expect(stored()).toMatchObject({ step: 5, destinationCountry: 'JP' });
  });
});
