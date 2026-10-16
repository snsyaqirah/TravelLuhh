// Home (§9.3). Phones, top to bottom: date and greeting, the S1 Shelf, the status ticket, In tabung, Latest
// entries, Rates, the passport strip. Desktop: Shelf (cols 1–8) beside the ticket and In tabung (9–12); Latest
// entries (1–7) beside Rates (8–12); the passport strip across. First run (no trips at all) swaps the money
// sections for a three-step "how a tabung works" list and one button.
import { useMemo } from 'react';
import type { Trip } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useTrips } from '@/hooks/useTrips';
import { useRates } from '@/hooks/useRates';
import { useToday } from '@/hooks/useToday';
import { formatOverlineDate, greeting } from '@/lib/dates';
import { getPhase } from '@/lib/phase';
import { AppSkeleton } from '@/components/shell/AppSkeleton';
import { useMediaQuery, DESKTOP_QUERY } from '@/components/shell/useMediaQuery';
import { Button } from '@/components/ui/button';
import { HomeShelf } from '@/components/home/HomeShelf';
import { StatusTicket } from '@/components/home/StatusTicket';
import { InTabungPanel } from '@/components/home/InTabungPanel';
import { LatestEntries } from '@/components/home/LatestEntries';
import { RatesPanel } from '@/components/home/RatesPanel';
import { PassportStrip } from '@/components/home/PassportStrip';
import { FirstRun } from '@/components/home/FirstRun';
import { liveTripsOf, passportStats, statusTrip } from '@/components/home/homeMath';

/** On the road first, then the soonest upcoming: the shelf's order. */
function shelfOrder(trips: readonly Trip[], today: Date): Trip[] {
  return liveTripsOf(trips, today).sort((a, b) => {
    const ra = getPhase(a, today) === 'onTheRoad' ? 0 : 1;
    const rb = getPhase(b, today) === 'onTheRoad' ? 0 : 1;
    return ra - rb || a.startDate.localeCompare(b.startDate) || a.id - b.id;
  });
}

export default function Home() {
  const { user } = useAuth();
  const today = useToday();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const home = (user?.currency || 'MYR').toUpperCase();
  const homeCountry = (user?.country || 'MY').toUpperCase();
  const firstName = (user?.name ?? '').trim().split(/\s+/)[0];

  const active = useTrips();
  const archived = useTrips({ archived: true });
  const fx = useRates(home);

  const live = useMemo(() => shelfOrder(active.trips, today), [active.trips, today]);
  const status = useMemo(() => statusTrip(active.trips, today), [active.trips, today]);
  const passport = useMemo(
    () => passportStats([...active.trips, ...archived.trips], today, home, fx.rates),
    [active.trips, archived.trips, today, home, fx.rates],
  );

  const header = (
    <header>
      <p className="type-overline text-ink-2">{formatOverlineDate(today)}</p>
      <h1 className="type-display-3 mt-1 text-ink">
        {greeting(new Date())}
        {firstName ? `, ${firstName}` : ''}.
      </h1>
    </header>
  );

  if (active.isLoading) return <AppSkeleton />;

  if (active.error && active.trips.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        {header}
        <div role="alert" className="flex flex-col items-start gap-3 border-l-[3px] border-stamp bg-stamp-tint px-4 py-4">
          <p className="type-body text-ink">{active.error}</p>
          <Button variant="secondary" onClick={() => void active.refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const firstRun = active.trips.length === 0 && !archived.isLoading && archived.trips.length === 0;

  if (firstRun) {
    return (
      <div className="flex flex-col gap-8 lg:gap-12">
        {header}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-12 lg:gap-x-6 lg:gap-y-12">
          <HomeShelf className="lg:col-span-7" trips={[]} rates={fx.rates} home={home} today={today} />
          <FirstRun className="lg:col-span-5" />
          <RatesPanel className="lg:col-span-5 lg:col-start-8" home={home} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 lg:gap-12">
      {header}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-12 lg:gap-x-6 lg:gap-y-12">
        <HomeShelf className="lg:col-span-12 xl:col-span-8" trips={live} rates={fx.rates} home={home} today={today} />
        <div className="flex min-w-0 flex-col gap-8 lg:col-span-12 lg:grid lg:grid-cols-2 lg:gap-6 xl:col-span-4 xl:flex xl:flex-col xl:gap-8">
          <StatusTicket trip={status} today={today} homeCountry={homeCountry} hasPast={active.trips.length > 0} />
          <InTabungPanel trips={active.trips} today={today} home={home} rates={fx.rates} ratesLoading={fx.isLoading} />
        </div>
        <LatestEntries className="lg:col-span-7" trips={live} limit={desktop ? 6 : 4} />
        <RatesPanel className="lg:col-span-5" home={home} />
        <PassportStrip className="lg:col-span-12" stats={passport} />
      </div>
    </div>
  );
}
