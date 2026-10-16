// S1 Shelf on Home (§8): a jar per live trip (on the road first, then soonest), 3 on phones and 5 on desktop,
// each jar linking to its trip. More than fit → "+2 more on your shelf". The visible SceneSummary sits under it
// (it carries the empty-shelf line too; the status ticket below has the "Start a tabung" button).
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Rates, Trip } from '@/types';
import { IsoStage } from '@/iso/IsoStage';
import { mapShelf } from '@/iso/mappers/shelf';
import { SceneSummary } from '@/components/motifs';
import { useMediaQuery, DESKTOP_QUERY } from '@/components/shell/useMediaQuery';

export interface HomeShelfProps {
  trips: readonly Trip[];
  rates: Rates | null;
  home: string;
  today: Date;
  className?: string;
}

export function HomeShelf({ trips, rates, home, today, className }: HomeShelfProps) {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const spec = useMemo(
    () => mapShelf({ trips, rates, homeCurrency: home, today }, { layout: desktop ? 'desktop' : 'mobile' }),
    [trips, rates, home, today, desktop],
  );
  return (
    <section aria-label="Your shelf" className={className}>
      <IsoStage spec={spec} height={{ base: 240, lg: 360 }} maxLabels={desktop ? 5 : 4} footer={<SceneSummary spec={spec} className="mt-2" />} />
      {spec.more > 0 ? (
        <Link
          to="/trips"
          className="type-body-s mt-1 inline-flex min-h-11 items-center text-ink underline decoration-rule-strong underline-offset-[3px] hover:decoration-ink"
        >
          +{spec.more} more on your shelf
        </Link>
      ) : null}
    </section>
  );
}
