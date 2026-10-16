// "When?" (§9.5 step 2, and the Edit sheet): a range calendar. The first tap sets the first day, the next tap
// the last day (an earlier day moves the start instead); a tap after that starts a new range. Live mono
// summary above: '12–20 OCT 2026 · 9D8N' and '9 days, 8 nights'.
import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { formatRange, isValidDate, parseLocalDate, toISODate } from '@/lib/dates';
import { durationLabel } from '@/lib/phase';
import { daysNightsLabel, draftDays } from '@/components/trips/create/createDraft';
import { cn } from '@/lib/utils';

export interface DateRangeFieldProps {
  start: string | null;
  end: string | null;
  onChange: (start: string | null, end: string | null) => void;
  /** id of the error message, for aria-describedby on the grid. */
  errorId?: string;
  invalid?: boolean;
  months?: 1 | 2;
  className?: string;
  /** Hide the summary line (the Edit sheet prints its own). */
  hideSummary?: boolean;
}

const asDate = (s: string | null) => {
  if (!s) return undefined;
  const d = parseLocalDate(s);
  return isValidDate(d) ? d : undefined;
};

export function DateRangeField({ start, end, onChange, errorId, invalid, months = 1, className, hideSummary }: DateRangeFieldProps) {
  // true between the first and the second tap
  const [pickingEnd, setPickingEnd] = useState(false);
  const from = asDate(start);
  const to = asDate(end) ?? from;
  const days = draftDays({ startDate: start, endDate: end });

  const onDay = (day: Date) => {
    const iso = toISODate(day);
    if (!from || !pickingEnd) {
      setPickingEnd(true);
      onChange(iso, iso);
      return;
    }
    if (day < from) {
      // Earlier than the first day: that becomes the first day; still waiting for the last.
      onChange(iso, toISODate(to ?? from));
      return;
    }
    setPickingEnd(false);
    onChange(toISODate(from), iso);
  };

  return (
    <div className={className}>
      {!hideSummary ? (
        <div className="flex min-h-12 flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-rule pb-2" aria-live="polite">
          {from ? (
            <>
              <span className="type-money-l text-ink">{formatRange(start ?? '', end ?? start ?? '')}</span>
              <span className="type-ledger text-[13px] text-ink-2">
                {durationLabel(days)} · {daysNightsLabel(days)}
              </span>
            </>
          ) : (
            <span className="type-body-s text-ink-2">Tap your first day, then your last day.</span>
          )}
        </div>
      ) : null}
      <div
        className={cn('mt-3 inline-block rounded-lg border bg-leaf', invalid ? 'border-stamp' : 'border-rule')}
        aria-describedby={errorId}
      >
        <Calendar
          mode="range"
          numberOfMonths={months}
          defaultMonth={from ?? new Date()}
          selected={from ? { from, to } : undefined}
          onDayClick={(day, modifiers) => {
            if (modifiers.disabled) return;
            onDay(day);
          }}
          weekStartsOn={1}
        />
      </div>
      {from && pickingEnd ? (
        <p className="type-body-s mt-2 text-ink-2">Now tap your last day. Same day again for a day trip.</p>
      ) : null}
    </div>
  );
}
