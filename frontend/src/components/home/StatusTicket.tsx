// Home's status ticket (§9.3): the hero TripTicket for the trip that matters today. On the road it leads with
// the daily allowance and the pace line; otherwise the next trip with its split-flap countdown and fields.
// Nothing live → a dashed ghost ticket and "Start a tabung".
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { Trip } from '@/types';
import { computeFund } from '@/hooks/useFund';
import { GhostOutline, TripTicket } from '@/components/motifs';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface StatusTicketProps {
  trip: Trip | null;
  today: Date;
  homeCountry?: string | null;
  /** True when the person has trips, just none coming up. */
  hasPast?: boolean;
  className?: string;
}

export function StatusTicket({ trip, today, homeCountry, hasPast, className }: StatusTicketProps) {
  if (!trip) {
    return (
      <section aria-labelledby="home-status" className={cn('flex flex-col items-start gap-3', className)}>
        <h2 id="home-status" className="type-overline text-ink-2">
          Next up
        </h2>
        <GhostOutline kind="ticket" height={80} />
        <p className="type-body text-ink-2">
          {hasPast ? 'Nothing booked yet. Pick the next place and we\'ll start the tabung.' : 'No trips yet. Pick a place, we\'ll start the tabung.'}
        </p>
        <Button asChild>
          <Link to="/trips/new">
            <Plus aria-hidden="true" />
            Start a tabung
          </Link>
        </Button>
      </section>
    );
  }
  const fund = computeFund(trip, today);
  return (
    <section aria-labelledby="home-status" className={className}>
      <h2 id="home-status" className="type-overline mb-2 text-ink-2">
        {fund.phase === 'onTheRoad' ? 'On the road' : 'Next up'}
      </h2>
      <TripTicket variant="hero" trip={trip} fund={fund} today={today} homeCountry={homeCountry} to={`/trips/${trip.id}`} headingLevel={3} />
    </section>
  );
}
