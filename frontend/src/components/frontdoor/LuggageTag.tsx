// The big paper luggage tag on the auth panel. It fills in live from Register's profile step: name, then
// HOME · MY · RM. Decorative: the form fields carry the same values for assistive tech.
import { currencyPrefix } from '@/lib/money';
import { cn } from '@/lib/utils';

export interface LuggageTagProps {
  name?: string;
  country?: string;
  currency?: string;
  className?: string;
}

// Both left corners cut like a real tag, and a 5px hole punched through the band.
const TAG_SHAPE: React.CSSProperties = {
  clipPath: 'polygon(14px 0, 100% 0, 100% 100%, 14px 100%, 0 calc(100% - 14px), 0 14px)',
  WebkitMaskImage: 'radial-gradient(circle at 15px 50%, transparent 5px, black 5.5px)',
  maskImage: 'radial-gradient(circle at 15px 50%, transparent 5px, black 5.5px)',
};

export function LuggageTag({ name, country, currency, className }: LuggageTagProps) {
  const code = (country ?? '').toUpperCase();
  const cur = (currency ?? '').toUpperCase();
  const home = [code || '··', cur ? currencyPrefix(cur) : '··'].join(' · ');
  const trimmed = (name ?? '').trim();
  return (
    <div aria-hidden="true" className={cn('relative flex w-[260px] text-ink', className)} style={TAG_SHAPE}>
      <span className="w-[30px] shrink-0 bg-brass" />
      <div className="min-w-0 flex-1 border-y border-r border-ink/20 bg-leaf px-4 py-3">
        <p className="type-overline text-ink-3">Passenger</p>
        <p className={cn('mt-1 truncate font-display text-[22px] font-medium leading-7', !trimmed && 'text-ink-3')}>
          {trimmed || 'Your name'}
        </p>
        <p className="mt-1.5 border-t border-dashed border-rule-strong pt-1.5 font-mono text-[12px] font-medium tracking-[0.08em] text-ink-2">
          HOME · {home}
        </p>
      </div>
    </div>
  );
}
