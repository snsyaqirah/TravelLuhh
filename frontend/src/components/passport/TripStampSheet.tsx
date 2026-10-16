// What a house in the Kampung opens (§8 S5 target): the trip's ticket (review variant, which carries its
// BALIK stamp), when it came home, whether it was the first trip to that country, and a way into the trip.
// Bottom sheet on phones, right drawer from 768px. Lives in the URL (?trip=<id>) so Back closes it.
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { Trip } from '@/types';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { TripTicket } from '@/components/motifs';
import { useMediaQuery } from '@/components/shell/useMediaQuery';
import { getCountryByCode } from '@/data/countries';
import { formatShortDate, isValidDate, parseLocalDate } from '@/lib/dates';
import { cn } from '@/lib/utils';

export interface TripStampSheetProps {
  trip: Trip | null;
  homeCountry?: string | null;
  today: Date;
  /** 1 for the first trip home to this country, 2 for the second… */
  visit: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth'];

/** 'Your first trip to Thailand.' A trip in your own country is 'around' it, not 'to' it. */
function visitLine(visit: number, country: string, domestic: boolean): string {
  const where = `${domestic ? 'around' : 'to'} ${country}`;
  const word = ORDINAL[Math.max(visit, 1) - 1];
  return word ? `Your ${word} trip ${where}.` : `Trip ${visit} ${where}.`;
}

function homeDate(iso: string): string {
  const d = parseLocalDate(iso);
  return isValidDate(d) ? `${formatShortDate(d)} ${d.getFullYear()}` : '';
}

export function TripStampSheet({ trip, homeCountry, today, visit, open, onOpenChange }: TripStampSheetProps) {
  const wide = useMediaQuery('(min-width: 768px)');
  const country = trip ? (getCountryByCode(trip.destinationCountry)?.name ?? trip.destinationCountry) : '';
  const domestic = Boolean(trip && homeCountry && trip.destinationCountry.toUpperCase() === homeCountry.toUpperCase());

  return (
    <Sheet open={open && Boolean(trip)} onOpenChange={onOpenChange}>
      <SheetContent
        side={wide ? 'right' : 'bottom'}
        className={cn('flex flex-col gap-5', wide ? 'w-full sm:max-w-[460px]' : 'max-h-[88dvh] overflow-y-auto')}
      >
        {trip ? (
          <>
            <SheetHeader>
              <p className="type-overline text-ink-2">Stamped {homeDate(trip.endDate)}</p>
              {/* The ticket below prints the name large; the title is for screen readers. */}
              <SheetTitle className="sr-only">{trip.name}</SheetTitle>
              <SheetDescription>{visitLine(visit, country, domestic)}</SheetDescription>
            </SheetHeader>

            {/* Room above for the BALIK stamp, which sits over the ticket's top edge. */}
            <div className="pt-4">
              <TripTicket variant="review" trip={trip} homeCountry={homeCountry} today={today} headingLevel={2} />
            </div>

            <Button asChild className="w-full sm:w-auto sm:self-start">
              <Link to={`/trips/${trip.id}/fund`}>
                Open {trip.name}
                <ChevronRight aria-hidden="true" />
              </Link>
            </Button>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
