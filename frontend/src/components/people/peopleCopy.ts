// People sheet helpers, pure: member order, role words, the email check, and the WhatsApp-able invite text
// for someone who doesn't have an account yet.
import type { Member, Role, Trip } from '@/types';
import { formatShortDate, isValidDate, parseLocalDate, parseServerDateTime } from '@/lib/dates';

export type MemberRole = Exclude<Role, 'owner'>;

export const ROLE_LABEL: Record<Role, string> = { owner: 'Owner', editor: 'Editor', viewer: 'Viewer' };

/** What each role can do, in one line (shown under the role picker). */
export const ROLE_HINT: Record<MemberRole, string> = {
  editor: 'Editors can log spends, plan days, pack and write notes.',
  viewer: 'Viewers can see everything but change nothing.',
};

/** Owner first, then by when they joined (the server already does this; kept so cached lists agree). */
export function sortMembers(members: ReadonlyArray<Member>): Member[] {
  const t = (m: Member) => {
    const d = parseServerDateTime(m.joinedAt);
    return isValidDate(d) ? d.getTime() : Number.MAX_SAFE_INTEGER;
  };
  return [...members].sort((a, b) => {
    if (a.role === 'owner' && b.role !== 'owner') return -1;
    if (b.role === 'owner' && a.role !== 'owner') return 1;
    return t(a) - t(b) || a.id - b.id;
  });
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** null when the address looks sendable; otherwise the sentence to show under the field. */
export function emailError(raw: string): string | null {
  const v = raw.trim();
  if (!v) return 'Type their email address.';
  if (v.length > 255) return 'That email is too long.';
  if (!EMAIL.test(v)) return "That doesn't look like an email address.";
  return null;
}

/** '12–20 Oct', '28 Nov–3 Dec', '30 Dec 2026–2 Jan 2027'. */
export function proseRange(start: string, end: string): string {
  const a = parseLocalDate(start);
  const b = parseLocalDate(end);
  if (!isValidDate(a) || !isValidDate(b)) return '';
  if (a.getFullYear() !== b.getFullYear()) return `${formatShortDate(a)} ${a.getFullYear()}–${formatShortDate(b)} ${b.getFullYear()}`;
  if (a.getMonth() === b.getMonth()) return a.getDate() === b.getDate() ? formatShortDate(a) : `${a.getDate()}–${formatShortDate(b)}`;
  return `${formatShortDate(a)}–${formatShortDate(b)}`;
}

/** A short message to paste into WhatsApp when the person has no TravelLuhh account yet. */
export function inviteText(trip: Pick<Trip, 'name' | 'startDate' | 'endDate'>, origin: string): string {
  const when = proseRange(trip.startDate, trip.endDate);
  const url = `${origin.replace(/\/$/, '')}/register`;
  return `Jom join ${trip.name}${when ? ` (${when})` : ''} on TravelLuhh, so we can track what we spend together. Make an account here: ${url} then send me the email you used and I'll add you.`;
}

/** "Siti Aisyah is on the trip as an editor." */
export function addedLine(m: Pick<Member, 'name' | 'role'>): string {
  return `${m.name} is on the trip as ${m.role === 'viewer' ? 'a viewer' : 'an editor'}.`;
}

/** "Aiman Hakim is now a viewer." */
export function roleChangedLine(name: string, role: MemberRole): string {
  return `${name} is now ${role === 'viewer' ? 'a viewer' : 'an editor'}.`;
}
