/* eslint-disable react-refresh/only-export-components -- entry file for a dev-only page */
// Dev-only harness for E8's scenes: Counter (Fund), Suitcase (Pack), Kampung (Passport).
// Open http://localhost:<port>/dev/e8.html
//   ?scene=counter|suitcase|kampung   which scene (default counter)
//   &view=compare|stage                compare: WebGL next to its SVG twin with draw-call stats; stage: real IsoStage
//   &theme=dark                        dark palette
//   &fx=<fixture id>                   one fixture only
//   &compact=1                         plan labels for the mobile slot (also picked automatically under 768px)
//   &svg=1                             stage view: force the SVG twin
import { StrictMode, useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { useFrame } from '@react-three/fiber';
import '@/index.css';
import { tokens, type ThemeName } from '@/design/tokens';
import { computeFund } from '@/hooks/useFund';
import { appEvents } from '@/lib/appEvents';
import { cn } from '@/lib/utils';
import type { PackingItem, Rates } from '@/types';
import { IsoCanvas } from '@/iso/canvas/IsoCanvas';
import { useElementSize, useReducedMotion } from '@/iso/hooks';
import { IsoStage } from '@/iso/IsoStage';
import { computeView } from '@/iso/projection';
import { SceneLabels } from '@/iso/SceneLabels';
import type { SceneSpecBase } from '@/iso/specs';
import { IsoSvgFrame } from '@/iso/svg/IsoSvg';
import type { IsoSceneProps, IsoSvgTwinProps, IsoTier, StageFit } from '@/iso/types';
import CounterScene from '@/iso/scenes/Counter';
import SuitcaseScene from '@/iso/scenes/Suitcase';
import KampungScene from '@/iso/scenes/Kampung';
import { CounterSvg } from '@/iso/svg/CounterSvg';
import { ClosedSuitcaseSvg, SuitcaseSvg } from '@/iso/svg/SuitcaseSvg';
import { KampungSvg } from '@/iso/svg/KampungSvg';
import { mapCounter, type CounterSpec } from '@/iso/mappers/counter';
import { mapSuitcase, type SuitcaseSpec } from '@/iso/mappers/suitcase';
import { mapKampung, type KampungSpec, type KampungTrip } from '@/iso/mappers/kampung';

type SceneName = 'counter' | 'suitcase' | 'kampung';

const params = new URLSearchParams(window.location.search);
const SCENE = (params.get('scene') as SceneName) || 'counter';
const VIEW = params.get('view') === 'stage' ? 'stage' : 'compare';
const THEME: ThemeName = params.get('theme') === 'dark' ? 'dark' : 'light';
const ONLY = params.get('fx');
const COMPACT = params.get('compact') === '1' || window.innerWidth < 768;
const SVG_ONLY = params.get('svg') === '1';
const TIER: IsoTier = params.get('tier') === 'lite' ? 'lite' : 'high';

// ------------------------------------------------------------------------------------------------- fixtures

const TODAY = new Date(2026, 10, 14); // Day 3 of Tokyo autumn

function counterFx(o: { budget: number; spend: Partial<Record<string, number>>; currency?: string; start?: string; end?: string }) {
  const spent = Object.values(o.spend).reduce<number>((s, v) => s + (v ?? 0), 0);
  const fund = computeFund(
    { budget: o.budget, currency: o.currency ?? 'MYR', startDate: o.start ?? '2026-11-12', endDate: o.end ?? '2026-11-20', totalExpenses: spent },
    TODAY,
  );
  return { tripId: 1, fund, byCategory: o.spend };
}

const COUNTER_FIXTURES: Record<string, ReturnType<typeof counterFx>> = {
  tokyo: counterFx({ budget: 4000, spend: { accommodation: 720, transportation: 410, food: 330, other: 200 } }),
  seven: counterFx({
    budget: 50000,
    spend: { accommodation: 9800, transportation: 7400, activities: 3100, bundle: 5200, food: 6100, shopping: 2400, other: 900 },
  }),
  small: counterFx({ budget: 50, spend: { food: 12.5 } }),
  nobudget: counterFx({ budget: 0, spend: { accommodation: 300, food: 150, shopping: 90 } }),
  empty: counterFx({ budget: 4000, spend: {}, start: '2026-12-01', end: '2026-12-09' }),
  over300: counterFx({ budget: 50, spend: { food: 150, transportation: 30 } }),
  overmix: counterFx({ budget: 3000, spend: { accommodation: 1600, transportation: 900, food: 700, shopping: 340 }, start: '2026-08-01', end: '2026-08-09' }),
  yen: counterFx({ budget: 120000, currency: 'JPY', spend: { food: 32000, transportation: 18400, activities: 9000 } }),
  // under one coin layer: the twin scatters loose coins like the WebGL pile instead of a solid disc
  lowjar: counterFx({ budget: 4000, spend: { accommodation: 2000, food: 1880 } }),
  onecoin: counterFx({ budget: 4000, spend: { accommodation: 2000, food: 1968 } }),
};

const PACK_CATS = ['documents', 'clothing', 'personal', 'health', 'electronics', 'gear', 'work', 'food', 'religious', 'general'];
const packItems = (n: number, packed: number, cats = PACK_CATS): PackingItem[] =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    tripId: 1,
    label: `Item ${i + 1}`,
    category: cats[(i * 7) % cats.length],
    isChecked: i < packed,
    createdAt: '',
    updatedAt: '',
  }));

const SUITCASE_FIXTURES: Record<string, PackingItem[]> = {
  progress: packItems(31, 23),
  start: packItems(31, 3),
  half: packItems(20, 10),
  empty: [],
  none: packItems(9, 0),
  done: packItems(18, 18),
  many: packItems(200, 120),
};

let tid = 100;
const kTrip = (name: string, cc: string, start: string, end: string, budget: number, spent: number, currency = 'MYR'): KampungTrip => ({
  id: tid++,
  name,
  destinationCountry: cc,
  startDate: start,
  endDate: end,
  budget,
  currency,
  totalExpenses: spent,
});

const K_TRIPS: KampungTrip[] = [
  kTrip('Hatyai weekend', 'TH', '2024-02-09', '2024-02-11', 800, 640),
  kTrip('Bali', 'ID', '2024-07-01', '2024-07-06', 3000, 3350),
  kTrip('Singapore', 'SG', '2025-01-24', '2025-01-26', 400, 380, 'SGD'),
  kTrip('Seoul spring', 'KR', '2025-04-02', '2025-04-10', 4500, 4100),
  kTrip('Melaka', 'MY', '2025-06-14', '2025-06-15', 300, 180),
  kTrip('Tokyo autumn', 'JP', '2026-01-12', '2026-01-20', 128000, 112000, 'JPY'),
  kTrip('Bangkok', 'TH', '2026-03-05', '2026-03-08', 1500, 1720),
  kTrip('Perth', 'AU', '2026-05-01', '2026-05-14', 7000, 5200),
  kTrip('Langkawi', 'MY', '2026-06-20', '2026-06-22', 900, 610),
  kTrip('Osaka', 'JP', '2026-08-03', '2026-08-09', 4000, 3500),
  kTrip('Hanoi', 'VN', '2026-09-01', '2026-09-05', 20000000, 15000000, 'VND'),
];
const RATES: Rates = { base: 'MYR', date: '2026-11-14', rates: { JPY: 32.4, THB: 7.6, SGD: 0.29, KRW: 296, IDR: 3500, AUD: 0.33, VND: 5600 } };
const K_TODAY = new Date(2026, 9, 15);

const KAMPUNG_FIXTURES: Record<string, Parameters<typeof mapKampung>[0]> = {
  year2026: { trips: K_TRIPS, year: 2026, homeCurrency: 'MYR', rates: RATES, today: K_TODAY },
  year2025: { trips: K_TRIPS, year: 2025, homeCurrency: 'MYR', rates: RATES, today: K_TODAY },
  all: { trips: K_TRIPS, year: 'all', homeCurrency: 'MYR', rates: RATES, today: K_TODAY },
  nofx: { trips: K_TRIPS, year: 2026, homeCurrency: 'MYR', rates: null, today: K_TODAY },
  one: { trips: K_TRIPS.slice(0, 1), year: 2024, homeCurrency: 'MYR', rates: RATES, today: K_TODAY },
  empty: { trips: [], year: 'all', homeCurrency: 'MYR', rates: RATES, today: K_TODAY },
};

// ------------------------------------------------------------------------------------------------- panels

interface Entry<S extends SceneSpecBase> {
  id: string;
  spec: S;
}

const SLOT = COMPACT ? { w: 343, h: 220 } : { w: 640, h: 320 };
const KAMPUNG_SLOT = COMPACT ? { w: 343, h: 320 } : { w: 960, h: 520 };

function Stats({ onStats }: { onStats: (calls: number, tris: number, frames: number) => void }) {
  const frames = useRef(0);
  useFrame(({ gl }) => {
    frames.current += 1;
    const n = frames.current;
    // gl.info resets at the start of each render; read it once this frame has been drawn.
    requestAnimationFrame(() => onStats(gl.info.render.calls, gl.info.render.triangles, n));
  });
  return null;
}

function Panel3D<S extends SceneSpecBase>({
  spec,
  Scene,
  fit,
  size,
}: {
  spec: S;
  Scene: ComponentType<IsoSceneProps<S>>;
  fit: StageFit;
  size: { w: number; h: number };
}) {
  const statsRef = useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();
  const onStats = useCallback(
    (calls: number, tris: number, frames: number) => {
      if (statsRef.current) statsRef.current.textContent = `calls ${calls} · tris ${tris} · frames ${frames}`;
      if (frames === 1) console.info(`[e8] ${spec.kind} calls=${calls} tris=${tris}`);
    },
    [spec.kind],
  );
  const view = computeView(spec.bounds, size.w, size.h, { fit });
  return (
    <figure className="flex flex-col gap-1">
      <div className="relative overflow-hidden rounded-sm border border-rule" style={{ width: size.w, height: size.h, background: tokens[THEME].paper }}>
        <IsoCanvas bounds={spec.bounds} fit={fit} theme={THEME} tier={TIER} dpr={[1, 2]} reducedMotion={reducedMotion}>
          <Stats onStats={onStats} />
          <Scene spec={spec} theme={THEME} tier={TIER} reducedMotion={reducedMotion} />
        </IsoCanvas>
        <SceneLabels labels={spec.labels} view={view} size={size} />
      </div>
      <figcaption className="type-overline text-ink-3">
        WebGL · <span ref={statsRef} />
      </figcaption>
    </figure>
  );
}

function PanelSvg<S extends SceneSpecBase>({
  spec,
  Svg,
  fit,
  size,
}: {
  spec: S;
  Svg: ComponentType<IsoSvgTwinProps<S>>;
  fit: StageFit;
  size: { w: number; h: number };
}) {
  const view = computeView(spec.bounds, size.w, size.h, { fit });
  return (
    <figure className="flex flex-col gap-1">
      <div className="relative overflow-hidden rounded-sm border border-rule" style={{ width: size.w, height: size.h, background: tokens[THEME].paper }}>
        <IsoSvgFrame bounds={spec.bounds} theme={THEME} view={view} size={size}>
          <Svg spec={spec} theme={THEME} />
        </IsoSvgFrame>
        <SceneLabels labels={spec.labels} view={view} size={size} />
      </div>
      <figcaption className="type-overline text-ink-3">SVG twin</figcaption>
    </figure>
  );
}

function Row({ title, children, summary, chip }: { title: string; children: ReactNode; summary: string; chip?: string }) {
  return (
    <section className="flex flex-col gap-2 border-t border-rule pt-3">
      <h2 className="type-overline text-ink-2">{title}</h2>
      <div className="flex flex-wrap gap-4">{children}</div>
      <p className="type-body-s max-w-[640px] text-ink-2">
        {summary}
        {chip ? <span className="type-ledger ml-2 rounded-sm border border-brass-ink px-1.5 text-[12px]">{chip}</span> : null}
      </p>
    </section>
  );
}

function Compare<S extends SceneSpecBase>({
  entries,
  Scene,
  Svg,
  fit,
  size,
}: {
  entries: Entry<S>[];
  Scene: ComponentType<IsoSceneProps<S>>;
  Svg: ComponentType<IsoSvgTwinProps<S>>;
  fit: StageFit;
  size: { w: number; h: number };
}) {
  return (
    <>
      {entries.map((e) => (
        <Row key={e.id} title={e.id} summary={e.spec.summary} chip={e.spec.unitChip}>
          <Panel3D spec={e.spec} Scene={Scene} fit={fit} size={size} />
          <PanelSvg spec={e.spec} Svg={Svg} fit={fit} size={size} />
        </Row>
      ))}
    </>
  );
}

function Stages({ entries, height }: { entries: Entry<SceneSpecBase>[]; height: { base: number; lg: number } }) {
  return (
    <>
      {entries.map((e) => (
        <section key={e.id} className="flex flex-col gap-2 border-t border-rule pt-3">
          <h2 className="type-overline text-ink-2">{e.id}</h2>
          <IsoStage spec={e.spec} height={height} theme={THEME} svgOnly={SVG_ONLY} onTarget={(t) => console.info('[e8] target', t)} />
        </section>
      ))}
    </>
  );
}

// ------------------------------------------------------------------------------------------------- live demos

function LiveCounter() {
  const [spend, setSpend] = useState<Record<string, number>>({ accommodation: 720, transportation: 410, food: 330 });
  const spec = useMemo(() => mapCounter(counterFx({ budget: 4000, spend }), { compact: COMPACT }), [spend]);
  const log = (category: 'food' | 'shopping' | 'activities', amount: number) => {
    setSpend((s) => ({ ...s, [category]: (s[category] ?? 0) + amount }));
    appEvents.emit({ type: 'coinOut', tripId: 1, date: '2026-11-14', category, amount });
  };
  return (
    <section className="flex flex-col gap-2 border-t border-rule pt-3">
      <h2 className="type-overline text-ink-2">live: coinOut</h2>
      <div className="flex gap-2">
        <DevButton onClick={() => log('food', 120)}>Log RM 120 Food</DevButton>
        <DevButton onClick={() => log('shopping', 260)}>Log RM 260 Shopping</DevButton>
        <DevButton onClick={() => log('activities', 900)}>Log RM 900 Activities</DevButton>
      </div>
      <IsoStage spec={spec} height={{ base: 220, lg: 320 }} theme={THEME} />
    </section>
  );
}

function LiveSuitcase() {
  const [items, setItems] = useState(() => packItems(14, 6));
  const spec = useMemo(() => mapSuitcase({ tripId: 1, items }, { compact: COMPACT }), [items]);
  const toggle = (want: boolean) => {
    const it = want ? items.find((i) => !i.isChecked) : [...items].reverse().find((i) => i.isChecked);
    if (!it) return;
    appEvents.emit({ type: 'packToggled', tripId: 1, itemId: it.id, checked: want });
    setItems((list) => list.map((i) => (i.id === it.id ? { ...i, isChecked: want } : i)));
  };
  return (
    <section className="flex flex-col gap-2 border-t border-rule pt-3">
      <h2 className="type-overline text-ink-2">live: packToggled</h2>
      <div className="flex gap-2">
        <DevButton onClick={() => toggle(true)}>Pack next</DevButton>
        <DevButton onClick={() => toggle(false)}>Unpack last</DevButton>
      </div>
      <IsoStage spec={spec} height={{ base: 220, lg: 320 }} theme={THEME} />
    </section>
  );
}

function DevButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="type-label h-9 rounded-sm border border-rule bg-leaf px-3 text-ink">
      {children}
    </button>
  );
}

// ------------------------------------------------------------------------------------------------- page

function pick<T>(all: Record<string, T>): Array<[string, T]> {
  return Object.entries(all).filter(([id]) => !ONLY || id === ONLY);
}

function App() {
  const wrap = useRef<HTMLDivElement>(null);
  const size = useElementSize(wrap);
  useEffect(() => {
    document.title = `E8 · ${SCENE}`;
  }, []);
  const opts = { compact: COMPACT };
  let body: ReactNode = null;
  if (SCENE === 'counter') {
    const entries = pick(COUNTER_FIXTURES).map(([id, i]) => ({ id, spec: mapCounter(i, opts) }));
    body =
      VIEW === 'compare' ? (
        <Compare<CounterSpec> entries={entries} Scene={CounterScene} Svg={CounterSvg} fit="contain" size={SLOT} />
      ) : (
        <>
          <Stages entries={entries} height={{ base: 220, lg: 320 }} />
          {!ONLY ? <LiveCounter /> : null}
        </>
      );
  } else if (SCENE === 'suitcase') {
    const entries = pick(SUITCASE_FIXTURES).map(([id, items]) => ({ id, spec: mapSuitcase({ tripId: 1, items }, opts) }));
    body =
      VIEW === 'compare' ? (
        <>
          <Compare<SuitcaseSpec> entries={entries} Scene={SuitcaseScene} Svg={SuitcaseSvg} fit="contain" size={SLOT} />
          <Row title="auth: ClosedSuitcaseSvg" summary="Static, no WebGL.">
            <div className="flex flex-wrap items-end gap-6 rounded-sm border border-rule p-4" style={{ background: tokens[THEME].paper }}>
              <ClosedSuitcaseSvg theme={THEME} width={200} />
              <ClosedSuitcaseSvg theme={THEME} width={120} tag="KUL" />
              <ClosedSuitcaseSvg theme={THEME} width={64} />
            </div>
          </Row>
        </>
      ) : (
        <>
          <Stages entries={entries} height={{ base: 220, lg: 320 }} />
          {!ONLY ? <LiveSuitcase /> : null}
        </>
      );
  } else {
    const entries = pick(KAMPUNG_FIXTURES).map(([id, i]) => ({ id, spec: mapKampung(i, opts) }));
    body =
      VIEW === 'compare' ? (
        <Compare<KampungSpec> entries={entries} Scene={KampungScene} Svg={KampungSvg} fit="height" size={KAMPUNG_SLOT} />
      ) : (
        <Stages entries={entries} height={{ base: 320, lg: 520 }} />
      );
  }
  return (
    <main ref={wrap} className={cn('flex min-h-screen flex-col gap-4 bg-background p-4 text-ink')}>
      <header className="flex flex-col gap-1">
        <h1 className="type-title">E8 · {SCENE} · {VIEW}</h1>
        <p className="type-overline text-ink-3">
          {THEME} · {COMPACT ? 'compact' : 'wide'} · {TIER} · width {Math.round(size?.w ?? 0)}
        </p>
      </header>
      {body}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
