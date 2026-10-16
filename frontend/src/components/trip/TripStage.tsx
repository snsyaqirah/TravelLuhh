// The trip page's one scene slot (§9.6). The spec follows the tab: fund → S3 Counter, pack → S4 Suitcase,
// everything else → S2 TripPlot (live). One IsoStage, so switching tabs keeps the same canvas. Targets carry
// router hrefs (stone → ledger?day=, block → ledger?cat=), which IsoStage renders as Links.
import { useMemo, type ReactNode } from 'react';
import type { Expense, PackingItem, Rates, Trip } from '@/types';
import type { FundState } from '@/hooks/useFund';
import { IsoStage } from '@/iso/IsoStage';
import type { Vec3 } from '@/iso/specs';
import { mapCounter } from '@/iso/mappers/counter';
import { mapSuitcase } from '@/iso/mappers/suitcase';
import { mapTripPlot, useBalikMoment } from '@/iso/mappers/tripPlot';
import { PassportStamp, SceneSummary, regionOf } from '@/components/motifs';
import { useMediaQuery } from '@/components/shell/useMediaQuery';
import { formatDayMonth } from '@/lib/dates';
import type { TripTab } from '@/components/trip/tripTabs';

export interface TripStageProps {
  trip: Trip;
  tab: TripTab;
  fund: FundState;
  expenses: readonly Expense[];
  byCategory: Partial<Record<string, number>>;
  packingItems: readonly PackingItem[];
  homeCountry?: string | null;
  today: Date;
  /** ?day= on the plot tabs: that day's stone gets the brass loop. */
  selectedDay: string | null;
  rates?: Rates | null;
}

const HEIGHT = { base: 220, lg: 320 };
const PHONE_QUERY = '(max-width: 767px)';

/** A DOM stamp pinned to a world point of the scene (the overlay layer doesn't take pointer events). */
function PinnedStamp({ at, project, children }: { at: Vec3; project: (p: Vec3) => [number, number]; children: ReactNode }) {
  const [x, y] = project(at);
  return (
    <div className="absolute" style={{ left: x, top: y, transform: 'translate(-50%, -30%)' }}>
      {children}
    </div>
  );
}

export function TripStage({
  trip,
  tab,
  fund,
  expenses,
  byCategory,
  packingItems,
  homeCountry,
  today,
  selectedDay,
  rates,
}: TripStageProps) {
  const compact = useMediaQuery(PHONE_QUERY);
  const scene = tab === 'fund' ? 'counter' : tab === 'pack' ? 'suitcase' : 'tripPlot';

  // BALIK is earned by a trip that came home within its budget; it plays once (localStorage), then sits still.
  const balikEligible = fund.phase === 'home' && fund.hasBudget && fund.over === 0;
  const playBalik = useBalikMoment(trip.id, balikEligible);

  const counter = useMemo(
    () => (scene === 'counter' ? mapCounter({ tripId: trip.id, fund, byCategory }, { compact }) : null),
    [scene, trip.id, fund, byCategory, compact]
  );
  const suitcase = useMemo(
    () => (scene === 'suitcase' ? mapSuitcase({ tripId: trip.id, items: packingItems }, { compact, stampLabel: false }) : null),
    [scene, trip.id, packingItems, compact]
  );
  const plot = useMemo(() => {
    if (scene !== 'tripPlot') return null;
    const spec = mapTripPlot(
      { trip, expenses, homeCountry, today, fund, rates },
      // The DOM stamp replaces the scene's BALIK label only when it is earned; otherwise the label stays.
      { selectedDate: selectedDay, balikSeen: !playBalik, stampLabel: !balikEligible }
    );
    // The stamp carries the code and the date, so the route label under the post would only collide with it.
    return balikEligible && spec.stamp ? { ...spec, labels: spec.labels.filter((l) => l.id !== 'sign') } : spec;
  },
    [scene, trip, expenses, homeCountry, today, fund, rates, selectedDay, playBalik, balikEligible]
  );

  const spec = counter ?? suitcase ?? plot;

  if (!spec) return null;

  const region = regionOf(trip.destinationCountry);
  const overlay =
    suitcase?.stamp && suitcase.done
      ? (project: (p: Vec3) => [number, number]) => (
          <PinnedStamp at={suitcase.stamp!.at} project={project}>
            <PassportStamp text="SIAP" sub="All packed" region={region} tone="fund" seed={`siap-${trip.id}`} size={64} decorative />
          </PinnedStamp>
        )
      : plot?.stamp && balikEligible
        ? (project: (p: Vec3) => [number, number]) => (
            <PinnedStamp at={plot.stamp!.at} project={project}>
              <PassportStamp
                text="BALIK"
                code={trip.destinationCountry.toUpperCase()}
                date={formatDayMonth(trip.endDate)}
                region={region}
                tone="stamp"
                seed={`balik-${trip.id}`}
                size={compact ? 64 : 96}
                animate={plot.stamp!.play}
                decorative
              />
            </PinnedStamp>
          )
        : undefined;

  return (
    <IsoStage
      spec={spec}
      height={HEIGHT}
      mode={scene === 'tripPlot' ? 'live' : undefined}
      overlay={overlay}
      footer={<SceneSummary spec={spec} />}
    />
  );
}
