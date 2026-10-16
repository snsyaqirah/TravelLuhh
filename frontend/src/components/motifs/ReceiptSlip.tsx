// Torn receipt (§5.4): leaf paper with a 6px zig-zag edge, mono type and dashed 3/3 separators. Holds the
// Log-spend body, transaction detail, Kongsi transfers and chart tooltips.
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Teeth are 12px wide and 6px deep. The conic cone opens 90° from each tooth's tip.
const TEETH_BOTTOM = 'conic-gradient(from -45deg at bottom, transparent, black 1deg 89deg, transparent 90deg) 50% 100% / 12px 51% repeat-x';
const TEETH_TOP = 'conic-gradient(from 135deg at top, transparent, black 1deg 89deg, transparent 90deg) 50% 0 / 12px 51% repeat-x';

const EDGE_MASK: Record<'bottom' | 'both', CSSProperties> = {
  bottom: {
    WebkitMask: 'conic-gradient(from -45deg at bottom, transparent, black 1deg 89deg, transparent 90deg) 50% / 12px 100%',
    mask: 'conic-gradient(from -45deg at bottom, transparent, black 1deg 89deg, transparent 90deg) 50% / 12px 100%',
  },
  both: {
    WebkitMask: `${TEETH_TOP}, ${TEETH_BOTTOM}`,
    mask: `${TEETH_TOP}, ${TEETH_BOTTOM}`,
  },
};

export interface ReceiptSlipProps extends HTMLAttributes<HTMLDivElement> {
  edge?: 'bottom' | 'both';
  /** A 2px hard shadow that follows the teeth: for a slip you can pick up (a sheet body, a tooltip). */
  raised?: boolean;
  children?: ReactNode;
}

export function ReceiptSlip({ edge = 'bottom', raised, className, style, children, ...rest }: ReceiptSlipProps) {
  const slip = (
    <div
      className={cn('bg-leaf px-4 font-mono text-[14px] leading-5 text-ink', edge === 'both' ? 'py-5' : 'pb-5 pt-4', className)}
      style={{ ...EDGE_MASK[edge], ...style }}
      {...rest}
    >
      {children}
    </div>
  );
  // The mask clips box-shadow, so the hard shadow is a drop-shadow on a wrapper and follows the teeth.
  return raised ? <div className="[filter:drop-shadow(2px_2px_0_hsl(var(--shade)/0.18))] dark:[filter:drop-shadow(2px_2px_0_hsl(var(--shade)))]">{slip}</div> : slip;
}

/** Dashed 1px rule-strong separator, 3 on 3. */
export function ReceiptRule({ className }: { className?: string }) {
  return <div role="separator" className={cn('rule-dashed my-3 h-px w-full', className)} />;
}

export interface ReceiptLineProps {
  label: ReactNode;
  value: ReactNode;
  /** Totals: medium weight. */
  strong?: boolean;
  /** Dotted leader between label and value, like a till receipt. */
  leader?: boolean;
  className?: string;
}

/** 'Ramen Ichiran ········ ¥ 3,200' */
export function ReceiptLine({ label, value, strong, leader = true, className }: ReceiptLineProps) {
  return (
    <div className={cn('flex items-baseline gap-2 py-0.5 tabular-nums', strong && 'font-medium', className)}>
      <span className="min-w-0 truncate">{label}</span>
      {leader ? <span aria-hidden="true" className="mb-1 min-w-4 flex-1 border-b border-dotted border-rule-strong" /> : <span className="flex-1" />}
      <span className="shrink-0 whitespace-nowrap text-right">{value}</span>
    </div>
  );
}
