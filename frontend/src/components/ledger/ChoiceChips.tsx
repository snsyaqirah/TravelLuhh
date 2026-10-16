// Small single-choice chip row used by the Log spend sheet (currency, date, paid by). A radio group with one
// tab stop and arrow keys, 44px tall, 2px radius (§5.2 chips). Selected = ink border, fund-tint fill.
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { chipClass } from './ledgerUi';

export interface ChoiceChip<V extends string | number> {
  value: V;
  label: ReactNode;
  /** Accessible name when the label is terse ('JPY'). */
  ariaLabel?: string;
}

export interface ChoiceChipsProps<V extends string | number> {
  options: readonly ChoiceChip<V>[];
  value: V | null;
  onChange: (value: V) => void;
  labelledBy: string;
  describedBy?: string;
  className?: string;
  chipClassName?: string;
  /** Extra buttons after the chips (e.g. "Other…"); they're outside the radio group's arrow keys. */
  trailing?: ReactNode;
}

export function ChoiceChips<V extends string | number>({
  options,
  value,
  onChange,
  labelledBy,
  describedBy,
  className,
  chipClassName,
  trailing,
}: ChoiceChipsProps<V>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const active = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const move = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = options.length - 1;
    let next = i;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = i === last ? 0 : i + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = i === 0 ? last : i - 1;
    else return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div role="radiogroup" aria-labelledby={labelledBy} aria-describedby={describedBy} className="flex flex-wrap items-center gap-2">
        {options.map((o, i) => {
          const selected = o.value === value;
          return (
            <button
              key={String(o.value)}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={o.ariaLabel}
              tabIndex={i === active ? 0 : -1}
              onClick={() => onChange(o.value)}
              onKeyDown={(e) => move(e, i)}
              className={chipClass(selected, chipClassName)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {trailing}
    </div>
  );
}
