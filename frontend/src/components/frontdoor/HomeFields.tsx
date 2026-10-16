// Home country (searchable, ISO chips, no flags) and home currency (auto-filled from the country, editable).
// Used by Register's profile step and the onboarding passport sheet.
import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fieldClasses } from '@/components/ui/input';
import { CountryChip } from '@/components/glyphs/CountryChip';
import { getCountryByCode, searchCountries } from '@/data/countries';
import { CURRENCIES } from '@/lib/currency';
import { currencyPrefix } from '@/lib/money';
import { cn } from '@/lib/utils';

interface CountryPickerProps {
  id: string;
  value: string;
  onChange: (code: string) => void;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
}

export function CountryPicker({ id, value, onChange, invalid, describedBy, disabled }: CountryPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchCountries(query), [query]);
  const selected = getCountryByCode(value);
  const listId = `${id}-list`;

  return (
    <Popover
      // modal: the list stays scrollable when the picker sits inside a dialog (onboarding).
      modal
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery('');
      }}
    >
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-haspopup="listbox"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          className={cn(fieldClasses, 'flex h-11 items-center justify-between gap-2 py-2 text-left', !selected && 'text-ink-2')}
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected ? <CountryChip code={selected.code} announce="none" /> : null}
            <span className="truncate">{selected ? selected.name : 'Pick a country'}</span>
          </span>
          <ChevronsUpDown className="h-5 w-5 shrink-0 text-ink-2" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0">
        <Command shouldFilter={false} label="Countries">
          <CommandInput value={query} onValueChange={setQuery} placeholder="Search a country or city" aria-label="Search countries" />
          <CommandList id={listId}>
            <CommandEmpty>Nothing matches "{query}". Try the country's English name.</CommandEmpty>
            <CommandGroup>
              {results.map((c) => (
                <CommandItem
                  key={c.code}
                  value={c.code}
                  onSelect={() => {
                    onChange(c.code);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <CountryChip code={c.code} announce="none" size="sm" />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="font-mono text-[12px] text-ink-3">{c.currency}</span>
                  <Check className={cn('h-4 w-4 text-fund', c.code === value ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface CurrencySelectProps {
  id: string;
  value: string;
  onChange: (code: string) => void;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
}

export function CurrencySelect({ id, value, onChange, invalid, describedBy, disabled }: CurrencySelectProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} aria-invalid={invalid || undefined} aria-describedby={describedBy}>
        {/* The trigger is narrow: code and prefix only ("MYR · RM"); the list carries the full names. */}
        <SelectValue placeholder="Pick a currency">
          {value ? (
            <span className="flex min-w-0 items-baseline gap-1.5">
              <span className="font-mono text-[15px] font-medium">{value}</span>
              {currencyPrefix(value) !== value ? <span className="truncate text-ink-2">· {currencyPrefix(value)}</span> : null}
            </span>
          ) : null}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[320px]">
        {CURRENCIES.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            <span className="font-mono text-[13px] font-medium">{c.code}</span>
            <span className="text-ink-2"> · {c.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
