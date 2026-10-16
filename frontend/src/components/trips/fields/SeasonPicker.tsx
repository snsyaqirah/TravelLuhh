// Season chip (§2.5, §9.5 step 2): the derived season with its iso glyph ("Autumn in Japan"), and a menu to
// pick another one. "Auto" goes back to the season worked out from the destination and start date.
import { ChevronDown } from 'lucide-react';
import type { Season } from '@/types';
import { IsoGlyph } from '@/components/glyphs';
import { SEASON_META, seasonMeta } from '@/data/seasons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { seasonPhrase } from '@/components/trips/fields/fieldText';

export interface SeasonPickerProps {
  /** The season shown (picked, else derived). null hides the chip until there's a place and a date. */
  season: Season | null;
  /** The traveller's own pick; null = derived. */
  picked: Season | null;
  /** Season worked out from the dates; shown as the Auto option. */
  derived: Season | null;
  country: string | null;
  onPick: (season: Season | null) => void;
  disabled?: boolean;
  className?: string;
}

export function SeasonPicker({ season, picked, derived, country, onPick, disabled, className }: SeasonPickerProps) {
  if (!season) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label={`Season: ${seasonPhrase(season, country)}. Change season`}
        className={cn(
          'pressable inline-flex min-h-11 items-center gap-2 rounded-sm border border-rule-strong bg-leaf py-1.5 pl-2 pr-2.5 text-left text-[15px] text-ink transition-colors duration-micro hover:border-ink data-[state=open]:border-ink',
          className,
        )}
      >
        <IsoGlyph name={seasonMeta(season).glyph} size={24} />
        <span>{seasonPhrase(season, country)}</span>
        <ChevronDown aria-hidden="true" className="h-4 w-4 text-ink-2" strokeWidth={1.75} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[14rem]">
        <DropdownMenuLabel className="type-overline text-ink-2">Season</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={picked ?? 'auto'}
          onValueChange={(v) => onPick(v === 'auto' ? null : (v as Season))}
        >
          {derived ? (
            <DropdownMenuRadioItem value="auto" className="gap-2">
              <IsoGlyph name={seasonMeta(derived).glyph} size={20} />
              Auto ({seasonMeta(derived).label.toLowerCase()})
            </DropdownMenuRadioItem>
          ) : null}
          <DropdownMenuSeparator />
          {SEASON_META.map((s) => (
            <DropdownMenuRadioItem key={s.key} value={s.key} className="gap-2">
              <IsoGlyph name={s.glyph} size={20} />
              {s.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
