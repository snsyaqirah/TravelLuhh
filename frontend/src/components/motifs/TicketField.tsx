// One labelled field on a ticket: FROM/TO, DEPART, DAYS, FUND (§5.4).
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TicketFieldProps {
  label: string;
  value: ReactNode;
  /** Mono money-l value (codes, dates, amounts). Otherwise the value is set as a title. */
  mono?: boolean;
  className?: string;
}

export function TicketField({ label, value, mono = true, className }: TicketFieldProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="type-overline text-ink-3">{label}</dt>
      <dd className={cn('mt-0.5 truncate text-ink', mono ? 'type-money-l' : 'type-title')}>{value}</dd>
    </div>
  );
}

/** The <dl> that TicketFields sit in: a 2-column grid by default (the hero ticket's 2×2). */
export function TicketFieldGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn('grid grid-cols-2 gap-x-4 gap-y-3', className)}>{children}</dl>;
}
