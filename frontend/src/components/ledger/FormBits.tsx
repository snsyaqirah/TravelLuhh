// Smaller Log spend sections: date chips, the "Paid by" picker and the receipt line items (§9.6 steps 5–7).
import { useEffect, useId, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Member, Trip } from '@/types';
import { formatMoney, parseMoneyInput } from '@/lib/money';
import { toISODate } from '@/lib/dates';
import { CATEGORIES } from '@/data/categories';
import { CategoryGlyph } from '@/components/glyphs';
import { Input, fieldClasses } from '@/components/ui/input';
import { ChoiceChips } from './ChoiceChips';
import { initialsOf } from './ledgerModel';
import { dayHint, shortDay } from './ledgerUi';
import { isISODate, newLine, summariseLines, yesterdayOf, type DraftErrors, type ExpenseDraft, type LineDraft } from './expenseDraft';

// ── Date ────────────────────────────────────────────────────────────────────

export interface DateChipsProps {
  value: string;
  onChange: (iso: string) => void;
  trip: Pick<Trip, 'startDate' | 'endDate'>;
  today: Date;
  error?: string;
}

export function DateChips({ value, onChange, trip, today, error }: DateChipsProps) {
  const uid = useId();
  const t = toISODate(today);
  const y = yesterdayOf(today);
  const preset = value === t ? 'today' : value === y ? 'yesterday' : 'pick';
  const [picking, setPicking] = useState(preset === 'pick');
  const pickRef = useRef<HTMLInputElement>(null);
  const shown = picking ? 'pick' : preset;
  const focusPick = useRef(false);

  useEffect(() => {
    if (picking && focusPick.current) {
      focusPick.current = false;
      pickRef.current?.focus();
    }
  }, [picking]);

  return (
    <div className="flex flex-col gap-2">
      <span id={`${uid}-label`} className="type-overline text-ink-2">
        Date
      </span>
      <ChoiceChips
        labelledBy={`${uid}-label`}
        describedBy={`${uid}-hint`}
        value={shown}
        onChange={(v) => {
          if (v === 'today') {
            setPicking(false);
            onChange(t);
          } else if (v === 'yesterday') {
            setPicking(false);
            onChange(y);
          } else {
            focusPick.current = true;
            setPicking(true);
          }
        }}
        options={[
          { value: 'today', label: 'Today' },
          { value: 'yesterday', label: 'Yesterday' },
          { value: 'pick', label: preset === 'pick' ? shortDay(value) : 'Pick a day', ariaLabel: preset === 'pick' ? `Picked ${shortDay(value)}` : 'Pick a day' },
        ]}
      />
      {picking ? (
        <div className="flex items-center gap-2">
          <label htmlFor={`${uid}-pick`} className="sr-only">
            Day paid
          </label>
          <Input
            ref={pickRef}
            id={`${uid}-pick`}
            type="date"
            value={isISODate(value) ? value : ''}
            onChange={(e) => {
              if (isISODate(e.target.value)) onChange(e.target.value);
            }}
            aria-invalid={error ? true : undefined}
            className="h-11 w-48 font-mono"
          />
        </div>
      ) : null}
      <p id={`${uid}-hint`} className={cn('type-body-s', error ? 'text-stamp' : 'text-ink-2')}>
        {error ?? dayHint(value, trip)}
      </p>
    </div>
  );
}

// ── Paid by ─────────────────────────────────────────────────────────────────

export interface PayerPickerProps {
  members: readonly Member[];
  value: number | null;
  onChange: (userId: number) => void;
  me?: number | null;
}

export function PayerPicker({ members, value, onChange, me }: PayerPickerProps) {
  const uid = useId();
  return (
    <div className="flex flex-col gap-2">
      <span id={`${uid}-label`} className="type-overline text-ink-2">
        Paid by
      </span>
      <ChoiceChips
        labelledBy={`${uid}-label`}
        value={value}
        onChange={onChange}
        options={members.map((m) => {
          const first = m.name.split(/\s+/)[0] || m.name;
          const you = me != null && m.userId === me;
          return {
            value: m.userId,
            ariaLabel: you ? `${m.name} (you)` : m.name,
            label: (
              <>
                <span aria-hidden="true" className="inline-flex h-6 min-w-6 items-center justify-center rounded-sm border border-ink px-1 font-mono text-[11px] font-medium text-ink">
                  {initialsOf(m.name)}
                </span>
                <span>{you ? `${first} (you)` : first}</span>
              </>
            ),
          };
        })}
      />
    </div>
  );
}

// ── Line items ──────────────────────────────────────────────────────────────

export interface LineItemsProps {
  draft: ExpenseDraft;
  patch: (p: Partial<ExpenseDraft>) => void;
  errors: DraftErrors;
}

export function LineItems({ draft, patch, errors }: LineItemsProps) {
  const uid = useId();
  const cur = draft.currency;
  const total = parseMoneyInput(draft.amount, cur);
  const { remaining, allocated } = summariseLines(draft);
  const lastAdded = useRef<string | null>(null);
  const refs = useRef(new Map<string, HTMLInputElement>());

  useEffect(() => {
    if (lastAdded.current) {
      refs.current.get(lastAdded.current)?.focus();
      lastAdded.current = null;
    }
  }, [draft.lines.length]);

  const setLine = (key: string, p: Partial<LineDraft>) => patch({ lines: draft.lines.map((l) => (l.key === key ? { ...l, ...p } : l)) });
  const add = () => {
    const line = newLine();
    lastAdded.current = line.key;
    patch({ lines: [...draft.lines, line] });
  };
  const remove = (key: string) => patch({ lines: draft.lines.filter((l) => l.key !== key) });

  let status: { text: string; tone: 'ink' | 'fund' | 'stamp' } | null = null;
  if (total != null && total > 0 && allocated > 0) {
    if (remaining > 0) status = { text: `${formatMoney(remaining, cur)} left to allocate`, tone: 'ink' };
    else if (remaining === 0) status = { text: `The lines add up to ${formatMoney(total, cur)}.`, tone: 'fund' };
    else status = { text: `The lines are ${formatMoney(-remaining, cur)} over the total.`, tone: 'stamp' };
  }

  return (
    <fieldset className="flex flex-col gap-3" aria-describedby={`${uid}-status`}>
      <legend className="type-overline mb-2 text-ink-2">Receipt lines</legend>
      <ol className="flex flex-col gap-3">
        {draft.lines.map((l, i) => (
          <li key={l.key} className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-2 border-l-2 border-rule-strong pl-3">
            <Input
              ref={(el) => {
                if (el) refs.current.set(l.key, el);
                else refs.current.delete(l.key);
              }}
              aria-label={`Line ${i + 1}, what`}
              placeholder="KitKat matcha, 3 boxes"
              value={l.description}
              maxLength={255}
              onChange={(e) => setLine(l.key, { description: e.target.value })}
              className="h-11"
            />
            <button
              type="button"
              onClick={() => remove(l.key)}
              aria-label={`Remove line ${i + 1}${l.description ? `, ${l.description}` : ''}`}
              className="row-span-2 inline-flex h-11 w-11 items-center justify-center self-start rounded-md text-ink-2 hover:bg-accent hover:text-ink"
            >
              <X className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
            </button>
            <div className="flex min-w-0 gap-2">
              <Input
                aria-label={`Line ${i + 1}, amount in ${cur}`}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={l.amount}
                onChange={(e) => setLine(l.key, { amount: e.target.value.replace(/[^\d.,]/g, '') })}
                className="h-11 w-28 shrink-0 font-mono"
              />
              <div className="relative min-w-0 flex-1">
                <select
                  aria-label={`Line ${i + 1}, category`}
                  value={l.category}
                  onChange={(e) => setLine(l.key, { category: e.target.value as LineDraft['category'] })}
                  className={cn(fieldClasses, 'h-11 appearance-none pl-9 pr-3 text-[15px]')}
                >
                  <option value="">No category</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <span aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2">
                  <CategoryGlyph category={l.category || 'other'} size={20} sketch={!l.category} />
                </span>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={add}
        className="type-label inline-flex h-11 items-center gap-1.5 self-start rounded-sm border border-dashed border-rule-strong px-3 text-ink hover:border-ink"
      >
        <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        Add a line
      </button>
      <p id={`${uid}-status`} aria-live="polite" className={cn('type-body-s', errors.lines ? 'text-stamp' : status?.tone === 'stamp' ? 'text-stamp' : status?.tone === 'fund' ? 'text-fund' : 'text-ink-2')}>
        {errors.lines ?? status?.text ?? 'Lines are optional. They show under the entry in the ledger.'}
      </p>
    </fieldset>
  );
}
