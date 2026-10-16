// Lifetime baki on the Me page (§8, §9.8): a 64px flat balang filled to Σ baki ÷ Σ target across every trip
// that came home (home currency), beside "≈ RM 1,240 baki, all time". Links to the Passport. When a rate is
// missing the amount is listed per currency rather than summed.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { Rates, Trip } from '@/types';
import { MiniBalangSvg } from '@/components/motifs';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { computePassportStats, homeTrips, lifetimeFill } from '@/components/passport/passportMath';

export interface LifetimeBakiProps {
  trips: ReadonlyArray<Trip>;
  homeCurrency: string;
  rates: Rates | null;
  today: Date;
  className?: string;
}

export function LifetimeBaki({ trips, homeCurrency, rates, today, className }: LifetimeBakiProps) {
  const { stats, fill } = useMemo(() => {
    const home = homeTrips(trips, today);
    return { stats: computePassportStats(home, homeCurrency, rates, today), fill: lifetimeFill(home, homeCurrency, rates, today) };
  }, [trips, homeCurrency, rates, today]);

  const none = stats.trips === 0;
  const baki = stats.baki;
  const amount = none
    ? null
    : baki.total != null
      ? formatMoney(baki.total, stats.home, { approx: baki.approx, decimals: 'none' })
      : baki.byCurrency.map((p) => formatMoney(p.amount, p.currency, { decimals: 'none' })).join(' + ');

  return (
    <Link
      to="/passport"
      className={cn(
        'group -mx-1 flex items-center gap-4 rounded-lg px-1 py-2 transition-colors duration-micro hover:bg-accent',
        className,
      )}
    >
      <MiniBalangSvg fill={none ? 0 : fill} phase="home" width={50} height={64} className="h-16 w-[50px] shrink-0" />
      <span className="min-w-0 flex-1">
        {amount ? (
          <span className="block">
            <span className="type-money-l text-ink">{amount}</span>
            <span className="type-body-s text-ink-2"> baki, all time</span>
          </span>
        ) : (
          <span className="type-body block text-ink">No baki yet.</span>
        )}
        <span className="type-body-s block text-ink-2">
          {none
            ? 'It collects here as your trips come home.'
            : `Left over from ${stats.trips} ${stats.trips === 1 ? 'trip' : 'trips'} home. See your passport.`}
          {!none && baki.total == null ? ' Some rates are missing, so it is listed per currency.' : ''}
        </span>
      </span>
      <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-ink-3 group-hover:text-ink" strokeWidth={1.75} />
    </Link>
  );
}
