// Money entry for the trip forms: a big Newsreader figure (`hero`, Create step 4) or a mono field (`l`), with
// the currency prefix in small mono like every hero figure (§4). inputmode="decimal" so phones show numbers;
// what's typed is parsed with parseMoneyInput and tidied to "3,000" on blur.
import { forwardRef, useId, type KeyboardEvent } from 'react';
import { currencyPrefix } from '@/lib/money';
import { tidyMoneyText } from '@/components/trips/fields/fieldText';
import { cn } from '@/lib/utils';

export interface MoneyInputProps {
  value: string;
  onChange: (value: string) => void;
  currency: string;
  size?: 'hero' | 'l';
  id?: string;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
  /** Accessible name when there's no visible <label htmlFor>. */
  ariaLabel?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
}

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { value, onChange, currency, size = 'hero', id, invalid, describedBy, placeholder = '0', ariaLabel, onKeyDown, className },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  const hero = size === 'hero';
  return (
    <div
      className={cn(
        'flex items-baseline gap-2 rounded-t-sm border-b-[1.5px] bg-sunken px-3 transition-colors duration-micro focus-within:border-fund hover:border-ink',
        invalid ? 'border-stamp hover:border-stamp' : 'border-field',
        hero ? 'py-2' : 'h-11 items-center',
        className,
      )}
    >
      <label
        htmlFor={inputId}
        className={cn('shrink-0 font-mono font-medium text-ink-3', hero ? 'text-[15px] lg:text-[22px]' : 'text-[15px]')}
      >
        <span aria-hidden="true">{currencyPrefix(currency)}</span>
        <span className="sr-only">{ariaLabel ? `${ariaLabel}, in ${currency}` : `Amount in ${currency}`}</span>
      </label>
      <input
        ref={ref}
        id={inputId}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="next"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => {
          const tidy = tidyMoneyText(e.target.value, currency);
          if (tidy !== e.target.value) onChange(tidy);
        }}
        onKeyDown={onKeyDown}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn(
          'min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-3',
          hero ? 'type-money-hero h-[52px] lg:h-[76px]' : 'type-money-l text-base',
        )}
      />
    </div>
  );
});

export interface CurrencySwitchProps {
  options: readonly string[];
  value: string;
  onChange: (code: string) => void;
  label: string;
  className?: string;
}

/** Two-way segmented switch between the home and destination currency ('RM · ¥'). */
export function CurrencySwitch({ options, value, onChange, label, className }: CurrencySwitchProps) {
  const name = useId();
  if (options.length < 2) return null;
  return (
    <fieldset className={cn('inline-flex', className)}>
      <legend className="sr-only">{label}</legend>
      <div className="inline-flex rounded-sm border border-rule-strong bg-leaf p-0.5">
        {options.map((code) => {
          const on = code === value;
          return (
            <label
              key={code}
              className={cn(
                'relative inline-flex h-10 min-w-[64px] cursor-pointer items-center justify-center gap-1.5 rounded-sm px-3 font-mono text-[13px] font-medium transition-colors duration-micro',
                on ? 'bg-ink text-paper' : 'text-ink-2 hover:text-ink',
                'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
              )}
            >
              <input type="radio" name={name} value={code} checked={on} onChange={() => onChange(code)} className="sr-only" />
              {currencyPrefix(code) !== code ? <span aria-hidden="true">{currencyPrefix(code)}</span> : null}
              <span>{code}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
