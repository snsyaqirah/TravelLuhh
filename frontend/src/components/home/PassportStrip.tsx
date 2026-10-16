// The passport strip (§9.3): one mono line linking to /passport, e.g.
// "4 TRIPS · 3 COUNTRIES · 31 DAYS AWAY · ≈ RM 1,240 BAKI". Baki drops out when a rate is missing.
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { passportLine, type PassportStats } from '@/components/home/homeMath';

export function PassportStrip({ stats, className }: { stats: PassportStats; className?: string }) {
  return (
    <Link
      to="/passport"
      className={cn(
        'group flex min-h-12 items-center justify-between gap-3 border-y border-rule px-1 py-3 font-mono text-[12px] font-medium uppercase leading-5 tracking-[0.08em] text-ink-2 transition-colors duration-micro hover:bg-accent hover:text-ink',
        className,
      )}
    >
      <span>
        <span className="text-ink">Passport</span>
        <span aria-hidden="true"> · </span>
        <span className="sr-only">: </span>
        {passportLine(stats)}
      </span>
      <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-ink-3 group-hover:text-ink" strokeWidth={1.75} />
    </Link>
  );
}
