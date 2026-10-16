/* eslint-disable react-refresh/only-export-components -- entry file for a dev-only page */
// Dev-only harness for the E4 motifs: every motif with real fixtures (Tokyo autumn · 9D8N · RM 4,000; Aiman,
// Siti) in its states. Open http://localhost:<port>/dev/e4.html. `?only=<section id>` renders one section.
import { useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';

import '@/index.css';
import type { Trip } from '@/types';
import { AppThemeProvider, ThemeToggle, useThemeName } from '@/components/theme/ThemeProvider';
import { Button } from '@/components/ui/button';
import { categoryColors, type CategoryKey } from '@/design/tokens';
import { faceTones } from '@/iso/faceTones';
import { CATEGORY_CODES } from '@/lib/categories';
import { computeFund } from '@/hooks/useFund';
import { fundNotice } from '@/lib/fundCopy';
import {
  AirmailStripe,
  CoinRail,
  DeparturesBoard,
  DivergingBar,
  GhostOutline,
  LedgerTabs,
  MiniBalangSvg,
  MoneyFigure,
  NoticeSlip,
  Passbook,
  PassportStamp,
  PhaseTag,
  ReceiptLine,
  ReceiptRule,
  ReceiptSlip,
  SceneSummary,
  SplitFlap,
  TripTicket,
  regionOf,
  useSessionDismissed,
  type PassbookRow,
} from '@/components/motifs';

const params = new URLSearchParams(window.location.search);
const only = params.get('only');

// ── fixtures ────────────────────────────────────────────────────────────────

const D = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 10, 0);
};
const BEFORE = D('2026-10-15'); // 28 days to Tokyo
const DAY3 = D('2026-11-14');
const AFTER = D('2026-11-25');

const base = {
  ownerId: 1,
  isArchived: false,
  createdAt: '2026-09-01T10:00:00',
  updatedAt: '2026-10-01T10:00:00',
};

const tokyo: Trip = {
  ...base,
  id: 1,
  name: 'Tokyo autumn',
  destinationCountry: 'JP',
  startDate: '2026-11-12',
  endDate: '2026-11-20',
  budget: 4000,
  currency: 'MYR',
  budgetType: 'solo',
  totalExpenses: 0,
};
const tokyoRoad: Trip = { ...tokyo, totalExpenses: 1660 };
const tokyoHome: Trip = { ...tokyo, totalExpenses: 3688 };
const bangkok: Trip = {
  ...base,
  id: 2,
  name: 'Bangkok with the geng, Sukhumvit and the night markets',
  destinationCountry: 'TH',
  startDate: '2026-11-10',
  endDate: '2026-11-16',
  budget: 20000,
  currency: 'THB',
  budgetType: 'shared',
  memberCount: 3,
  totalExpenses: 21500,
};
const bali: Trip = {
  ...base,
  id: 3,
  name: 'Bali, slow week',
  destinationCountry: 'ID',
  startDate: '2026-12-01',
  endDate: '2026-12-07',
  budget: 0,
  currency: 'MYR',
  budgetType: 'solo',
  totalExpenses: 0,
};
const seoul: Trip = {
  ...base,
  id: 4,
  name: 'Seoul in spring',
  destinationCountry: 'KR',
  startDate: '2027-04-02',
  endDate: '2027-04-08',
  budget: 6000,
  currency: 'MYR',
  budgetType: 'separated',
  memberCount: 4,
  totalExpenses: 2400,
  savedAmount: 4200,
};

/** Stand-in for E5's IsoGlyph: a category-coloured iso cube with the §7.3 face tones. */
function Glyph({ cat }: { cat: CategoryKey }) {
  const theme = useThemeName();
  const t = faceTones(categoryColors[theme][cat], theme);
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <polygon points="12,3 21,8 12,13 3,8" fill={t.top} />
      <polygon points="3,8 12,13 12,22 3,17" fill={t.left} />
      <polygon points="21,8 12,13 12,22 21,17" fill={t.right} />
    </svg>
  );
}

const ex = (
  id: number,
  date: string,
  label: string,
  cat: CategoryKey,
  out: number,
  extra: Partial<PassbookRow> = {},
): PassbookRow => ({ id, date, label, out, glyph: <Glyph cat={cat} />, sub: CATEGORY_CODES[cat], ...extra });

const tokyoRows: PassbookRow[] = [
  { id: 'fund', date: '2026-09-01', label: 'Fund set', in: 4000, kind: 'system' },
  ex(1, '2026-09-20', 'Flights KUL to HND, return', 'transportation', 1240),
  ex(2, '2026-11-12', 'Hotel Gracery Shinjuku', 'accommodation', 720, {
    isBundle: true,
    children: [
      { id: 'a', label: 'Night 1', amount: 240 },
      { id: 'b', label: 'Night 2', amount: 240 },
      { id: 'c', label: 'Night 3', amount: 240 },
    ],
  }),
  ex(3, '2026-11-12', 'Suica top-up', 'transportation', 89.1, { originalAmount: 3000, originalCurrency: 'JPY' }),
  ex(4, '2026-11-13', 'Ramen Ichiran', 'food', 94.4, { originalAmount: 3200, originalCurrency: 'JPY', payerInitials: 'SA' }),
  ex(5, '2026-11-13', 'teamLab Planets', 'activities', 112.1, { originalAmount: 3800, originalCurrency: 'JPY', payerInitials: 'AH' }),
  ex(6, '2026-11-14', 'Uniqlo Ginza', 'shopping', 186.4),
];

const overRows: PassbookRow[] = [
  { id: 'fund', date: '2026-10-01', label: 'Fund set', in: 20000, kind: 'system' },
  ex(11, '2026-11-10', 'Hotel Sukhumvit 11, 6 nights', 'accommodation', 12600),
  ex(12, '2026-11-11', 'Chatuchak shopping', 'shopping', 5400),
  ex(13, '2026-11-12', 'Muay Thai tickets', 'activities', 3500),
];

const savingRows: PassbookRow[] = [
  { id: 'f1', date: '2026-10-02', label: 'Dropped in · Syaqirah', in: 1500, glyph: <Glyph cat="other" /> },
  { id: 'f2', date: '2026-10-09', label: 'Dropped in · Aiman', in: 1200, glyph: <Glyph cat="other" /> },
  ex(21, '2026-10-12', 'Flights KUL to ICN', 'transportation', 2400),
  { id: 'f3', date: '2026-10-14', label: 'Dropped in · Siti', in: 1500, glyph: <Glyph cat="other" /> },
];

const rates = [
  { code: 'JPY', rate: 32.41, delta7d: 0.004, series: [32.1, 32.2, 32.05, 32.3, 32.28, 32.36, 32.41] },
  { code: 'THB', rate: 7.72, delta7d: -0.0031, series: [7.76, 7.75, 7.74, 7.73, 7.74, 7.71, 7.72] },
  { code: 'SGD', rate: 0.3061, delta7d: 0.0001, series: [0.306, 0.3062, 0.3061, 0.306, 0.3061, 0.3062, 0.3061] },
  { code: 'KRW', rate: 312.4, delta7d: null, series: [] },
];

// ── page ────────────────────────────────────────────────────────────────────

function Section({ id, title, children, wide }: { id: string; title: string; children: ReactNode; wide?: boolean }) {
  if (only && only !== id) return null;
  return (
    <section id={id} className={wide ? 'lg:col-span-2' : undefined}>
      <h2 className="type-overline mb-3 border-b border-rule pb-2 text-ink-2">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="type-overline mb-1.5 text-ink-3">{children}</p>;
}

function FlapDemo() {
  const [n, setN] = useState(28);
  return (
    <div className="flex flex-wrap items-end gap-6">
      <SplitFlap value={n} label="DAYS" />
      <SplitFlap value="482913" size={28} ariaLabel="Code 4 8 2 9 1 3" />
      <Button variant="secondary" size="sm" onClick={() => setN((x) => Math.max(0, x - 1))}>
        One day closer
      </Button>
    </div>
  );
}

function NoticeDemo() {
  const over = fundNotice(computeFund(bangkok, D('2026-11-13')));
  const [gone, dismiss] = useSessionDismissed('e4-demo-over');
  return (
    <>
      {gone ? (
        <p className="type-body-s text-ink-3">Dismissed for this session.</p>
      ) : (
        <NoticeSlip
          level="over"
          onDismiss={dismiss}
          action={
            <a href="#ledger" className="underline underline-offset-[3px]">
              Here's where it went
            </a>
          }
        >
          {over?.text.replace(/ Here's where it went →$/, '')}
        </NoticeSlip>
      )}
      <NoticeSlip level="warn" onDismiss={() => undefined}>
        RM 210 left for 2 days.
      </NoticeSlip>
      <NoticeSlip level="info" onDismiss={() => undefined}>
        No budget set for this trip. Add one to fill the jar.
      </NoticeSlip>
    </>
  );
}

function TabsDemo() {
  const [tab, setTab] = useState('ledger');
  const [filter, setFilter] = useState('all');
  return (
    <>
      <LedgerTabs
        ariaLabel="Trip sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'fund', label: 'Fund' },
          { key: 'ledger', label: 'Ledger' },
          { key: 'days', label: 'Days' },
          { key: 'pack', label: 'Pack' },
          { key: 'notes', label: 'Notes' },
        ]}
      />
      <LedgerTabs
        ariaLabel="Filter trips"
        value={filter}
        onChange={setFilter}
        tabs={[
          { key: 'all', label: 'All', count: 7 },
          { key: 'upcoming', label: 'Upcoming', count: 2 },
          { key: 'road', label: 'On the road', count: 1 },
          { key: 'home', label: 'Home', count: 4 },
        ]}
      />
    </>
  );
}

function StampReplay() {
  const [k, setK] = useState(0);
  return (
    <div className="flex items-center gap-4">
      <div key={k} className="flex h-24 w-24 items-center justify-center border border-dashed border-rule">
        <PassportStamp text="BALIK" code="JP" date="2026-11-20" region="asia" seed={1} size={96} animate={k > 0} />
      </div>
      <Button variant="secondary" size="sm" onClick={() => setK((x) => x + 1)}>
        Stamp it
      </Button>
    </div>
  );
}

function Harness() {
  const [deleted, setDeleted] = useState<string | null>(null);
  const actions = (name: string) => ({ onEdit: () => setDeleted(`Edit ${name}`), onDelete: () => setDeleted(`Delete ${name}`) });
  return (
    <div className="mx-auto max-w-[1168px] px-4 pb-24 pt-6 lg:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="type-overline text-ink-3">E4 · MOTIFS · §5.4</p>
          <h1 className="type-display-2 text-ink">
            Tickets, passbooks and <em>cop</em>
          </h1>
        </div>
        <ThemeToggle size="sm" />
      </header>
      {deleted ? <p className="type-body-s mb-4 text-ink-2">Last menu action: {deleted}</p> : null}

      <div className="grid gap-x-10 gap-y-12 lg:grid-cols-2">
        <Section id="ticket-list" title="TripTicket · list">
          <TripTicket trip={tokyo} homeCountry="MY" today={BEFORE} to="/trips/1" {...actions('Tokyo autumn')} />
          <TripTicket trip={tokyoRoad} homeCountry="MY" today={DAY3} to="/trips/1" selected {...actions('Tokyo autumn')} />
          <TripTicket trip={tokyoHome} homeCountry="MY" today={AFTER} to="/trips/1" {...actions('Tokyo autumn')} />
          <TripTicket trip={bangkok} homeCountry="MY" today={D('2026-11-13')} to="/trips/2" {...actions('Bangkok')} />
          <TripTicket trip={bali} homeCountry="MY" today={BEFORE} to="/trips/3" {...actions('Bali')} />
          <TripTicket trip={seoul} homeCountry="MY" today={BEFORE} to="/trips/4" {...actions('Seoul')} />
        </Section>

        <Section id="ticket-hero" title="TripTicket · hero, review, mini">
          <TripTicket variant="hero" trip={tokyo} homeCountry="MY" today={BEFORE} {...actions('Tokyo autumn')} />
          <TripTicket variant="hero" trip={tokyoRoad} homeCountry="MY" today={DAY3} {...actions('Tokyo autumn')} />
          <TripTicket variant="hero" trip={tokyoHome} homeCountry="MY" today={AFTER} {...actions('Tokyo autumn')} />
          <TripTicket variant="review" trip={{ ...tokyo, id: undefined }} homeCountry="MY" today={BEFORE} />
          <TripTicket
            variant="mini"
            title="teamLab Planets"
            location="Toyosu, Koto City, Tokyo"
            glyph={<Glyph cat="activities" />}
            meta="Tickets for 10:30, bring a towel"
            {...actions('teamLab')}
          />
          <TripTicket variant="mini" title="Ramen Ichiran Shinjuku" glyph={<Glyph cat="food" />} />
        </Section>

        <Section id="ledger" title="Passbook · Phase A, grouped, on the road" wide>
          <Passbook
            rows={tokyoRows}
            currency="MYR"
            tripStart={tokyo.startDate}
            tripEnd={tokyo.endDate}
            dailyAllowance={4000 / 9}
            caption="Tokyo autumn ledger"
            onRowClick={(r) => setDeleted(`Open ${r.label}`)}
          />
        </Section>

        <Section id="ledger-over" title="Passbook · over budget (THB)">
          <Passbook rows={overRows} currency="THB" tripStart={bangkok.startDate} tripEnd={bangkok.endDate} caption="Bangkok ledger" />
        </Section>

        <Section id="ledger-saving" title="Passbook · saving mode, dense, newest first">
          <Passbook rows={savingRows} currency="MYR" dense newestFirst groupByDay={false} caption="Seoul fund" />
          <Label>Biggest spends (no balance)</Label>
          <Passbook rows={tokyoRows.filter((r) => r.out).sort((a, b) => (b.out ?? 0) - (a.out ?? 0)).slice(0, 3)} currency="MYR" showBalance={false} groupByDay={false} />
          <Label>Empty</Label>
          <Passbook rows={[]} currency="MYR" />
        </Section>

        <Section id="money" title="MoneyFigure">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            <div>
              <Label>Hero</Label>
              <MoneyFigure size="hero" amount={2340.5} currency="MYR" tone="fund" />
            </div>
            <div>
              <Label>Hero, whole, over</Label>
              <MoneyFigure size="hero" amount={-240} currency="MYR" tone="stamp" />
            </div>
            <div>
              <Label>Hero, approx JPY</Label>
              <MoneyFigure size="hero" amount={98200} currency="JPY" approx />
            </div>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
            <MoneyFigure size="l" amount={1660} currency="MYR" />
            <MoneyFigure size="l" amount={-82.5} currency="SGD" tone="stamp" />
            <div className="w-40">
              <MoneyFigure size="ledger" amount={3200} currency="JPY" />
              <MoneyFigure size="ledger" amount={94.4} currency="MYR" approx className="text-ink-3" />
            </div>
          </div>
        </Section>

        <Section id="rail" title="CoinRail">
          <div>
            <Label>Day 3 of 9</Label>
            <CoinRail target={4000} spent={1660} currency="MYR" />
          </div>
          <div>
            <Label>91% gone</Label>
            <CoinRail target={4000} spent={3640} currency="MYR" />
          </div>
          <div>
            <Label>Over</Label>
            <CoinRail target={20000} spent={21500} currency="THB" />
          </div>
          <div>
            <Label>Saving mode: 4,200 dropped in, 2,400 spent</Label>
            <CoinRail target={6000} spent={2400} inJar={1800} currency="MYR" />
          </div>
          <div>
            <Label>No budget</Label>
            <CoinRail target={0} spent={312} currency="MYR" />
          </div>
        </Section>

        <Section id="tags" title="PhaseTag · AirmailStripe · SceneSummary">
          <div className="flex flex-wrap gap-3">
            <PhaseTag phase="upcoming" daysToGo={28} />
            <PhaseTag phase="upcoming" daysToGo={1} saving />
            <PhaseTag phase="onTheRoad" day={3} totalDays={9} />
            <PhaseTag phase="home" homeDate="2026-11-20" />
          </div>
          <AirmailStripe />
          <SceneSummary
            spec={{ summary: 'Tokyo autumn: RM 2,340 of RM 4,000 left. Day 3 of 9. RM 186 spent today.', unitChip: '1 coin = RM 20' }}
          />
        </Section>

        <Section id="stamps" title="PassportStamp" wide>
          <div className="flex flex-wrap items-center gap-6">
            <PassportStamp text="Japan" code="JP" date="12 NOV 2026" sub="2026" region={regionOf('JP')} seed="JP" size={96} />
            <PassportStamp text="France" code="FR" date="2025-06-03" region={regionOf('FR')} seed="FR" size={96} />
            <PassportStamp text="Peru" code="PE" date="2025-02-14" region={regionOf('PE')} seed="PE" size={96} />
            <PassportStamp text="Morocco" code="MA" date="2024-09-21" region={regionOf('MA')} seed="MA" size={96} />
            <PassportStamp text="New Zealand" code="NZ" date="2024-12-28" region={regionOf('NZ')} seed="NZ" size={96} />
            <PassportStamp text="Settled" region="asia" tone="fund" seed={2} size={96} date="2026-11-21" />
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <PassportStamp text="BALIK" code="JP" date="2026-11-20" region="asia" seed={1} size={64} />
            <PassportStamp text="SIAP" region="europe" tone="fund" seed={3} size={64} date="2026-11-11" />
            <PassportStamp text="OVER" code="TH" date="2026-11-13" region="asia" seed={2} size={64} />
            <PassportStamp text="CUKUP" region="oceania" tone="fund" seed={4} size={64} />
            <PassportStamp text="BALIK" code="PE" region="americas" seed={5} size={48} />
            <PassportStamp text="SIAP" region="africa_me" tone="fund" seed={6} size={48} />
            <StampReplay />
          </div>
        </Section>

        <Section id="receipt" title="ReceiptSlip">
          <ReceiptSlip raised>
            <p className="type-overline text-ink-3">13 NOV 2026 · FNB · DAY 2</p>
            <p className="mt-1 font-sans text-[18px] font-semibold">Ramen Ichiran</p>
            <ReceiptRule />
            <ReceiptLine label="Paid" value="¥ 3,200" />
            <ReceiptLine label="Rate" value="1 JPY = 0.0295 MYR" />
            <ReceiptLine label="Counted" value="RM 94.40" strong />
            <ReceiptRule />
            <ReceiptLine label="Paid by" value="Siti" leader={false} />
          </ReceiptSlip>
          <ReceiptSlip edge="both">
            <ReceiptLine label="Aiman → Siti" value="RM 82.50" strong />
            <ReceiptLine label="Hafiz → Aiman" value="RM 20.00" strong />
          </ReceiptSlip>
        </Section>

        <Section id="flap" title="SplitFlap">
          <FlapDemo />
        </Section>

        <Section id="notice" title="NoticeSlip">
          <NoticeDemo />
        </Section>

        <Section id="tabs" title="LedgerTabs">
          <TabsDemo />
        </Section>

        <Section id="rates" title="DeparturesBoard">
          <DeparturesBoard
            rows={rates}
            base="MYR"
            date="2026-10-15"
            footer={
              <Button variant="ghost" size="sm" className="px-0">
                All rates
              </Button>
            }
          />
          <DeparturesBoard rows={[]} base="MYR" error="Live rates aren't loading right now." />
        </Section>

        <Section id="kongsi" title="DivergingBar">
          <DivergingBar
            currency="MYR"
            rows={[
              { name: 'Aiman', net: 102.5 },
              { name: 'Siti Aisyah', net: -82.5 },
              { name: 'Hafiz', net: -20 },
              { name: 'Syaqirah', net: 0 },
            ]}
          />
        </Section>

        <Section id="ghosts" title="GhostOutline">
          <div className="flex flex-wrap items-end gap-8">
            <GhostOutline kind="jar" />
            <GhostOutline kind="ticket" />
            <GhostOutline kind="suitcase" />
            <GhostOutline kind="house" />
          </div>
        </Section>

        <Section id="jars" title="MiniBalangSvg">
          <div className="flex flex-wrap items-end gap-6">
            <MiniBalangSvg fill={1} phase="upcoming" title="Full jar" />
            <MiniBalangSvg fill={0.585} phase="onTheRoad" title="Jar 58% full" />
            <MiniBalangSvg fill={0.078} phase="home" title="Jar 8% full" />
            <MiniBalangSvg fill={0} over phase="onTheRoad" title="Over budget" />
            <MiniBalangSvg fill={0} phase="upcoming" title="No budget" />
            <MiniBalangSvg fill={0.7} slots={3} phase="upcoming" width={56} height={72} title="Shared pot" />
            <MiniBalangSvg fill={0.31} phase="home" width={50} height={64} title="Lifetime baki" />
          </div>
        </Section>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <AppThemeProvider>
    <MotionConfig reducedMotion="user">
      <MemoryRouter>
        <Harness />
      </MemoryRouter>
    </MotionConfig>
  </AppThemeProvider>,
);
