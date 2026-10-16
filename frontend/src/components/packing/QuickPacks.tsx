// Quick packs (§9.6 Pack): a ruled row of text buttons with preset glyphs. Each shows how many new things it
// would add (the server skips labels already on the list), so a pack that adds nothing is visibly spent.
import { useId } from 'react';
import type { PackingPreset } from '@/types';
import { IsoGlyph } from '@/components/glyphs';
import { PACKING_PRESETS, presetAdditions } from '@/data/packing';
import { cn } from '@/lib/utils';

export interface QuickPacksProps {
  labels: readonly string[];
  busy: PackingPreset | null;
  onPick: (preset: PackingPreset, label: string) => void;
  className?: string;
}

export function QuickPacks({ labels, busy, onPick, className }: QuickPacksProps) {
  const labelId = useId();
  return (
    <div className={className}>
      <p id={labelId} className="type-overline text-ink-2">
        Start from a list
      </p>
      <div className="scrollbar-none -mx-4 mt-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div
          role="group"
          aria-labelledby={labelId}
          className="flex w-max min-w-full divide-x divide-rule border-y border-rule"
        >
          {PACKING_PRESETS.map((p) => {
            const adds = presetAdditions(p.key, labels).length;
            const isBusy = busy === p.key;
            return (
              <button
                key={p.key}
                type="button"
                disabled={adds === 0 || busy !== null}
                onClick={() => onPick(p.key, p.label)}
                aria-label={adds ? `${p.label} list, adds ${adds}` : `${p.label} list, already on yours`}
                className={cn(
                  'pressable flex h-12 shrink-0 items-center gap-2 px-3 text-[15px] font-medium text-ink hover:bg-sunken disabled:cursor-default disabled:hover:bg-transparent md:flex-1 md:justify-center',
                  adds === 0 && 'text-ink-3'
                )}
              >
                <IsoGlyph name={p.glyph} size={22} sketch={adds === 0} />
                <span className="whitespace-nowrap">{p.label}</span>
                <span aria-hidden="true" className="font-mono text-[12px] text-ink-3">
                  {isBusy ? '…' : `+${adds}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
