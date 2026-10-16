// Route facts the shell needs (§6.1–6.3): nav items, trip tabs, per-route chrome defaults. Pure, so it is
// tested without a router.
import { House, Stamp, Ticket, UserRound, type LucideIcon } from 'lucide-react';
import type { Phase } from '@/lib/phase';

export const TRIP_TABS = ['fund', 'ledger', 'days', 'pack', 'notes'] as const;
export type TripTab = (typeof TRIP_TABS)[number];

export function isTripTab(value: string | null | undefined): value is TripTab {
  return (TRIP_TABS as readonly string[]).includes(value ?? '');
}

/** Where /trips/:id lands: plan before, log during, review after. */
export function defaultTabForPhase(phase: Phase): TripTab {
  if (phase === 'upcoming') return 'days';
  if (phase === 'onTheRoad') return 'ledger';
  return 'fund';
}

/** The :tripId segment of any /trips/:tripId/* path ('new' is the create flow, not a trip). */
export function tripIdFromPath(pathname: string): string | null {
  const m = /^\/trips\/([^/]+)(?:\/|$)/.exec(pathname);
  if (!m || m[1] === 'new') return null;
  return decodeURIComponent(m[1]);
}

/**
 * Identity of a page for the route crossfade and scroll reset. Every tab of one trip shares a key, so
 * switching tabs only moves the underline (§10.3) and keeps the scroll position.
 */
export function routeFadeKey(pathname: string): string {
  const id = tripIdFromPath(pathname);
  return id ? `/trips/${id}` : pathname.replace(/\/+$/, '') || '/';
}

export interface NavItem {
  to: string;
  label: string;
  /** Mono index on the desktop rail: '01'. */
  index: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/home', label: 'Home', index: '01', icon: House },
  { to: '/trips', label: 'Trips', index: '02', icon: Ticket },
  { to: '/passport', label: 'Passport', index: '03', icon: Stamp },
  { to: '/me', label: 'Me', index: '04', icon: UserRound },
];

/** Trips stays lit inside a trip; the create flow belongs to the "Start a tabung" button instead. */
export function isNavActive(item: NavItem, pathname: string): boolean {
  if (pathname === item.to) return true;
  if (item.to === '/trips') return pathname.startsWith('/trips/') && pathname !== '/trips/new';
  return pathname.startsWith(`${item.to}/`);
}

/** What the mobile AppBar and BottomBar show when the page says nothing. */
export interface ChromeDefaults {
  title: string;
  /** Show the wordmark instead of a text title. */
  brand?: boolean;
  backTo?: string;
  backLabel?: string;
  hideBottomBar?: boolean;
}

export function defaultChrome(pathname: string): ChromeDefaults {
  if (pathname === '/trips/new') {
    return { title: 'Start a tabung', backTo: '/trips', backLabel: 'Back to Trips', hideBottomBar: true };
  }
  if (tripIdFromPath(pathname)) {
    // The title (the trip's name) is filled in by the shell once the trip is in the cache.
    return { title: '', backTo: '/trips', backLabel: 'Back to Trips' };
  }
  if (pathname === '/home') return { title: 'Home', brand: true };
  const item = NAV_ITEMS.find((n) => isNavActive(n, pathname));
  return { title: item?.label ?? '' };
}

/** Adds or replaces one query param, keeping the rest (used for ?sheet=). */
export function withParam(search: string, key: string, value: string): string {
  const params = new URLSearchParams(search);
  params.set(key, value);
  return `?${params.toString()}`;
}

export const APP_NAME = 'TravelLuhh';

/** Browser tab title: "Tokyo autumn · TravelLuhh"; just the app name while the page title is unknown. */
export function documentTitleFor(title: string | null | undefined): string {
  const t = (title ?? '').trim();
  return t ? `${t} · ${APP_NAME}` : APP_NAME;
}
