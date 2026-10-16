// Trips home as ticket stubs, newest first (§9.7). Each stub is a link to the trip: the homecoming date and
// country on the stub, a perforation, then the name, the route and dates, and what came back (baki) or how
// far over it went. With every year showing, a mono year line starts each year.
import { Fragment, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRange, isValidDate, parseLocalDate } from '@/lib/dates';
import { durationLabel, tripDays } from '@/lib/phase';
import { computeFund } from '@/hooks/useFund';
import { sentenceMoney } from '@/lib/fundCopy';
import { routeLabel } from '@/components/motifs';
import { CountryChip } from '@/components/glyphs/CountryChip';
import { tripYear, type PassportTrip } from '@/components/passport/passportMath';

export interface TripTimelineProps {
  trips: ReadonlyArray<PassportTrip & { name: string }>;
  homeCountry?: string | null;
  today: Date;
  /** Show a year line before each year's first stub (the All tab). */
  groupByYear?: boolean;
  className?: string;
}

// Notches top and bottom at the perforation (same mask idea as TripTicket): two half-height layers, one bite each.
const NOTCHES: CSSProperties = {
  WebkitMask:
    'radial-gradient(circle 6px at var(--stub) 0, transparent 5.5px, black 6px) top / 100% 51% no-repeat, radial-gradient(circle 6px at var(--stub) 100%, transparent 5.5px, black 6px) bottom / 100% 51% no-repeat',
  mask: 'radial-gradient(circle 6px at var(--stub) 0, transparent 5.5px, black 6px) top / 100% 51% no-repeat, radial-gradient(circle 6px at var(--stub) 100%, transparent 5.5px, black 6px) bottom / 100% 51% no-repeat',
};

const PERFORATION: CSSProperties = {
  backgroundImage: 'linear-gradient(to bottom, hsl(var(--rule-strong)) 50%, transparent 50%)',
  backgroundSize: '1.5px 8px',
};

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function Outcome({ trip, today }: { trip: PassportTrip; today: Date }) {
  const f = computeFund(trip, today);
  if (!f.hasBudget) {
    return <span className="text-ink-2">No budget set · spent {sentenceMoney(f.spent, f.currency)}</span>;
  }
  if (f.over > 0) {
    return <span className="text-stamp">Over by {sentenceMoney(f.over, f.currency)}</span>;
  }
  return (
    <span className="text-fund">
      {sentenceMoney(f.inJar, f.currency)} baki
      <span className="text-ink-3"> · of {sentenceMoney(f.target, f.currency)}</span>
    </span>
  );
}

function Stub({ trip, homeCountry, today }: { trip: TripTimelineProps['trips'][number]; homeCountry?: string | null; today: Date }) {
  const end = parseLocalDate(trip.endDate);
  const ok = isValidDate(end);
  const days = tripDays(trip);
  return (
    <Link
      to={`/trips/${trip.id}`}
      className="group relative block rounded-lg outline-none [--stub:72px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:[--stub:88px]"
    >
      <div
        className="relative flex min-h-[96px] items-stretch rounded-lg border border-rule bg-card transition-colors duration-micro group-hover:border-rule-strong"
        style={NOTCHES}
      >
        <div className="flex w-[var(--stub)] shrink-0 flex-col items-center justify-center gap-1 py-3">
          <span className="type-overline text-ink-3">{ok ? MONTHS[end.getMonth()] : ''}</span>
          <span className="font-display text-[28px] font-medium leading-none text-ink">{ok ? end.getDate() : ''}</span>
          <CountryChip code={trip.destinationCountry} size="sm" className="mt-1" />
        </div>
        <span aria-hidden="true" className="absolute bottom-3 left-[var(--stub)] top-3 w-[1.5px]" style={PERFORATION} />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-3 pl-4 pr-2">
          <h3 className="truncate font-display text-[19px] font-medium leading-6 text-ink">{trip.name}</h3>
          <p className="type-overline truncate text-ink-2">
            {routeLabel(trip.destinationCountry, homeCountry)} · {formatRange(trip.startDate, trip.endDate)} · {durationLabel(days)}
          </p>
          <p className="type-ledger text-[13px] leading-5">
            <Outcome trip={trip} today={today} />
          </p>
        </div>
        <span className="flex w-10 shrink-0 items-center justify-center text-ink-3 group-hover:text-ink">
          <ChevronRight aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
        </span>
      </div>
    </Link>
  );
}

export function TripTimeline({ trips, homeCountry, today, groupByYear, className }: TripTimelineProps) {
  let lastYear = 0;
  return (
    <ol className={cn('flex flex-col gap-3', className)}>
      {trips.map((t) => {
        const y = tripYear(t);
        const head = groupByYear && y !== lastYear;
        lastYear = y;
        return (
          <Fragment key={t.id}>
            {head ? (
              <li className="type-overline flex items-center gap-3 pt-2 text-ink-3 first:pt-0">
                {y}
                <span aria-hidden="true" className="h-px flex-1 bg-rule" />
              </li>
            ) : null}
            <li>
              <Stub trip={t} homeCountry={homeCountry} today={today} />
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
