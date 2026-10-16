// TEMPORARY P2 screenshot harness (deleted after testing): mounts TripEditSheet for a trip id.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/context/AuthContext';
import { useTrip } from '@/hooks/useTrips';
import { TripEditSheet } from '@/components/trips/TripEditSheet';

function H({ id }: { id: number }) {
  const { trip } = useTrip(id);
  const [open, setOpen] = useState(true);
  return trip ? <TripEditSheet trip={trip} open={open} onOpenChange={setOpen} /> : null;
}

export function mount(id: number) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  createRoot(el).render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>
          <H id={id} />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}
