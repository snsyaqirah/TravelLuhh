// People (?sheet=people, §9.6): who's on the trip and what they can do. Owner first. The owner invites by
// email (editor or viewer), changes roles and removes people; everyone else sees the list and can leave the
// trip; viewers change nothing. Bottom sheet on phones, right drawer from 768px. Uses useMembers (api client).
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { Member, Trip } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useMembers } from '@/hooks/useMembers';
import { useMediaQuery } from '@/components/shell/useMediaQuery';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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
import { getErrorMessage } from '@/lib/axios';
import { cn } from '@/lib/utils';
import { MemberRow } from '@/components/people/MemberRow';
import { InviteForm } from '@/components/people/InviteForm';
import { roleChangedLine, sortMembers, type MemberRole } from '@/components/people/peopleCopy';

export interface PeopleSheetProps {
  trip: Trip;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ListSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3 py-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 [--ledger-row:40px]" />
          <Skeleton className="h-10 flex-1 [--ledger-row:20px]" />
        </div>
      ))}
    </div>
  );
}

function roleSentence(trip: Trip, ownerName: string): string {
  switch (trip.myRole) {
    case 'owner':
      return 'You own this trip. Editors can log spends and change plans; viewers can only look.';
    case 'viewer':
      return `You can see everything here but can't change it. Ask ${ownerName} if you need to log spends.`;
    default:
      return `You can log spends and change plans. Only ${ownerName} can invite or remove people.`;
  }
}

export function PeopleSheet({ trip, open, onOpenChange }: PeopleSheetProps) {
  const wide = useMediaQuery('(min-width: 768px)');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { members, isLoading, error, refetch, addMember, updateRole, removeMember, leaveTrip } = useMembers(trip.id, {
    enabled: open,
  });

  const isOwner = trip.myRole === 'owner';
  // Show the trip's own roster while the fresh list loads.
  const list = useMemo(() => sortMembers(members?.length ? members : (trip.members ?? [])), [members, trip.members]);
  const ownerName = list.find((m) => m.role === 'owner')?.name.split(/\s+/)[0] ?? trip.owner?.name ?? 'the owner';

  const [busyId, setBusyId] = useState<number | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [announce, setAnnounce] = useState('');
  const [removing, setRemoving] = useState<Member | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  // Remounts the invite form (clearing its old "is on the trip" line) once the roster changes another way.
  const [inviteKey, setInviteKey] = useState(0);

  const setRowError = (id: number, msg: string | null) =>
    setRowErrors((e) => {
      const next = { ...e };
      if (msg) next[id] = msg;
      else delete next[id];
      return next;
    });

  const changeRole = async (m: Member, role: MemberRole) => {
    if (role === m.role) return;
    setBusyId(m.id);
    setRowError(m.id, null);
    try {
      await updateRole(m.id, role);
      setAnnounce(roleChangedLine(m.name, role));
    } catch (x) {
      setRowError(m.id, getErrorMessage(x, `${m.name}'s role didn't change. Try again.`));
    } finally {
      setBusyId(null);
    }
  };

  const doRemove = async () => {
    if (!removing) return;
    const m = removing;
    setRemoveError(null);
    setBusyId(m.id);
    try {
      await removeMember(m.id);
      setAnnounce(`${m.name} is off the trip. Anything they logged stays in the ledger.`);
      setRemoving(null);
      setInviteKey((k) => k + 1);
    } catch (x) {
      setRemoveError(getErrorMessage(x, `${m.name} is still on the trip. Try again.`));
    } finally {
      setBusyId(null);
    }
  };

  const doLeave = async () => {
    setLeaveError(null);
    setLeaving(true);
    try {
      await leaveTrip();
      toast.success(`You left ${trip.name}.`);
      navigate('/trips', { replace: true });
    } catch (x) {
      setLeaveError(getErrorMessage(x, "You're still on this trip. Try again."));
      setLeaving(false);
    }
  };

  const count = list.length;
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        ref={contentRef}
        side={wide ? 'right' : 'bottom'}
        className={cn('flex flex-col gap-0 overflow-hidden p-0', wide ? 'w-full sm:max-w-[440px]' : 'max-h-[88dvh]')}
        // Start on the sheet itself, not on the first role picker, so opening it can't change anyone's role.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          contentRef.current?.focus();
        }}
      >
        <SheetHeader className="border-b border-rule px-5 pb-4 pt-5">
          <p className="type-overline text-ink-2">
            {trip.name} · {count} {count === 1 ? 'person' : 'people'}
          </p>
          <SheetTitle>People</SheetTitle>
          <SheetDescription>{roleSentence(trip, ownerName)}</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(24px+env(safe-area-inset-bottom))]">
          {isLoading && list.length === 0 ? (
            <ListSkeleton />
          ) : error && list.length === 0 ? (
            <div role="alert" className="my-5 border-l-[3px] border-stamp bg-stamp-tint px-4 py-3">
              <p className="type-body text-ink">{error}</p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => void refetch()}>
                Try again
              </Button>
            </div>
          ) : (
            <>
              <ul aria-label="People on this trip" className="pt-1">
                {list.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    isYou={user?.id === m.userId}
                    manageable={isOwner && m.role !== 'owner'}
                    busy={busyId === m.id}
                    error={rowErrors[m.id]}
                    onRoleChange={(r) => void changeRole(m, r)}
                    onRemove={() => {
                      setRemoveError(null);
                      setRemoving(m);
                    }}
                  />
                ))}
              </ul>
              {error ? <p className="type-body-s text-ink-2">Showing the last list we had. {error}</p> : null}
              {isOwner && count <= 1 ? (
                <p className="type-body-s mt-1 text-ink-2">
                  Just you so far.{trip.budgetType === 'solo' ? ' The budget stays solo until you change it in Edit trip.' : ''}
                </p>
              ) : null}
            </>
          )}

          <p aria-live="polite" className="type-body-s min-h-5 py-1 text-fund">
            {announce}
          </p>

          {isOwner ? (
            <div className="mt-2 border-t border-rule pt-5">
              <InviteForm key={inviteKey} trip={trip} onInvite={addMember} />
            </div>
          ) : (
            <div className="mt-2 border-t border-rule pt-5">
              <p className="type-body-s text-ink-2">Leaving takes the trip off your list. What you logged stays with it.</p>
              <Button
                variant="destructive"
                className="mt-3"
                onClick={() => {
                  setLeaveError(null);
                  setConfirmLeave(true);
                }}
              >
                Leave trip
              </Button>
            </div>
          )}
        </div>

        <AlertDialog open={Boolean(removing)} onOpenChange={(o) => !o && busyId === null && setRemoving(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {removing?.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                They lose access to {trip.name}. Anything they logged stays in the ledger, and you can add them back.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {removeError ? (
              <p role="alert" className="type-body-s text-stamp">
                {removeError}
              </p>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busyId !== null}>Keep them</AlertDialogCancel>
              <AlertDialogAction
                variant="destructiveSolid"
                disabled={busyId !== null}
                onClick={(e) => {
                  e.preventDefault();
                  void doRemove();
                }}
              >
                {busyId !== null ? 'Removing…' : 'Remove'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={confirmLeave} onOpenChange={(o) => !o && !leaving && setConfirmLeave(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Leave {trip.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                You'll lose access to its ledger and plans. What you logged stays with the trip, and {ownerName} can add you back.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {leaveError ? (
              <p role="alert" className="type-body-s text-stamp">
                {leaveError}
              </p>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={leaving}>Stay</AlertDialogCancel>
              <AlertDialogAction
                variant="destructiveSolid"
                disabled={leaving}
                onClick={(e) => {
                  e.preventDefault();
                  void doLeave();
                }}
              >
                {leaving ? 'Leaving…' : 'Leave trip'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
