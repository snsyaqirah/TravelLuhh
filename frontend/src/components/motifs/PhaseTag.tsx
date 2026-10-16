// Luggage tag for a trip's phase (§2.2, §5.4): clipped corner, punched hole, mono capitals.
// Each phase has its own fill *and* its own words, so the tag never relies on colour.
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import type { Phase } from '@/lib/phase';
import { phaseTagText } from '@/components/motifs/tripMeta';

export interface PhaseTagProps {
  phase: Phase;
  /** upcoming: whole days until the start. */
  daysToGo?: number;
  /** onTheRoad: 1-based day. */
  day?: number;
  totalDays?: number;
  /** home: the trip's end date ('YYYY-MM-DD' or Date). */
  homeDate?: string | Date;
  /** Phase B: an upcoming trip with fund entries reads SAVING. */
  saving?: boolean;
  className?: string;
}

const LOOK: Record<Phase, string> = {
  upcoming: 'bg-fund-tint text-fund',
  // warning-foreground is ink on light and near-black on dark, so the brass tag stays readable in both.
  onTheRoad: 'bg-brass text-warning-foreground',
  home: 'bg-sunken text-ink-2',
};

// 6px clipped top-left corner, and a 4px hole punched 7px from the left edge.
const SHAPE: CSSProperties = {
  clipPath: 'polygon(6px 0, 100% 0, 100% 100%, 0 100%, 0 6px)',
  WebkitMaskImage: 'radial-gradient(circle at 7px 50%, transparent 2px, black 2.5px)',
  maskImage: 'radial-gradient(circle at 7px 50%, transparent 2px, black 2.5px)',
};

export function PhaseTag({ className, ...props }: PhaseTagProps) {
  const { text, spoken } = phaseTagText(props);
  return (
    <span
      data-phase={props.phase}
      style={SHAPE}
      className={cn('type-overline inline-flex h-6 shrink-0 items-center whitespace-nowrap pl-[15px] pr-2', LOOK[props.phase], className)}
    >
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">{spoken}</span>
    </span>
  );
}
