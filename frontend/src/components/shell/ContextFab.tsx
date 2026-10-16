import { lazy, Suspense } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useTrip } from '@/hooks/useTrips';
import { useToday } from '@/hooks/useToday';
import { getPhase } from '@/lib/phase';
import { cn } from '@/lib/utils';
import { tripIdFromPath, withParam } from '@/components/shell/routeMeta';
import { FAB_FACE, FAB_ROOT } from '@/components/trip/fabStyle';

// Radix menu + floating-ui stay out of the entry chunk until an upcoming trip needs the dial.
const FabDial = lazy(() => import('@/components/trip/FabDial'));

/**
 * Centre slot of the BottomBar (§6.3). Inside a trip it logs a spend on that trip (?sheet=log-spend, read by
 * TripDetail); before an upcoming trip it opens a two-item dial, Drop in · Log spend (Phase B travel fund).
 * Everywhere else it starts a new tabung. Viewers can't log spends, so they get "New".
 */
export function ContextFab({ className }: { className?: string }) {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const today = useToday();
  const tripId = tripIdFromPath(pathname);
  const { trip } = useTrip(tripId ?? undefined, { enabled: tripId !== null });
  const canLog = tripId !== null && trip?.myRole !== 'viewer';
  const dial = canLog && trip != null && getPhase(trip, today) === 'upcoming';

  if (dial) {
    const go = (sheet: 'drop-in' | 'log-spend') => navigate({ pathname, search: withParam(search, 'sheet', sheet) });
    return (
      <Suspense
        fallback={
          // Same face while the dial's chunk arrives (a few ms); a tap meanwhile logs a spend.
          <button type="button" aria-label="Add: log a spend" className={cn(FAB_ROOT, className)} onClick={() => go('log-spend')}>
            <span aria-hidden className={FAB_FACE}>
              <Plus className="h-6 w-6" strokeWidth={2} />
            </span>
            <span className="mt-0.5 text-[11px] font-medium leading-[14px] text-ink">Add</span>
          </button>
        }
      >
        <FabDial onPick={go} className={className} />
      </Suspense>
    );
  }

  const to = canLog ? { pathname, search: withParam(search, 'sheet', 'log-spend') } : '/trips/new';
  const label = canLog ? 'Log spend' : 'New';

  return (
    <Link to={to} className={cn(FAB_ROOT, className)}>
      <span aria-hidden className={FAB_FACE}>
        <Plus className="h-6 w-6" strokeWidth={2} />
      </span>
      <span className="mt-0.5 text-[11px] font-medium leading-[14px] text-ink">{label}</span>
    </Link>
  );
}
