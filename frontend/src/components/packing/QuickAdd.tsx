// Quick-add (§9.6 Pack): one line to type, a category that guesses itself from the words ("Phone charger" →
// Electronics) until you pick one, and Add. Enter adds and keeps the cursor in the field for the next thing.
import { useId, useRef, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { IsoGlyph } from '@/components/glyphs';
import { PACKING_CATEGORIES, PACKING_CATEGORY_META, guessPackingCategory, type PackingCategory } from '@/data/packing';
import { cn } from '@/lib/utils';

export interface QuickAddProps {
  onAdd: (label: string, category: PackingCategory) => Promise<unknown>;
  className?: string;
}

export function QuickAdd({ onAdd, className }: QuickAddProps) {
  const uid = useId();
  const input = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState('');
  const [picked, setPicked] = useState<PackingCategory | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const category = picked ?? guessPackingCategory(label);
  const meta = PACKING_CATEGORY_META[category];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const text = label.trim();
    if (!text || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onAdd(text, category);
      setLabel('');
      setPicked(null);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Couldn't add that. Try again in a moment.");
    } finally {
      setSaving(false);
      input.current?.focus();
    }
  };

  return (
    <form onSubmit={submit} className={className} aria-label="Add to the packing list">
      <div className="flex items-stretch gap-2">
        <label htmlFor={`${uid}-label`} className="sr-only">
          Thing to pack
        </label>
        <Input
          ref={input}
          id={`${uid}-label`}
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Add something to pack"
          maxLength={200}
          autoComplete="off"
          enterKeyHint="done"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${uid}-err` : undefined}
          className="min-w-0 flex-1"
        />
        <Select value={category} onValueChange={(v) => setPicked(v as PackingCategory)}>
          <SelectTrigger
            aria-label={`Category: ${meta.label}${picked ? '' : ' (guessed)'}`}
            className="w-auto shrink-0 gap-1.5 px-2.5"
          >
            {/* the trigger line-clamps its direct span child, so the flex row sits one level down */}
            <span>
              <span className="flex items-center gap-1.5">
                <IsoGlyph name={meta.glyph} size={20} />
                <span className="hidden text-[15px] sm:inline">{meta.label}</span>
              </span>
            </span>
          </SelectTrigger>
          <SelectContent align="end">
            {PACKING_CATEGORIES.map((c) => (
              <SelectItem key={c.key} value={c.key}>
                <span className="flex items-center gap-2">
                  <IsoGlyph name={c.glyph} size={20} />
                  {c.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" disabled={!label.trim() || saving} className={cn('shrink-0 px-3 sm:px-4')}>
          <Plus aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Add</span>
        </Button>
      </div>
      {error ? (
        <p id={`${uid}-err`} role="alert" className="type-body-s mt-1.5 text-stamp">
          {error}
        </p>
      ) : null}
    </form>
  );
}
