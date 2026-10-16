// Kongsi (§9.6 Fund tab 4): who's ahead, who's behind, and the fewest transfers to square up. Shared trips get
// balances and transfers; separated trips pay from their own jars, so nobody owes anybody by design.
import { toast } from 'sonner';
import type { Settlement, Trip } from '@/types';
import { useSettlement } from '@/hooks/useSettlement';
import { useAuth } from '@/context/AuthContext';
import { DivergingBar, PassportStamp, ReceiptSlip, regionOf } from '@/components/motifs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/lib/money';
import { settleUpText, transferLine } from '@/lib/fundCopy';
import { copyText } from '@/components/trip/clipboard';
import { balanceRows, firstName, personLabel, plainAmount, type KongsiBalance } from '@/components/trip/tripCopy';

export interface KongsiSectionProps {
  trip: Pick<Trip, 'id' | 'name' | 'currency' | 'budgetType' | 'destinationCountry'>;
  /** Poll with the rest of a live group trip. */
  live?: boolean;
}

async function copy(text: string, done: string) {
  if (await copyText(text)) toast.success(done);
  else toast.error("Couldn't copy here. Select the text and copy it instead.");
}

function SharedKongsi({ trip, settlement }: { trip: KongsiSectionProps['trip']; settlement: Settlement }) {
  const { user } = useAuth();
  const me = user?.id ?? null;
  const c = settlement.currency ?? trip.currency;
  const balances = settlement.balances as KongsiBalance[];
  const left = balances.filter((b) => b.onTrip === false);
  const settled = settlement.transactions.length === 0;

  return (
    <>
      <p className="type-body-s text-ink-2">
        {formatMoney(settlement.totalSpent, c)} spent
        {settlement.perPerson != null ? `, ${formatMoney(settlement.perPerson, c)} each` : ''}. Bars show who's ahead
        and who's behind.
      </p>
      <DivergingBar rows={balanceRows(balances, me)} currency={c} />
      {left.length ? (
        <p className="type-body-s text-ink-3">
          {left.map((b) => firstName(b.name)).join(' and ')} left the trip, so {left.length === 1 ? 'takes' : 'take'} no
          share. The others pay them back.
        </p>
      ) : null}

      {settled ? (
        <div className="flex items-center gap-4 border-y border-rule py-3">
          <PassportStamp
            text="SETTLED"
            code={trip.destinationCountry.toUpperCase()}
            region={regionOf(trip.destinationCountry)}
            tone="fund"
            seed={`settled-${trip.id}`}
            size={64}
            decorative
          />
          <p className="type-body text-ink">All square. Nobody owes anybody.</p>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-3" aria-label="Transfers to square up">
            {settlement.transactions.map((t) => (
              <li key={`${t.fromUserId}-${t.toUserId}`}>
                <ReceiptSlip className="flex items-end justify-between gap-3 pb-6 pt-3">
                  <span className="min-w-0">
                    <span className="block truncate text-ink-2">
                      {personLabel(t.fromUserId, t.fromName, me)} → {personLabel(t.toUserId, t.toName, me)}
                    </span>
                    <span className="type-money-l block text-ink">{formatMoney(t.amount, c)}</span>
                    <span className="sr-only">{transferLine(t, c)}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-mr-2 h-11 shrink-0 px-2 font-sans"
                    aria-label={`Copy ${formatMoney(t.amount, c)}, ${firstName(t.fromName)} to ${firstName(t.toName)}`}
                    onClick={() => void copy(plainAmount(t.amount, c), `Copied ${plainAmount(t.amount, c)}.`)}
                  >
                    Copy amount
                  </Button>
                </ReceiptSlip>
              </li>
            ))}
          </ul>
          <div>
            <Button
              variant="secondary"
              onClick={() =>
                void copy(settleUpText(trip.name, settlement.transactions, c), 'Copied. Paste it in the group chat.')
              }
            >
              Copy for WhatsApp
            </Button>
          </div>
        </>
      )}
    </>
  );
}

export function KongsiSection({ trip, live }: KongsiSectionProps) {
  const { settlement, isLoading, error, refetch } = useSettlement(trip.id, { live });

  return (
    <section aria-labelledby="fund-kongsi" className="flex flex-col gap-3">
      <h2 id="fund-kongsi" className="type-title text-ink">
        Kongsi
      </h2>
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : error || !settlement ? (
        <div className="flex items-center justify-between gap-3 border-y border-rule py-3">
          <p className="type-body-s text-ink-2">{error ?? "Couldn't load who owes what."}</p>
          <Button variant="ghost" size="sm" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : settlement.totalSpent <= 0 ? (
        <p className="type-body text-ink-2">Nothing to split yet. Whoever pays, log it with their name and it lands here.</p>
      ) : trip.budgetType === 'separated' ? (
        <p className="type-body text-ink">
          Everyone pays from their own jar on this trip, so nobody owes anybody. See the jars below.
        </p>
      ) : (
        <SharedKongsi trip={trip} settlement={settlement} />
      )}
    </section>
  );
}
