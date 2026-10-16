// Luggage-tag shape for the Pack tab (§9.6): clipped top-left corner and a punched string hole, mono capitals.
// Used for the progress tag ("23 / 31 PACKED") and the category headers. Fill + words carry the state, never
// colour alone. Text on sunken stays ink-2 or darker (§3.1: ink-3 never on sunken under 18px).
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface LuggageTagProps {
  children: ReactNode;
  tone?: 'plain' | 'fund';
  size?: 'md' | 'lg';
  className?: string;
}

const SHAPE: Record<'md' | 'lg', CSSProperties> = {
  md: {
    clipPath: 'polygon(7px 0, 100% 0, 100% 100%, 0 100%, 0 7px)',
    WebkitMaskImage: 'radial-gradient(circle at 9px 50%, transparent 2.5px, black 3px)',
    maskImage: 'radial-gradient(circle at 9px 50%, transparent 2.5px, black 3px)',
  },
  lg: {
    clipPath: 'polygon(10px 0, 100% 0, 100% 100%, 0 100%, 0 10px)',
    WebkitMaskImage: 'radial-gradient(circle at 12px 50%, transparent 3.5px, black 4px)',
    maskImage: 'radial-gradient(circle at 12px 50%, transparent 3.5px, black 4px)',
  },
};

export function LuggageTag({ children, tone = 'plain', size = 'md', className }: LuggageTagProps) {
  return (
    <span
      style={SHAPE[size]}
      className={cn(
        'inline-flex shrink-0 items-center gap-2 whitespace-nowrap font-mono font-medium uppercase',
        size === 'lg' ? 'h-10 pl-[26px] pr-4 text-[13px] tracking-[0.08em]' : 'h-7 pl-[20px] pr-3 text-[11px] tracking-[0.08em]',
        tone === 'fund' ? 'bg-fund-tint text-fund' : 'bg-sunken text-ink-2',
        className
      )}
    >
      {children}
    </span>
  );
}
