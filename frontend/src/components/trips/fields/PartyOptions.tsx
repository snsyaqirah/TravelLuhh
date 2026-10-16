// "Who's in?" (§9.5 step 3, and the Edit sheet): three ruled rows with a jar drawing each, mapping to budgetType.
// Native radios underneath, so arrow keys move between rows and Enter submits the step.
import { useId } from 'react';
import type { BudgetType } from '@/types';
import { MiniBalangSvg } from '@/iso/svg/MiniBalangSvg';
import { cn } from '@/lib/utils';
import { PARTY_OPTIONS } from '@/components/trips/fields/fieldText';

function PartyDrawing({ type }: { type: BudgetType }) {
  if (type === 'separated') {
    return (
      <span aria-hidden="true" className="flex items-end gap-0.5">
        <MiniBalangSvg fill={0.55} phase="upcoming" width={26} height={36} />
        <MiniBalangSvg fill={0.35} phase="upcoming" width={26} height={36} />
        <MiniBalangSvg fill={0.7} phase="upcoming" width={26} height={36} />
      </span>
    );
  }
  return <MiniBalangSvg fill={type === 'shared' ? 0.7 : 0.55} phase="upcoming" slots={type === 'shared' ? 3 : 1} width={44} height={56} />;
}

export interface PartyOptionsProps {
  value: BudgetType | null;
  onChange: (value: BudgetType) => void;
  invalid?: boolean;
  errorId?: string;
  disabled?: boolean;
  /** Visible legend; the Create step has its own heading so it hides it. */
  legend?: string;
  hideLegend?: boolean;
  className?: string;
}

export function PartyOptions({ value, onChange, invalid, errorId, disabled, legend = "Who's in?", hideLegend, className }: PartyOptionsProps) {
  const name = useId();
  return (
    <fieldset className={className} aria-describedby={errorId} aria-invalid={invalid || undefined} disabled={disabled}>
      <legend className={cn('type-overline mb-1.5 text-ink-2', hideLegend && 'sr-only')}>{legend}</legend>
      <div className={cn('overflow-hidden rounded-lg border bg-leaf', invalid ? 'border-stamp' : 'border-rule')}>
        {PARTY_OPTIONS.map((o, i) => {
          const checked = value === o.value;
          return (
            <label
              key={o.value}
              className={cn(
                'relative flex min-h-[84px] cursor-pointer items-center gap-4 px-4 py-3 transition-colors duration-micro',
                i > 0 && 'border-t border-rule',
                checked ? 'bg-fund-tint shadow-[inset_3px_0_0_0_hsl(var(--fund))]' : 'hover:bg-accent',
                disabled && 'cursor-not-allowed opacity-70 hover:bg-transparent',
                'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-ring',
              )}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={checked}
                onChange={() => onChange(o.value)}
                className="peer sr-only"
              />
              <span className="flex h-14 w-[84px] shrink-0 items-end justify-center">
                <PartyDrawing type={o.value} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-semibold leading-6 text-ink">{o.title}</span>
                <span className="type-body-s block text-ink-2">{o.line}</span>
              </span>
              {/* square radio mark: radios are square in this kit (§5.2) */}
              <span
                aria-hidden="true"
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border-[1.5px]',
                  checked ? 'border-fund bg-fund' : 'border-field bg-leaf',
                )}
              >
                {checked ? <span className="h-2 w-2 bg-on-fund" /> : null}
              </span>
            </label>
          );
        })}
      </div>
      <p className="type-body-s mt-3 text-ink-2">Geng trips: invite your geng by email once the tabung is open.</p>
    </fieldset>
  );
}
