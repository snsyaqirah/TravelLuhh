// The three biggest spends as passbook rows (§9.6 Fund tab 3). A row opens the expense receipt sheet.
import { useMemo } from 'react';
import type { Expense, Trip } from '@/types';
import { Passbook, type PassbookRow } from '@/components/motifs';
import { CategoryGlyph } from '@/components/glyphs';
import { CATEGORY_META } from '@/data/categories';
import { isCategoryKey } from '@/lib/categories';
import { biggestSpends } from '@/components/trip/fund/fundMath';
import { initialsOf } from '@/components/trip/tripCopy';

export interface BiggestSpendsProps {
  trip: Pick<Trip, 'name' | 'currency' | 'budgetType'>;
  expenses: readonly Expense[];
  onOpen: (expenseId: number) => void;
}

function expenseRow(e: Expense, group: boolean): PassbookRow {
  const key = isCategoryKey(e.category) ? e.category : 'other';
  const payer = e.paidByUser?.name ?? e.addedByUser?.name;
  return {
    id: e.id,
    date: e.expenseDate,
    label: e.description,
    glyph: <CategoryGlyph category={key} size={20} />,
    out: Number(e.amount) || 0,
    sub: CATEGORY_META[key].code,
    originalAmount: e.originalAmount,
    originalCurrency: e.originalCurrency,
    payerInitials: group && payer ? initialsOf(payer) : undefined,
  };
}

export function BiggestSpends({ trip, expenses, onOpen }: BiggestSpendsProps) {
  const group = trip.budgetType !== 'solo';
  const rows = useMemo(() => biggestSpends(expenses).map((e) => expenseRow(e, group)), [expenses, group]);
  if (!rows.length) return null;
  return (
    <section aria-labelledby="fund-biggest" className="flex flex-col gap-3">
      <h2 id="fund-biggest" className="type-title text-ink">
        Biggest spends
      </h2>
      <Passbook
        rows={rows}
        currency={trip.currency}
        showBalance={false}
        groupByDay={false}
        caption={`${trip.name}: three biggest spends`}
        onRowClick={(line) => onOpen(Number(line.id))}
      />
    </section>
  );
}
