// Inline budget notice (§5.4): a slip with a 3px left rule, one line of plain text and a 44px close.
// Pages show only the highest-severity slip (lib/fundCopy.fundNotice picks it) and keep a dismissal for the
// session (useSessionDismissed).
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type NoticeSlipLevel = 'warn' | 'over' | 'info';

export interface NoticeSlipProps {
  level: NoticeSlipLevel;
  children: ReactNode;
  /** Shows the close button. Omit for a notice that must stay. */
  onDismiss?: () => void;
  /** A link or button after the text, e.g. "Here's where it went". */
  action?: ReactNode;
  className?: string;
}

const LOOK: Record<NoticeSlipLevel, { bar: string; bg: string; mark: string; glyph: string; spoken: string }> = {
  over: { bar: 'border-l-stamp', bg: 'bg-stamp-tint', mark: 'text-stamp', glyph: '▲', spoken: 'Over budget:' },
  warn: { bar: 'border-l-brass', bg: 'bg-stamp-tint', mark: 'text-brass-ink', glyph: '▲', spoken: 'Heads up:' },
  // Info isn't an alarm, so it sits on fund-tint rather than the stamp tint.
  info: { bar: 'border-l-fund', bg: 'bg-fund-tint', mark: 'text-fund', glyph: '●', spoken: 'Note:' },
};

export function NoticeSlip({ level, children, onDismiss, action, className }: NoticeSlipProps) {
  const look = LOOK[level];
  return (
    <div
      role="status"
      data-level={level}
      className={cn('flex w-full items-start gap-3 border-l-[3px] py-1 pl-3', look.bar, look.bg, onDismiss ? 'pr-0' : 'pr-4', className)}
    >
      <span aria-hidden="true" className={cn('mt-[11px] font-mono text-[11px] leading-none', look.mark)}>
        {look.glyph}
      </span>
      <p className="type-body-s min-w-0 flex-1 py-2.5 text-ink">
        <span className="sr-only">{look.spoken} </span>
        {children}
        {action ? <span className="ml-1.5 inline-block">{action}</span> : null}
      </p>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notice"
          className="pressable -my-1 flex h-11 w-11 shrink-0 items-center justify-center text-ink-2 hover:text-ink"
        >
          <X className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
