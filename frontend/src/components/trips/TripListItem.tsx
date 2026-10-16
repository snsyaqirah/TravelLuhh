// One trip on the Trips page: the TripTicket list variant as a link, with an always-visible ⋯ menu (44px, never
// hover-only). The menu only offers what this person may do: Edit for owners and editors; Archive or Unarchive
// and Delete for owners. Viewers get no menu at all, so no control does nothing.
import { MoreHorizontal } from 'lucide-react';
import type { Trip } from '@/types';
import { TripTicket } from '@/components/motifs';
import { computeFund } from '@/hooks/useFund';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface TripListItemProps {
  trip: Trip;
  today: Date;
  homeCountry?: string | null;
  onEdit?: (trip: Trip) => void;
  onArchive?: (trip: Trip) => void;
  onUnarchive?: (trip: Trip) => void;
  onDelete?: (trip: Trip) => void;
  className?: string;
}

export function TripListItem({ trip, today, homeCountry, onEdit, onArchive, onUnarchive, onDelete, className }: TripListItemProps) {
  const fund = computeFund(trip, today);
  const items = [
    onEdit ? { key: 'edit', label: 'Edit', run: () => onEdit(trip) } : null,
    onArchive ? { key: 'archive', label: 'Archive', run: () => onArchive(trip) } : null,
    onUnarchive ? { key: 'unarchive', label: 'Unarchive', run: () => onUnarchive(trip) } : null,
  ].filter(Boolean) as { key: string; label: string; run: () => void }[];
  const hasMenu = items.length > 0 || Boolean(onDelete);

  return (
    <div className={cn('relative', className)}>
      <TripTicket variant="list" trip={trip} fund={fund} today={today} homeCountry={homeCountry} to={`/trips/${trip.id}`} />
      {hasMenu ? (
        <div className="absolute right-0 top-0 z-10">
          {/* modal={false}: the menu hands focus straight to the confirm dialog without leaving pointer-events locked */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              aria-label={`More for ${trip.name}`}
              className="pressable flex h-11 w-11 items-center justify-center rounded-lg text-ink-2 hover:bg-accent hover:text-ink data-[state=open]:bg-accent data-[state=open]:text-ink"
            >
              <MoreHorizontal className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[11rem]">
              {items.map((it) => (
                <DropdownMenuItem key={it.key} onSelect={it.run}>
                  {it.label}
                </DropdownMenuItem>
              ))}
              {onDelete ? (
                <>
                  {items.length ? <DropdownMenuSeparator /> : null}
                  <DropdownMenuItem onSelect={() => onDelete(trip)} className="text-stamp focus:bg-stamp-tint focus:text-stamp">
                    Delete trip
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
    </div>
  );
}
