// Jars (§9.6 Fund tab 5, separated trips): one jar per person, filled with what's left of their allocation.
// The owner sets allocations inline; a hint compares their sum with the trip budget (the server doesn't).
import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { MemberBudget, Trip } from '@/types';
import { useBudgets } from '@/hooks/useBudgets';
import { MiniBalangSvg } from '@/components/motifs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { currencyPrefix, parseMoneyInput, roundMoney } from '@/lib/money';
import { sentenceMoney } from '@/lib/fundCopy';
import { getErrorMessage } from '@/lib/axios';
import type { Phase } from '@/lib/phase';
import { cn } from '@/lib/utils';
import { allocationHint } from '@/components/trip/fund/fundMath';
import { readAmount } from '@/components/trip/tripCopy';

export interface BudgetAllocationPanelProps {
  trip: Pick<Trip, 'id' | 'name' | 'budget' | 'currency'>;
  /** Owner only: set or change allocations. */
  canManage: boolean;
  phase: Phase;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

function JarRow({ b, currency, phase }: { b: MemberBudget; currency: string; phase: Phase }) {
  // Without a jar the API reports remaining = −spent; that isn't "over" anything, so say there's no jar.
  const hasJar = b.allocated > 0;
  const over = hasJar && b.remaining < 0;
  const fill = hasJar ? clamp01(b.remaining / b.allocated) : 0;
  return (
    <li className="flex items-center gap-3 border-b border-rule py-2 last:border-b-0">
      <MiniBalangSvg fill={fill} phase={phase} over={over} width={36} height={46} />
      <div className="min-w-0 flex-1">
        <p className="type-body truncate font-medium text-ink">{b.name}</p>
        <p className="type-body-s text-ink-2">
          {hasJar
            ? `${sentenceMoney(b.spent, currency)} spent of ${sentenceMoney(b.allocated, currency)}`
            : `No jar yet · ${sentenceMoney(b.spent, currency)} spent`}
        </p>
      </div>
      <p className={cn('type-ledger shrink-0 text-right', !hasJar ? 'text-ink-3' : over ? 'text-stamp' : 'text-fund')}>
        {!hasJar ? 'no jar' : over ? `${sentenceMoney(-b.remaining, currency)} over` : `${sentenceMoney(b.remaining, currency)} left`}
      </p>
    </li>
  );
}

export function BudgetAllocationPanel({ trip, canManage, phase }: BudgetAllocationPanelProps) {
  const { budgets, totalAllocated, isLoading, error, refetch, saveBudgets, isSaving } = useBudgets(trip.id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const ids = useId();
  const c = trip.currency;

  useEffect(() => {
    if (!editing) return;
    setDraft(Object.fromEntries(budgets.map((b) => [b.userId, b.allocated > 0 ? String(b.allocated) : ''])));
    setFormError(null);
    // Only when editing starts; later refetches must not wipe what the owner is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const draftSum = useMemo(
    () => roundMoney(Object.values(draft).reduce((s, v) => s + (parseMoneyInput(v) ?? 0), 0), c),
    [draft, c]
  );
  const hint = allocationHint(editing ? draftSum : totalAllocated, trip.budget, c);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const rows: { userId: number; allocated: number }[] = [];
    for (const b of budgets) {
      const raw = (draft[b.userId] ?? '').trim();
      if (!raw) {
        rows.push({ userId: b.userId, allocated: 0 });
        continue;
      }
      const read = readAmount(raw, c);
      if ('error' in read) {
        setFormError(`${b.name}: ${read.error}`);
        return;
      }
      rows.push({ userId: b.userId, allocated: read.amount });
    }
    setFormError(null);
    try {
      await saveBudgets(rows);
      toast.success('Jars saved.');
      setEditing(false);
    } catch (err) {
      setFormError(getErrorMessage(err, "The jars didn't save. Try again."));
    }
  };

  return (
    <section aria-labelledby="fund-jars" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="fund-jars" className="type-title text-ink">
          Jars
        </h2>
        {canManage && !editing && budgets.length ? (
          <Button variant="secondary" size="sm" className="h-11 md:h-9" onClick={() => setEditing(true)}>
            Set jars
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <Skeleton className="h-36 w-full" />
      ) : error ? (
        <div className="flex items-center justify-between gap-3 border-y border-rule py-3">
          <p className="type-body-s text-ink-2">{error}</p>
          <Button variant="ghost" size="sm" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : editing ? (
        <form onSubmit={save} noValidate className="flex flex-col gap-3">
          <ul className="border-y border-rule">
            {budgets.map((b) => (
              <li key={b.userId} className="flex items-center gap-3 border-b border-rule py-2 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <label htmlFor={`${ids}-${b.userId}`} className="type-body block truncate text-ink">
                    {b.name}
                  </label>
                  <span id={`${ids}-${b.userId}-spent`} className="type-ledger block text-[13px] text-ink-3">
                    {sentenceMoney(b.spent, c)} spent so far
                  </span>
                </div>
                <span className="flex w-36 items-baseline gap-1.5 border-b-[1.5px] border-field bg-sunken px-2 focus-within:border-fund">
                  <span aria-hidden="true" className="font-mono text-xs text-ink-3">
                    {currencyPrefix(c)}
                  </span>
                  <input
                    id={`${ids}-${b.userId}`}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0"
                    aria-describedby={`${ids}-${b.userId}-spent`}
                    value={draft[b.userId] ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, [b.userId]: e.target.value }))}
                    className="type-ledger h-11 min-w-0 flex-1 bg-transparent text-right text-base text-ink outline-none"
                  />
                </span>
              </li>
            ))}
          </ul>
          <p
            aria-live="polite"
            className={cn('type-body-s', hint.tone === 'over' ? 'text-stamp' : hint.tone === 'short' ? 'text-brass-ink' : 'text-ink-2')}
          >
            {hint.text}
          </p>
          <p className="type-body-s text-ink-3">Leave a box empty to remove that person's jar.</p>
          {formError ? (
            <p role="alert" className="type-body-s text-stamp">
              {formError}
            </p>
          ) : null}
          <div className="flex gap-3">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save jars'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : budgets.length ? (
        <>
          <ul className="border-y border-rule">
            {budgets.map((b) => (
              <JarRow key={b.userId} b={b} currency={c} phase={phase} />
            ))}
          </ul>
          <p className={cn('type-body-s', hint.tone === 'over' ? 'text-stamp' : 'text-ink-2')}>{hint.text}</p>
        </>
      ) : (
        <p className="type-body text-ink-2">
          No jars yet.{' '}
          {canManage
            ? `Split the ${sentenceMoney(trip.budget, c)} between everyone with Set jars.`
            : 'The trip owner sets them.'}
        </p>
      )}
    </section>
  );
}
