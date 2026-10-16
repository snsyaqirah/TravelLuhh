// Passport stamp (§5.4). Earned only: BALIK, SIAP, SETTLED, OVER, CUKUP, and one per visited country on the
// Passport page. The outline is the region (circle Asia, rectangle Europe, octagon Americas, triangle Africa +
// Middle East, oval Oceania); a 2px outer and 1px inner ring, words on the band, the ISO code in the middle.
// Ink bleeds a little (feTurbulence + feDisplacementMap) and the stamp lands at a seeded angle.
import { useEffect, useId, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { formatDayMonth, formatShortDate } from '@/lib/dates';
import type { Region } from '@/types';
import { stampShapeFor, type StampShape } from '@/components/motifs/regions';
import { stampNoiseSeed, stampRotation } from '@/components/motifs/stampMath';

export interface PassportStampProps {
  /** Top text: BALIK, SIAP, SETTLED, OVER, CUKUP or a country name. */
  text: string;
  /** Small line under the code (e.g. the year). */
  sub?: string;
  /** ISO code in the centre. */
  code?: string;
  /** Bottom text. 'YYYY-MM-DD' strings print as '21 NOV'; other strings print as given. */
  date?: string;
  region: Region;
  tone?: 'stamp' | 'fund';
  /** Seeds the angle and the ink, e.g. the trip id. */
  seed: string | number;
  size?: 48 | 64 | 96;
  /** Play stamp-in (180 ms) and nudge the parent once. Off under reduced motion. */
  animate?: boolean;
  /** Accessible name. Default "BALIK stamp, 21 Nov". */
  title?: string;
  /** When the same fact is already in text nearby. */
  decorative?: boolean;
  className?: string;
}

const C = 50; // viewBox centre (0 0 100 100)
const MONO = '"IBM Plex Mono", ui-monospace, monospace';
const ADVANCE = 0.6; // Plex Mono glyph advance, in em

interface Fonts {
  ring: number;
  date: number;
  centre: number;
}

/** Ring text is unreadable on a 48px stamp, so the small one carries only its centre word. */
const FONTS: Record<48 | 64 | 96, Fonts> = {
  48: { ring: 0, date: 0, centre: 24 },
  64: { ring: 12.5, date: 10, centre: 22 },
  96: { ring: 11, date: 9, centre: 22 },
};

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function polygon(n: number, r: number, rot: number, cy = C): string {
  return Array.from({ length: n }, (_, i) => {
    const a = rot + (i / n) * Math.PI * 2;
    return `${(C + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`;
  }).join(' ');
}

/** Outline elements for the outer (2px) and inner (1px) rings. */
function rings(shape: StampShape, outerW: number, innerW: number) {
  const common = { fill: 'none', stroke: 'currentColor' } as const;
  switch (shape) {
    case 'circle':
      return (
        <>
          <circle cx={C} cy={C} r={47} strokeWidth={outerW} {...common} />
          <circle cx={C} cy={C} r={31} strokeWidth={innerW} {...common} />
        </>
      );
    case 'oval':
      return (
        <>
          <ellipse cx={C} cy={C} rx={48} ry={37} strokeWidth={outerW} {...common} />
          <ellipse cx={C} cy={C} rx={34} ry={23} strokeWidth={innerW} {...common} />
        </>
      );
    case 'rect':
      return (
        <>
          <rect x={3} y={13} width={94} height={74} rx={3} strokeWidth={outerW} {...common} />
          <rect x={9} y={28} width={82} height={44} rx={1.5} strokeWidth={innerW} {...common} />
        </>
      );
    case 'octagon':
      return (
        <>
          <polygon points={polygon(8, 48, Math.PI / 8)} strokeWidth={outerW} {...common} />
          <polygon points={polygon(8, 33, Math.PI / 8)} strokeWidth={innerW} {...common} />
        </>
      );
    case 'triangle':
      return (
        <>
          <polygon points="50,3 97,90 3,90" strokeWidth={outerW} strokeLinejoin="round" {...common} />
          <polygon points="50,15.6 87,84 13,84" strokeWidth={innerW} strokeLinejoin="round" {...common} />
        </>
      );
  }
}

type Band = { arc: readonly [number, number] } | { y: number; w: number };

interface Layout {
  top: Band | null;
  bottom: Band;
  centreY: number;
  /** Widest the centre text may be. */
  centreW: number;
  /** Round stamps put a dot where the two bands meet. */
  dots?: number;
  /** Fixed baseline for the line under the centre (triangle); otherwise it follows the centre text. */
  underY?: number;
}

/** Where the words go for each outline: arcs on round stamps, straight bands otherwise. */
const LAYOUT: Record<StampShape, Layout> = {
  circle: { top: { arc: [39, 39] }, bottom: { arc: [41.5, 41.5] }, centreY: C, centreW: 56, dots: 39 },
  oval: { top: { arc: [41, 30] }, bottom: { arc: [43.5, 32.5] }, centreY: C, centreW: 62, dots: 41 },
  rect: { top: { y: 20.5, w: 86 }, bottom: { y: 80, w: 86 }, centreY: C, centreW: 76 },
  octagon: { top: { y: 14, w: 52 }, bottom: { y: 86, w: 52 }, centreY: C, centreW: 58 },
  // A triangle's band is too thin for words, so everything stacks inside it: code, word, date.
  triangle: { top: null, bottom: { y: 70, w: 52 }, centreY: 52, centreW: 30, underY: 82 },
};

/** textLength when mono text would overflow `width`, so long words squeeze instead of spilling. */
function fit(text: string, font: number, width: number, tracking: number) {
  const natural = text.length * font * (ADVANCE + tracking);
  return natural > width ? width : undefined;
}

const TEXT = { fill: 'currentColor', fontFamily: MONO, fontWeight: 600, textAnchor: 'middle' } as const;

/** A line of stamp text along a band: on an arc path (round stamps) or straight, squeezed to fit. */
function BandText({
  band,
  pathId,
  text,
  font,
  tracking,
  below,
}: {
  band: Band;
  pathId: string;
  text: string;
  font: number;
  tracking: number;
  /** Lower band: glyphs hang inward from the outer edge. */
  below?: boolean;
}) {
  if ('arc' in band) {
    return (
      <text {...TEXT} fontSize={font} letterSpacing={font * tracking} dy={below ? -font * 0.05 : font * 0.36}>
        <textPath href={`#${pathId}`} startOffset="50%">
          {text}
        </textPath>
      </text>
    );
  }
  return (
    <text
      {...TEXT}
      x={C}
      y={band.y + font * 0.36}
      fontSize={font}
      letterSpacing={font * tracking}
      textLength={fit(text, font, band.w, tracking)}
      lengthAdjust="spacingAndGlyphs"
    >
      {text}
    </text>
  );
}

export function PassportStamp({
  text,
  sub,
  code,
  date,
  region,
  tone = 'stamp',
  seed,
  size = 64,
  animate = false,
  title,
  decorative,
  className,
}: PassportStampProps) {
  const uid = useId().replace(/:/g, '');
  const ref = useRef<SVGSVGElement>(null);
  const reduce = useReducedMotion();
  const play = animate && !reduce;
  const shape = stampShapeFor(region);
  const rotation = stampRotation(seed, text);
  const fonts = FONTS[size] ?? FONTS[64];
  const scale = size / 100;
  const outerW = 2 / scale;
  const innerW = 1 / scale;
  const word = text.toUpperCase();
  const dateText = date ? (isoDate.test(date) ? formatDayMonth(date) : date.toUpperCase()) : '';
  const layout = LAYOUT[shape];
  const small = fonts.ring === 0;
  const tracking = 0.12;

  // Slots. Small stamps carry only their centre. Without a code the word moves to the centre.
  let topText = '';
  let bottomText = '';
  let centreText = '';
  let underText = sub ? sub.toUpperCase() : '';
  if (small) {
    centreText = code ?? word;
    underText = '';
  } else if (shape === 'triangle') {
    centreText = code ?? word;
    bottomText = code ? word : dateText;
    if (code && dateText) underText = dateText;
  } else {
    topText = code ? word : '';
    centreText = code ?? word;
    bottomText = dateText;
  }
  const centreFont = small && shape === 'triangle' ? 20 : small || code ? fonts.centre : Math.round(fonts.centre * 0.68);
  // The small triangle's centre sits low, where the shape is wide enough for a word.
  const centreY = small && shape === 'triangle' ? 62 : layout.centreY;
  const shiftForUnder = underText && layout.underY == null ? 4 : 0;
  const bandFont = (slot: 'top' | 'bottom') => (slot === 'top' || shape === 'triangle' ? fonts.ring : fonts.date);

  // One-frame 2px nudge of whatever the stamp landed on (§10).
  useEffect(() => {
    if (!play) return;
    const parent = ref.current?.parentElement;
    if (!parent) return;
    parent.classList.add('animate-stamp-shake');
    const done = () => parent.classList.remove('animate-stamp-shake');
    const t = window.setTimeout(done, 260);
    return () => {
      window.clearTimeout(t);
      done();
    };
  }, [play]);

  const spokenDate = date ? (isoDate.test(date) ? formatShortDate(date) : date) : '';
  const label = title ?? `${word} stamp${spokenDate ? `, ${spokenDate}` : ''}`;
  const pathTop = `st-top-${uid}`;
  const pathBottom = `st-bot-${uid}`;
  const filterId = `st-ink-${uid}`;

  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={cn('shrink-0 overflow-visible', tone === 'fund' ? 'text-fund' : 'text-stamp', play && 'animate-stamp-in', className)}
      style={{ transform: `rotate(${rotation}deg)`, opacity: play ? undefined : 0.85 }}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      focusable="false"
      data-shape={shape}
      data-rotation={rotation}
    >
      <defs>
        <filter id={filterId} x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves={2} seed={stampNoiseSeed(seed, text)} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {layout.top && 'arc' in layout.top ? (
          <path id={pathTop} d={`M${C - layout.top.arc[0]},${C}A${layout.top.arc[0]},${layout.top.arc[1]} 0 0 1 ${C + layout.top.arc[0]},${C}`} />
        ) : null}
        {'arc' in layout.bottom ? (
          <path
            id={pathBottom}
            d={`M${C - layout.bottom.arc[0]},${C}A${layout.bottom.arc[0]},${layout.bottom.arc[1]} 0 0 0 ${C + layout.bottom.arc[0]},${C}`}
          />
        ) : null}
      </defs>
      <g filter={`url(#${filterId})`}>
        {rings(shape, outerW, innerW)}

        {topText && layout.top ? <BandText band={layout.top} pathId={pathTop} text={topText} font={bandFont('top')} tracking={tracking} /> : null}
        {bottomText ? (
          <BandText band={layout.bottom} pathId={pathBottom} text={bottomText} font={bandFont('bottom')} tracking={0.1} below />
        ) : null}

        {!small && layout.dots ? (
          <>
            <circle cx={C - layout.dots} cy={C} r={1.8} fill="currentColor" />
            <circle cx={C + layout.dots} cy={C} r={1.8} fill="currentColor" />
          </>
        ) : null}

        {centreText ? (
          <text
            {...TEXT}
            x={C}
            y={centreY + centreFont * 0.36 - shiftForUnder}
            fontSize={centreFont}
            letterSpacing={centreFont * 0.06}
            textLength={fit(centreText, centreFont, small && shape === 'triangle' ? 36 : layout.centreW, 0.06)}
            lengthAdjust="spacingAndGlyphs"
          >
            {centreText}
          </text>
        ) : null}
        {underText ? (
          <text {...TEXT} x={C} y={layout.underY ?? centreY + centreFont * 0.36 + 8} fontSize={8} letterSpacing={0.8} fontWeight={500}>
            {underText}
          </text>
        ) : null}
      </g>
    </svg>
  );
}
