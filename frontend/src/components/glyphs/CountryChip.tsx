import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { getCountryByCode } from '@/data/countries';

export interface CountryChipProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** ISO 3166-1 alpha-2 code ('JP'). Case doesn't matter. */
  code: string;
  /**
   * What a screen reader hears. 'name' (default) reads "Japan"; 'code' reads the letters; 'none' hides the chip
   * when the country name is already written next to it.
   */
  announce?: 'name' | 'code' | 'none';
  /** 'ink' on paper and cards; 'muted' in dense lists; 'onFund' on the fund panel and the desktop rail. */
  tone?: 'ink' | 'muted' | 'onFund';
  /** 'md' is the spec chip (12px). 'sm' (11px) is for scene labels and tight table cells. */
  size?: 'sm' | 'md';
}

const TONES: Record<NonNullable<CountryChipProps['tone']>, string> = {
  ink: 'border-ink text-ink',
  muted: 'border-rule-strong text-ink-2',
  onFund: 'border-on-fund text-on-fund',
};

/** Country as an ISO code chip (spec §5.5): Plex Mono 500, 1px border, 2px radius. Replaces flag emoji. */
export function CountryChip({ code, announce = 'name', tone = 'ink', size = 'md', className, ...rest }: CountryChipProps) {
  const iso = code.trim().toUpperCase();
  const name = getCountryByCode(iso)?.name;
  const spoken = announce === 'name' ? (name ?? iso) : iso;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-sm border font-mono font-medium uppercase leading-none',
        size === 'md' ? 'h-5 min-w-[1.75rem] px-1 text-[12px] tracking-[0.04em]' : 'h-4 min-w-[1.5rem] px-[3px] text-[11px] tracking-[0.03em]',
        TONES[tone],
        className,
      )}
      title={name}
      aria-hidden={announce === 'none' ? true : undefined}
      {...rest}
    >
      <span aria-hidden={announce === 'name' && name ? true : undefined}>{iso}</span>
      {announce === 'name' && name ? <span className="sr-only">{spoken}</span> : null}
    </span>
  );
}
