// Ticket and tag text derived from a trip. Pure, so a ticket, a tag and a scene label never disagree.
import type { Trip } from '@/types';
import { formatDayMonth, formatRange, formatShortDate, isValidDate, parseLocalDate } from '@/lib/dates';
import { dayIndex, daysUntilStart, durationLabel, getPhase, tripDays, type Phase } from '@/lib/phase';

export interface PhaseTagInput {
  phase: Phase;
  daysToGo?: number;
  day?: number;
  totalDays?: number;
  homeDate?: string | Date;
  saving?: boolean;
}

const daysWord = (n: number) => `${n} ${n === 1 ? 'DAY' : 'DAYS'}`;

/** Tag text ('ON THE ROAD · DAY 3/9') and how a screen reader should say it ('On the road, day 3 of 9'). */
export function phaseTagText({ phase, daysToGo, day, totalDays, homeDate, saving }: PhaseTagInput): {
  text: string;
  spoken: string;
} {
  if (phase === 'onTheRoad') {
    if (day != null && totalDays != null) {
      return { text: `ON THE ROAD · DAY ${day}/${totalDays}`, spoken: `On the road, day ${day} of ${totalDays}` };
    }
    return { text: 'ON THE ROAD', spoken: 'On the road' };
  }
  if (phase === 'home') {
    const label = homeDate ? formatDayMonth(homeDate) : '';
    return label && homeDate
      ? { text: `HOME · ${label}`, spoken: `Home since ${formatShortDate(homeDate)}` }
      : { text: 'HOME', spoken: 'Home' };
  }
  const word = saving ? 'SAVING' : 'UPCOMING';
  const spokenWord = saving ? 'Saving' : 'Upcoming';
  if (daysToGo == null) return { text: word, spoken: spokenWord };
  const n = Math.max(0, Math.round(daysToGo));
  return { text: `${word} · ${daysWord(n)}`, spoken: `${spokenWord}, ${n} ${n === 1 ? 'day' : 'days'} to go` };
}

type TripDates = Pick<Trip, 'startDate' | 'endDate'>;

/** Everything <PhaseTag> needs, from a trip's dates. */
export function phaseTagPropsFor(trip: TripDates, today: Date = new Date(), o: { saving?: boolean } = {}): PhaseTagInput {
  const phase = getPhase(trip, today);
  if (phase === 'onTheRoad') {
    return { phase, day: dayIndex(trip, today) ?? 1, totalDays: tripDays(trip) };
  }
  if (phase === 'home') return { phase, homeDate: trip.endDate };
  return { phase, daysToGo: Math.max(0, daysUntilStart(trip, today)), saving: o.saving };
}

/** 'MY → JP', or just 'JP' when the home country is unknown or the same. */
export function routeLabel(destination: string, home?: string | null): string {
  const to = (destination ?? '').toUpperCase();
  const from = (home ?? '').toUpperCase();
  return from && from !== to ? `${from} → ${to}` : to;
}

/** Ticket field row: 'MY → JP · 12–20 NOV · 9D8N' (the year only shows when it isn't this year). */
export function ticketFieldRow(
  trip: TripDates & Pick<Trip, 'destinationCountry'>,
  home?: string | null,
  today: Date = new Date(),
): string {
  const range = formatRange(trip.startDate, trip.endDate);
  const start = parseLocalDate(trip.startDate);
  const thisYear = isValidDate(start) && start.getFullYear() === today.getFullYear();
  const shownRange = thisYear ? range.replace(new RegExp(`\\s${today.getFullYear()}$`), '') : range;
  return [routeLabel(trip.destinationCountry, home), shownRange, durationLabel(tripDays(trip))].filter(Boolean).join(' · ');
}

/** 'SOLO' · 'GENG · 3' (shared or separated with a known head count) · 'GENG'. */
export function partyLabel(trip: Pick<Trip, 'budgetType'> & Partial<Pick<Trip, 'memberCount' | 'members'>>): string {
  if (trip.budgetType === 'solo') return 'SOLO';
  const n = trip.memberCount ?? trip.members?.length ?? 0;
  return n > 1 ? `GENG · ${n}` : 'GENG';
}

/** Group trips (shared or separated) carry the airmail stripe. */
export const isGroupTrip = (trip: Pick<Trip, 'budgetType'>) => trip.budgetType === 'shared' || trip.budgetType === 'separated';
