import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Suspense } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/context/AuthContext';
import { AppRoutes } from '@/App';
import { toISODate, addCalendarDays } from '@/lib/dates';

// Pages are stand-ins: these tests are about which page a URL reaches, not what the page draws.
// The first render of each route lazy-loads the real shell (Layout, Rail, AppBar…). On a busy machine that
// transform alone can pass vitest's 5s default, so this file gets more room; the assertions are unchanged.
vi.setConfig({ testTimeout: 20_000 });

vi.mock('@/pages/Landing', () => ({ default: () => 'page:landing' }));
vi.mock('@/pages/Login', () => ({ default: () => 'page:login' }));
vi.mock('@/pages/Register', () => ({ default: () => 'page:register' }));
vi.mock('@/pages/ForgotPassword', () => ({ default: () => 'page:forgot' }));
vi.mock('@/pages/OAuthCallback', () => ({ default: () => 'page:oauth' }));
vi.mock('@/pages/Home', () => ({ default: () => 'page:home' }));
vi.mock('@/pages/Trips', () => ({ default: () => 'page:trips' }));
vi.mock('@/pages/TripNew', () => ({ default: () => 'page:trip-new' }));
vi.mock('@/pages/TripDetail', () => ({ default: () => 'page:trip-detail' }));
vi.mock('@/pages/Passport', () => ({ default: () => 'page:passport' }));
vi.mock('@/pages/Me', () => ({ default: () => 'page:me' }));
vi.mock('@/pages/NotFound', () => ({ default: () => 'page:not-found' }));
vi.mock('@/pages/dev/IsoKit', () => ({ default: () => 'page:iso-kit' }));
vi.mock('@/iso/gate', () => ({ get3DGate: () => ({ ok: false, reason: 'no-webgl' }) }));

const user = {
  id: 1,
  name: 'Syaqirah',
  email: 'syaqirah@example.com',
  authProvider: 'local',
  currency: 'MYR',
  onboardingCompleted: true,
};

vi.mock('@/services/userService', () => ({
  userService: { getMe: vi.fn(async () => user) },
}));

const today = new Date();
const day = (offset: number) => toISODate(addCalendarDays(today, offset));
// id 1 upcoming, 2 on the road, 3 back home, 4 on the road but read-only
const trips: Record<number, { start: number; end: number; role?: string }> = {
  1: { start: 20, end: 28 },
  2: { start: -2, end: 4 },
  3: { start: -40, end: -30 },
  4: { start: -1, end: 2, role: 'viewer' },
};

vi.mock('@/services/tripService', () => ({
  tripService: {
    getAllTrips: vi.fn(async () => []),
    getTripById: vi.fn(async (id: number) => {
      const t = trips[id];
      if (!t) throw Object.assign(new Error('Not found'), { response: { status: 404 } });
      return {
        id,
        name: id === 2 ? 'Tokyo autumn' : `Trip ${id}`,
        destinationCountry: 'JP',
        startDate: day(t.start),
        endDate: day(t.end),
        budget: 4000,
        currency: 'MYR',
        budgetType: 'solo',
        isArchived: false,
        myRole: t.role ?? 'owner',
      };
    }),
  },
}));

function LocationProbe() {
  const { pathname, search } = useLocation();
  return <output data-testid="loc">{pathname + search}</output>;
}

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Suspense fallback="loading">
            <AppRoutes />
          </Suspense>
          <LocationProbe />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const loc = () => screen.getByTestId('loc').textContent;

function signIn() {
  localStorage.setItem('travelluhh_token', 'test-access');
  localStorage.setItem('travelluhh_refresh_token', 'test-refresh');
  localStorage.setItem('travelluhh_user', JSON.stringify(user));
}

beforeAll(() => {
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('signed out', () => {
  it('sends protected pages to login with the way back in ?next', async () => {
    renderAt('/trips/5/ledger?cat=food');
    await screen.findByText('page:login');
    expect(loc()).toBe(`/login?next=${encodeURIComponent('/trips/5/ledger?cat=food')}`);
  });

  it('keeps the public pages public', async () => {
    renderAt('/');
    expect(await screen.findByText('page:landing')).toBeInTheDocument();
    cleanup();
    renderAt('/auth/callback?token=a&refresh=b');
    expect(await screen.findByText('page:oauth')).toBeInTheDocument();
  });

  it('serves the dev-only iso kit outside the shell (vitest runs as DEV)', async () => {
    renderAt('/dev/iso-kit');
    expect(await screen.findByText('page:iso-kit')).toBeInTheDocument();
  });

  it('shows the 404 page for unknown paths', async () => {
    renderAt('/nowhere');
    expect(await screen.findByText('page:not-found')).toBeInTheDocument();
  });
});

describe('signed in', () => {
  beforeEach(signIn);

  it.each([
    ['/dashboard', '/home', 'page:home'],
    ['/portfolio?year=2025', '/passport?year=2025', 'page:passport'],
    ['/profile', '/me', 'page:me'],
  ])('redirects the old path %s to %s', async (from, to, page) => {
    renderAt(from);
    await screen.findByText(page);
    expect(loc()).toBe(to);
  });

  it.each([
    ['1', '/trips/1/days'],
    ['2', '/trips/2/ledger'],
    ['3', '/trips/3/fund'],
  ])('opens trip %s on the tab for its phase', async (id, to) => {
    renderAt(`/trips/${id}`);
    await waitFor(() => expect(loc()).toBe(to));
    expect(await screen.findByText('page:trip-detail')).toBeInTheDocument();
  });

  it('opens edit as a sheet over the default tab', async () => {
    renderAt('/trips/1/edit');
    await waitFor(() => expect(loc()).toBe('/trips/1/days?sheet=edit'));
  });

  it('sends an unknown tab to fund and keeps the query', async () => {
    renderAt('/trips/2/expenses?cat=food');
    await waitFor(() => expect(loc()).toBe('/trips/2/fund?cat=food'));
  });

  it('lets TripDetail handle a trip that does not exist', async () => {
    renderAt('/trips/99');
    await waitFor(() => expect(loc()).toBe('/trips/99/fund'));
  });

  it('reaches the create flow without the bottom bar', async () => {
    renderAt('/trips/new');
    await screen.findByText('page:trip-new');
    expect(screen.queryByRole('link', { name: 'New' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to Trips' })).toHaveAttribute('href', '/trips');
  });
});

describe('shell chrome', () => {
  beforeEach(signIn);

  it('inside a trip: trip name in the app bar, the FAB logs a spend on this trip', async () => {
    renderAt('/trips/2/ledger?day=2026-10-14');
    await screen.findByText('page:trip-detail');
    expect(await screen.findByText('Tokyo autumn')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log spend' })).toHaveAttribute(
      'href',
      '/trips/2/ledger?day=2026-10-14&sheet=log-spend'
    );
  });

  it('a viewer cannot log spends, so the FAB starts a new trip instead', async () => {
    renderAt('/trips/4/ledger');
    await screen.findByText('page:trip-detail');
    await waitFor(() => expect(screen.getByRole('link', { name: 'New' })).toHaveAttribute('href', '/trips/new'));
  });

  it('elsewhere the FAB starts a new tabung, and the current tab is marked', async () => {
    renderAt('/trips');
    await screen.findByText('page:trips');
    expect(screen.getByRole('link', { name: 'New' })).toHaveAttribute('href', '/trips/new');
    const current = screen.getAllByRole('link', { current: 'page' }).map((a) => a.getAttribute('href'));
    expect(current).toContain('/trips');
    expect(current).not.toContain('/home');
  });

  it('before an upcoming trip the FAB is a dial: drop in or log a spend', async () => {
    renderAt('/trips/1/days');
    await screen.findByText('page:trip-detail');
    const dial = await screen.findByRole('button', { name: 'Add to this trip: drop in or log a spend' });
    fireEvent.pointerDown(dial, { button: 0, ctrlKey: false, pointerType: 'mouse' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Drop in' }));
    await waitFor(() => expect(loc()).toBe('/trips/1/days?sheet=drop-in'));
  });

  it('hides the bottom bar while a sheet is open', async () => {
    renderAt('/trips/2/ledger?sheet=logbook');
    await screen.findByText('page:trip-detail');
    expect(screen.queryByRole('link', { name: 'Log spend' })).toBeNull();
  });
});
