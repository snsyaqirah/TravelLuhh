// Pack tab (§9.6): luggage-tag progress, quick packs, the checklist grouped by packing category, and a
// quick-add line that stays above the bottom bar on phones. Ticking is optimistic: usePacking flips the row
// at once and emits `packToggled`, so the box hops into the suitcase on the stage. At 100% the trip earns
// the SIAP stamp.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import type { PackingItem, PackingPreset, Trip } from '@/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GhostOutline, PassportStamp, regionOf } from '@/components/motifs';
import { usePacking } from '@/hooks/usePacking';
import { useUndoableDelete } from '@/hooks/useUndoableDelete';
import { queryKeys } from '@/lib/queryClient';
import { getErrorMessage } from '@/lib/axios';
import { LuggageTag } from '@/components/packing/LuggageTag';
import { PackChecklist } from '@/components/packing/PackChecklist';
import { QuickAdd } from '@/components/packing/QuickAdd';
import { QuickPacks } from '@/components/packing/QuickPacks';
import { groupPacking, packProgress, presetToast, progressText } from '@/components/packing/packing';

export interface PackTabProps {
  trip: Trip;
  canEdit: boolean;
}

function PackSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-6">
      <Skeleton className="h-10 w-44" />
      <Skeleton className="h-12" />
      <div className="space-y-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-36" style={{ ['--ledger-row' as string]: '48px' }} />
      </div>
    </div>
  );
}

export function PackTab({ trip, canEdit }: PackTabProps) {
  const { pathname } = useLocation();
  const { items, isLoading, error, refetch, toggleItem, addItem, deleteItem, addPreset } = usePacking(trip.id);

  const undoable = useUndoableDelete<PackingItem>({
    queryKey: queryKeys.packing(trip.id),
    remove: (item) => deleteItem(item.id),
    message: (item) => `Removed "${item.label}".`,
    flushKey: pathname,
  });
  const { pendingIds } = undoable;
  const visible = useMemo(() => (pendingIds.size ? items.filter((i) => !pendingIds.has(i.id)) : items), [items, pendingIds]);
  const groups = useMemo(() => groupPacking(visible), [visible]);
  const progress = packProgress(visible);
  const labels = useMemo(() => visible.map((i) => i.label), [visible]);

  // The stamp lands (stamp-in) only when the last box is ticked while you watch; on load it is already there.
  const wasDone = useRef<boolean | null>(null);
  const [stampLive, setStampLive] = useState(false);
  useEffect(() => {
    if (isLoading) return;
    if (wasDone.current === false && progress.done) setStampLive(true);
    if (!progress.done) setStampLive(false);
    wasDone.current = progress.done;
  }, [isLoading, progress.done]);

  const [busyPreset, setBusyPreset] = useState<PackingPreset | null>(null);
  const pickPreset = (preset: PackingPreset, label: string) => {
    setBusyPreset(preset);
    addPreset(preset)
      .then((added) => toast(presetToast(added.length, label)))
      .catch((e) => toast.error(getErrorMessage(e)))
      .finally(() => setBusyPreset(null));
  };

  const toggle = (item: PackingItem) => {
    toggleItem(item.id).catch((e) => toast.error(getErrorMessage(e, `Couldn't update "${item.label}". Try again.`)));
  };

  if (isLoading) return <PackSkeleton />;

  if (error && !items.length) {
    return (
      <div role="alert" className="border-l-[3px] border-stamp bg-stamp-tint px-4 py-3">
        <p className="type-body text-ink">{error}</p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const empty = progress.total === 0;

  return (
    <div>
      {empty ? (
        <div className="flex items-center gap-5 rounded-lg border border-dashed border-rule-strong px-4 py-5">
          <GhostOutline kind="suitcase" height={64} className="shrink-0" />
          <p className="type-body text-ink">
            {canEdit ? 'Empty bag. Start from a list or add your own.' : 'Empty bag. Nothing on the list yet.'}
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-6 sm:gap-10">
          <div className="min-w-0">
            <LuggageTag size="lg" tone={progress.done ? 'fund' : 'plain'} className={progress.done ? undefined : 'text-ink'}>
              <span aria-hidden="true">{progressText(progress)}</span>
              <span className="sr-only">
                {progress.packed} of {progress.total} packed
              </span>
            </LuggageTag>
            <div
              role="progressbar"
              aria-label="Packed"
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.packed}
              aria-valuetext={`${progress.packed} of ${progress.total} packed`}
              className="mt-3 h-1.5 w-full max-w-[280px] bg-sunken"
            >
              <div className="h-full bg-fund" style={{ width: `${Math.round(progress.ratio * 1000) / 10}%` }} />
            </div>
            {progress.done ? <p className="type-body mt-3 text-ink">All packed. Zip it.</p> : null}
          </div>
          {progress.done ? (
            <PassportStamp
              text="SIAP"
              tone="fund"
              size={64}
              region={regionOf(trip.destinationCountry)}
              seed={trip.id}
              animate={stampLive}
              decorative
              className="shrink-0"
            />
          ) : null}
        </div>
      )}

      {canEdit ? <QuickPacks className="mt-6" labels={labels} busy={busyPreset} onPick={pickPreset} /> : null}

      {!empty ? (
        <div className="mt-6">
          <PackChecklist groups={groups} canEdit={canEdit} onToggle={toggle} onRemove={undoable.remove} />
        </div>
      ) : null}

      {canEdit ? (
        <QuickAdd
          onAdd={(label, category) => addItem(label, category)}
          className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-10 -mx-4 mt-4 border-t border-rule bg-background px-4 pb-5 pt-3 md:bottom-0 md:mx-0 md:px-0 lg:max-w-[720px]"
        />
      ) : null}
    </div>
  );
}
