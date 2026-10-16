/* eslint-disable react-refresh/only-export-components -- entry file for a dev-only page */
// Dev-only harness for P4 (Ledger tab, Log spend sheet, expense detail) against the real backend, inside the
// real shell. It stands in for TripDetail's wiring so the tab and sheets can be driven before P3 lands.
// Open http://localhost:<port>/dev/p4.html?path=/trips/2/ledger  (log in first: shot.mjs --token …)
//   path=…   route, query string included: /trips/2/ledger?day=2026-10-14&cat=food&sheet=log-spend
//   role=viewer  pretend to be a viewer (no write controls)
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';

import '@/index.css';
import { AppThemeProvider } from '@/components/theme/ThemeProvider';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { AuthProvider } from '@/context/AuthContext';
import { queryClient } from '@/lib/queryClient';
import { Layout } from '@/components/layout/Layout';
import { AppSkeleton } from '@/components/shell/AppSkeleton';
import { useTrip } from '@/hooks/useTrips';
import { useFund } from '@/hooks/useFund';
import { useExpenses } from '@/hooks/useExpenses';
import { useTripSheet } from '@/components/trip/useTripSheet';
import { LedgerTab } from '@/components/trip/tabs/LedgerTab';
import { LogSpendSheet } from '@/components/trip/sheets/LogSpendSheet';
import { ExpenseDetailSheet } from '@/components/trip/sheets/ExpenseDetailSheet';
import { PhaseTag, phaseTagPropsFor } from '@/components/motifs';

const params = new URLSearchParams(window.location.search);
const path = params.get('path') || '/trips/2/ledger';
const forceViewer = params.get('role') === 'viewer';

function HarnessTrip() {
  const { tripId } = useParams();
  const { trip: loaded, isLoading, error } = useTrip(tripId);
  const trip = loaded && forceViewer ? { ...loaded, myRole: 'viewer' as const } : loaded;
  const fund = useFund(trip);
  const sheet = useTripSheet();
  const { expenses } = useExpenses(trip?.id);
  if (isLoading && !trip) return <AppSkeleton />;
  if (!trip || !fund) return <p className="type-body text-stamp">{error ?? 'No trip'}</p>;
  const canEdit = trip.myRole !== 'viewer';
  const editing = sheet.sheet === 'log-spend' && sheet.id ? expenses.find((e) => e.id === sheet.id) : undefined;
  return (
    <div className="flex flex-col gap-6 [--passbook-sticky-top:52px] md:[--passbook-sticky-top:0px]">
      <header className="flex flex-col gap-2">
        <p className="type-overline text-ink-3">P4 harness · stand-in for TripDetail</p>
        <h1 className="type-display-2 text-ink">{trip.name}</h1>
        <PhaseTag {...phaseTagPropsFor(trip)} />
      </header>
      <LedgerTab trip={trip} fund={fund} canEdit={canEdit} />
      <LogSpendSheet trip={trip} open={sheet.sheet === 'log-spend'} onOpenChange={(o) => !o && sheet.close()} expense={editing} />
      <ExpenseDetailSheet
        trip={trip}
        expenseId={sheet.sheet === 'expense' ? sheet.id : null}
        open={sheet.sheet === 'expense'}
        onOpenChange={(o) => !o && sheet.close()}
        onEdit={(e) => sheet.open('log-spend', { id: e.id })}
      />
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
                <Route path="/trips/:tripId/:tab" element={<HarnessTrip />} />
                <Route path="*" element={<p className="type-body">Use ?path=/trips/2/ledger</p>} />
              </Route>
            </Routes>
          </MemoryRouter>
          <Sonner />
        </AuthProvider>
      </MotionConfig>
    </AppThemeProvider>
  </QueryClientProvider>
);
