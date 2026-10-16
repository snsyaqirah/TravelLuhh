import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Trip } from '@/types';

const updateTrip = vi.fn();
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 3, name: 'Aiman', email: 'a@example.test', currency: 'MYR', country: 'MY', authProvider: 'local' } }),
}));
vi.mock('@/hooks/useRates', () => ({
  useRates: () => ({ rates: null, date: null, isLoading: false, error: null, isStale: false, fetchedAt: 0, refetch: () => {} }),
}));
vi.mock('@/hooks/useTrips', () => ({ useTrips: () => ({ updateTrip }) }));
vi.mock('@/components/shell/useMediaQuery', () => ({ useMediaQuery: () => true }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { TripEditSheet } from '@/components/trips/TripEditSheet';

const v1 = {
  id: 7,
  ownerId: 1,
  name: 'Tokyo autumn',
  destinationCountry: 'JP',
  startDate: '2026-11-12',
  endDate: '2026-11-20',
  budget: 4000,
  currency: 'MYR',
  budgetType: 'shared',
  season: null,
  isArchived: false,
  createdAt: '2026-07-01T00:00:00',
  updatedAt: '2026-07-01T00:00:00',
  totalExpenses: 0,
  savedAmount: 0,
  myRole: 'editor',
} as unknown as Trip;

afterEach(() => {
  cleanup();
  updateTrip.mockReset();
});

describe('TripEditSheet', () => {
  it("sends only what this person changed, even when the live trip moved on while the sheet was open", async () => {
    updateTrip.mockResolvedValue({});
    const onOpenChange = vi.fn();
    const ui = (trip: Trip) => (
      <MemoryRouter>
        <TripEditSheet trip={trip} open onOpenChange={onOpenChange} />
      </MemoryRouter>
    );
    const { rerender } = render(ui(v1));
    fireEvent.change(screen.getByLabelText('Trip name'), { target: { value: 'Tokyo autumn 2026' } });
    // The 25 s live poll brings the owner's change: budget 4,000 → 5,000.
    rerender(ui({ ...v1, budget: 5000, updatedAt: '2026-07-02T00:00:00' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(updateTrip).toHaveBeenCalledTimes(1));
    expect(updateTrip).toHaveBeenCalledWith({ id: 7, name: 'Tokyo autumn 2026' });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
