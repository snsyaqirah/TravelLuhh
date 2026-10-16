// S2 TripPlot (§8): one trip as a plinth with its balang at the back-left and its days laid out as a real
// calendar of stones. Three modes share one spec shape:
//  - live  (trip page: Ledger, Days, Notes tabs)  mapTripPlot()
//  - draft (Create flow, steps 1–5)               mapTripPlotDraft()
//  - demo  (Landing hero, acts ISI/JALAN/BALIK)   mapTripPlotDemo() / useTripPlotDemo()
// The map* functions are pure. The small hooks at the bottom (BALIK first view, demo timeline) are the only
// stateful bits, and the only code here that touches localStorage or timers.
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BudgetType, Expense, Rates, Trip } from '@/types';
import { computeFund, type FundState } from '@/hooks/useFund';
import { addCalendarDays, eachDateISO, formatDayMonth, formatShortDate, formatWeekdayDayMonth, isValidDate, parseLocalDate, toISODate } from '@/lib/dates';
import { sentenceMoney } from '@/lib/fundCopy';
import { convertMoney, formatMoney, niceUnit } from '@/lib/money';
import { dayIndex, daysUntilStart, durationLabel, tripDays, type Phase } from '@/lib/phase';
import { useReducedMotion } from '@/iso/hooks';
import { boundsForScreenRect, ringPoints, screenRectOf } from '@/iso/mappers/shelf';
import { JAR_MAX_R, JAR_REF_HEIGHT, LID, SIGNPOST, STONE, stoneTop } from '@/iso/shapes';
import type { LidColorKey, LidState, RenderState, SceneLabel, SceneSpecBase, SceneTarget, Vec3 } from '@/iso/specs';
import type { StageMode, StoneState } from '@/iso/types';

// ---------------------------------------------------------------- types

export type TripPlotTrip = Pick<Trip, 'id' | 'name' | 'destinationCountry' | 'startDate' | 'endDate' | 'budget' | 'currency'> &
  Partial<Pick<Trip, 'totalExpenses' | 'spentAmount' | 'savedAmount' | 'budgetType'>>;

/** Expense rows as the API returns them; `amount` is in the trip currency (§2.6). */
export type TripPlotExpense = Pick<Expense, 'expenseDate' | 'amount'> & Partial<Pick<Expense, 'currency'>>;

export interface TripPlotInput {
  trip: TripPlotTrip;
  /** useExpenses(trip.id).expenses. Omit or [] for none. */
  expenses?: readonly TripPlotExpense[];
  /** user.country for the signpost ('MY → JP'). Defaults to MY. */
  homeCountry?: string | null;
  today?: Date;
  /** useFund(trip, { spent: totalSpent }) so the jar matches the figures panel. Computed when omitted. */
  fund?: FundState;
  /** Only for legacy rows stored in another currency (pre-§2.6). Rows with no rate stay off the stones. */
  rates?: Rates | null;
}

export interface TripPlotOptions {
  /** Days tab selection ('YYYY-MM-DD'): that day's stone gets the brass loop. */
  selectedDate?: string | null;
  /** readBalikSeen(trip.id) / useBalikMoment(): false → spec.stamp.play on a completed, under-budget trip. */
  balikSeen?: boolean;
  /**
   * Show BALIK as a scene label at the signpost (default true). Turn off when the page mounts a DOM
   * PassportStamp at spec.stamp.at instead.
   */
  stampLabel?: boolean;
  /** Fixed coin unit (demo keeps one unit across acts). Default niceUnit(maxDaySpend / 10). */
  coinUnit?: number;
}

export interface PlotJar {
  id: string;
  /** Base centre on the plinth. */
  at: Vec3;
  height: number;
  /** 0..1 share of the jar holding coins. */
  fill: number;
  lid: LidState;
  lidColor: LidColorKey;
  lidYaw: number;
  slots: 1 | 3;
  seed: string;
  /** Sketch jar (draft steps 1–2): leaf fill, dashed outline, no coins. */
  ghost: boolean;
}

export interface PlotStone {
  index: number;
  /** First and last date this stone stands for ('YYYY-MM-DD'). Equal unless daysPerStone > 1. */
  from: string;
  to: string;
  days: number;
  col: number;
  row: number;
  /** Base centre on the plinth. */
  at: Vec3;
  state: StoneState;
  /** Spend on these days (trip currency). */
  spend: number;
  /** Coins in this stone's stack (0 on future stones). */
  coins: number;
  /** Stack jitter seed, stable per trip and date (3D and SVG use the same). */
  seed: string;
  /** Spend above the daily allowance × days → stamp rim. */
  over: boolean;
  selected: boolean;
}

export type DemoAct = 1 | 2 | 3;
export type DemoFrame = 'isi-empty' | 'isi-full' | 'isi-closed' | 'jalan-1' | 'jalan-2' | 'jalan-3' | 'balik';

export interface TripPlotSpec extends SceneSpecBase {
  kind: 'tripPlot';
  mode: StageMode;
  /** Live coinOut events for this trip animate; null in draft and demo. */
  tripId: number | null;
  phase: Phase;
  /** §2.2: sketch (upcoming), ink (on the road), chop (home). */
  renderState: RenderState;
  plinth: { w: number; d: number; at: Vec3 };
  jars: PlotJar[];
  stones: PlotStone[];
  rows: number;
  daysPerStone: number;
  /** Trip-currency value of one stacked coin; null when no stack is drawn. */
  coinUnit: number | null;
  currency: string;
  signpost: { at: Vec3 } | null;
  iou: { at: Vec3; rotY: number } | null;
  /** Home phase: where a DOM PassportStamp BALIK goes; `play` = first view of an under-budget trip. */
  stamp: { at: Vec3; text: 'BALIK'; play: boolean } | null;
  /** Rows that couldn't be placed on a stone (legacy foreign-currency rows with no rate, bad dates). */
  unplaced: number;
  draftStep: number | null;
  demo: { act: DemoAct; frame: DemoFrame } | null;
  /**
   * Same key → same stones in the same places; scenes only animate between specs that share it. Deliberately
   * ignores the plinth depth, which grows the moment a trip goes over budget (while a coin is in the air).
   */
  layoutKey: string;
}

// ---------------------------------------------------------------- layout (§8)

export const PLOT = {
  stoneX0: 2.8,
  stoneZ0: 0.5,
  pitch: STONE.spacing,
  /** 2.8 + 7 × .75 + .4 */
  plinthW: 8.45,
  minDepth: 2.8,
  jar: [1.4, 0, 1.4] as Vec3,
  jarHeight: 2.4,
  /** Over budget: the tilted lid leans out in front of the jar and needs this much plinth. */
  overDepth: 3.6,
  /** Leans the tilted lid out to the front-left, clear of Monday's column of stones. */
  overLidYaw: -0.45,
  iou: [2.1, 0, 3.15] as Vec3,
  maxStones: 42,
  maxCoins: 10,
  /** Separated draft: a jar each, H 1.4, in the jar zone (left, right, back, front). */
  separated: [
    [0.7, 0, 1.9],
    [1.9, 0, 0.7],
    [0.7, 0, 0.7],
    [1.9, 0, 1.9],
  ] as Vec3[],
  separatedHeight: 1.4,
} as const;

const DEFAULT_HOME = 'MY';
const EPS = 0.005;

const stoneAt = (col: number, row: number): Vec3 => [PLOT.stoneX0 + col * PLOT.pitch, 0, PLOT.stoneZ0 + row * PLOT.pitch];
const depthFor = (rows: number) => Math.max(PLOT.minDepth, rows * PLOT.pitch + 0.6);

/** Monday 0 … Sunday 6. */
function weekdayMon0(iso: string): number {
  const d = parseLocalDate(iso);
  return isValidDate(d) ? (d.getDay() + 6) % 7 : 0;
}

const iso10 = (s: string | null | undefined) => (typeof s === 'string' ? s.trim().slice(0, 10) : '');

interface StoneFrame {
  from: string;
  to: string;
  days: number;
  col: number;
  row: number;
}

/**
 * Calendar layout: column = weekday (Mon … Sun), row = week counted from the start date's week. Trips longer
 * than 42 days put `ceil(days / 42)` days on a stone and fill a plain 7-wide grid instead.
 */
export function calendarStones(startDate: string, endDate: string): { stones: StoneFrame[]; daysPerStone: number; rows: number } {
  const start = iso10(startDate);
  let end = iso10(endDate);
  if (!isValidDate(parseLocalDate(start))) return { stones: [], daysPerStone: 1, rows: 0 };
  if (!isValidDate(parseLocalDate(end)) || end < start) end = start;
  const dates = eachDateISO(start, end, 400);
  const days = dates.length;
  const daysPerStone = days > PLOT.maxStones ? Math.ceil(days / PLOT.maxStones) : 1;
  const count = Math.ceil(days / daysPerStone);
  const startCol = daysPerStone === 1 ? weekdayMon0(start) : 0;
  const stones: StoneFrame[] = [];
  for (let i = 0; i < count; i++) {
    const slice = dates.slice(i * daysPerStone, (i + 1) * daysPerStone);
    const offset = startCol + i;
    stones.push({ from: slice[0], to: slice[slice.length - 1], days: slice.length, col: offset % 7, row: Math.floor(offset / 7) });
  }
  const rows = stones.length ? stones[stones.length - 1].row + 1 : 0;
  return { stones, daysPerStone, rows };
}

/** Index of the stone a date belongs to; dates before or after the trip go to the first or last stone. -1 without stones. */
export function stoneIndexForDate(stones: ReadonlyArray<Pick<PlotStone, 'from' | 'to'>>, date: string): number {
  if (stones.length === 0) return -1;
  const d = iso10(date);
  if (!d || d <= stones[0].to) return 0;
  if (d >= stones[stones.length - 1].from) return stones.length - 1;
  let lo = 0;
  let hi = stones.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (stones[mid].to < d) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Signpost label hangs below the post's foot: the post stands after the last stone, so below it on screen is
 * empty plinth, while above it are the earlier rows of stones.
 */
const signLabelAt = (sign: Vec3): Vec3 => [sign[0] + 0.15, 0, sign[2] + 0.15];

/** Signpost goes in the cell right after the last stone (or just past Sunday when the week is full). */
function signpostAt(stones: readonly StoneFrame[]): Vec3 {
  if (stones.length === 0) return [PLOT.stoneX0 + 7 * PLOT.pitch - 0.05, 0, PLOT.stoneZ0];
  const last = stones[stones.length - 1];
  const col = last.col + 1;
  const [x, , z] = stoneAt(col, last.row);
  return [col >= 7 ? x - 0.05 : x, 0, z];
}

function routeLabel(home: string | null | undefined, dest: string | null | undefined): string | null {
  const to = (dest ?? '').trim().toUpperCase();
  if (!to) return null;
  const from = ((home ?? '').trim() || DEFAULT_HOME).toUpperCase();
  return `${from} → ${to}`;
}

const lidColorFor = (phase: Phase): LidColorKey =>
  phase === 'onTheRoad' ? 'lidOnTheRoad' : phase === 'home' ? 'lidHome' : 'lidUpcoming';

const renderStateFor = (phase: Phase): RenderState => (phase === 'onTheRoad' ? 'ink' : phase === 'home' ? 'chop' : 'sketch');

const unitMoney = (amount: number, currency: string) => formatMoney(amount, currency, { decimals: 'none' });

function days(n: number): string {
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}

// ---------------------------------------------------------------- framing

function framePoints(
  plinth: { w: number; d: number },
  jars: readonly PlotJar[],
  stones: readonly PlotStone[],
  signpost: Vec3 | null,
  overLid: boolean,
): Vec3[] {
  const pts: Vec3[] = [];
  for (const x of [0, plinth.w]) for (const z of [0, plinth.d]) pts.push([x, 0, z], [x, -0.4, z]);
  for (const j of jars) {
    const s = j.height / JAR_REF_HEIGHT;
    pts.push(...ringPoints([j.at[0], s, j.at[2]], JAR_MAX_R * s));
    const top = j.lid === 'closed' ? JAR_REF_HEIGHT + LID.h : JAR_REF_HEIGHT;
    pts.push(...ringPoints([j.at[0], top * s, j.at[2]], LID.r * s));
  }
  if (overLid) pts.push([0.2, 1.5, 3.5], [2.0, 1.5, 3.5]);
  for (const st of stones) if (st.coins > 0 || st.state === 'today') pts.push([st.at[0], 0.8, st.at[2]]);
  if (signpost) pts.push([signpost[0], SIGNPOST.post[1], signpost[2]], [signpost[0] + SIGNPOST.boardLen, SIGNPOST.boardsY[0], signpost[2]]);
  // Room for the signpost label chip that hangs below the post.
  if (signpost) pts.push([signpost[0] + 0.15, -1.0, signpost[2] + 0.15]);
  return pts;
}

// ---------------------------------------------------------------- live

interface BuildArgs {
  mode: StageMode;
  trip: TripPlotTrip;
  fund: FundState;
  phase: Phase;
  today: Date;
  expenses: readonly TripPlotExpense[];
  rates?: Rates | null;
  homeCountry?: string | null;
  opts: TripPlotOptions;
}

function dayTargetLabel(stone: PlotStone, firstDate: string, currency: string): string {
  const startIdx = Math.round((parseLocalDate(stone.from).getTime() - parseLocalDate(firstDate).getTime()) / 86_400_000) + 1;
  const when =
    stone.days === 1
      ? `Day ${startIdx}, ${titleCaseDate(formatWeekdayDayMonth(stone.from))}`
      : `Days ${startIdx}–${startIdx + stone.days - 1}, ${formatShortDate(stone.from)} to ${formatShortDate(stone.to)}`;
  const what = stone.spend > EPS ? `${sentenceMoney(stone.spend, currency)} spent` : stone.state === 'future' ? 'nothing yet' : 'nothing spent';
  return `${when}: ${what}`;
}

/** 'WED 14 NOV' → 'Wed 14 Nov' for sentences. */
function titleCaseDate(s: string): string {
  return s.replace(/\b([A-Z])([A-Z]+)\b/g, (_, a: string, b: string) => a + b.toLowerCase());
}

function buildPlot({ mode, trip, fund, phase, today, expenses, rates, homeCountry, opts }: BuildArgs): TripPlotSpec {
  const currency = trip.currency;
  const layout = calendarStones(trip.startDate, trip.endDate);
  const { daysPerStone } = layout;
  const totalDays = Math.max(1, tripDays(trip));

  // Stone states by phase (§2.2).
  const todayISO = toISODate(today);
  const todayIdx = phase === 'onTheRoad' ? stoneIndexForDate(layout.stones, todayISO) : -1;
  const stateOf = (i: number): StoneState =>
    phase === 'home' ? 'past' : phase === 'upcoming' ? 'future' : i < todayIdx ? 'past' : i === todayIdx ? 'today' : 'future';

  // Day spend: group by expenseDate; dates outside the trip go to the first or last stone.
  const spend = layout.stones.map(() => 0);
  let unplaced = 0;
  for (const e of expenses) {
    let amount = Number(e.amount);
    if (!Number.isFinite(amount) || amount === 0) continue;
    const cur = (e.currency ?? '').toUpperCase();
    if (cur && cur !== currency.toUpperCase()) {
      const converted = convertMoney(amount, cur, currency, rates);
      if (converted == null) {
        unplaced += 1;
        continue;
      }
      amount = converted;
    }
    const i = stoneIndexForDate(layout.stones, e.expenseDate);
    if (i < 0 || !isValidDate(parseLocalDate(iso10(e.expenseDate)))) {
      unplaced += 1;
      continue;
    }
    spend[i] += amount;
  }

  const stacked = layout.stones.map((_, i) => stateOf(i) !== 'future');
  const maxSpend = Math.max(0, ...spend.filter((_, i) => stacked[i]));
  const unit = maxSpend > EPS ? (opts.coinUnit && opts.coinUnit > 0 ? opts.coinUnit : niceUnit(maxSpend / PLOT.maxCoins)) : null;
  const perDay = fund.hasBudget ? fund.target / totalDays : null;
  const selectedIdx = opts.selectedDate ? stoneIndexForDate(layout.stones, opts.selectedDate) : -1;

  const stones: PlotStone[] = layout.stones.map((s, i) => {
    const state = stateOf(i);
    const coins = unit && stacked[i] ? Math.min(PLOT.maxCoins, Math.round(Math.max(0, spend[i]) / unit)) : 0;
    return {
      index: i,
      from: s.from,
      to: s.to,
      days: s.days,
      col: s.col,
      row: s.row,
      at: stoneAt(s.col, s.row),
      state,
      spend: spend[i],
      coins,
      seed: `${trip.id}|${s.from}`,
      over: perDay != null && state !== 'future' && spend[i] > perDay * s.days + EPS,
      selected: i === selectedIdx,
    };
  });

  const over = fund.hasBudget && fund.over > 0;
  const plinth = { w: PLOT.plinthW, d: depthFor(layout.rows), at: [0, 0, 0] as Vec3 };
  if (over) plinth.d = Math.max(plinth.d, PLOT.overDepth);
  plinth.at = [plinth.w / 2, 0, plinth.d / 2];

  const jar: PlotJar = {
    id: 'jar',
    at: PLOT.jar,
    height: PLOT.jarHeight,
    fill: fund.hasBudget ? fund.fill : 0,
    lid: over ? 'tilted' : 'closed',
    lidColor: lidColorFor(phase),
    lidYaw: over ? PLOT.overLidYaw : 0,
    slots: trip.budgetType === 'shared' ? 3 : 1,
    seed: `trip-${trip.id}`,
    ghost: false,
  };
  const sign = signpostAt(layout.stones);
  const route = routeLabel(homeCountry, trip.destinationCountry);
  const showStampLabel = opts.stampLabel !== false;

  const stamp =
    phase === 'home'
      ? {
          at: [sign[0], SIGNPOST.post[1] + 0.2, sign[2]] as Vec3,
          text: 'BALIK' as const,
          play: fund.hasBudget && fund.over <= 0 && opts.balikSeen === false,
        }
      : null;

  // ---- labels (≤ 4 shown; priority orders them)
  const labels: SceneLabel[] = [];
  const jarLabel = jarLabelFor(fund, phase);
  if (jarLabel) labels.push({ id: 'jar', at: jarLabelAt(jar), anchor: 'right', priority: 0, ...jarLabel });
  if (phase === 'home' && showStampLabel) {
    labels.push({
      id: 'sign',
      at: signLabelAt(sign),
      text: 'BALIK',
      sub: [route, formatDayMonth(trip.endDate)].filter(Boolean).join(' · '),
      tone: 'stamp',
      anchor: 'below',
      priority: 1,
    });
  } else if (route) {
    labels.push({ id: 'sign', at: signLabelAt(sign), text: route, tone: 'ink', anchor: 'below', priority: 1 });
  }
  // ---- targets: one per stone → that day's ledger (IsoStage drops any closer than 32px, e.g. on phones)
  const firstDate = layout.stones[0]?.from ?? iso10(trip.startDate);
  const targets: SceneTarget[] =
    mode === 'live'
      ? stones.map((st) => ({
          id: `day-${st.from}`,
          at: [st.at[0], stoneTop(st.state), st.at[2]] as Vec3,
          sizePx: 32,
          ariaLabel: dayTargetLabel(st, firstDate, currency),
          href: `/trips/${trip.id}/ledger?day=${st.from}`,
        }))
      : [];

  // ---- unit chip
  const chips: string[] = [];
  if (unit && stones.some((s) => s.coins > 0)) chips.push(`1 coin = ${unitMoney(unit, currency)}`);
  if (daysPerStone > 1) chips.push(`1 stone = ${daysPerStone} days`);

  const bounds = boundsForScreenRect(screenRectOf(framePoints(plinth, [jar], stones, sign, over)));

  return {
    kind: 'tripPlot',
    mode,
    tripId: mode === 'live' ? trip.id : null,
    phase,
    renderState: renderStateFor(phase),
    bounds,
    labels,
    targets,
    summary: liveSummary(trip, fund, phase, today, stones, todayIdx, unplaced),
    unitChip: chips.length ? chips.join(' · ') : undefined,
    plinth,
    jars: [jar],
    stones,
    rows: layout.rows,
    daysPerStone,
    coinUnit: unit,
    currency,
    signpost: { at: sign },
    iou: over ? { at: PLOT.iou, rotY: -0.22 } : null,
    stamp,
    unplaced,
    draftStep: null,
    demo: null,
    layoutKey: `${firstDate}|${layout.stones.length}|${daysPerStone}`,
  };
}

/** Right of the jar's shoulder, so the chip floats over empty plinth instead of the jar or the slot's top edge. */
function jarLabelAt(jar: PlotJar): Vec3 {
  const s = jar.height / JAR_REF_HEIGHT;
  const off = 0.78 * s;
  return [jar.at[0] + off, 1.9 * s, jar.at[2] - off];
}

function jarLabelFor(f: FundState, phase: Phase): Pick<SceneLabel, 'text' | 'sub' | 'tone'> | null {
  const c = f.currency;
  if (!f.hasBudget) return { text: 'No budget set', tone: 'muted' };
  const of = `of ${sentenceMoney(f.target, c)}`;
  if (f.over > 0) return { text: `Over ${sentenceMoney(f.over, c)}`, sub: of, tone: 'stamp' };
  if (phase === 'home') return { text: `${sentenceMoney(f.inJar, c)} baki`, sub: of, tone: 'fund' };
  if (phase === 'upcoming' && f.spent <= EPS) return { text: `${sentenceMoney(f.inJar, c)} in jar`, sub: `for ${days(f.daysTotal)}`, tone: 'fund' };
  return { text: `${sentenceMoney(f.inJar, c)} left`, sub: of, tone: 'fund' };
}

function liveSummary(
  trip: TripPlotTrip,
  f: FundState,
  phase: Phase,
  today: Date,
  stones: readonly PlotStone[],
  todayIdx: number,
  unplaced: number,
): string {
  const c = f.currency;
  const name = trip.name.trim() || 'This trip';
  const parts: string[] = [];
  let money: string;
  if (!f.hasBudget) money = f.spent > EPS ? `no budget set, ${sentenceMoney(f.spent, c)} spent` : 'no budget set';
  else if (f.over > 0) money = `over by ${sentenceMoney(f.over, c)} on ${sentenceMoney(f.target, c)}`;
  else if (phase === 'home') money = `back with ${sentenceMoney(f.inJar, c)} baki of ${sentenceMoney(f.target, c)}`;
  else if (phase === 'upcoming' && f.spent <= EPS) money = `${sentenceMoney(f.target, c)} in the jar for ${days(f.daysTotal)}`;
  else money = `${sentenceMoney(f.inJar, c)} of ${sentenceMoney(f.target, c)} left`;
  parts.push(`${name}: ${money}.`);

  if (phase === 'onTheRoad') {
    const day = dayIndex(trip, today) ?? 1;
    parts.push(`Day ${day} of ${f.daysTotal}.`);
    const t = todayIdx >= 0 ? stones[todayIdx] : null;
    const todaySpend = t && t.days === 1 ? t.spend : null;
    if (todaySpend != null) parts.push(todaySpend > EPS ? `${sentenceMoney(todaySpend, c)} spent today.` : 'Nothing spent today.');
  } else if (phase === 'upcoming') {
    const n = Math.max(0, daysUntilStart(trip, today));
    parts.push(n === 0 ? 'Starts today.' : n === 1 ? 'Starts tomorrow.' : `Starts in ${n} days.`);
  } else {
    parts.push(`${durationLabel(f.daysTotal)}, home since ${formatShortDate(trip.endDate)}.`);
  }
  if (unplaced > 0) parts.push(unplaced === 1 ? '1 entry has no rate or date, so it isn\'t on the day stones.' : `${unplaced} entries have no rate or date, so they aren't on the day stones.`);
  return parts.join(' ');
}

/**
 * Live trip stage. Feed it the same trip, expenses and FundState the page shows in its figures.
 *
 *   const fund = useFund(trip, { spent: totalSpent });
 *   const spec = useMemo(() => mapTripPlot({ trip, expenses, fund, homeCountry: user?.country },
 *     { selectedDate, balikSeen: !playBalik }), [...]);
 *   <IsoStage spec={spec} mode="live" height={{ base: 220, lg: 320 }} />
 */
export function mapTripPlot(input: TripPlotInput, opts: TripPlotOptions = {}): TripPlotSpec {
  const today = input.today ?? new Date();
  const fund = input.fund ?? computeFund(input.trip, today);
  return buildPlot({
    mode: 'live',
    trip: input.trip,
    fund,
    phase: fund.phase,
    today,
    expenses: input.expenses ?? [],
    rates: input.rates,
    homeCountry: input.homeCountry,
    opts,
  });
}

// ---------------------------------------------------------------- draft (Create flow)

export interface TripPlotDraft {
  destinationCountry?: string | null;
  name?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  budget?: number | null;
  currency?: string | null;
  budgetType?: BudgetType | null;
  /** Jars to draw for 'separated' (2–4). Default 3. */
  people?: number;
}

export interface TripPlotDraftOptions {
  homeCountry?: string | null;
}

/**
 * Create flow preview. The scene follows the form (§9.5): 1 where → plinth + signpost; 2 when → stones drop
 * as sketches; 3 who's in → solo / shared (3 slots) / separated (a jar each); 4 how much → the jar fills to
 * the brim with `≈ RM 444 / day`; 5 check → the lid closes and one coin drops in.
 */
export function mapTripPlotDraft(draft: TripPlotDraft, step: number, opts: TripPlotDraftOptions = {}): TripPlotSpec {
  const s = Math.min(5, Math.max(1, Math.round(step)));
  const currency = (draft.currency || 'MYR').toUpperCase();
  const budget = Number.isFinite(draft.budget) && (draft.budget ?? 0) > 0 ? (draft.budget as number) : 0;
  const hasDates = !!draft.startDate && isValidDate(parseLocalDate(iso10(draft.startDate)));
  const layout =
    s >= 2 && hasDates ? calendarStones(draft.startDate as string, draft.endDate || (draft.startDate as string)) : { stones: [], daysPerStone: 1, rows: 0 };
  const totalDays = layout.stones.reduce((n, st) => n + st.days, 0);

  const stones: PlotStone[] = layout.stones.map((st, i) => ({
    index: i,
    from: st.from,
    to: st.to,
    days: st.days,
    col: st.col,
    row: st.row,
    at: stoneAt(st.col, st.row),
    state: 'future',
    spend: 0,
    coins: 0,
    seed: `draft|${st.from}`,
    over: false,
    selected: false,
  }));

  const type: BudgetType = draft.budgetType ?? 'solo';
  const fill = s >= 4 && budget > 0 ? 1 : 0;
  const lid: LidState = s >= 5 ? 'closed' : 'off';
  let jars: PlotJar[];
  if (s <= 2) {
    jars = [{ id: 'jar', at: PLOT.jar, height: PLOT.jarHeight, fill: 0, lid: 'closed', lidColor: 'lidUpcoming', lidYaw: 0, slots: 1, seed: 'draft', ghost: true }];
  } else if (type === 'separated') {
    const n = Math.min(4, Math.max(2, Math.round(draft.people ?? 3)));
    jars = PLOT.separated.slice(0, n).map((at, i) => ({
      id: `jar-${i}`,
      at,
      height: PLOT.separatedHeight,
      fill,
      lid,
      lidColor: 'lidUpcoming',
      lidYaw: 0,
      slots: 1,
      seed: `draft-${i}`,
      ghost: false,
    }));
  } else {
    jars = [{ id: 'jar', at: PLOT.jar, height: PLOT.jarHeight, fill, lid, lidColor: 'lidUpcoming', lidYaw: 0, slots: type === 'shared' ? 3 : 1, seed: 'draft', ghost: false }];
  }

  const plinth = { w: PLOT.plinthW, d: depthFor(layout.rows), at: [0, 0, 0] as Vec3 };
  plinth.at = [plinth.w / 2, 0, plinth.d / 2];
  const sign = signpostAt(layout.stones);
  const route = routeLabel(opts.homeCountry, draft.destinationCountry);

  const labels: SceneLabel[] = [];
  if (route) labels.push({ id: 'sign', at: signLabelAt(sign), text: route, tone: 'ink', anchor: 'below', priority: 1 });
  const perDay = budget > 0 && totalDays > 0 ? budget / totalDays : null;
  if (s >= 4 && budget > 0) {
    // The jar furthest right on screen carries the label.
    const lead = jars.reduce((a, b) => (b.at[0] - b.at[2] > a.at[0] - a.at[2] ? b : a));
    labels.push({
      id: 'jar',
      at: jarLabelAt(lead),
      text: perDay != null ? `${sentenceMoney(perDay, currency, { approx: true })} / day` : sentenceMoney(budget, currency),
      sub: perDay != null ? `${sentenceMoney(budget, currency)} · ${days(totalDays)}` : undefined,
      tone: 'fund',
      anchor: 'right',
      priority: 0,
    });
  }

  const bounds = boundsForScreenRect(screenRectOf(framePoints(plinth, jars, stones, sign, false)));
  const start = layout.stones[0]?.from ?? '';

  return {
    kind: 'tripPlot',
    mode: 'draft',
    tripId: null,
    phase: 'upcoming',
    renderState: 'sketch',
    bounds,
    labels,
    targets: [],
    summary: draftSummary(draft, s, type, budget, currency, totalDays, perDay),
    unitChip: layout.daysPerStone > 1 ? `1 stone = ${layout.daysPerStone} days` : undefined,
    plinth,
    jars,
    stones,
    rows: layout.rows,
    daysPerStone: layout.daysPerStone,
    coinUnit: null,
    currency,
    signpost: { at: sign },
    iou: null,
    stamp: null,
    unplaced: 0,
    draftStep: s,
    demo: null,
    layoutKey: `${start}|${stones.length}|${layout.daysPerStone}`,
  };
}

function draftSummary(
  draft: TripPlotDraft,
  step: number,
  type: BudgetType,
  budget: number,
  currency: string,
  totalDays: number,
  perDay: number | null,
): string {
  const dest = (draft.destinationCountry ?? '').toUpperCase();
  const name = (draft.name ?? '').trim();
  const head = name || (dest ? `A tabung for ${dest}` : 'A new tabung');
  const parts = [`${head}.`];
  if (step >= 2 && totalDays > 0) parts.push(`${totalDays} ${totalDays === 1 ? 'day' : 'days'} from ${formatShortDate(draft.startDate ?? '')}.`);
  if (step >= 3) {
    parts.push(
      type === 'shared' ? 'Geng, one pot: one big jar, everyone drops in.' : type === 'separated' ? 'Geng, own money: a jar each.' : 'Just me: one jar.',
    );
  }
  if (step >= 4) {
    parts.push(
      budget > 0
        ? perDay != null
          ? `${sentenceMoney(budget, currency)} in the jar, about ${sentenceMoney(perDay, currency)} a day.`
          : `${sentenceMoney(budget, currency)} in the jar.`
        : 'Set a target to fill the jar.',
    );
  }
  if (step >= 5) parts.push('Ready to open.');
  return parts.join(' ');
}

// ---------------------------------------------------------------- demo (Landing)

/** Landing fixture: Tokyo autumn · 9D8N · RM 4,000. Days 1–3 add up to RM 1,212; the trip ends on RM 3,688. */
export const DEMO_TRIP: TripPlotTrip = {
  id: 0,
  name: 'Tokyo autumn',
  destinationCountry: 'JP',
  startDate: '2026-11-12',
  endDate: '2026-11-20',
  budget: 4000,
  currency: 'MYR',
  budgetType: 'solo',
};
export const DEMO_DAILY = [440, 418, 354, 398, 512, 286, 463, 377, 440] as const;
/** One unit across all three acts so stacks don't rescale between them. */
const DEMO_UNIT = 50;
export const DEMO_ACT_MS = 6000;

export interface DemoActInfo {
  act: DemoAct;
  key: 'ISI' | 'JALAN' | 'BALIK';
  /** Chip text under the scene (Plex Mono). */
  chip: string;
  /** DOM caption for the act. */
  caption: string;
  /** Frames and their start time (ms) inside the act. */
  frames: ReadonlyArray<{ frame: DemoFrame; at: number }>;
}

export const DEMO_ACTS: readonly DemoActInfo[] = [
  {
    act: 1,
    key: 'ISI',
    chip: '01 ISI fill it',
    caption: 'RM 4,000 in the jar',
    frames: [
      { frame: 'isi-empty', at: 0 },
      { frame: 'isi-full', at: 600 },
      { frame: 'isi-closed', at: 1700 },
    ],
  },
  {
    act: 2,
    key: 'JALAN',
    chip: '02 JALAN spend through it',
    caption: 'Day 3 · RM 1,212 spent · ≈ RM 398 a day left',
    frames: [
      { frame: 'jalan-1', at: 0 },
      { frame: 'jalan-2', at: 1500 },
      { frame: 'jalan-3', at: 3000 },
    ],
  },
  {
    act: 3,
    key: 'BALIK',
    chip: '03 BALIK keep the receipt',
    caption: 'Back with RM 312 baki',
    frames: [{ frame: 'balik', at: 0 }],
  },
];

const DEMO_START = parseLocalDate(DEMO_TRIP.startDate);

function demoExpenses(throughDay: number): TripPlotExpense[] {
  return DEMO_DAILY.slice(0, throughDay).map((amount, i) => ({ expenseDate: toISODate(addCalendarDays(DEMO_START, i)), amount }));
}

/** The demo spec for one frame of the Landing acts. Pure; the same frame always gives the same spec. */
export function mapTripPlotDemo(frame: DemoFrame, opts: { homeCountry?: string | null } = {}): TripPlotSpec {
  const act: DemoAct = frame.startsWith('isi') ? 1 : frame.startsWith('jalan') ? 2 : 3;
  const day = frame.startsWith('jalan') ? Number(frame.slice(6)) : frame === 'balik' ? DEMO_DAILY.length : 0;
  const today = act === 1 ? addCalendarDays(DEMO_START, -11) : act === 2 ? addCalendarDays(DEMO_START, day - 1) : addCalendarDays(DEMO_START, 10);
  const expenses = demoExpenses(day);
  const spent = expenses.reduce((n, e) => n + e.amount, 0);
  const fund = computeFund(DEMO_TRIP, today, { spent });
  const spec = buildPlot({
    mode: 'demo',
    trip: DEMO_TRIP,
    fund,
    phase: fund.phase,
    today,
    expenses,
    homeCountry: opts.homeCountry,
    opts: { coinUnit: DEMO_UNIT, balikSeen: false },
  });
  const info = DEMO_ACTS[act - 1];
  if (act === 1) {
    const filled = frame !== 'isi-empty';
    spec.jars = spec.jars.map((j) => ({ ...j, fill: filled ? 1 : 0, lid: frame === 'isi-closed' ? 'closed' : 'off' }));
    spec.labels = spec.labels.filter((l) => l.id !== 'jar' || filled);
  }
  spec.summary = `${DEMO_TRIP.name}, ${durationLabel(DEMO_DAILY.length)}, RM 4,000. ${info.caption}.`;
  spec.demo = { act, frame };
  return spec;
}

// ---------------------------------------------------------------- hooks (stateful; pages only)

/** localStorage key for the BALIK moment (§13). */
export const balikKey = (tripId: number) => `travelluhh_balik_seen_${tripId}`;

export function readBalikSeen(tripId: number): boolean {
  try {
    return window.localStorage.getItem(balikKey(tripId)) === '1';
  } catch {
    return false;
  }
}

export function markBalikSeen(tripId: number): void {
  try {
    window.localStorage.setItem(balikKey(tripId), '1');
  } catch {
    // storage blocked: the stamp may play again next visit, which is harmless
  }
}

/**
 * True on the first view of a completed, under-budget trip (pass `eligible` once the trip has loaded), then
 * remembered. Feed `!play` to mapTripPlot's `balikSeen`, and play the stamp-in when it's true.
 */
export function useBalikMoment(tripId: number | null | undefined, eligible: boolean): boolean {
  const [play, setPlay] = useState(false);
  useEffect(() => {
    if (!eligible || tripId == null) return;
    if (!readBalikSeen(tripId)) {
      setPlay(true);
      markBalikSeen(tripId);
    }
  }, [eligible, tripId]);
  return play;
}

export interface TripPlotDemo {
  act: DemoAct;
  frame: DemoFrame;
  spec: TripPlotSpec;
  caption: string;
  acts: readonly DemoActInfo[];
  /** Still auto-advancing (false after the first interaction, and always under reduced motion). */
  auto: boolean;
  /** Pick an act (a chip tap). Counts as interaction: auto-advance stops and that act plays from its start. */
  select: (act: DemoAct) => void;
  /** Stop auto-advance without changing the act (any other interaction with the hero). */
  stop: () => void;
}

/**
 * Landing demo timeline: acts ISI → JALAN → BALIK, one every 6 s, looping until the first interaction.
 * Under reduced motion it never advances and shows act 3's final frame; picking an act shows its last frame.
 *
 *   const demo = useTripPlotDemo();
 *   <IsoStage spec={demo.spec} mode="demo" height={{ base: 300, lg: 560 }} footer={null} />
 *   {demo.acts.map((a) => <button aria-pressed={a.act === demo.act} onClick={() => demo.select(a.act)}>{a.chip}</button>)}
 *   <p>{demo.caption}</p>
 */
export function useTripPlotDemo(opts: { reducedMotion?: boolean; homeCountry?: string | null; actMs?: number } = {}): TripPlotDemo {
  const systemReduced = useReducedMotion();
  const reduced = opts.reducedMotion ?? systemReduced;
  const actMs = opts.actMs ?? DEMO_ACT_MS;
  const [state, setState] = useState<{ act: DemoAct; frame: number; auto: boolean; run: number }>(() =>
    reduced ? { act: 3, frame: 0, auto: false, run: 0 } : { act: 1, frame: 0, auto: true, run: 0 },
  );

  // Reduced motion switched on mid-way: settle on the final frame of act 3 and stop.
  useEffect(() => {
    if (reduced) setState((s) => (s.auto ? { act: 3, frame: DEMO_ACTS[2].frames.length - 1, auto: false, run: s.run + 1 } : s));
  }, [reduced]);

  const info = DEMO_ACTS[state.act - 1];
  const frameIdx = reduced ? info.frames.length - 1 : Math.min(state.frame, info.frames.length - 1);

  // Frames inside the act.
  useEffect(() => {
    if (reduced) return;
    const next = info.frames[frameIdx + 1];
    if (!next) return;
    const t = window.setTimeout(() => setState((s) => ({ ...s, frame: frameIdx + 1 })), next.at - info.frames[frameIdx].at);
    return () => window.clearTimeout(t);
  }, [reduced, info, frameIdx, state.run]);

  // The next act, while auto.
  useEffect(() => {
    if (reduced || !state.auto) return;
    const t = window.setTimeout(
      () => setState((s) => ({ act: ((s.act % 3) + 1) as DemoAct, frame: 0, auto: s.auto, run: s.run + 1 })),
      actMs,
    );
    return () => window.clearTimeout(t);
  }, [reduced, state.auto, state.act, state.run, actMs]);

  const select = useCallback((act: DemoAct) => setState((s) => ({ act, frame: 0, auto: false, run: s.run + 1 })), []);
  const stop = useCallback(() => setState((s) => (s.auto ? { ...s, auto: false } : s)), []);

  const frame = info.frames[frameIdx].frame;
  const homeCountry = opts.homeCountry;
  const spec = useMemo(() => mapTripPlotDemo(frame, { homeCountry }), [frame, homeCountry]);
  return { act: state.act, frame, spec, caption: info.caption, acts: DEMO_ACTS, auto: state.auto && !reduced, select, stop };
}
