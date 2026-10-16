// Travel fund (§2.3 Phase B): what's really been dropped into this trip's tabung, against the target. Entries
// print as passbook MASUK rows (withdrawals as KELUAR) with the running fund as BAKI. CUKUP once the target is met.
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { FundEntry, Trip } from '@/types';
import type { FundState } from '@/hooks/useFund';
import { useFundEntries } from '@/hooks/useFundEntries';
import { Passbook, PassportStamp, regionOf, type PassbookLine, type PassbookRow } from '@/components/motifs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatMoney } from '@/lib/money';
import { sentenceMoney } from '@/lib/fundCopy';
import { formatShortDate } from '@/lib/dates';
import { getErrorMessage } from '@/lib/axios';
import { BalangMark } from '@/components/brand/Wordmark';
import { fundedOn, savingPlan } from '@/components/trip/fund/fundMath';
import { savedLine } from '@/components/trip/tripCopy';

export interface TravelFundSectionProps {
  trip: Trip;
  fund: FundState;
  canEdit: boolean;
  today: Date;
  onDropIn: () => void;
}

const SHORT_LIST = 5;

function entryRows(entries: readonly FundEntry[]): PassbookRow[] {
  // The API lists newest first; the passbook wants oldest first so BAKI runs forward.
  return [...entries]
    .sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.id - b.id)
    .map((e) => ({
      id: e.id,
      date: e.entryDate,
      label: e.note?.trim() || (e.amount < 0 ? 'Out of the tabung' : 'Into the tabung'),
      in: e.amount > 0 ? e.amount : undefined,
      out: e.amount < 0 ? -e.amount : undefined,
      sub: e.userName ? e.userName.split(/\s+/)[0] : undefined,
      glyph: <BalangMark size={20} tone="ink" className={e.amount < 0 ? 'text-ink-3' : 'text-fund'} />,
    }));
}

export function TravelFundSection({ trip, fund, canEdit, today, onDropIn }: TravelFundSectionProps) {
  const { entries, saved, isLoading, error, refetch, deleteEntry } = useFundEntries(trip.id);
  const [showAll, setShowAll] = useState(false);
  const [pending, setPending] = useState<PassbookLine | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const c = trip.currency;

  const rows = useMemo(() => entryRows(entries), [entries]);
  // Newest five unless asked; BAKI stays right because the hidden rows are the oldest (opening balance).
  const shown = showAll || rows.length <= SHORT_LIST ? rows : rows.slice(-SHORT_LIST);
  const opening = shown === rows ? 0 : rows.slice(0, rows.length - SHORT_LIST).reduce((s, r) => s + (r.in ?? 0) - (r.out ?? 0), 0);
  const plan = fund.phase === 'upcoming' ? savingPlan(fund.toSave, trip.startDate, today) : null;
  const funded = fund.hasBudget && fund.saved >= fund.target && fund.saved > 0;
  const fundedDate = funded ? fundedOn(entries, fund.target) : null;

  const remove = async () => {
    if (!pending) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      await deleteEntry(Number(pending.id));
      const after = Math.max(0, saved - (pending.in ?? 0) + (pending.out ?? 0));
      toast.success(`Removed. The fund holds ${formatMoney(after, c)} now.`);
      setPending(null);
    } catch (e) {
      setRemoveError(getErrorMessage(e, "That entry wasn't removed. Try again."));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <section aria-labelledby="fund-travel" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="fund-travel" className="type-title text-ink">
          Travel fund
        </h2>
        {canEdit ? (
          <Button variant="secondary" size="sm" className="h-11 md:h-9" onClick={onDropIn}>
            Drop in
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : error ? (
        <div className="flex items-center justify-between gap-3 border-y border-rule py-3">
          <p className="type-body-s text-ink-2">{error}</p>
          <Button variant="ghost" size="sm" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              {fund.mode === 'saving' ? (
                <p className="type-body text-ink">{savedLine(fund)}</p>
              ) : (
                <p className="type-body text-ink">
                  Nothing dropped in yet.{' '}
                  {fund.hasBudget
                    ? `Until the first drop, the whole ${sentenceMoney(fund.target, c)} counts as already set aside.`
                    : 'Set a budget to give the jar a target.'}
                </p>
              )}
              {plan ? (
                <p className="type-body-s text-ink-2">
                  Save {sentenceMoney(plan.perWeek, c)} a week until {plan.until}.
                </p>
              ) : null}
            </div>
            {funded ? (
              <PassportStamp
                text="CUKUP"
                sub="Fully funded"
                code={trip.destinationCountry.toUpperCase()}
                date={fundedDate ? formatShortDate(fundedDate).toUpperCase() : undefined}
                region={regionOf(trip.destinationCountry)}
                tone="fund"
                seed={`cukup-${trip.id}`}
                size={64}
                title={`Fully funded: ${sentenceMoney(fund.saved, c)} saved`}
              />
            ) : null}
          </div>

          {rows.length ? (
            <Passbook
              rows={shown}
              openingBalance={opening}
              currency={c}
              showBalance
              groupByDay={false}
              newestFirst
              dense
              caption={`${trip.name} travel fund`}
              onRowClick={canEdit ? (line) => setPending(line) : undefined}
            />
          ) : null}
          {rows.length > SHORT_LIST || (canEdit && rows.length) ? (
            <div className="flex flex-wrap items-center justify-between gap-x-4">
              {canEdit ? <p className="type-body-s text-ink-3">Tap an entry to remove it.</p> : <span />}
              {rows.length > SHORT_LIST ? (
                <button
                  type="button"
                  aria-expanded={showAll}
                  onClick={() => setShowAll((v) => !v)}
                  className="type-label -mr-2 inline-flex h-11 items-center px-2 text-ink underline decoration-rule-strong underline-offset-[3px] hover:decoration-ink"
                >
                  {showAll ? 'Show the latest five' : `Show all ${rows.length}`}
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPending(null);
            setRemoveError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending
                ? `${pending.label}, ${formatMoney((pending.in ?? 0) - (pending.out ?? 0), c, { signed: true })} on ${formatShortDate(pending.date)}. The fund changes for everyone on the trip.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {removeError ? (
            <p role="alert" className="type-body-s text-stamp">
              {removeError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              variant="destructiveSolid"
              disabled={removing}
              onClick={(e) => {
                e.preventDefault();
                void remove();
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
