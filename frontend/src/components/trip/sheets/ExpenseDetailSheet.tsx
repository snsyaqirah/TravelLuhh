// One ledger entry as a receipt (spec §9.6 "row tap"): what was paid and in which currency, what it came to
// in the trip currency and at what rate, the day, who paid and who logged it, the note and the receipt lines.
// Editors get Edit (hands the entry to the Log spend sheet) and Delete (5 s Undo, no confirm dialog). The
// Delete here is also the keyboard and desktop route for the ledger's swipe-to-delete.
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import type { Expense, Trip } from '@/types';
import { useExpenses } from '@/hooks/useExpenses';
import { formatMoney, splitMoney } from '@/lib/money';
import { parseLocalDate, parseServerDateTime, isValidDate } from '@/lib/dates';
import { categoryMeta } from '@/data/categories';
import { CategoryGlyph } from '@/components/glyphs';
import { ReceiptRule, ReceiptSlip } from '@/components/motifs/ReceiptSlip';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LedgerSheet } from '@/components/ledger/LedgerSheet';
import { dayHint } from '@/components/ledger/ledgerUi';
import { payerOf } from '@/components/ledger/ledgerModel';
import { rateLabel } from '@/components/ledger/expenseDraft';
import { removeExpenseWithUndo, usePendingExpenseDeletes } from '@/components/ledger/pendingDeletes';

export interface ExpenseDetailSheetProps {
  trip: Trip;
  expenseId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (expense: Expense) => void;
}

function longDate(iso: string): string {
  const d = parseLocalDate(iso);
  return isValidDate(d) ? format(d, 'EEE d MMM yyyy') : iso;
}

function loggedAt(ts: string | null | undefined): string {
  const d = parseServerDateTime(ts ?? null);
  return isValidDate(d) ? format(d, 'd MMM, HH:mm') : '';
}

export function ExpenseDetailSheet({ trip, expenseId, open, onOpenChange, onEdit }: ExpenseDetailSheetProps) {
  const canEdit = trip.myRole !== 'viewer';
  const qc = useQueryClient();
  const { expenses, isLoading, error, refetch } = useExpenses(trip.id);
  const pendingIds = usePendingExpenseDeletes();
  // Keep showing the entry while the sheet slides away (the id leaves the URL first).
  const [lastId, setLastId] = useState<number | null>(expenseId);
  if (open && expenseId !== null && expenseId !== lastId) setLastId(expenseId);
  const id = open ? (expenseId ?? lastId) : lastId;
  const found = (id !== null && !pendingIds.has(id) ? expenses.find((e) => e.id === id) : null) ?? null;
  const [held, setHeld] = useState<Expense | null>(found);
  if (found && found !== held) setHeld(found);
  // Once deleted (row left the cache) keep the receipt on screen until the sheet is gone.
  const expense = found ?? (held && held.id === id && !open ? held : null);

  const meta = categoryMeta(expense?.category);
  const title = expense ? expense.description : isLoading ? 'Loading entry' : 'Entry';

  const remove = () => {
    if (!expense) return;
    // The undo lives outside this sheet, which unmounts as it closes.
    removeExpenseWithUndo(qc, expense);
    onOpenChange(false);
  };

  const foreign = Boolean(expense?.originalCurrency && expense.originalCurrency.toUpperCase() !== expense.currency.toUpperCase());
  const paidAmount = expense ? (foreign ? Number(expense.originalAmount) : Number(expense.amount)) : 0;
  const paidCurrency = expense ? (foreign ? (expense.originalCurrency as string) : expense.currency) : trip.currency;
  const parts = splitMoney(paidAmount, paidCurrency, { decimals: 'fixed' });
  const rate = expense && foreign ? (expense.fxRate && expense.fxRate > 0 ? Number(expense.fxRate) : Number(expense.amount) / paidAmount) : null;
  const payer = expense ? payerOf(expense) : null;
  const subs = expense?.subItems ?? [];
  const subTotal = subs.reduce((s, x) => s + Number(x.amount), 0);
  const hint = expense ? dayHint(expense.expenseDate, trip) : '';

  return (
    <LedgerSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      overline={expense ? `${meta.code} · ${meta.label.toUpperCase()}` : trip.name.toUpperCase()}
      data-sheet="expense"
      footer={
        expense && canEdit ? (
          <div className="flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => onEdit(expense)}>
              Edit
            </Button>
            <Button type="button" variant="destructive" className="flex-1" onClick={remove}>
              Delete
            </Button>
          </div>
        ) : null
      }
    >
      {expense ? (
        <ReceiptSlip raised>
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center">
              <CategoryGlyph category={meta.key} size={36} />
            </span>
            <div className="min-w-0">
              <p className="font-display text-[40px] font-medium leading-[44px] text-ink [font-variant-numeric:lining-nums_tabular-nums]">
                <span className="sr-only">{formatMoney(paidAmount, paidCurrency)}</span>
                <span aria-hidden="true">
                  <span className="mr-1.5 align-[0.95em] font-mono text-[13px] font-medium text-ink-3">{parts.prefix}</span>
                  {parts.int}
                  {parts.dec ? <span className="text-[24px]">{parts.dec}</span> : null}
                </span>
              </p>
              {foreign ? (
                <p className="type-ledger text-ink-2">
                  <span className="sr-only">About </span>
                  {formatMoney(expense.amount, expense.currency, { approx: true })}
                </p>
              ) : null}
            </div>
          </div>

          <ReceiptRule />

          <dl className="flex flex-col">
            <Row label="Date" value={longDate(expense.expenseDate)} />
            {hint ? <Row label="Trip day" value={hint.replace(/\.$/, '')} /> : null}
            <Row label="Category" value={meta.label} />
            {foreign ? <Row label="Paid" value={formatMoney(paidAmount, paidCurrency)} /> : null}
            <Row label={foreign ? `In ${expense.currency}` : 'Amount'} value={formatMoney(expense.amount, expense.currency)} strong />
            {rate ? <Row label="Rate" value={rateLabel(rate, expense.currency, paidCurrency)} /> : null}
            {payer?.name ? <Row label="Paid by" value={payer.name} /> : null}
            {expense.addedByUser?.name ? <Row label="Logged by" value={expense.addedByUser.name} /> : null}
            {loggedAt(expense.createdAt) ? <Row label="Logged on" value={loggedAt(expense.createdAt)} /> : null}
          </dl>

          {subs.length ? (
            <>
              <ReceiptRule />
              <p className="type-overline mb-1 text-ink-2">Receipt lines</p>
              <ul aria-label={`Items in ${expense.description}`}>
                {subs.map((s, i) => (
                  <li key={s.id} className="flex items-baseline gap-2 py-0.5">
                    <span aria-hidden="true" className="text-rule-strong">
                      {i === subs.length - 1 ? '└─' : '├─'}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-sans text-[14px] text-ink">{s.description}</span>
                    {s.category ? <span className="shrink-0 text-[12px] text-ink-3">{categoryMeta(s.category).code}</span> : null}
                    <span className="shrink-0 whitespace-nowrap">{formatMoney(s.amount, expense.currency)}</span>
                  </li>
                ))}
              </ul>
              {Math.abs(subTotal - expense.amount) > 0.005 ? (
                <p className="mt-1 text-[12px] text-ink-3">{formatMoney(expense.amount - subTotal, expense.currency)} not split into lines</p>
              ) : null}
            </>
          ) : null}

          {expense.notes ? (
            <>
              <ReceiptRule />
              <p className="type-overline mb-1 text-ink-2">Note</p>
              <p className="whitespace-pre-wrap break-words font-sans text-[15px] leading-6 text-ink">{expense.notes}</p>
            </>
          ) : null}
        </ReceiptSlip>
      ) : isLoading ? (
        <div role="status" aria-busy="true" className="flex flex-col gap-3">
          <span className="sr-only">Loading the entry</span>
          <Skeleton className="h-12 w-48 [--ledger-row:3rem]" />
          <Skeleton className="h-[200px] w-full rounded-lg" />
        </div>
      ) : error ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="type-body text-ink">{error}</p>
          <Button type="button" variant="secondary" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="type-body text-ink">That entry isn't in the ledger any more. Someone may have removed it.</p>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Back to the ledger
          </Button>
        </div>
      )}
    </LedgerSheet>
  );
}

/** 'Paid by ········ Siti Aisyah', as a dt/dd pair; the dotted leader lives inside the dd. */
function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline gap-2 py-1">
      <dt className="shrink-0 text-ink-2">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-baseline gap-2">
        <span aria-hidden="true" className="mb-1 min-w-4 flex-1 border-b border-dotted border-rule-strong" />
        <span className={strong ? 'text-right font-medium text-ink' : 'text-right text-ink'}>{value}</span>
      </dd>
    </div>
  );
}

export default ExpenseDetailSheet;
