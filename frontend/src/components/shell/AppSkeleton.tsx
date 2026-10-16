import type { CSSProperties } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface AppSkeletonProps {
  /** 'content' sits inside the shell's content column; 'screen' fills the viewport (before the shell exists). */
  variant?: 'content' | 'screen';
  className?: string;
}

const rows = { '--ledger-row': '48px' } as CSSProperties;

/**
 * Route-level Suspense fallback (§6.1): the rough shape of a page in static sunken blocks with ruled lines.
 * No shimmer, no pulse, no spinner (§10.6). The scene slot keeps its reserved height so nothing jumps.
 */
export function AppSkeleton({ variant = 'content', className }: AppSkeletonProps) {
  const body = (
    <div role="status" aria-busy="true" className={cn('flex flex-col gap-8 lg:gap-12', className)}>
      <span className="sr-only">Loading</span>
      <div className="flex flex-col gap-3">
        {/* Small blocks carry one rule, on their bottom edge. */}
        <Skeleton className="h-3.5 w-28 [--ledger-row:0.875rem]" />
        <Skeleton className="h-8 w-3/4 max-w-[420px] [--ledger-row:2rem] lg:h-11 lg:[--ledger-row:2.75rem]" />
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <Skeleton className="h-[220px] rounded-lg lg:col-span-7 lg:h-[320px]" />
        <div className="flex flex-col gap-3 lg:col-span-5">
          <Skeleton className="h-3.5 w-24 [--ledger-row:0.875rem]" />
          <Skeleton className="h-11 w-44 [--ledger-row:2.75rem] lg:h-16 lg:[--ledger-row:4rem]" />
          <Skeleton className="h-2.5 w-full [--ledger-row:0.625rem]" />
        </div>
      </div>
      <Skeleton className="h-[192px] w-full rounded-lg" style={rows} />
    </div>
  );

  if (variant === 'content') return body;
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-[1168px] px-4 py-8 md:px-6 lg:py-12">{body}</div>
    </div>
  );
}
