// Airmail edge for group trips (shared and separated only, §5.4). Purely decorative: the party label says
// "GENG" in words wherever the stripe appears.
import { cn } from '@/lib/utils';

const STRIPE =
  'repeating-linear-gradient(-45deg, hsl(var(--stamp)) 0 8px, hsl(var(--leaf)) 8px 12px, hsl(var(--airmail)) 12px 20px, hsl(var(--leaf)) 20px 24px)';

export function AirmailStripe({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('h-1.5 w-full shrink-0', className)} style={{ backgroundImage: STRIPE }} />;
}
