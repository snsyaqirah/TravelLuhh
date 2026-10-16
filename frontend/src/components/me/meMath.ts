// Me page helpers (§9.8), pure: the passport data page's fields and its decorative MRZ line, form checks
// that mirror the backend's rules, and the favourite-currency list for the Rates board.
import type { User } from '@/types';
import { isValidDate, parseServerDateTime } from '@/lib/dates';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const MRZ_LENGTH = 44;

/** Up to two initials for the photo box: 'Siti Aisyah' → 'SA', 'Syaqirah' → 'S'. */
export function initials(user: Pick<User, 'name' | 'email'> | null | undefined): string {
  const words = (user?.name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return (user?.email ?? '').trim().charAt(0).toUpperCase();
  return words
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

/** 'OCT 2026' from the account's createdAt, or '' when it can't be read. */
export function sinceLabel(createdAt: string | null | undefined): string {
  if (!createdAt) return '';
  const d = parseServerDateTime(createdAt);
  return isValidDate(d) ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '';
}

/** How this person signs in: GOOGLE, EMAIL, or GOOGLE + EMAIL (a Google account that also set a password). */
export function signInLabel(user: Pick<User, 'authProvider' | 'hasPassword'>): string {
  if (user.authProvider === 'google') return user.hasPassword ? 'GOOGLE + EMAIL' : 'GOOGLE';
  return 'EMAIL';
}

/**
 * The machine-readable line at the foot of a passport data page, for decoration only:
 * 'P<MY<SYAQIRAH<BINTI<OSMAN<<<<…' padded with '<' to 44 characters.
 */
export function mrzLine(user: Pick<User, 'name' | 'country'>): string {
  const country = (user.country ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'XX';
  const name = (user.name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]+/g, '<')
    .replace(/^<+|<+$/g, '');
  return `P<${country}<${name}`.padEnd(MRZ_LENGTH, '<').slice(0, MRZ_LENGTH);
}

/** Same rule as PUT /users/profile: 2 to 100 characters. null when fine. */
export function nameError(raw: string): string | null {
  const name = raw.trim();
  if (!name) return 'Type your name.';
  if (name.length < 2) return 'Your name needs at least 2 characters.';
  if (name.length > 100) return 'Keep your name under 100 characters.';
  return null;
}

export interface PasswordDraft {
  current: string;
  next: string;
  confirm: string;
}

export type PasswordErrors = Partial<Record<keyof PasswordDraft, string>>;

/** Same rules as PUT /users/change-password (8–128 characters, different from the current one). */
export function passwordErrors(d: PasswordDraft): PasswordErrors {
  const e: PasswordErrors = {};
  if (!d.current) e.current = 'Type your current password.';
  if (!d.next) e.next = 'Type a new password.';
  else if (d.next.length < 8) e.next = 'Use at least 8 characters.';
  else if (d.next.length > 128) e.next = 'Keep it under 128 characters.';
  else if (d.current && d.next === d.current) e.next = 'The new password has to be different from the current one.';
  if (!d.confirm) e.confirm = 'Type the new password again.';
  else if (d.next && d.confirm !== d.next) e.confirm = "These don't match the new password.";
  return e;
}

/** At most this many favourites (currencyService keeps four). */
export const MAX_FAVOURITES = 4;

/** Currencies offered as Rates favourites, most likely first for someone travelling from Malaysia. */
export const FAVOURITE_CHOICES: readonly string[] = [
  'MYR',
  'SGD',
  'JPY',
  'THB',
  'KRW',
  'IDR',
  'USD',
  'CNY',
  'HKD',
  'TWD',
  'VND',
  'PHP',
  'AUD',
  'GBP',
  'EUR',
  'SAR',
  'AED',
  'INR',
];

/** Toggle one code in the list (keeps order, never more than MAX_FAVOURITES, never the home currency). */
export function toggleFavourite(list: readonly string[], code: string, home: string): string[] {
  const c = code.toUpperCase();
  const clean = list.filter((x) => x !== home.toUpperCase());
  if (clean.includes(c)) return clean.filter((x) => x !== c);
  if (c === home.toUpperCase() || clean.length >= MAX_FAVOURITES) return clean;
  return [...clean, c];
}
