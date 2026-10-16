// The Landing passbook with two mono notes on leader lines (§9.1): "running balance, always" points at the last
// row's BAKI, "paid in JPY, counted in MYR" at its converted amount. Positions are measured from the rendered
// Passbook (table or two-line list, whichever its width picked), so the lines land on the real numbers.
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Passbook } from '@/components/motifs/Passbook';
import type { PassbookRow } from '@/components/motifs/passbookMath';
import { CategoryGlyph } from '@/components/glyphs/IsoGlyph';
import { useMediaQuery } from '@/components/shell/useMediaQuery';
import { cn } from '@/lib/utils';
import { DEMO_PASSBOOK_ROWS, DEMO_PASSBOOK_ROWS_MOBILE, DEMO_PASSBOOK_TRIP } from './demoPassbook';

const NOTES = {
  balance: 'running balance, always',
  converted: 'paid in JPY, counted in MYR',
} as const;
type NoteKey = keyof typeof NOTES;

interface Leader {
  key: NoteKey;
  /** Target point (wrapper px): the bottom centre of the number. */
  x: number;
  y: number;
  /** Where the note's first line sits. */
  depth: number;
  /** Right edge of the note text, and how wide it may grow. */
  textRight: number;
  maxWidth: number;
}

function visible(el: Element): boolean {
  return el.getClientRects().length > 0;
}

/** The balance and converted-amount elements of a rendered passbook row, in either layout. */
function targetsOf(row: HTMLElement): { balance: Element | null; converted: Element | null } {
  if (row.tagName === 'TR') {
    // glyph · date · details · KELUAR · (MASUK) · BAKI
    const out = row.children[3];
    return { balance: row.lastElementChild?.firstElementChild ?? null, converted: out?.lastElementChild ?? out ?? null };
  }
  // two-line list: line 1 = glyph, label ··· amount; line 2 = [code · BAKI value] [≈ converted]
  const body = row.firstElementChild;
  const line2 = body?.children[1];
  const baki = line2?.firstElementChild?.lastElementChild;
  return { balance: baki?.lastElementChild ?? baki ?? null, converted: line2?.children[1] ?? null };
}

function measure(wrap: HTMLElement, rowId: string | number): Leader[] | null {
  const row = Array.from(wrap.querySelectorAll<HTMLElement>(`[data-row="${rowId}"]`)).find(visible);
  const book = row?.closest('.rounded-lg');
  if (!row || !book) return null;
  const base = wrap.getBoundingClientRect();
  if (base.width === 0) return null;
  const { balance, converted } = targetsOf(row);
  if (!balance || !converted) return null;
  const pt = (el: Element) => {
    // The text's own box: amounts are right-aligned inside wider cells.
    let r = el.getBoundingClientRect();
    try {
      const range = document.createRange();
      range.selectNodeContents(el);
      const t = range.getBoundingClientRect();
      if (t.width > 0) r = t;
    } catch {
      // no Range layout (tests): the element box will do
    }
    return { x: r.left + r.width / 2 - base.left, y: r.bottom - base.top + 5 };
  };
  const bookBottom = book.getBoundingClientRect().bottom - base.top;
  const depth = bookBottom + 22;
  const pts = (
    [
      { key: 'balance' as const, ...pt(balance) },
      { key: 'converted' as const, ...pt(converted) },
    ] satisfies Array<{ key: NoteKey; x: number; y: number }>
  ).sort((a, b) => a.x - b.x);
  const [left, right] = pts;
  // Each note sits left of its own leader; the right one must also clear the left leader.
  const gap = 10;
  const leftMax = left.x - gap;
  const rightMax = right.x - gap - (left.x + 8);
  if (rightMax < 80) {
    // Too close together: stack the right note one level lower, full width.
    return [
      { ...left, depth, textRight: left.x - gap, maxWidth: leftMax },
      { ...right, depth: depth + 40, textRight: right.x - gap, maxWidth: right.x - gap },
    ];
  }
  return [
    { ...left, depth, textRight: left.x - gap, maxWidth: leftMax },
    { ...right, depth, textRight: right.x - gap, maxWidth: rightMax },
  ];
}

export function AnnotatedPassbook({ className }: { className?: string }) {
  const wide = useMediaQuery('(min-width: 640px)');
  const rows = useMemo<PassbookRow[]>(
    () =>
      (wide ? DEMO_PASSBOOK_ROWS : DEMO_PASSBOOK_ROWS_MOBILE).map(({ category, ...row }) =>
        category ? { ...row, glyph: <CategoryGlyph category={category} size={22} /> } : row,
      ),
    [wide],
  );
  const targetId = rows[rows.length - 1].id;
  const wrap = useRef<HTMLDivElement>(null);
  const [leaders, setLeaders] = useState<Leader[] | null>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setWidth(el.getBoundingClientRect().width);
        setLeaders(measure(el, targetId));
      });
    };
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    // Mono widths change once Plex Mono arrives.
    document.fonts?.ready.then(update).catch(() => {});
    return () => {
      cancelAnimationFrame(frame);
      ro?.disconnect();
    };
  }, [targetId]);

  return (
    <figure className={cn('relative pb-16', className)}>
      <div ref={wrap} className="relative">
        <Passbook
          rows={rows}
          currency={DEMO_PASSBOOK_TRIP.currency}
          tripStart={DEMO_PASSBOOK_TRIP.start}
          tripEnd={DEMO_PASSBOOK_TRIP.end}
          dailyAllowance={DEMO_PASSBOOK_TRIP.budget / DEMO_PASSBOOK_TRIP.days}
          caption="Example passbook for Tokyo autumn, a RM 4,000 trip, up to day 3"
        />
        {leaders ? (
          <>
            <svg aria-hidden="true" className="pointer-events-none absolute left-0 top-0 overflow-visible" width={width} height={1}>
              {leaders.map((l) => (
                <g key={l.key} stroke="hsl(var(--ink-2))" strokeWidth={1} fill="none">
                  <circle cx={l.x} cy={l.y} r={2.5} fill="hsl(var(--ink-2))" stroke="none" />
                  <path d={`M ${l.x} ${l.y} V ${l.depth} H ${l.textRight + 4}`} strokeDasharray="3 3" />
                </g>
              ))}
            </svg>
            {leaders.map((l) => (
              <span
                key={l.key}
                aria-hidden="true"
                className="absolute text-right font-mono text-[12px] leading-4 text-ink-2"
                style={{ top: l.depth - 8, right: width - l.textRight, maxWidth: l.maxWidth }}
              >
                {NOTES[l.key]}
              </span>
            ))}
          </>
        ) : null}
      </div>
      {/* Before layout (or without it), the notes still read as a caption. */}
      <figcaption className={cn('mt-4 font-mono text-[12px] leading-4 text-ink-2', leaders && 'sr-only')}>
        {NOTES.balance} · {NOTES.converted}
      </figcaption>
    </figure>
  );
}
