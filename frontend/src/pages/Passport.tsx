// Passport /passport (§9.7). Every trip that came home, archived ones included so the history is complete:
// year tabs (?year=2026|all), the S5 Kampung (a house opens its ticket in a sheet, ?trip=<id>), the totals as a
// mono passbook strip in the home currency, one stamp per country, and the trips as ticket stubs, newest first.
import { useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTrips } from '@/hooks/useTrips';
import { useRates } from '@/hooks/useRates';
import { useToday } from '@/hooks/useToday';
import { formatShortDate } from '@/lib/dates';
import { getPhase } from '@/lib/phase';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GhostOutline, LedgerTabs, ledgerPanelId, ledgerTabId } from '@/components/motifs';
import { PassportKampung } from '@/components/passport/PassportKampung';
import { PassportStatsStrip } from '@/components/passport/PassportStatsStrip';
import { StampGrid } from '@/components/passport/StampGrid';
import { TripTimeline } from '@/components/passport/TripTimeline';
import { TripStampSheet } from '@/components/passport/TripStampSheet';
import {
  computePassportStats,
  countryStamps,
  homeTrips,
  mergeTrips,
  nextHomecoming,
  parseYearParam,
  passportYears,
  tripsInYear,
  tripYear,
  visitNumber,
  type PassportYear,
} from '@/components/passport/passportMath';

const TABS_ID = 'passport-year';

function PassportSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6 lg:gap-8">
      <span className="sr-only">Loading your passport</span>
      <Skeleton className="h-11 w-16 [--ledger-row:2.75rem]" />
      <Skeleton className="h-[320px] rounded-lg lg:h-[520px]" />
      <Skeleton className="h-[148px] [--ledger-row:74px] sm:h-[148px] lg:h-[74px]" />
      <div className="grid grid-cols-3 gap-3 lg:grid-cols-6 lg:gap-6">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[104px] w-[104px] max-w-full rounded-lg [--ledger-row:104px]" />
        ))}
      </div>
    </div>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 border-l-[3px] border-stamp bg-stamp-tint px-4 py-4">
      <p className="type-body text-ink">{message}</p>
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export default function Passport() {
  const { user } = useAuth();
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const homeCurrency = (user?.currency || 'MYR').toUpperCase();
  const homeCountry = (user?.country || 'MY').toUpperCase();

  const active = useTrips();
  const archived = useTrips({ archived: true });
  const fx = useRates(homeCurrency);

  const all = useMemo(() => mergeTrips(active.trips, archived.trips), [active.trips, archived.trips]);
  const home = useMemo(() => homeTrips(all, today), [all, today]);
  const years = useMemo(() => passportYears(home), [home]);
  const year = parseYearParam(params.get('year'), years);
  const scoped = useMemo(() => tripsInYear(home, year), [home, year]);
  const stats = useMemo(() => computePassportStats(scoped, homeCurrency, fx.rates, today), [scoped, homeCurrency, fx.rates, today]);
  const stamps = useMemo(() => countryStamps(scoped), [scoped]);

  const openId = Number(params.get('trip'));
  const opened = useMemo(() => home.find((t) => t.id === openId) ?? null, [home, openId]);

  const setYear = useCallback(
    (next: PassportYear) =>
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set('year', String(next));
          p.delete('trip');
          return p;
        },
        { replace: true },
      ),
    [setParams],
  );

  const openTrip = useCallback(
    (id: number) =>
      setParams((prev) => {
        const p = new URLSearchParams(prev);
        p.set('trip', String(id));
        return p;
      }),
    [setParams],
  );

  const closeTrip = useCallback(
    () =>
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.delete('trip');
          return p;
        },
        { replace: true },
      ),
    [setParams],
  );

  const retry = () => {
    void active.refetch();
    void archived.refetch();
  };

  const header = (
    <header>
      <h1 className="type-display-2 text-ink">Passport</h1>
    </header>
  );

  if (active.isLoading || (archived.isLoading && active.trips.length === 0)) {
    return (
      <div className="flex flex-col gap-6 lg:gap-8">
        {header}
        <PassportSkeleton />
      </div>
    );
  }

  if (active.error && all.length === 0) {
    return (
      <div className="flex flex-col gap-6 lg:gap-8">
        {header}
        <LoadError message={active.error} onRetry={retry} />
      </div>
    );
  }

  const archivedNote = archived.error ? (
    <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l-[3px] border-brass bg-sunken px-4 py-2">
      <p className="type-body-s text-ink">Archived trips didn't load, so older stamps may be missing.</p>
      <Button variant="link" size="sm" onClick={() => void archived.refetch()}>
        Try again
      </Button>
    </div>
  ) : null;

  // ── Nothing home yet ─────────────────────────────────────────────────────────────────────────────
  if (home.length === 0) {
    const next = nextHomecoming(all, today);
    return (
      <div className="flex flex-col gap-6 lg:gap-8">
        {header}
        {archivedNote}
        <section className="flex flex-col items-start gap-4 border-y border-rule py-8 lg:flex-row lg:items-center lg:gap-10 lg:py-12">
          <GhostOutline kind="house" height={128} className="shrink-0" />
          <div className="flex max-w-[480px] flex-col items-start gap-3">
            <p className="type-title text-ink">No stamps yet. Your first trip home earns one.</p>
            {next ? (
              <>
                <p className="type-body-s text-ink-2">
                  {next.name} comes home on {formatShortDate(next.endDate)}
                  {getPhase(next, today) === 'onTheRoad' ? '. Enjoy the rest of it.' : '.'}
                </p>
                <Button asChild variant="secondary">
                  <Link to={`/trips/${next.id}`}>Open {next.name}</Link>
                </Button>
              </>
            ) : (
              <>
                <p className="type-body-s text-ink-2">Start a tabung. When you're back, the trip lands here as a house and a stamp.</p>
                <Button asChild>
                  <Link to="/trips/new">Start a tabung</Link>
                </Button>
              </>
            )}
          </div>
        </section>
      </div>
    );
  }

  const tabs = [
    ...years.map((y) => ({ key: String(y), label: String(y), count: home.filter((t) => tripYear(t) === y).length })),
    { key: 'all', label: 'All', count: home.length },
  ];
  const tabKey = String(year);
  const scopeLabel = year === 'all' ? 'every year' : String(year);

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      {header}
      {archivedNote}
      <LedgerTabs
        tabs={tabs}
        value={tabKey}
        onChange={(k) => setYear(k === 'all' ? 'all' : Number(k))}
        ariaLabel="Year"
        idBase={TABS_ID}
      />

      <div
        role="tabpanel"
        id={ledgerPanelId(TABS_ID, tabKey)}
        aria-labelledby={ledgerTabId(TABS_ID, tabKey)}
        className="flex flex-col gap-8 pt-2 lg:gap-12"
      >
        <PassportKampung
          trips={all}
          year={year}
          homeCurrency={homeCurrency}
          rates={fx.rates}
          today={today}
          onOpenTrip={openTrip}
          onSelectYear={setYear}
        />

        <PassportStatsStrip stats={stats} scopeLabel={scopeLabel} ratesLoading={fx.isLoading} />

        <section aria-labelledby="passport-stamps">
          <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-rule pb-2">
            <h2 id="passport-stamps" className="type-title text-ink">
              Stamps
            </h2>
            <p className="type-body-s text-ink-2">One per country, shaped by region</p>
          </div>
          <StampGrid stamps={stamps} />
        </section>

        <section aria-labelledby="passport-trips" className="lg:max-w-[760px]">
          <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-rule pb-2">
            <h2 id="passport-trips" className="type-title text-ink">
              Trips home
            </h2>
            <p className="type-body-s text-ink-2">Newest first</p>
          </div>
          <TripTimeline trips={scoped} homeCountry={homeCountry} today={today} groupByYear={year === 'all'} />
        </section>
      </div>

      <TripStampSheet
        trip={opened}
        homeCountry={homeCountry}
        today={today}
        visit={opened ? visitNumber(opened, home) : 1}
        open={Boolean(opened)}
        onOpenChange={(o) => {
          if (!o) closeTrip();
        }}
      />
    </div>
  );
}
