import * as React from "react";

import { cn } from "@/lib/utils";
import {
  BALANG_LID_TOP,
  BALANG_OUTLINE,
  BALANG_SEAMS,
  BALANG_SLOT,
  BALANG_STROKE,
  BALANG_VIEWBOX,
} from "@/components/brand/balangGeometry";

export type BrandTone = "ink" | "onFund" | "sidebar";

// stroke = outline colour, lid = lid-top fill, slot = the cut in the lid (contrasts with the lid fill).
const MARK_TONES: Record<BrandTone, { stroke: string; lid: string; slot: string }> = {
  ink: { stroke: "text-ink", lid: "fill-fund", slot: "stroke-on-fund" },
  onFund: { stroke: "text-on-fund", lid: "fill-brass", slot: "stroke-ink" },
  sidebar: { stroke: "text-sidebar-primary", lid: "fill-sidebar-primary", slot: "stroke-sidebar" },
};

const TEXT_TONES: Record<BrandTone, string> = {
  ink: "text-ink",
  onFund: "text-on-fund",
  sidebar: "text-sidebar-foreground",
};

export interface BalangMarkProps extends Omit<React.SVGProps<SVGSVGElement>, "ref"> {
  /** Rendered size in px. The mark is designed on a 20px grid. */
  size?: number;
  tone?: BrandTone;
  /** Accessible name. Omit when the mark sits next to the wordmark text (it is then decorative). */
  title?: string;
}

/** The balang (Raya cookie jar) with a coin slot: every trip is a tabung. Isometric, §7.1 projection. */
export function BalangMark({ size = 20, tone = "ink", title, className, ...props }: BalangMarkProps) {
  const t = MARK_TONES[tone];
  return (
    <svg
      viewBox={BALANG_VIEWBOX}
      width={size}
      height={size}
      fill="none"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      className={cn("shrink-0", t.stroke, className)}
      {...props}
    >
      <g stroke="currentColor" strokeWidth={BALANG_STROKE} strokeLinecap="round" strokeLinejoin="round">
        <path d={BALANG_OUTLINE} />
        <path d={BALANG_SEAMS} />
        <path d={BALANG_LID_TOP} className={t.lid} />
        <path d={BALANG_SLOT} className={t.slot} />
      </g>
    </svg>
  );
}

const SIZES = {
  sm: { text: "text-[17px] leading-5", mark: 18, gap: "gap-1.5" },
  md: { text: "text-[22px] leading-6", mark: 20, gap: "gap-2" },
  lg: { text: "text-[32px] leading-9", mark: 28, gap: "gap-2.5" },
} as const;

export interface WordmarkProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: keyof typeof SIZES;
  tone?: BrandTone;
  /** Hide the balang, e.g. where the mark is already shown nearby. */
  showMark?: boolean;
}

/** "Travel" in Newsreader 600 and an italic "Luhh", led by the balang mark. */
export function Wordmark({ size = "md", tone = "ink", showMark = true, className, ...props }: WordmarkProps) {
  const s = SIZES[size];
  return (
    <span className={cn("inline-flex items-center", s.gap, TEXT_TONES[tone], className)} {...props}>
      {showMark && <BalangMark size={s.mark} tone={tone} className="-translate-y-px" />}
      <span className={cn("font-display font-semibold tracking-[-0.01em]", s.text)}>
        Travel<em className="font-medium italic">Luhh</em>
      </span>
    </span>
  );
}
