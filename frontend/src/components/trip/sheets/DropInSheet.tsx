// "Drop in" (Phase B travel fund, §2.3): put money in the trip's tabung, or take some out. Opened by
// ?sheet=drop-in from the Fund tab or the upcoming-trip FAB dial. Bottom sheet on phones, right drawer on desktop.
import { useEffect, useId, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { Trip } from '@/types';
import { useFundEntries } from '@/hooks/useFundEntries';
import { useToday } from '@/hooks/useToday';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMediaQuery, DESKTOP_QUERY } from '@/components/shell/useMediaQuery';
import { currencyPrefix } from '@/lib/money';
import { sentenceMoney } from '@/lib/fundCopy';
import { toISODate } from '@/lib/dates';
import { getErrorMessage } from '@/lib/axios';
import { cn } from '@/lib/utils';
import { cleanMoney, readAmount } from '@/components/trip/tripCopy';

export interface DropInSheetProps {
  trip: Trip;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Direction = 'in' | 'out';

const NOTE_MAX = 500;

export function DropInSheet({ trip, open, onOpenChange }: DropInSheetProps) {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const today = toISODate(useToday());
  const { addEntry, isSaving, saved } = useFundEntries(trip.id, { enabled: open });
  const ids = useId();
  const [direction, setDirection] = useState<Direction>('in');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  // A fresh slip every time the sheet opens.
  useEffect(() => {
    if (!open) return;
    setDirection('in');
    setAmount('');
    setDate(today);
    setNote('');
    setError(null);
  }, [open, today]);

  const c = trip.currency;
  const fundNow = saved || trip.savedAmount || 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const read = readAmount(amount, c);
    if ('error' in read) {
      setError(read.error);
      return;
    }
    if (!date) {
      setError('Pick the date the money went in.');
      return;
    }
    setError(null);
    const signed = direction === 'out' ? -read.amount : read.amount;
    try {
      await addEntry({ amount: signed, entryDate: date, note: note.trim() || undefined });
      toast.success(
        direction === 'out'
          ? `Taken out. ${sentenceMoney(read.amount, c)} from the tabung.`
          : `Masuk. ${sentenceMoney(read.amount, c)} in the tabung.`
      );
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "That didn't save. Try again."));
    }
  };

  const errorId = `${ids}-error`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={desktop ? 'right' : 'bottom'}
        className={cn('flex flex-col gap-5', desktop && 'w-[420px] sm:max-w-[420px]')}
      >
        <SheetHeader>
          <SheetTitle>{direction === 'out' ? 'Take out' : 'Drop in'}</SheetTitle>
          <SheetDescription>
            {trip.name} fund: {cleanMoney(fundNow, c)}
            {trip.budget > 0 ? ` of ${cleanMoney(trip.budget, c)}` : ''}.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <fieldset>
            <legend className="type-label mb-2 text-ink-2">Direction</legend>
            <div className="grid grid-cols-2 border border-rule-strong">
              {(['in', 'out'] as const).map((d) => (
                <label
                  key={d}
                  className={cn(
                    'type-label relative flex h-11 cursor-pointer items-center justify-center text-ink-2 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-ring',
                    d === 'out' && 'border-l border-rule-strong',
                    direction === d && 'bg-ink text-paper'
                  )}
                >
                  <input
                    type="radio"
                    name={`${ids}-direction`}
                    value={d}
                    checked={direction === d}
                    onChange={() => setDirection(d)}
                    className="sr-only"
                  />
                  {d === 'in' ? 'Drop in' : 'Take out'}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <Label htmlFor={`${ids}-amount`} className="type-label text-ink-2">
              Amount
            </Label>
            <div className="mt-2 flex items-baseline gap-2 border-b-[1.5px] border-field bg-sunken px-3 focus-within:border-fund">
              <span aria-hidden="true" className="font-mono text-sm text-ink-3">
                {currencyPrefix(c)}
              </span>
              <input
                id={`${ids}-amount`}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                className="h-16 min-w-0 flex-1 bg-transparent font-display text-[40px] leading-none text-ink outline-none placeholder:text-ink-3"
              />
            </div>
          </div>

          <div>
            <Label htmlFor={`${ids}-date`} className="type-label text-ink-2">
              Date
            </Label>
            <Input
              id={`${ids}-date`}
              type="date"
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-2 font-mono"
            />
          </div>

          <div>
            <Label htmlFor={`${ids}-note`} className="type-label text-ink-2">
              Note <span className="text-ink-3">(optional)</span>
            </Label>
            <Textarea
              id={`${ids}-note`}
              value={note}
              maxLength={NOTE_MAX}
              rows={2}
              placeholder={direction === 'out' ? 'Paid the hotel deposit' : "From this month's pay"}
              onChange={(e) => setNote(e.target.value)}
              className="mt-2"
            />
          </div>

          {error ? (
            <p id={errorId} role="alert" className="type-body-s text-stamp">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={isSaving} className="w-full">
            {isSaving ? 'Saving…' : direction === 'out' ? 'Take out' : 'Drop in'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
