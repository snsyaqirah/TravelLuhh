// The packing checklist (§9.6 Pack): one luggage-tag header per packing category (suitcase order), 48px rows
// with a checkbox. A ticked row strikes through in ink-3 (its box hops into the case on the stage). Editors get
// a visible remove button on every row; viewers see the same list without controls.
import { useId } from 'react';
import { X } from 'lucide-react';
import type { PackingItem } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { IsoGlyph } from '@/components/glyphs';
import { cn } from '@/lib/utils';
import { LuggageTag } from './LuggageTag';
import type { PackGroup } from './packing';

export interface PackChecklistProps {
  groups: readonly PackGroup[];
  canEdit: boolean;
  onToggle: (item: PackingItem) => void;
  onRemove: (item: PackingItem) => void;
}

/** Read-only tick box for viewers: same look as the checkbox, no control. */
function StaticBox({ checked }: { checked: boolean }) {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" className="shrink-0">
      <rect
        x="0.75"
        y="0.75"
        width="18.5"
        height="18.5"
        rx="2"
        strokeWidth="1.5"
        className={checked ? 'fill-fund stroke-fund' : 'fill-leaf stroke-field'}
      />
      {checked ? (
        <path d="M5.5 10.2l3 3 6-6.4" fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="stroke-on-fund" />
      ) : null}
    </svg>
  );
}

function Row({ item, canEdit, onToggle, onRemove }: { item: PackingItem; canEdit: boolean } & Pick<PackChecklistProps, 'onToggle' | 'onRemove'>) {
  const id = useId();
  const text = (
    <span
      className={cn(
        'min-w-0 flex-1 truncate text-[15px] leading-5',
        item.isChecked ? 'text-ink-3 line-through decoration-ink-3' : 'text-ink'
      )}
    >
      {item.label}
    </span>
  );
  return (
    <li className="flex min-h-12 items-center border-b border-rule last:border-b-0">
      {canEdit ? (
        <>
          <label htmlFor={id} className="flex min-h-12 min-w-0 flex-1 cursor-pointer items-center gap-3 pl-1 pr-2">
            <Checkbox id={id} checked={item.isChecked} onCheckedChange={() => onToggle(item)} />
            {text}
          </label>
          <button
            type="button"
            onClick={() => onRemove(item)}
            aria-label={`Remove ${item.label}`}
            className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-2 hover:bg-accent hover:text-stamp"
          >
            <X className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </>
      ) : (
        <div className="flex min-h-12 min-w-0 flex-1 items-center gap-3 pl-1 pr-2">
          <StaticBox checked={item.isChecked} />
          {text}
          <span className="sr-only">{item.isChecked ? ', packed' : ', not packed'}</span>
        </div>
      )}
    </li>
  );
}

export function PackChecklist({ groups, canEdit, onToggle, onRemove }: PackChecklistProps) {
  return (
    // Two columns of luggage on desktop, so a row's remove button isn't a mile from its label.
    <div className="space-y-6 lg:columns-2 lg:gap-x-12 lg:space-y-0">
      {groups.map((g) => {
        const all = g.packed === g.items.length;
        return (
          <section key={g.meta.key} aria-labelledby={`pack-${g.meta.key}`} className="break-inside-avoid lg:pb-6">
            <h3 id={`pack-${g.meta.key}`} className="mb-1">
              <LuggageTag tone={all ? 'fund' : 'plain'}>
                <IsoGlyph name={g.meta.glyph} size={18} />
                <span>{g.meta.label}</span>
                <span className="font-normal" aria-hidden="true">
                  {g.packed}/{g.items.length}
                </span>
                <span className="sr-only">
                  , {g.packed} of {g.items.length} packed
                </span>
              </LuggageTag>
            </h3>
            <ul>
              {g.items.map((it) => (
                <Row key={it.id} item={it} canEdit={canEdit} onToggle={onToggle} onRemove={onRemove} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
