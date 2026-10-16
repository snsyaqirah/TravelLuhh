// Day strip (§9.6 Days): one ticket stub per day, scrolling sideways. Each stub carries the day number and
// date, a dot when the day has stops, the stop count and that day's spend in mono. Today's stub has a brass
// top edge; the selected one is picked up (ink border + hard shadow).
// Keyboard: it is a tablist with a roving tab stop. Arrow keys move and select, Home/End jump to the ends.
import { useEffect, useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { dayTabId, stopCount, type DayStub } from './days';

export interface DayStripProps {
  days: readonly DayStub[];
  selected: string;
  onSelect: (iso: string) => void;
  /** iso → number of stops */
  counts: Readonly<Record<string, number>>;
  /** iso → spend that day, trip currency */
  spentByDay: Readonly<Record<string, number>>;
  currency: string;
  /** id of the panel the tabs control */
  panelId: string;
  idBase: string;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
}

export function DayStrip({ days, selected, onSelect, counts, spentByDay, currency, panelId, idBase }: DayStripProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  // Keep the selected stub in view without moving the page vertically (scrollIntoView would).
  useLayoutEffect(() => {
    const box = scroller.current;
    const el = box?.querySelector<HTMLElement>(`[data-iso="${selected}"]`);
    if (!box || !el) return;
    const left = el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2;
    const target = Math.max(0, Math.min(left, box.scrollWidth - box.clientWidth));
    if (Math.abs(box.scrollLeft - target) < 1) return;
    box.scrollTo({ left: target, behavior: first.current || prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [selected, days.length]);
  useEffect(() => {
    first.current = false;
  }, []);

  const move = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(days.length - 1, i + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = Math.max(0, i - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = days.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const iso = days[next].iso;
    onSelect(iso);
    scroller.current?.querySelector<HTMLButtonElement>(`[data-iso="${iso}"]`)?.focus();
  };

  return (
    <div
      ref={scroller}
      // the 3px top/right padding leaves room for the selected stub's hard shadow inside the scroll box
      className="scrollbar-none -mx-4 overflow-x-auto px-4 pb-1 pt-1 md:mx-0 md:px-0"
    >
      <div role="tablist" aria-label="Days of the trip" aria-orientation="horizontal" className="flex w-max gap-2 pr-1">
        {days.map((d, i) => {
          const isSel = d.iso === selected;
          const n = counts[d.iso] ?? 0;
          const spent = spentByDay[d.iso] ?? 0;
          const spoken = [
            d.index ? `Day ${d.index}` : d.overline === 'BEFORE' ? 'Before the trip' : 'After the trip',
            d.long,
            d.isToday ? 'today' : '',
            n ? stopCount(n) : 'no stops',
            spent > 0 ? `${formatMoney(spent, currency)} spent` : '',
          ]
            .filter(Boolean)
            .join(', ');
          return (
            <button
              key={d.iso}
              type="button"
              role="tab"
              id={dayTabId(idBase, d.iso)}
              data-iso={d.iso}
              aria-selected={isSel}
              aria-controls={panelId}
              aria-label={spoken}
              tabIndex={isSel ? 0 : -1}
              onClick={() => onSelect(d.iso)}
              onKeyDown={(e) => move(e, i)}
              className={cn(
                'pressable relative flex h-[88px] w-[84px] shrink-0 flex-col rounded-lg border bg-card px-2.5 pb-2 pt-2.5 text-left',
                isSel ? 'border-[1.5px] border-ink shadow-hard' : 'border-rule hover:border-rule-strong',
                d.index === null && !isSel && 'border-dashed'
              )}
            >
              {d.isToday ? (
                <span aria-hidden="true" className="absolute inset-x-0 -top-px h-[3px] rounded-t-lg bg-brass" />
              ) : null}
              <span className="flex w-full items-center justify-between">
                <span className={cn('type-overline', isSel ? 'text-ink' : 'text-ink-2')}>{d.overline}</span>
                {n > 0 ? (
                  <svg aria-hidden="true" width="6" height="6" viewBox="0 0 6 6" className="text-fund">
                    <circle cx="3" cy="3" r="3" fill="currentColor" />
                  </svg>
                ) : null}
              </span>
              <span aria-hidden="true" className="mt-0.5 font-mono text-[14px] font-medium leading-5 text-ink">
                {d.label}
              </span>
              <span aria-hidden="true" className="mt-auto font-mono text-[11px] leading-4 text-ink-3">
                {n ? stopCount(n) : 'Free'}
              </span>
              <span aria-hidden="true" className="font-mono text-[11px] leading-4 text-ink-2">
                {spent > 0 ? formatMoney(spent, currency, { decimals: 'none' }) : ' '}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
