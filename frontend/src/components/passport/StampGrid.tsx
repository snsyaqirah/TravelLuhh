// One PassportStamp per country you came home from (§9.7): the outline is the region, the code sits in the
// middle, the month of the first visit runs along the bottom. Three to a row on phones, six on desktop.
// Replaces the old TravelMap.
import { cn } from '@/lib/utils';
import { PassportStamp } from '@/components/motifs';
import { monthYear, type CountryStamp } from '@/components/passport/passportMath';

export interface StampGridProps {
  stamps: CountryStamp[];
  className?: string;
}

export function StampGrid({ stamps, className }: StampGridProps) {
  return (
    <ul className={cn('grid grid-cols-3 gap-x-3 gap-y-6 lg:grid-cols-6 lg:gap-x-6', className)}>
      {stamps.map((s) => {
        const first = monthYear(s.first);
        const last = monthYear(s.last);
        const many = s.visits > 1;
        return (
          <li key={s.code} className="flex min-w-0 flex-col gap-2">
            <div className="flex h-[104px] w-[104px] max-w-full items-center justify-center text-stamp">
              <PassportStamp
                text={s.name.toUpperCase()}
                code={s.code}
                date={first}
                region={s.region}
                seed={s.seedTrip}
                size={96}
                decorative
              />
            </div>
            <div className="min-w-0">
              <p className="type-label truncate text-ink">{s.name}</p>
              <p className="font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.06em] text-ink-3">
                {many ? (
                  <>
                    <span className="block">{s.visits} trips</span>
                    <span className="block">First {first}</span>
                    {last !== first ? <span className="block">Last {last}</span> : null}
                  </>
                ) : (
                  <span className="block">{first}</span>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
