// Pace chart (§9.6 Fund tab 2), lazy-loaded so Recharts only ships with the Fund tab. Cumulative spend as a
// 2px fund line against a dashed ink-3 even-pace line, today as a brass dot. One y-axis; hairline grid; no
// draw-in animation (motion only reports a change, §10). A ReceiptSlip tooltip follows the pointer and focus.
import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { tokens } from '@/design/tokens';
import { useThemeName } from '@/components/theme/ThemeProvider';
import { ReceiptLine, ReceiptRule, ReceiptSlip } from '@/components/motifs';
import { formatMoney } from '@/lib/money';
import { axisMoney } from '@/components/trip/tripCopy';
import { formatWeekdayDayMonth } from '@/lib/dates';
import type { PacePoint } from '@/components/trip/fund/fundMath';

export interface PaceChartProps {
  points: PacePoint[];
  currency: string;
  /** Accessible summary of the chart (the pace sentence). */
  summary: string;
}

const MONO = '"IBM Plex Mono", ui-monospace, monospace';

function PaceTooltip({ active, payload, currency }: TooltipProps<number, string> & { currency: string }) {
  const point = payload?.[0]?.payload as PacePoint | undefined;
  if (!active || !point) return null;
  const diff = point.spent != null && point.even != null ? point.spent - point.even : null;
  return (
    <ReceiptSlip raised className="min-w-[200px] px-3 pb-4 pt-2.5 text-ink">
      <p className="type-overline text-ink-2">
        Day {point.day} · {formatWeekdayDayMonth(point.date)}
        {point.isToday ? ' · today' : ''}
      </p>
      <ReceiptRule className="my-2" />
      <ReceiptLine label="Spent so far" value={point.spent != null ? formatMoney(point.spent, currency) : 'Not yet'} />
      {point.even != null ? <ReceiptLine label="Even pace" value={formatMoney(point.even, currency)} /> : null}
      {diff != null ? (
        <ReceiptLine
          strong
          label={diff > 0 ? 'Above even pace' : 'Below even pace'}
          value={formatMoney(Math.abs(diff), currency)}
        />
      ) : null}
    </ReceiptSlip>
  );
}

export default function PaceChart({ points, currency, summary }: PaceChartProps) {
  const theme = useThemeName();
  const t = tokens[theme];
  const today = useMemo(() => points.find((p) => p.isToday && p.spent != null) ?? null, [points]);
  const hasEven = points.some((p) => p.even != null);
  const tickEvery = points.length > 14 ? Math.ceil(points.length / 7) : 1;

  return (
    <figure className="m-0">
      <figcaption className="sr-only">{summary}</figcaption>
      <div aria-hidden="true" className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-ink-2">
        <span className="type-label inline-flex items-center gap-2">
          <svg width="20" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="20" y2="4" stroke={t.fund} strokeWidth="2" />
          </svg>
          Spent so far
        </span>
        {hasEven ? (
          <span className="type-label inline-flex items-center gap-2">
            <svg width="20" height="8" aria-hidden="true">
              <line x1="0" y1="4" x2="20" y2="4" stroke={t.ink3} strokeWidth="1.5" strokeDasharray="4 3" />
            </svg>
            Even pace
          </span>
        ) : null}
        {today ? (
          <span className="type-label inline-flex items-center gap-2">
            <svg width="10" height="10" aria-hidden="true">
              <circle cx="5" cy="5" r="4" fill={t.brass} />
            </svg>
            Today
          </span>
        ) : null}
      </div>
      <div className="h-[220px] w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={t.rule} strokeWidth={1} />
            <XAxis
              dataKey="day"
              interval={tickEvery - 1}
              tickFormatter={(d: number) => `D${d}`}
              tick={{ fill: t.ink2, fontSize: 12, fontFamily: MONO }}
              axisLine={{ stroke: t.ruleStrong }}
              tickLine={false}
              tickMargin={6}
            />
            <YAxis
              width={64}
              tickFormatter={(v: number) => axisMoney(v, currency)}
              tick={{ fill: t.ink2, fontSize: 12, fontFamily: MONO }}
              axisLine={false}
              tickLine={false}
              tickCount={5}
            />
            <Tooltip
              cursor={{ stroke: t.ruleStrong, strokeWidth: 1 }}
              isAnimationActive={false}
              content={<PaceTooltip currency={currency} />}
              wrapperStyle={{ outline: 'none' }}
            />
            {hasEven ? (
              <Line
                type="linear"
                dataKey="even"
                stroke={t.ink3}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            ) : null}
            <Line
              type="linear"
              dataKey="spent"
              stroke={t.fund}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: t.fund, stroke: t.leaf, strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
            {today ? (
              <ReferenceDot x={today.day} y={today.spent ?? 0} r={5} fill={t.brass} stroke={t.leaf} strokeWidth={2} isFront />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
