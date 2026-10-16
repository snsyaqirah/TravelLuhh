// The seven category glyph buttons of the Log spend sheet (§9.6): 4 + 3, 64×56, label under each. A real
// radio group: one tab stop, arrow keys move and select, the chosen one is announced.
import { useRef, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { CATEGORIES, type CategoryKey } from '@/data/categories';
import { CategoryGlyph } from '@/components/glyphs';

export interface CategoryGridProps {
  value: CategoryKey | null;
  onChange: (value: CategoryKey) => void;
  /** id of the visible group label. */
  labelledBy: string;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}

export function CategoryGrid({ value, onChange, labelledBy, invalid, describedBy, className }: CategoryGridProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const active = Math.max(
    0,
    CATEGORIES.findIndex((c) => c.key === value),
  );

  const move = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const cols = 4;
    const last = CATEGORIES.length - 1;
    let next = index;
    if (e.key === 'ArrowRight') next = index === last ? 0 : index + 1;
    else if (e.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
    else if (e.key === 'ArrowDown') next = Math.min(last, index + cols);
    else if (e.key === 'ArrowUp') next = index - cols >= 0 ? index - cols : index;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    else return;
    e.preventDefault();
    onChange(CATEGORIES[next].key);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      aria-required="true"
      className={cn('grid grid-cols-4 gap-2', className)}
    >
      {CATEGORIES.map((c, i) => {
        const checked = c.key === value;
        return (
          <button
            key={c.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={i === active ? 0 : -1}
            onClick={() => onChange(c.key)}
            onKeyDown={(e) => move(e, i)}
            data-category={c.key}
            className={cn(
              'pressable flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-md border px-1 text-ink',
              checked ? 'border-ink bg-fund-tint shadow-hard' : 'border-rule bg-leaf hover:border-rule-strong hover:bg-sunken',
              invalid && !value && 'border-stamp',
            )}
          >
            <CategoryGlyph category={c.key} size={24} sketch={value != null && !checked} />
            <span className={cn('type-label truncate text-[12px] leading-4', checked ? 'font-semibold text-ink' : 'text-ink-2')}>{c.label}</span>
          </button>
        );
      })}
    </div>
  );
}
