// Google sign-in leaves the app and comes back on /auth/callback, so a ?next from Login would be lost.
// It rides along in sessionStorage (this tab only). Every access is wrapped: blocked storage just means /home.
//
// The same tab also records that it started a Google flow (a random nonce with a timestamp). The callback only
// accepts tokens when that record is there and fresh, so a link crafted elsewhere (/auth/callback?token=…)
// can't sign this browser into someone else's account. The backend redirect can't echo the nonce back, so
// "started here, under 10 minutes ago" is the check.
import { safeNextPath } from '@/lib/session';

const KEY = 'travelluhh_oauth_next';
const FLOW_KEY = 'travelluhh_oauth_flow';
export const OAUTH_FLOW_TTL_MS = 10 * 60 * 1000;

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  try {
    crypto.getRandomValues(bytes);
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Call right before leaving for Google. */
export function beginOAuthFlow(now = Date.now()): void {
  try {
    sessionStorage.setItem(FLOW_KEY, JSON.stringify({ nonce: randomNonce(), at: now }));
  } catch {
    // storage blocked: the callback will refuse the tokens and send the person back to Login
  }
}

/** Reads and clears the flow record. True only when this tab started a Google sign-in in the last 10 minutes. */
export function takeOAuthFlow(now = Date.now()): boolean {
  try {
    const raw = sessionStorage.getItem(FLOW_KEY);
    sessionStorage.removeItem(FLOW_KEY);
    if (!raw) return false;
    const v = JSON.parse(raw) as { nonce?: unknown; at?: unknown };
    if (typeof v?.nonce !== 'string' || v.nonce.length < 16 || typeof v.at !== 'number') return false;
    const age = now - v.at;
    return age >= 0 && age < OAUTH_FLOW_TTL_MS;
  } catch {
    return false;
  }
}

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
