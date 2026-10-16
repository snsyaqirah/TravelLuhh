// The selected day as a transit line (§9.6 Days): a 2px ink line with 10px stations, the start time in a
// Plex Mono column, each stop as a mini ticket. Stops without a time collect under "Unscheduled" on a dashed
// stretch of line at the bottom. A station is filled once the stop is behind you, hollow while it's ahead.
import { useLayoutEffect, useRef, useState } from 'react';
import type { ItineraryItem } from '@/types';
import { TripTicket } from '@/components/motifs';
import { IsoGlyph } from '@/components/glyphs';
import { itineraryCategoryMeta, normalizeItineraryCategory } from '@/data/itinerary';
import { hhmm, isStopPast, splitDayItems } from './days';

export interface DayTimelineProps {
  items: readonly ItineraryItem[];
  now: Date;
  canEdit: boolean;
  onEdit: (item: ItineraryItem) => void;
  onDelete: (item: ItineraryItem) => void;
}

// Columns: time 48px, station 20px (line and dot centred), ticket. 8px gaps.
const TIME_COL = 48;
const STATION_COL = 20;
const GAP = 8;
const LINE_LEFT = TIME_COL + GAP + STATION_COL / 2 - 1; // left edge of the 2px line
const GRID = { gridTemplateColumns: `${TIME_COL}px ${STATION_COL}px minmax(0,1fr)`, columnGap: GAP };

function Station({ past, dashed }: { past: boolean; dashed?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      data-station={dashed ? 'unscheduled' : 'scheduled'}
      width="10"
      height="10"
      viewBox="0 0 10 10"
      className="relative z-[1] text-ink"
    >
      <circle
        cx="5"
        cy="5"
        r="4"
        strokeWidth="2"
        stroke="currentColor"
        strokeDasharray={dashed ? '2.1 2' : undefined}
        className={past ? 'fill-ink' : 'fill-background'}
      />
    </svg>
  );
}

interface RowProps {
  item: ItineraryItem;
  now: Date;
  canEdit: boolean;
  onEdit: (item: ItineraryItem) => void;
  onDelete: (item: ItineraryItem) => void;
  unscheduled?: boolean;
}

function StopRow({ item, now, canEdit, onEdit, onDelete, unscheduled }: RowProps) {
  const start = hhmm(item.startTime);
  const end = hhmm(item.endTime);
  const cat = normalizeItineraryCategory(item.category);
  const meta = cat ? itineraryCategoryMeta(cat) : null;
  const past = !unscheduled && isStopPast(item.itemDate, item.startTime, now);
  const details = [meta?.label, end && start ? `until ${end}` : '', item.description?.trim()].filter(Boolean);

  return (
    <li className="grid items-start" style={GRID}>
      <p className="pt-[10px] text-right font-mono text-[14px] font-medium leading-5 text-ink">
        {start ? <time dateTime={start}>{start}</time> : <span className="sr-only">No time set.</span>}
      </p>
      <span className="flex justify-center pt-[15px]">
        <Station past={past} dashed={unscheduled} />
      </span>
      <TripTicket
        variant="mini"
        title={item.title}
        location={item.location}
        glyph={<IsoGlyph name={meta?.glyph ?? 'other'} tone={meta?.tone} size={24} />}
        meta={details.length ? details.join(' · ') : undefined}
        onEdit={canEdit ? () => onEdit(item) : undefined}
        onDelete={canEdit ? () => onDelete(item) : undefined}
      />
    </li>
  );
}

interface Lines {
  solid: { top: number; height: number } | null;
  dashed: { top: number; height: number } | null;
}

/** Measures the stations so the line runs exactly from the first to the last, whatever the ticket heights. */
function useTransitLines(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<Lines>({ solid: null, dashed: null });

  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const measure = () => {
      const top0 = box.getBoundingClientRect().top;
      const centre = (el: Element) => el.getBoundingClientRect().top - top0 + 5;
      const sched = [...box.querySelectorAll('[data-station="scheduled"]')].map(centre);
      const uns = [...box.querySelectorAll('[data-station="unscheduled"]')].map(centre);
      const solid = sched.length > 1 ? { top: sched[0], height: sched[sched.length - 1] - sched[0] } : null;
      const from = sched.length ? sched[sched.length - 1] : uns[0];
      const dashed = uns.length && from !== undefined ? { top: from, height: uns[uns.length - 1] - from } : null;
      setLines((prev) =>
        prev.solid?.top === solid?.top &&
        prev.solid?.height === solid?.height &&
        prev.dashed?.top === dashed?.top &&
        prev.dashed?.height === dashed?.height
          ? prev
          : { solid, dashed: dashed && dashed.height > 0 ? dashed : null }
      );
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [dep]);

  return { ref, lines };
}

export function DayTimeline({ items, now, canEdit, onEdit, onDelete }: DayTimelineProps) {
  const { scheduled, unscheduled } = splitDayItems(items);
  const { ref, lines } = useTransitLines(items);
  const row = { now, canEdit, onEdit, onDelete };

  return (
    <div ref={ref} className="relative">
      {lines.solid ? (
        <span
          aria-hidden="true"
          className="absolute w-[2px] bg-ink"
          style={{ left: LINE_LEFT, top: lines.solid.top, height: lines.solid.height }}
        />
      ) : null}
      {lines.dashed ? (
        <span
          aria-hidden="true"
          className="absolute w-0 border-l-2 border-dashed border-rule-strong"
          style={{ left: LINE_LEFT, top: lines.dashed.top, height: lines.dashed.height }}
        />
      ) : null}

      {scheduled.length ? (
        <ol aria-label="Stops in time order" className="space-y-3">
          {scheduled.map((it) => (
            <StopRow key={it.id} item={it} {...row} />
          ))}
        </ol>
      ) : null}

      {unscheduled.length ? (
        <section aria-labelledby="unscheduled-heading" className={scheduled.length ? 'mt-5' : undefined}>
          <h4
            id="unscheduled-heading"
            className="type-overline mb-2 text-ink-2"
            style={{ marginLeft: TIME_COL + GAP + STATION_COL + GAP }}
          >
            Unscheduled
          </h4>
          <ol className="space-y-3">
            {unscheduled.map((it) => (
              <StopRow key={it.id} item={it} {...row} unscheduled />
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
