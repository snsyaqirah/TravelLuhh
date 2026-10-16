// Token + user persistence. The only module that touches the auth keys in localStorage. Every access is
// wrapped: private windows and blocked storage must not crash the app.
import type { LoginResponse, User } from '@/types';

export const STORAGE_KEYS = {
  accessToken: 'travelluhh_token',
  refreshToken: 'travelluhh_refresh_token',
  user: 'travelluhh_user',
  onboardingCompleted: 'travelluhh_onboarding_completed',
} as const;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage unavailable: the session lives only in memory for this page load
  }
}

export function getAccessToken(): string | null {
  return read(STORAGE_KEYS.accessToken);
}

export function getRefreshToken(): string | null {
  return read(STORAGE_KEYS.refreshToken);
}

export function setTokens(accessToken: string, refreshToken?: string | null): void {
  write(STORAGE_KEYS.accessToken, accessToken);
  if (refreshToken) write(STORAGE_KEYS.refreshToken, refreshToken);
}

const USER_FIELDS = [
  'id',
  'name',
  'email',
  'avatar',
  'authProvider',
  'country',
  'currency',
  'onboardingCompleted',
  'emailVerified',
  'hasPassword',
  'createdAt',
  'updatedAt',
] as const;

/**
 * Keep only the documented UserResponse fields. Older builds stored the whole JPA entity, password hash
 * included, so anything unknown is dropped. Returns null for values that are not a user.
 */
export function sanitizeUser(raw: unknown): User | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;
  if (typeof src.email !== 'string') return null;
  const out: Record<string, unknown> = {};
  for (const k of USER_FIELDS) {
    if (src[k] !== undefined) out[k] = src[k];
  }
  // Ids are numbers on the wire; older OAuth callbacks stored the email (JWT sub) here.
  const id = typeof src.id === 'number' ? src.id : Number(src.id);
  out.id = Number.isFinite(id) ? id : 0;
  if (out.authProvider !== 'google') out.authProvider = 'local';
  if (typeof out.name !== 'string') out.name = '';
  return out as unknown as User;
}

export function getStoredUser(): User | null {
  const raw = read(STORAGE_KEYS.user);
  if (!raw) return null;
  try {
    return sanitizeUser(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function setStoredUser(user: User | null): void {
  const clean = sanitizeUser(user);
  write(STORAGE_KEYS.user, clean ? JSON.stringify(clean) : null);
}

/** Rewrites the stored user through sanitizeUser once, dropping any legacy passwordHash. */
export function scrubStoredUser(): User | null {
  const raw = read(STORAGE_KEYS.user);
  if (!raw) return null;
  const clean = getStoredUser();
  write(STORAGE_KEYS.user, clean ? JSON.stringify(clean) : null);
  return clean;
}

export function saveSession(res: Pick<LoginResponse, 'accessToken' | 'refreshToken'> & { user?: User | null }): void {
  setTokens(res.accessToken, res.refreshToken);
  if (res.user) setStoredUser(res.user);
}

export function clearSession(): void {
  write(STORAGE_KEYS.accessToken, null);
  write(STORAGE_KEYS.refreshToken, null);
  write(STORAGE_KEYS.user, null);
  write(STORAGE_KEYS.onboardingCompleted, null);
}

export function hasSession(): boolean {
  return Boolean(getAccessToken() || getRefreshToken());
}

const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/auth/callback'];

export function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Sanitises a ?next= value: only same-origin app paths, never protocol-relative URLs or auth pages
 * (which would loop). Falls back to `fallback`.
 */
export function safeNextPath(next: string | null | undefined, fallback = '/home'): string {
  if (!next) return fallback;
  let decoded: string;
  try {
    decoded = decodeURIComponent(next);
  } catch {
    return fallback;
  }
  for (const p of [next, decoded]) {
    if (!p.startsWith('/') || p.startsWith('//') || p.startsWith('/\\')) return fallback;
    if (isAuthPage(p.split(/[?#]/)[0])) return fallback;
  }
  return next;
}
