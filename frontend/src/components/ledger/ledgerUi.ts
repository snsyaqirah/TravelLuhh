// Small shared helpers for the ledger UI (kept out of component files so fast refresh stays happy).
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Trip } from '@/types';
import { parseLocalDate } from '@/lib/dates';
import { tripDayOf } from '@/components/motifs/passbookMath';
import { isISODate } from './expenseDraft';

/** Chip look shared by the Log spend choice rows (§5.2 chips: 2px radius, 44px tall). */
export function chipClass(selected: boolean, extra?: string) {
  return cn(
    'pressable inline-flex h-11 shrink-0 items-center gap-1.5 rounded-sm border px-3 text-[15px] leading-5',
    selected ? 'border-ink bg-fund-tint font-semibold text-ink' : 'border-rule-strong bg-leaf text-ink-2 hover:border-ink hover:text-ink',
    extra,
  );
}

/** 'Wed 14 Oct' */
export function shortDay(iso: string): string {
  return isISODate(iso) ? format(parseLocalDate(iso), 'EEE d MMM') : iso;
}

/** 'Day 5 of 9', or where a date falls outside the trip. */
export function dayHint(iso: string, trip: Pick<Trip, 'startDate' | 'endDate'>): string {
  const n = tripDayOf(iso, trip.startDate, trip.endDate);
  if (n === 'before') return 'Before the trip, so it counts as a booking.';
  if (n === 'after') return 'After the trip ended.';
  if (typeof n === 'number') {
    const total = (tripDayOf(trip.endDate, trip.startDate, trip.endDate) as number) || n;
    return `Day ${n} of ${total}`;
  }
  return '';
}
