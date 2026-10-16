// S5 Kampung on the Passport (§8, §9.7): one house per trip home in the selected year (or every year), a road
// between years and a jar at the end of each year holding its baki. A house opens that trip's ticket; a year
// jar (All tab) switches to that year. The visible SceneSummary sits under the slot.
import { useCallback, useMemo } from 'react';
import type { Rates } from '@/types';
import { IsoStage } from '@/iso/IsoStage';
import { mapKampung, type KampungTrip } from '@/iso/mappers/kampung';
import type { SceneTarget } from '@/iso/specs';
import { SceneSummary } from '@/components/motifs';
import { useMediaQuery } from '@/components/shell/useMediaQuery';
import type { PassportYear } from '@/components/passport/passportMath';

export interface PassportKampungProps {
  /** Every trip, any phase: first visits are judged across all of them. */
  trips: ReadonlyArray<KampungTrip>;
  year: PassportYear;
  homeCurrency: string;
  rates: Rates | null;
  today: Date;
  onOpenTrip: (tripId: number) => void;
  onSelectYear: (year: number) => void;
  className?: string;
}

function payloadNumber(payload: unknown, key: 'tripId' | 'year'): number | null {
  if (!payload || typeof payload !== 'object') return null;
  const v = Number((payload as Record<string, unknown>)[key]);
  return Number.isFinite(v) ? v : null;
}

export function PassportKampung({ trips, year, homeCurrency, rates, today, onOpenTrip, onSelectYear, className }: PassportKampungProps) {
  const wide = useMediaQuery('(min-width: 768px)');
  const spec = useMemo(
    () => mapKampung({ trips, year, homeCurrency, rates, today }, { compact: !wide }),
    [trips, year, homeCurrency, rates, today, wide],
  );

  const onTarget = useCallback(
    (t: SceneTarget) => {
      if (t.action?.type === 'openTrip') {
        const id = payloadNumber(t.action.payload, 'tripId');
        if (id != null) onOpenTrip(id);
      } else if (t.action?.type === 'selectYear') {
        const y = payloadNumber(t.action.payload, 'year');
        if (y != null) onSelectYear(y);
      }
    },
    [onOpenTrip, onSelectYear],
  );

  return (
    <section aria-label="Your kampung" className={className}>
      <IsoStage spec={spec} height={{ base: 320, lg: 520 }} onTarget={onTarget} footer={<SceneSummary spec={spec} className="mt-2" />} />
    </section>
  );
}
