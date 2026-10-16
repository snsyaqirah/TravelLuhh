// Add / edit a stop (§9.6 Days). Bottom sheet on phones, right drawer from 768px. Fields: title, day, start
// and end time, location, category, description. The server checks the day is inside the trip and that the
// end isn't before the start; its messages show inline under the field they belong to.
import { useEffect, useId, useState, type FormEvent } from 'react';
import type { CreateItineraryItemRequest, ItineraryItem, Trip } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { IsoGlyph } from '@/components/glyphs';
import { ITINERARY_CATEGORIES, normalizeItineraryCategory } from '@/data/itinerary';
import { useMediaQuery } from '@/components/shell/useMediaQuery';
import { getErrorMessage, getFieldErrors } from '@/lib/axios';
import { formatShortDate } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { hhmm } from './days';

const NO_CATEGORY = 'none';

interface FormState {
  title: string;
  itemDate: string;
  startTime: string;
  endTime: string;
  location: string;
  category: string;
  description: string;
}

type FieldKey = keyof FormState;

export interface StopSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Pick<Trip, 'startDate' | 'endDate'>;
  /** Day the new stop goes on. */
  defaultDate: string;
  /** The stop being edited; null adds a new one. */
  item: ItineraryItem | null;
  onSubmit: (data: CreateItineraryItemRequest) => Promise<unknown>;
}

function initial(item: ItineraryItem | null, defaultDate: string): FormState {
  return {
    title: item?.title ?? '',
    itemDate: item?.itemDate ?? defaultDate,
    startTime: hhmm(item?.startTime),
    endTime: hhmm(item?.endTime),
    location: item?.location ?? '',
    category: normalizeItineraryCategory(item?.category) ?? NO_CATEGORY,
    description: item?.description ?? '',
  };
}

/** Server field names → our fields (the request DTO uses the same names). */
const FIELD_KEYS: readonly FieldKey[] = ['title', 'itemDate', 'startTime', 'endTime', 'location', 'category', 'description'];

export function StopSheet({ open, onOpenChange, trip, defaultDate, item, onSubmit }: StopSheetProps) {
  const wide = useMediaQuery('(min-width: 768px)');
  const uid = useId();
  const [form, setForm] = useState<FormState>(() => initial(item, defaultDate));
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fresh form each time the sheet opens (or switches to another stop).
  useEffect(() => {
    if (!open) return;
    setForm(initial(item, defaultDate));
    setErrors({});
    setFormError(null);
  }, [open, item, defaultDate]);

  const set = (k: FieldKey, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Partial<Record<FieldKey, string>> = {};
    if (!form.title.trim()) next.title = 'Give the stop a name.';
    if (!form.itemDate) next.itemDate = 'Pick a day.';
    if (form.startTime && form.endTime && form.endTime < form.startTime) next.endTime = 'End time is before the start time.';
    if (form.endTime && !form.startTime) next.startTime = 'Add a start time too, or clear the end time.';
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;

    const body: CreateItineraryItemRequest = {
      itemDate: form.itemDate,
      title: form.title.trim(),
      startTime: form.startTime || undefined,
      endTime: form.endTime || undefined,
      location: form.location.trim() || undefined,
      category: form.category === NO_CATEGORY ? undefined : form.category,
      description: form.description.trim() || undefined,
    };
    setSaving(true);
    try {
      await onSubmit(body);
      onOpenChange(false);
    } catch (err) {
      const fields = getFieldErrors(err) ?? {};
      const mapped: Partial<Record<FieldKey, string>> = {};
      for (const [k, msg] of Object.entries(fields)) if ((FIELD_KEYS as readonly string[]).includes(k)) mapped[k as FieldKey] = msg;
      const message = getErrorMessage(err, "Couldn't save the stop. Try again in a moment.");
      // "Pick a day between …" comes back as a plain 400 message: it belongs to the day field.
      if (!Object.keys(mapped).length && /\bday\b/i.test(message)) mapped.itemDate = message;
      else if (!Object.keys(mapped).length && /end time/i.test(message)) mapped.endTime = message;
      setErrors(mapped);
      if (!Object.keys(mapped).length) setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const id = (k: string) => `${uid}-${k}`;
  const err = (k: FieldKey) =>
    errors[k] ? (
      <p id={id(`${k}-err`)} className="type-body-s mt-1.5 text-stamp">
        {errors[k]}
      </p>
    ) : null;
  const aria = (k: FieldKey) => ({
    'aria-invalid': errors[k] ? true : undefined,
    'aria-describedby': errors[k] ? id(`${k}-err`) : undefined,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={wide ? 'right' : 'bottom'}
        className={cn('flex flex-col gap-0 p-0', wide ? 'w-full sm:max-w-[420px]' : 'max-h-[92dvh]')}
      >
        <SheetHeader className="border-b border-rule px-5 pb-4 pt-5">
          <SheetTitle>{item ? 'Edit stop' : 'Add a stop'}</SheetTitle>
          <SheetDescription>
            Any day from {formatShortDate(trip.startDate)} to {formatShortDate(trip.endDate)}.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
            <div>
              <Label htmlFor={id('title')}>Title</Label>
              <Input
                id={id('title')}
                className="mt-1.5"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="Toshogu shrine"
                maxLength={255}
                autoComplete="off"
                {...aria('title')}
              />
              {err('title')}
            </div>

            <div>
              <Label htmlFor={id('itemDate')}>Day</Label>
              <Input
                id={id('itemDate')}
                type="date"
                className="mt-1.5 font-mono"
                value={form.itemDate}
                min={trip.startDate}
                max={trip.endDate}
                onChange={(e) => set('itemDate', e.target.value)}
                {...aria('itemDate')}
              />
              {err('itemDate')}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor={id('startTime')}>Starts</Label>
                <Input
                  id={id('startTime')}
                  type="time"
                  className="mt-1.5 font-mono"
                  value={form.startTime}
                  onChange={(e) => set('startTime', e.target.value)}
                  {...aria('startTime')}
                />
                {err('startTime')}
              </div>
              <div>
                <Label htmlFor={id('endTime')}>Ends</Label>
                <Input
                  id={id('endTime')}
                  type="time"
                  className="mt-1.5 font-mono"
                  value={form.endTime}
                  onChange={(e) => set('endTime', e.target.value)}
                  {...aria('endTime')}
                />
                {err('endTime')}
              </div>
            </div>
            <p className="type-body-s -mt-3 text-ink-2">Leave the time empty and it goes under Unscheduled.</p>

            <div>
              <Label htmlFor={id('location')}>Location</Label>
              <Input
                id={id('location')}
                className="mt-1.5"
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                placeholder="Nikko"
                maxLength={255}
                autoComplete="off"
                {...aria('location')}
              />
              {err('location')}
            </div>

            <div>
              <Label htmlFor={id('category')}>Category</Label>
              <Select value={form.category} onValueChange={(v) => set('category', v)}>
                <SelectTrigger id={id('category')} className="mt-1.5" {...aria('category')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CATEGORY}>No category</SelectItem>
                  {ITINERARY_CATEGORIES.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      <span className="flex items-center gap-2">
                        <IsoGlyph name={c.glyph} tone={c.tone} size={20} />
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {err('category')}
            </div>

            <div>
              <Label htmlFor={id('description')}>Notes</Label>
              <Textarea
                id={id('description')}
                className="mt-1.5 min-h-20"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Book ahead, cash only, meet at the east exit…"
                {...aria('description')}
              />
              {err('description')}
            </div>

            {formError ? (
              <p role="alert" className="type-body-s border-l-[3px] border-stamp bg-stamp-tint px-3 py-2 text-ink">
                {formError}
              </p>
            ) : null}
          </div>

          <div className="flex gap-3 border-t border-rule px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? 'Saving…' : item ? 'Save stop' : 'Add stop'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
