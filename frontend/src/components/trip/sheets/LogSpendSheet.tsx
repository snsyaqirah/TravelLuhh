// Log spend sheet (spec §9.6, §2.6): amount first, then currency, category, what, when, who paid, and the
// receipt's line items. Creates when there's no `expense`, edits (PUT) when there is. Whatever currency was
// paid in, the entry goes out in the trip currency with the original amount and the rate beside it.
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import type { CreateExpenseInput, CreateExpenseRequest, Expense, Trip } from '@/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useExpenses } from '@/hooks/useExpenses';
import { useRates } from '@/hooks/useRates';
import { useToday } from '@/hooks/useToday';
import { getErrorMessage } from '@/lib/axios';
import { invalidateKeys, moneyKeys, queryKeys } from '@/lib/queryClient';
import { expenseService } from '@/services/expenseService';
import { CATEGORY_META, type CategoryKey } from '@/data/categories';
import { isGroupTrip } from '@/components/motifs/tripMeta';
import { ReceiptRule, ReceiptSlip } from '@/components/motifs/ReceiptSlip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LedgerSheet } from '@/components/ledger/LedgerSheet';
import { CategoryGrid } from '@/components/ledger/CategoryGrid';
import { MoneyEntry } from '@/components/ledger/MoneyEntry';
import { DateChips, LineItems, PayerPicker } from '@/components/ledger/FormBits';
import { dayHint } from '@/components/ledger/ledgerUi';
import {
  FIELD_ORDER,
  MAX_NOTES,
  buildExpenseInput,
  draftFromExpense,
  newDraft,
  newLine,
  type DraftErrors,
  type ExpenseDraft,
} from '@/components/ledger/expenseDraft';

/** The wire body for a PUT that has to carry `subItems: []` (drop every receipt line). */
function toRequestBody(input: CreateExpenseInput, tripId: number): CreateExpenseRequest {
  return {
    tripId,
    description: input.description,
    amount: input.amount,
    currency: input.currency,
    category: input.category,
    expenseDate: input.expenseDate ?? '',
    notes: input.notes,
    originalAmount: input.originalAmount,
    originalCurrency: input.originalCurrency,
    fxRate: input.fxRate,
    paidBy: input.paidBy,
    subItems: [],
  };
}

export interface LogSpendSheetProps {
  trip: Trip;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit mode when given. */
  expense?: Expense;
}

export function LogSpendSheet({ trip, open, onOpenChange, expense }: LogSpendSheetProps) {
  const { user } = useAuth();
  const me = user?.id ?? null;
  const today = useToday();
  const qc = useQueryClient();
  const members = useMemo(() => trip.members ?? [], [trip.members]);
  const group = isGroupTrip(trip) && members.length > 1;
  const rates = useRates(trip.currency);
  const { createExpense, updateExpense } = useExpenses(trip.id, { enabled: open });

  const formId = useId();
  const uid = useId();
  const amountRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const init = (): ExpenseDraft => (expense ? draftFromExpense(expense, trip, { group }) : newDraft(trip, { me, group, today }));
  const [draft, setDraft] = useState<ExpenseDraft>(init);
  const [editing, setEditing] = useState<Expense | undefined>(expense);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notesOpen, setNotesOpen] = useState(Boolean(expense?.notes));
  const [touched, setTouched] = useState(false);

  // Start fresh each time the sheet opens (or the entry being edited arrives). While it closes, keep what's
  // on screen so the exit animation doesn't flash an empty form.
  const resetKey = open ? `open:${expense?.id ?? 'new'}` : 'closed';
  const [lastKey, setLastKey] = useState(resetKey);
  if (resetKey !== lastKey) {
    setLastKey(resetKey);
    if (open) {
      setDraft(init());
      setEditing(expense);
      setErrors({});
      setServerError(null);
      setSaving(false);
      setTouched(false);
      setNotesOpen(Boolean(expense?.notes));
    }
  }

  const patch = (p: Partial<ExpenseDraft>) => {
    setDraft((d) => ({ ...d, ...p }));
    if (serverError) setServerError(null);
  };

  // Re-check the fields that already showed an error while the person fixes them.
  useEffect(() => {
    if (!touched) return;
    const res = buildExpenseInput(draft, { trip, rates: rates.rates, hadSubItems: Boolean(editing?.subItems?.length) });
    setErrors(res.errors ?? {});
  }, [draft, touched, trip, rates.rates, editing]);

  const setCategory = (category: CategoryKey) => {
    const opening = category === 'bundle' && !draft.itemise && draft.lines.length === 0;
    patch(opening ? { category, itemise: true, lines: [newLine(), newLine()] } : { category });
  };

  const focusFirstError = (errs: DraftErrors) => {
    const field = FIELD_ORDER.find((f) => errs[f]);
    if (!field) return;
    if (field === 'amount') {
      amountRef.current?.focus();
      return;
    }
    const section = formRef.current?.querySelector<HTMLElement>(`[data-field="${field}"]`);
    const target =
      section?.querySelector<HTMLElement>('[aria-invalid="true"], [role="radio"][tabindex="0"], input, select, textarea, button') ?? section;
    target?.focus();
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const hadSubItems = Boolean(editing?.subItems?.length);
    const res = buildExpenseInput(draft, { trip, rates: rates.rates, hadSubItems });
    if (!res.input) {
      setTouched(true);
      setErrors(res.errors ?? {});
      focusFirstError(res.errors ?? {});
      return;
    }
    setErrors({});
    setServerError(null);
    setSaving(true);
    try {
      if (editing) {
        const input = { ...res.input, id: editing.id };
        // Leaving the payer alone keeps it, even if they've since left the trip.
        const before = editing.paidBy ?? editing.addedBy ?? null;
        if (!group || input.paidBy === before) delete input.paidBy;
        if (input.subItems && input.subItems.length === 0) {
          // useExpenses drops an empty list (which would keep the old lines), so send this one directly.
          const saved = await expenseService.updateExpense(editing.id, toRequestBody(input, trip.id));
          qc.setQueryData<Expense[]>(queryKeys.expenses(trip.id), (old) => old?.map((x) => (x.id === saved.id ? saved : x)));
          void invalidateKeys(qc, moneyKeys(trip.id));
        } else {
          await updateExpense(input);
        }
        toast(`Saved. ${res.preview.paid} in ${res.preview.label}.`);
      } else {
        await createExpense(res.input);
        toast(`Masuk. ${res.preview.paid} to ${res.preview.label}.`);
      }
      onOpenChange(false);
    } catch (err) {
      setServerError(getErrorMessage(err, "That didn't save. Try again."));
    } finally {
      setSaving(false);
    }
  };

  const isEdit = Boolean(editing);
  const hint = dayHint(draft.date, trip);
  const overline = `${trip.name.toUpperCase()}${hint.startsWith('Day') ? ` · ${hint.toUpperCase()}` : ''}`;
  const meta = draft.category ? CATEGORY_META[draft.category] : null;
  const suggestions = (meta?.suggestions ?? ['Nasi lemak', 'Grab', 'Hotel night', 'Tickets', 'Souvenirs']).slice(0, 5);
  const ids = { cat: `${uid}-cat`, catErr: `${uid}-cat-err`, desc: `${uid}-desc`, descHint: `${uid}-desc-hint`, notes: `${uid}-notes` };

  return (
    <LedgerSheet
      open={open}
      onOpenChange={(o) => {
        if (!o && saving) return;
        onOpenChange(o);
      }}
      title={isEdit ? 'Edit entry' : 'Log spend'}
      overline={overline}
      initialFocus={amountRef}
      fill
      data-sheet="log-spend"
      footer={
        <div className="flex flex-col gap-2">
          {serverError ? (
            <p role="alert" className="type-body-s border-l-[3px] border-stamp bg-stamp-tint px-3 py-2 text-ink">
              {serverError}
            </p>
          ) : null}
          <Button
            type="submit"
            form={formId}
            size="lg"
            disabled={saving}
            aria-label={isEdit ? undefined : 'Masuk, add to ledger'}
            className="w-full"
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Masuk'}
          </Button>
        </div>
      }
    >
      <form id={formId} ref={formRef} onSubmit={onSubmit} noValidate aria-label={isEdit ? 'Edit entry' : 'Log spend'}>
        <ReceiptSlip raised className="font-sans text-[15px]">
          <div data-field="amount">
            <MoneyEntry draft={draft} patch={patch} trip={trip} rates={rates} amountRef={amountRef} errors={errors} />
          </div>

          <ReceiptRule className="my-4" />

          <div data-field="category" className="flex flex-col gap-2">
            <span id={ids.cat} className="type-overline text-ink-2">
              Category
            </span>
            <CategoryGrid
              value={draft.category}
              onChange={setCategory}
              labelledBy={ids.cat}
              invalid={Boolean(errors.category)}
              describedBy={errors.category ? ids.catErr : undefined}
            />
            {errors.category ? (
              <p id={ids.catErr} className="type-body-s text-stamp">
                {errors.category}
              </p>
            ) : null}
          </div>

          <ReceiptRule className="my-4" />

          <div data-field="description" className="flex flex-col gap-2">
            <label htmlFor={ids.desc} className="type-overline text-ink-2">
              What was it
            </label>
            <Input
              id={ids.desc}
              value={draft.description}
              maxLength={255}
              autoComplete="off"
              enterKeyHint="done"
              placeholder={`e.g. ${suggestions[0]}`}
              onChange={(e) => patch({ description: e.target.value })}
              aria-describedby={ids.descHint}
              aria-invalid={errors.description ? true : undefined}
            />
            <div className="relative -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none" data-vaul-no-drag role="group" aria-label="Suggestions">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => patch({ description: s })}
                  className={cn(
                    'pressable inline-flex h-11 shrink-0 items-center rounded-sm border px-3 text-[14px]',
                    draft.description === s ? 'border-ink bg-fund-tint text-ink' : 'border-rule bg-paper text-ink-2 hover:border-ink hover:text-ink',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <p id={ids.descHint} className={cn('type-body-s', errors.description ? 'text-stamp' : 'text-ink-2')}>
              {errors.description ?? (meta ? `Optional. Left blank, it's logged as "${meta.label}".` : 'Optional.')}
            </p>
          </div>

          <ReceiptRule className="my-4" />

          <div data-field="date">
            <DateChips value={draft.date} onChange={(date) => patch({ date })} trip={trip} today={today} error={errors.date} />
          </div>

          {group ? (
            <>
              <ReceiptRule className="my-4" />
              <PayerPicker members={members} value={draft.paidBy} onChange={(paidBy) => patch({ paidBy })} me={me} />
            </>
          ) : null}

          <ReceiptRule className="my-4" />

          <div data-field="lines" className="flex flex-col gap-3">
            {draft.itemise ? (
              <LineItems draft={draft} patch={patch} errors={errors} />
            ) : null}
            <button
              type="button"
              aria-pressed={draft.itemise}
              onClick={() =>
                patch(draft.itemise ? { itemise: false } : { itemise: true, lines: draft.lines.length ? draft.lines : [newLine(), newLine()] })
              }
              className="type-label inline-flex min-h-11 items-center gap-1.5 self-start text-ink underline decoration-rule-strong underline-offset-[3px] hover:decoration-ink"
            >
              {draft.itemise ? (
                'Remove the receipt lines'
              ) : (
                <>
                  <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  Split the receipt into lines
                </>
              )}
            </button>
          </div>

          <ReceiptRule className="my-4" />

          <div data-field="notes" className="flex flex-col gap-2">
            {notesOpen ? (
              <>
                <label htmlFor={ids.notes} className="type-overline text-ink-2">
                  Note
                </label>
                <Textarea
                  id={ids.notes}
                  value={draft.notes}
                  maxLength={MAX_NOTES}
                  rows={3}
                  placeholder="Two rooms. Paid on Aiman's card."
                  onChange={(e) => patch({ notes: e.target.value })}
                  aria-invalid={errors.notes ? true : undefined}
                />
                {errors.notes ? <p className="type-body-s text-stamp">{errors.notes}</p> : null}
              </>
            ) : (
              <button
                type="button"
                onClick={() => setNotesOpen(true)}
                className="type-label inline-flex min-h-11 items-center gap-1.5 self-start text-ink underline decoration-rule-strong underline-offset-[3px] hover:decoration-ink"
              >
                <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Add a note
              </button>
            )}
          </div>
        </ReceiptSlip>
      </form>
    </LedgerSheet>
  );
}

export default LogSpendSheet;
