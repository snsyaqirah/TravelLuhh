// Google sign-in leaves the app and comes back on /auth/callback, so a ?next from Login would be lost.
// It rides along in sessionStorage (this tab only). Every access is wrapped: blocked storage just means /home.
import { safeNextPath } from '@/lib/session';

const KEY = 'travelluhh_oauth_next';

export function rememberOAuthNext(next: string | null | undefined): void {
  try {
    const safe = safeNextPath(next ?? null, '');
    if (safe) sessionStorage.setItem(KEY, safe);
    else sessionStorage.removeItem(KEY);
  } catch {
    // storage blocked: the callback falls back to /home
  }
}

/** Reads and clears the remembered path. Always a safe in-app path. */
export function takeOAuthNext(fallback = '/home'): string {
  try {
    const v = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return safeNextPath(v, fallback);
  } catch {
    return fallback;
  }
}
