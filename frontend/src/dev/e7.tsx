/* eslint-disable react-refresh/only-export-components -- entry file for a dev-only page */
// Dev-only harness for E7's scenes: http://localhost:<port>/dev/e7.html
//   ?view=plot|shelf|draft|demo|live|perf   (default plot)
//   ?theme=light|dark|both                   (default both)
//   ?render=3d|svg|pair                      (pair = WebGL beside its SVG twin)
//   ?only=key,key                            (fixture keys)
//   ?step=1..5 ?type=solo|shared|separated   (draft)
//   ?tier=lite                               (force the lite tier: 60 coins, no edges)
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { useThree } from '@react-three/fiber';
import '@/index.css';
import type { ThemeName } from '@/design/tokens';
import { computeFund } from '@/hooks/useFund';
import { appEvents } from '@/lib/appEvents';
import { addCalendarDays, parseLocalDate, toISODate } from '@/lib/dates';
import { rng } from '@/iso/seed';
import { IsoStage } from '@/iso/IsoStage';
import { IsoCanvas } from '@/iso/canvas/IsoCanvas';
import { mapShelf, type ShelfSpec, type ShelfTrip } from '@/iso/mappers/shelf';
import {
  DEMO_ACTS,
  mapTripPlot,
  mapTripPlotDemo,
  mapTripPlotDraft,
  useTripPlotDemo,
  type DemoFrame,
  type TripPlotExpense,
  type TripPlotSpec,
  type TripPlotTrip,
} from '@/iso/mappers/tripPlot';
import ShelfScene from '@/iso/scenes/Shelf';
import TripPlotScene from '@/iso/scenes/TripPlot';
import type { SceneSpecBase } from '@/iso/specs';
import type { Rates, BudgetType } from '@/types';

const params = new URLSearchParams(window.location.search);
const VIEW = params.get('view') ?? 'plot';
const THEMES: ThemeName[] = params.get('theme') === 'light' ? ['light'] : params.get('theme') === 'dark' ? ['dark'] : ['light', 'dark'];
const RENDER = (params.get('render') ?? '3d') as '3d' | 'svg' | 'pair';
const ONLY = params.get('only')?.split(',').filter(Boolean) ?? null;
const TIER = params.get('tier') === 'lite' ? 'lite' : undefined;
const DESKTOP = window.innerWidth >= 1024;

// ---------------------------------------------------------------- fixtures

const D = (y: number, m: number, d: number, h = 15) => new Date(y, m - 1, d, h);
const day3 = D(2026, 11, 14);

const tokyo: TripPlotTrip = {
  id: 101,
  name: 'Tokyo autumn',
  destinationCountry: 'JP',
  startDate: '2026-11-12',
  endDate: '2026-11-20',
  budget: 4000,
  currency: 'MYR',
  budgetType: 'solo',
};

const e = (expenseDate: string, amount: number, currency?: string): TripPlotExpense => ({ expenseDate, amount, currency });

const tokyoDays3 = [e('2026-11-12', 480), e('2026-11-12', 240), e('2026-11-13', 520), e('2026-11-13', 234), e('2026-11-14', 186)];
const tokyoAll = [440, 418, 354, 398, 512, 286, 463, 377, 440].map((a, i) => e(toISODate(addCalendarDays(parseLocalDate('2026-11-12'), i)), a));

function sum(xs: readonly TripPlotExpense[]) {
  return xs.reduce((n, x) => n + x.amount, 0);
}

function plot(trip: TripPlotTrip, expenses: TripPlotExpense[], today: Date, extra: Parameters<typeof mapTripPlot>[1] = {}, rates?: Rates | null) {
  const placed = expenses.filter((x) => !x.currency || x.currency === trip.currency);
  const fund = computeFund({ ...trip, totalExpenses: sum(placed) + 0 }, today);
  return mapTripPlot({ trip, expenses, today, fund, homeCountry: 'MY', rates }, extra);
}

function sixtyDays(): TripPlotExpense[] {
  const r = rng('sixty');
  const start = parseLocalDate('2026-10-01');
  return Array.from({ length: 200 }, () => e(toISODate(addCalendarDays(start, r.int(44))), Math.round(r.range(8, 160))));
}

const rates: Rates = { base: 'MYR', date: '2026-10-15', rates: { JPY: 32.41, KRW: 310.5, THB: 7.62, SGD: 0.29, EUR: 0.2, IDR: 3480 } };

const PLOTS: Array<{ key: string; title: string; spec: () => TripPlotSpec }> = [
  { key: 'road', title: 'On the road · day 3/9 · RM 1,660 spent', spec: () => plot(tokyo, tokyoDays3, day3) },
  { key: 'upcoming', title: 'Upcoming · sketch', spec: () => plot(tokyo, [], D(2026, 10, 15)) },
  { key: 'home', title: 'Home · chop · RM 312 baki · BALIK unseen', spec: () => plot(tokyo, tokyoAll, D(2026, 11, 25), { balikSeen: false }) },
  {
    key: 'over',
    title: 'RM 50 budget · 300% over',
    spec: () =>
      plot({ ...tokyo, id: 102, name: 'KL weekend', destinationCountry: 'MY', budget: 50, startDate: '2026-11-13', endDate: '2026-11-15' }, [e('2026-11-13', 120), e('2026-11-14', 80)], day3),
  },
  {
    key: 'nobudget',
    title: 'Budget 0 · on the road',
    spec: () => plot({ ...tokyo, id: 103, name: 'Penang makan', destinationCountry: 'MY', budget: 0 }, tokyoDays3, day3),
  },
  {
    key: 'oneday',
    title: '1-day trip · 1 expense',
    spec: () =>
      plot({ ...tokyo, id: 104, name: 'Melaka day trip', destinationCountry: 'MY', budget: 300, startDate: '2026-11-14', endDate: '2026-11-14' }, [e('2026-11-14', 96)], day3),
  },
  {
    key: 'sixty',
    title: '60 days · 200 expenses · 1 stone = 2 days',
    spec: () =>
      plot({ ...tokyo, id: 105, name: 'Europe long haul', destinationCountry: 'FR', budget: 18000, startDate: '2026-10-01', endDate: '2026-11-29' }, sixtyDays(), day3),
  },
  {
    key: 'big',
    title: 'RM 50,000 · 12 days · 1 expense',
    spec: () =>
      plot(
        { ...tokyo, id: 106, name: 'Antarctica', destinationCountry: 'AQ', budget: 50000, startDate: '2026-11-10', endDate: '2026-11-21' },
        [e('2026-11-10', 12400)],
        day3,
      ),
  },
  {
    key: 'mixed',
    title: 'Legacy JPY row (rate) + KRW row (no rate)',
    spec: () => plot(tokyo, [...tokyoDays3, e('2026-11-13', 3200, 'JPY'), e('2026-11-14', 50000, 'VND')], day3, {}, rates),
  },
  { key: 'selected', title: 'Days tab · 13 Nov selected', spec: () => plot(tokyo, tokyoDays3, day3, { selectedDate: '2026-11-13' }) },
  {
    key: 'shared',
    title: 'Shared pot · 42 days from a Sunday · upcoming',
    spec: () =>
      plot({ ...tokyo, id: 107, name: 'Umrah and Istanbul', destinationCountry: 'SA', budgetType: 'shared', budget: 24000, startDate: '2026-11-01', endDate: '2026-12-12' }, [], D(2026, 10, 15)),
  },
  {
    key: 'longest',
    title: '120 days · 1 stone = 3 days · home over',
    spec: () =>
      plot({ ...tokyo, id: 108, name: 'Gap year', destinationCountry: 'AU', budget: 30000, startDate: '2026-05-01', endDate: '2026-08-28' }, Array.from({ length: 120 }, (_, i) => e(toISODate(addCalendarDays(parseLocalDate('2026-05-01'), i)), 240 + (i % 7) * 20)), D(2026, 10, 15)),
  },
];

const sTrip = (t: Partial<ShelfTrip> & Pick<ShelfTrip, 'id' | 'name'>): ShelfTrip => ({
  destinationCountry: 'JP',
  startDate: '2026-12-01',
  endDate: '2026-12-09',
  budget: 4000,
  currency: 'MYR',
  ...t,
});

const shelfTrips: ShelfTrip[] = [
  sTrip({ id: 1, name: 'Tokyo autumn', startDate: '2026-11-12', endDate: '2026-11-20', totalExpenses: 1660 }),
  sTrip({ id: 2, name: 'Seoul in spring', destinationCountry: 'KR', startDate: '2027-04-02', endDate: '2027-04-08', budget: 2500000, currency: 'KRW', totalExpenses: 0 }),
  sTrip({ id: 3, name: 'Bangkok shopping', destinationCountry: 'TH', startDate: '2026-12-20', endDate: '2026-12-24', budget: 12000, currency: 'THB', totalExpenses: 3500 }),
  sTrip({ id: 4, name: 'Bali with the geng', destinationCountry: 'ID', startDate: '2027-01-10', endDate: '2027-01-15', budget: 2000, totalExpenses: 2240 }),
  sTrip({ id: 5, name: 'Penang makan', destinationCountry: 'MY', startDate: '2026-11-28', endDate: '2026-11-30', budget: 0, totalExpenses: 120 }),
  sTrip({ id: 6, name: 'Singapore F1', destinationCountry: 'SG', startDate: '2027-09-30', endDate: '2027-10-03', budget: 900, currency: 'SGD' }),
  sTrip({ id: 7, name: 'Old Hanoi trip', destinationCountry: 'VN', startDate: '2026-03-01', endDate: '2026-03-07', budget: 2000, totalExpenses: 1500 }),
];

const shelf = (trips: ShelfTrip[], r: Rates | null, layout: 'mobile' | 'desktop' = DESKTOP ? 'desktop' : 'mobile') =>
  mapShelf({ trips, rates: r, homeCurrency: 'MYR', today: day3 }, { layout });

const SHELVES: Array<{ key: string; title: string; spec: () => ShelfSpec }> = [
  { key: 'three', title: 'Three trips · MYR, KRW, THB · to scale', spec: () => shelf(shelfTrips.slice(0, 3), rates) },
  { key: 'fx', title: 'Rates missing · not to scale', spec: () => shelf(shelfTrips.slice(0, 3), null) },
  { key: 'edge', title: 'Over budget + no budget', spec: () => shelf([shelfTrips[3], shelfTrips[4], shelfTrips[0]], rates) },
  { key: 'five', title: 'Six eligible, five shown (desktop cap)', spec: () => shelf(shelfTrips, rates, 'desktop') },
  { key: 'one', title: 'One trip', spec: () => shelf([shelfTrips[0]], rates) },
  { key: 'overlast', title: 'Over budget at the end of the row', spec: () => shelf([shelfTrips[0], shelfTrips[3]], rates) },
  { key: 'empty', title: 'Empty shelf', spec: () => shelf([shelfTrips[6]], rates) },
];

// ---------------------------------------------------------------- layout

function Themed({ theme, children }: { theme: ThemeName; children: ReactNode }) {
  return <div className={theme === 'dark' ? 'dark bg-background text-foreground' : 'bg-background text-foreground'}>{children}</div>;
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-b border-rule px-4 py-4">
      <h2 className="type-overline text-ink-3">{title}</h2>
      {children}
    </section>
  );
}

function Stage({ spec, height, theme, mode, draftStep }: { spec: SceneSpecBase; height: { base: number; lg: number }; theme: ThemeName; mode?: 'live' | 'draft' | 'demo'; draftStep?: number }) {
  if (RENDER === 'pair')
    return (
      <div className="grid grid-cols-2 gap-2">
        <IsoStage spec={spec} height={height} theme={theme} mode={mode} draftStep={draftStep} tier={TIER} footer={null} />
        <IsoStage spec={spec} height={height} theme={theme} mode={mode} draftStep={draftStep} svgOnly footer={null} />
      </div>
    );
  return <IsoStage spec={spec} height={height} theme={theme} mode={mode} draftStep={draftStep} tier={TIER} svgOnly={RENDER === 'svg'} />;
}

function Columns({ children }: { children: (theme: ThemeName) => ReactNode }) {
  return (
    <div className={THEMES.length === 2 ? 'grid grid-cols-1 lg:grid-cols-2' : ''}>
      {THEMES.map((t) => (
        <Themed key={t} theme={t}>
          {children(t)}
        </Themed>
      ))}
    </div>
  );
}

const pick = <T extends { key: string }>(xs: T[]) => (ONLY ? xs.filter((x) => ONLY.includes(x.key)) : xs);

function PlotView() {
  const list = useMemo(() => pick(PLOTS).map((f) => ({ ...f, s: f.spec() })), []);
  return (
    <Columns>
      {(theme) =>
        list.map((f) => (
          <Card key={f.key} title={`${f.key} · ${f.title}`}>
            <Stage spec={f.s} height={{ base: 220, lg: 320 }} theme={theme} mode="live" />
          </Card>
        ))
      }
    </Columns>
  );
}

function ShelfView() {
  const list = useMemo(() => pick(SHELVES).map((f) => ({ ...f, s: f.spec() })), []);
  return (
    <Columns>
      {(theme) =>
        list.map((f) => (
          <Card key={f.key} title={`${f.key} · ${f.title}${f.s.more ? ` · +${f.s.more} more on your shelf` : ''}`}>
            <Stage spec={f.s} height={{ base: 240, lg: 360 }} theme={theme} />
          </Card>
        ))
      }
    </Columns>
  );
}

function DraftView() {
  const fixed = params.get('step');
  const type = (params.get('type') ?? 'solo') as BudgetType;
  const [step, setStep] = useState(Number(fixed ?? 1));
  const draft = { destinationCountry: 'JP', name: 'Tokyo 9D8N', startDate: '2026-11-12', endDate: '2026-11-20', budget: 4000, currency: 'MYR', budgetType: type };
  const spec = useMemo(() => mapTripPlotDraft(draft, step, { homeCountry: 'MY' }), [step, type]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = params.get('all') === '1';
  return (
    <Columns>
      {(theme) => (
        <>
          <Card title={`draft · ${type} · step ${step}`}>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} type="button" className={`border border-rule px-3 py-1 ${s === step ? 'bg-ink text-paper' : ''}`} onClick={() => setStep(s)}>
                  {s}
                </button>
              ))}
            </div>
            <Stage spec={spec} height={{ base: 160, lg: 420 }} theme={theme} mode="draft" draftStep={step} />
          </Card>
          {all
            ? [1, 2, 3, 4, 5].map((s) => (
                <Card key={s} title={`step ${s}`}>
                  <Stage spec={mapTripPlotDraft(draft, s, { homeCountry: 'MY' })} height={{ base: 160, lg: 420 }} theme={theme} mode="draft" draftStep={s} />
                </Card>
              ))
            : null}
        </>
      )}
    </Columns>
  );
}

function DemoView() {
  const demo = useTripPlotDemo();
  const frames = params.get('frames') === '1';
  return (
    <Columns>
      {(theme) => (
        <>
          <Card title={`demo · act ${demo.act} · ${demo.frame} · ${demo.auto ? 'auto' : 'stopped'}`}>
            <Stage spec={demo.spec} height={{ base: 300, lg: 560 }} theme={theme} mode="demo" />
            <div className="flex gap-2">
              {demo.acts.map((a) => (
                <button
                  key={a.act}
                  type="button"
                  aria-pressed={a.act === demo.act}
                  className={`type-ledger border border-rule px-2 py-1 ${a.act === demo.act ? 'bg-ink text-paper' : ''}`}
                  onClick={() => demo.select(a.act)}
                >
                  {a.chip}
                </button>
              ))}
            </div>
            <p className="type-body">{demo.caption}</p>
          </Card>
          {frames
            ? DEMO_ACTS.flatMap((a) => a.frames).map(({ frame }) => (
                <Card key={frame} title={frame}>
                  <Stage spec={mapTripPlotDemo(frame as DemoFrame)} height={{ base: 300, lg: 560 }} theme={theme} mode="demo" />
                </Card>
              ))
            : null}
        </>
      )}
    </Columns>
  );
}

function LiveView() {
  const [expenses, setExpenses] = useState(tokyoDays3);
  const spec = useMemo(() => plot(tokyo, expenses, day3), [expenses]);
  const add = (date: string, amount: number) => {
    const next = [...expenses, e(date, amount)];
    // useExpenses order: the cache updates, then the event fires in the same tick.
    setExpenses(next);
    appEvents.emit({ type: 'coinOut', tripId: tokyo.id, date, category: 'food', amount });
  };
  return (
    <Columns>
      {(theme) => (
        <Card title="live · coinOut">
          <div className="flex gap-2">
            <button type="button" className="border border-rule px-3 py-1" onClick={() => add('2026-11-14', 42)}>
              Masuk RM 42 today
            </button>
            <button type="button" className="border border-rule px-3 py-1" onClick={() => add('2026-11-12', 300)}>
              Masuk RM 300 on day 1
            </button>
            <button type="button" className="border border-rule px-3 py-1" onClick={() => add('2026-11-14', 3000)}>
              Masuk RM 3,000 today
            </button>
          </div>
          <Stage spec={spec} height={{ base: 220, lg: 320 }} theme={theme} mode="live" />
        </Card>
      )}
    </Columns>
  );
}

// ---------------------------------------------------------------- perf (raw canvas, renderer.info)

function Info({ onInfo }: { onInfo: (s: string) => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const t = window.setTimeout(() => {
      const i = gl.info.render;
      onInfo(`${i.calls} calls · ${i.triangles} tris`);
    }, 1200);
    return () => window.clearTimeout(t);
  }, [gl, onInfo]);
  return null;
}

function PerfCell({ title, spec, kind }: { title: string; spec: SceneSpecBase; kind: 'plot' | 'shelf' }) {
  const [info, setInfo] = useState('…');
  return (
    <Card title={`${title} · ${info}`}>
      <div className="relative h-[220px] w-full" data-perf={info}>
        <IsoCanvas bounds={spec.bounds} theme="light" tier="high" dpr={1} reducedMotion>
          <Info onInfo={setInfo} />
          {kind === 'plot' ? (
            <TripPlotScene spec={spec as TripPlotSpec} theme="light" tier="high" reducedMotion />
          ) : (
            <ShelfScene spec={spec as ShelfSpec} theme="light" tier="high" reducedMotion />
          )}
        </IsoCanvas>
      </div>
    </Card>
  );
}

function PerfView() {
  const cells = [
    ...pick(PLOTS).map((f) => ({ key: f.key, spec: f.spec() as SceneSpecBase, kind: 'plot' as const })),
    ...pick(SHELVES).map((f) => ({ key: `shelf-${f.key}`, spec: f.spec() as SceneSpecBase, kind: 'shelf' as const })),
  ].slice(0, 12);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3">
      {cells.map((c) => (
        <PerfCell key={c.key} title={c.key} spec={c.spec} kind={c.kind} />
      ))}
    </div>
  );
}

function App() {
  const body =
    VIEW === 'shelf' ? <ShelfView /> : VIEW === 'draft' ? <DraftView /> : VIEW === 'demo' ? <DemoView /> : VIEW === 'live' ? <LiveView /> : VIEW === 'perf' ? <PerfView /> : <PlotView />;
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="px-4 py-3">
        <p className="type-overline text-ink-3">DEV · E7 SCENES</p>
        <h1 className="type-title">{VIEW}</h1>
      </header>
      {body}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
