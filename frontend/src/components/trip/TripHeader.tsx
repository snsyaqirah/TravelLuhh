// Trip page header (§9.6): a top row (back to Trips, people, logbook, export, ⋯) and the title block (name,
// mono field row, PhaseTag). Group trips carry the airmail stripe on the top edge.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Clock, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import type { Expense, Trip } from '@/types';
import type { FundState } from '@/hooks/useFund';
import { useTrips } from '@/hooks/useTrips';
import { useMembers } from '@/hooks/useMembers';
import { AirmailStripe, PhaseTag, isGroupTrip, phaseTagPropsFor } from '@/components/motifs';
import { ExportMenu } from '@/components/export/ExportMenu';
import { UserSquare } from '@/components/shell/UserSquare';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { getErrorMessage } from '@/lib/axios';
import { cn } from '@/lib/utils';
import type { TripSheet } from '@/components/trip/useTripSheet';
import { headerFieldParts } from '@/components/trip/tripCopy';
import { DeleteTripDialog } from '@/components/trips/DeleteTripDialog';

export interface TripHeaderProps {
  trip: Trip;
  fund: FundState;
  expenses: Expense[];
  homeCountry?: string | null;
  today: Date;
  canEdit: boolean;
  isOwner: boolean;
  onOpenSheet: (sheet: TripSheet) => void;
}

function PeopleButton({ trip, onOpen }: { trip: Trip; onOpen: () => void }) {
  const members = trip.members ?? [];
  const shown = members.slice(0, 3);
  const extra = Math.max(0, (trip.memberCount ?? members.length) - shown.length);
  const names = members.map((m) => m.name).join(', ');
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={members.length ? `People on this trip: ${names}` : 'People on this trip'}
      className="pressable flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-1.5 text-ink hover:bg-accent"
    >
      <span className="flex items-center">
        {shown.map((m, i) => (
          <UserSquare
            key={m.id}
            user={m}
            size={24}
            className={cn('shadow-[0_0_0_2px_hsl(var(--paper))]', i > 0 && '-ml-1.5')}
          />
        ))}
      </span>
      {extra > 0 ? <span className="type-ledger text-ink-2">+{extra}</span> : null}
      <span className="type-label hidden lg:inline">People</span>
    </button>
  );
}

export function TripHeader({ trip, fund, expenses, homeCountry, today, canEdit, isOwner, onOpenSheet }: TripHeaderProps) {
  const navigate = useNavigate();
  const { setArchived } = useTrips({ enabled: false });
  const { leaveTrip, isSaving: isLeaving } = useMembers(trip.id, { enabled: false });
  const [confirm, setConfirm] = useState<'delete' | 'leave' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const group = isGroupTrip(trip);
  const tag = phaseTagPropsFor(trip, today, { saving: fund.mode === 'saving' });

  const closeConfirm = (open: boolean) => {
    if (!open) {
      setConfirm(null);
      setActionError(null);
    }
  };

  const archive = async () => {
    const next = !trip.isArchived;
    try {
      await setArchived(trip.id, next);
      toast.success(next ? `${trip.name} archived` : `${trip.name} is back with your trips`, {
        description: next ? 'It stays in your passport. Nothing was deleted.' : undefined,
        action: next ? { label: 'Undo', onClick: () => void setArchived(trip.id, false) } : undefined,
      });
    } catch (e) {
      toast.error(getErrorMessage(e, "Changes didn't save. Try again."));
    }
  };

  const doLeave = async () => {
    setActionError(null);
    try {
      await leaveTrip();
      toast.success(`You left ${trip.name}`);
      navigate('/trips', { replace: true });
    } catch (e) {
      setActionError(getErrorMessage(e, "You're still on this trip. Try again."));
    }
  };

  return (
    <header className="relative">
      {group ? <AirmailStripe className="mb-4" /> : null}

      <div className="flex items-center justify-between gap-2">
        <Link
          to="/trips"
          className="type-label -ml-2 hidden h-11 items-center gap-1 rounded-md px-2 text-ink-2 hover:text-ink md:inline-flex"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
          Trips
        </Link>

        <div className="-mr-2 ml-auto flex items-center gap-0.5 md:gap-1">
          <PeopleButton trip={trip} onOpen={() => onOpenSheet('people')} />
          <Button variant="ghost" size="icon" aria-label="Logbook" onClick={() => onOpenSheet('logbook')} className="lg:w-auto lg:px-3">
            <Clock aria-hidden="true" />
            <span className="type-label hidden lg:inline">Logbook</span>
          </Button>
          <ExportMenu trip={trip} expenses={expenses} compact className="lg:hidden" />
          <ExportMenu trip={trip} expenses={expenses} className="hidden lg:inline-flex" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More for this trip">
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {canEdit ? <DropdownMenuItem onSelect={() => onOpenSheet('edit')}>Edit trip</DropdownMenuItem> : null}
              {isOwner ? (
                <DropdownMenuItem onSelect={() => void archive()}>
                  {trip.isArchived ? 'Move back to trips' : 'Archive'}
                </DropdownMenuItem>
              ) : null}
              {isOwner ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-stamp focus:text-stamp" onSelect={() => setConfirm('delete')}>
                    Delete trip
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  {canEdit ? <DropdownMenuSeparator /> : null}
                  <DropdownMenuItem className="text-stamp focus:text-stamp" onSelect={() => setConfirm('leave')}>
                    Leave trip
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-2 md:mt-3">
        <h1 className="type-display-2 text-ink">{trip.name}</h1>
        <p className="type-ledger text-[13px] uppercase tracking-[0.04em] text-ink-2">
          {/* Pieces wrap between each other, never inside one ('GENG · 3' stays together). */}
          {headerFieldParts(trip, homeCountry).map((part, i) => (
            <span key={`${i}-${part}`}>
              {i > 0 ? ' ' : ''}
              <span className="whitespace-nowrap">
                {i > 0 ? '· ' : ''}
                {part}
              </span>
            </span>
          ))}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <PhaseTag {...tag} />
          {trip.isArchived ? <span className="type-overline text-ink-3">Archived</span> : null}
          {trip.myRole && trip.myRole !== 'owner' ? (
            <span className="type-overline text-ink-3">{trip.myRole === 'viewer' ? 'You can view' : 'You can edit'}</span>
          ) : null}
        </div>
      </div>

      {/* P2's shared delete confirmation (counts entries, names who else loses the trip). */}
      <DeleteTripDialog
        trip={confirm === 'delete' ? trip : null}
        onOpenChange={(o) => !o && setConfirm(null)}
        onDeleted={() => navigate('/trips', { replace: true })}
      />

      <AlertDialog open={confirm === 'leave'} onOpenChange={closeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave {trip.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll lose access to its ledger and plans. What you logged stays with the trip, and the owner can add you
              back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {actionError ? (
            <p role="alert" className="type-body-s text-stamp">
              {actionError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLeaving}>Stay</AlertDialogCancel>
            <AlertDialogAction
              variant="destructiveSolid"
              disabled={isLeaving}
              onClick={(e) => {
                e.preventDefault();
                void doLeave();
              }}
            >
              {isLeaving ? 'Leaving…' : 'Leave trip'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
