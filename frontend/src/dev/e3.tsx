/* eslint-disable react-refresh/only-export-components -- entry file for a dev-only page */
// Dev-only harness for the E3 shell: the real Layout (Rail, AppBar, BottomBar, ContextFab) around a stand-in
// page, with a fake signed-in user and seeded trips/rates so it renders without a backend.
// Open http://localhost:<port>/dev/e3.html?path=/trips/2/ledger
//   path=…        route inside the shell (default /home)
//   page=skeleton the route Suspense fallback · page=error the route error state
//   rates=none    drop the THB rate, so the rail's IN TABUNG total must disappear
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';

import '@/index.css';
import type { Rates, Trip, User } from '@/types';
import { AppThemeProvider } from '@/components/theme/ThemeProvider';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { AuthProvider } from '@/context/AuthContext';
import { queryClient, queryKeys } from '@/lib/queryClient';
import { Layout } from '@/components/layout/Layout';
import { AppSkeleton } from '@/components/shell/AppSkeleton';
import { useShellChrome } from '@/components/shell/chrome';

const params = new URLSearchParams(window.location.search);
const path = params.get('path') || '/home';
const pageMode = params.get('page');

const user: User = {
  id: 1,
  name: 'Syaqirah Osman',
  email: 'syaqirah@example.com',
  authProvider: 'local',
  country: 'MY',
  currency: 'MYR',
  onboardingCompleted: true,
};

const base = {
  ownerId: 1,
  description: null,
  image: null,
  isArchived: false,
  createdAt: '2026-09-01T10:00:00',
  updatedAt: '2026-10-01T10:00:00',
  myRole: 'owner' as const,
};
const trips: Trip[] = [
  { ...base, id: 1, name: 'Tokyo autumn', destinationCountry: 'JP', startDate: '2026-11-12', endDate: '2026-11-20', budget: 4000, currency: 'MYR', budgetType: 'solo', totalExpenses: 0 },
  { ...base, id: 2, name: 'Bangkok with the geng, Sukhumvit and the night markets', destinationCountry: 'TH', startDate: '2026-10-12', endDate: '2026-10-18', budget: 20000, currency: 'THB', budgetType: 'shared', totalExpenses: 6500 },
  { ...base, id: 3, name: 'Bali, slow week', destinationCountry: 'ID', startDate: '2026-08-01', endDate: '2026-08-07', budget: 3000, currency: 'MYR', budgetType: 'solo', totalExpenses: 2688 },
];
const rates: Rates = {
  base: 'MYR',
  date: '2026-10-15',
  rates: params.get('rates') === 'none' ? { JPY: 32.4 } : { JPY: 32.4, THB: 7.6, IDR: 3520 },
};

// A fake session, before AuthProvider reads storage. Requests fail fast (no backend), which AuthProvider
// treats as "offline" and keeps the user.
try {
  localStorage.setItem('travelluhh_token', 'harness-access');
  localStorage.setItem('travelluhh_refresh_token', 'harness-refresh');
  localStorage.setItem('travelluhh_user', JSON.stringify(user));
} catch {
  // storage blocked: the shell renders signed out
}
queryClient.setDefaultOptions({ queries: { staleTime: Infinity, retry: false, refetchOnWindowFocus: false } });
queryClient.setQueryData(queryKeys.me, user);
queryClient.setQueryData(queryKeys.trips(false), trips);
for (const t of trips) queryClient.setQueryData(queryKeys.trip(t.id), t);
queryClient.setQueryData(queryKeys.rates('MYR'), rates);

function Boom(): never {
  throw new Error('Harness: forced render error');
}

function StandInPage() {
  const { pathname, search } = useLocation();
  const sheetOpen = new URLSearchParams(search).has('sheet');
  useShellChrome({ hideBottomBar: params.get('hideBar') === '1' ? true : undefined });

  if (pageMode === 'skeleton') return <AppSkeleton />;
  if (pageMode === 'error') return <Boom />;

  return (
    <div className="flex flex-col gap-8 lg:gap-12">
      <header className="flex flex-col gap-2">
        <p className="type-overline text-ink-3">Thu 15 Oct 2026 · {pathname}</p>
        <h1 className="type-display-2 text-ink">
          Petang, <em>Syaqirah</em>.
        </h1>
        <p className="type-body text-ink-2">
          Stand-in page content. {sheetOpen ? 'A sheet is open (?sheet), so the bottom bar steps aside.' : ''}
        </p>
      </header>
      <section className="grid gap-6 lg:grid-cols-12">
        <div className="h-[220px] rounded-lg border border-rule bg-card lg:col-span-7 lg:h-[320px]" />
        <div className="flex flex-col gap-2 rounded-lg border border-rule bg-card p-4 lg:col-span-5 lg:p-5">
          <p className="type-overline text-ink-3">Left in jar</p>
          <p className="type-money-l text-fund">RM 2,340.50</p>
          <p className="type-body-s text-ink-2">≈ RM 312 a day for the next 6 days.</p>
        </div>
      </section>
      <section className="rounded-lg border border-rule bg-card">
        {['Ramen Ichiran', 'Suica top-up', 'Don Quijote', 'Teh tarik', 'Hotel Gracery', 'Airport limousine bus'].map(
          (row, i) => (
            <div
              key={row}
              className="flex h-12 items-center justify-between border-b border-rule px-4 last:border-b-0 odd:bg-stripe"
            >
              <span className="type-body-s text-ink">{row}</span>
              <span className="type-ledger text-ink">{`−¥ ${(1200 + i * 830).toLocaleString('en-MY')}`}</span>
            </div>
          )
        )}
      </section>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <AppThemeProvider>
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              <Route element={<Layout />}>
                <Route path="*" element={<StandInPage />} />
              </Route>
            </Routes>
          </MemoryRouter>
          <Sonner />
        </AuthProvider>
      </MotionConfig>
    </AppThemeProvider>
  </QueryClientProvider>
);
