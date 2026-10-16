// Delete confirmation (§9.4, §11): "Delete Tokyo autumn? This removes the trip and all 38 entries for good."
// Keep it / Delete trip (the one solid stamp button). The entry count comes from the trip's ledger, fetched
// when the dialog opens (and shared with the trip page's cache).
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Trip } from '@/types';
import { useTrips } from '@/hooks/useTrips';
import { expenseService } from '@/services/expenseService';
import { queryKeys } from '@/lib/queryClient';
import { getErrorMessage } from '@/lib/axios';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/trips/fields/FieldBits';
import { deleteTripSentence } from '@/components/trips/tripActions';

export interface DeleteTripDialogProps {
  /** The trip to delete; null closes the dialog. */
  trip: Pick<Trip, 'id' | 'name' | 'members' | 'ownerId'> | null;
  onOpenChange: (open: boolean) => void;
  /** After a successful delete (e.g. navigate away from the trip page). */
  onDeleted?: (tripId: number) => void;
}

/** 'Aiman and Siti lose it too.' for group trips. */
function othersSentence(trip: DeleteTripDialogProps['trip']): string | null {
  const others = (trip?.members ?? []).filter((m) => m.userId !== trip?.ownerId).map((m) => m.name.split(' ')[0]);
  if (!others.length) return null;
  const names = others.length === 1 ? others[0] : `${others.slice(0, -1).join(', ')} and ${others[others.length - 1]}`;
  return `${names} ${others.length === 1 ? 'loses' : 'lose'} it too.`;
}

export function DeleteTripDialog({ trip: tripProp, onOpenChange, onDeleted }: DeleteTripDialogProps) {
  const { deleteTrip } = useTrips({ enabled: false });
  // Keep the last trip on screen while the dialog animates closed.
  const [last, setLast] = useState(tripProp);
  if (tripProp && tripProp !== last) setLast(tripProp);
  const trip = tripProp ?? last;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = tripProp !== null;
  const id = trip?.id ?? 0;
  const entries = useQuery({
    queryKey: queryKeys.expenses(id),
    queryFn: () => expenseService.getExpensesByTrip(id),
    enabled: open && id > 0,
  });
  const count = entries.data ? entries.data.length : null;

  const close = (next: boolean) => {
    if (pending) return;
    if (!next) setError(null);
    onOpenChange(next);
  };

  const confirm = async () => {
    if (!trip || pending) return;
    setPending(true);
    setError(null);
    try {
      await deleteTrip(trip.id);
      toast.success(`${trip.name} deleted.`);
      setPending(false);
      onOpenChange(false);
      onDeleted?.(trip.id);
    } catch (e) {
      setPending(false);
      setError(getErrorMessage(e, "The trip wasn't deleted. Try again."));
    }
  };

  const others = othersSentence(trip);

  return (
    <AlertDialog open={open} onOpenChange={close}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {trip?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {deleteTripSentence(count)}
            {others ? ` ${others}` : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <FieldError className="mt-0">{error}</FieldError>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
          <Button variant="destructiveSolid" onClick={() => void confirm()} disabled={pending}>
            {pending ? 'Deleting…' : 'Delete trip'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
