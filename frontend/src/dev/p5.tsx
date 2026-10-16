/* eslint-disable react-refresh/only-export-components -- entry file for a dev-only page */
// Dev-only harness for P5: the Days, Pack and Notes tabs and the Logbook sheet inside the real shell, against
// the running backend (sign in first; shot.mjs injects the tokens). Open
//   http://localhost:<port>/dev/p5.html?path=/trips/2/days
//   path=/trips/:id/days|pack|notes   tab to show (add &day=2026-10-14, &sheet=logbook)
//   role=viewer                        force canEdit=false (no demo user is a viewer)
import { useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Outlet, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { History } from 'lucide-react';

import '@/index.css';
import { AppThemeProvider } from '@/components/theme/ThemeProvider';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { AuthProvider } from '@/context/AuthContext';
import { queryClient } from '@/lib/queryClient';
import { Layout } from '@/components/layout/Layout';
import { AppSkeleton } from '@/components/shell/AppSkeleton';
import { LedgerTabs } from '@/components/motifs';
import { useTrip } from '@/hooks/useTrips';
import { useTripSheet } from '@/components/trip/useTripSheet';
import { DaysTab } from '@/components/trip/tabs/DaysTab';
import { PackTab } from '@/components/trip/tabs/PackTab';
import { NotesTab } from '@/components/trip/tabs/NotesTab';
import { LogbookSheet } from '@/components/trip/sheets/LogbookSheet';

const params = new URLSearchParams(window.location.search);
const path = params.get('path') || '/trips/2/days';
const forceViewer = params.get('role') === 'viewer';

const TABS = [
  { key: 'days', label: 'Days' },
  { key: 'pack', label: 'Pack' },
  { key: 'notes', label: 'Notes' },
];

function HarnessTrip() {
  const { tripId, tab = 'days' } = useParams();
  const [search, setSearch] = useSearchParams();
  const { trip, isLoading, error } = useTrip(tripId);
  const sheet = useTripSheet();
  const selectedDay = search.get('day');
  const onSelectDay = useCallback(
    (iso: string) =>
      setSearch(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set('day', iso);
          return p;
        },
        { replace: true }
      ),
    [setSearch]
  );

  if (isLoading) return <AppSkeleton />;
  if (!trip) return <p className="type-body text-stamp">{error ?? 'Trip not found'}</p>;
  const canEdit = !forceViewer && trip.myRole !== 'viewer';

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="type-overline text-ink-2">P5 harness · {forceViewer ? 'viewer' : trip.myRole}</p>
          <h1 className="type-display-2 text-ink">{trip.name}</h1>
        </div>
        <Button variant="ghost" size="icon" aria-label="Logbook" onClick={() => sheet.open('logbook')}>
          <History aria-hidden="true" />
        </Button>
      </header>
      <HarnessTabs tab={tab} />
      <div>
        {tab === 'days' ? <DaysTab trip={trip} canEdit={canEdit} selectedDay={selectedDay} onSelectDay={onSelectDay} /> : null}
        {tab === 'pack' ? <PackTab trip={trip} canEdit={canEdit} /> : null}
        {tab === 'notes' ? <NotesTab trip={trip} canEdit={canEdit} /> : null}
        {!['days', 'pack', 'notes'].includes(tab) ? <p className="type-body text-ink-2">({tab} tab belongs to another page)</p> : null}
      </div>
      <LogbookSheet tripId={trip.id} open={sheet.sheet === 'logbook'} onOpenChange={(o) => (o ? sheet.open('logbook') : sheet.close())} />
    </div>
  );
}

function HarnessTabs({ tab }: { tab: string }) {
  const { tripId } = useParams();
  const navigate = useNavigate();
  return <LedgerTabs tabs={TABS} value={tab} ariaLabel="Trip sections" onChange={(k) => navigate(`/trips/${tripId}/${k}`)} />;
}

function Root() {
  return (
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={params.get('shell') === '0' ? <Outlet /> : <Layout />}>
          <Route path="/trips/:tripId/:tab" element={<HarnessTrip />} />
          <Route path="*" element={<p className="type-body">Unknown harness path</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <AppThemeProvider>
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <Root />
          <Sonner />
        </AuthProvider>
      </MotionConfig>
    </AppThemeProvider>
  </QueryClientProvider>
);
