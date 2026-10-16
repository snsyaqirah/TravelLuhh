import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig, isAxiosError } from 'axios';
import type { ApiError, LoginResponse } from '@/types';
import { clearSession, getAccessToken, getRefreshToken, isAuthPage, saveSession } from '@/lib/session';

export const API_BASE_URL: string =
  ((import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:8080/api').replace(/\/+$/, '');

export const NETWORK_ERROR_MESSAGE =
  "Alamak, can't reach the server. Your entries are safe. Try again in a moment.";

/**
 * Dispatched on window (cancelable, detail: { next }) when the session can't be refreshed. The default is a
 * hard redirect to /login?next=…; a router-aware listener may preventDefault() and navigate instead.
 */
export const SESSION_EXPIRED_EVENT = 'travelluhh:session-expired';
export interface SessionExpiredDetail {
  next: string;
}

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

/** Request path relative to the API root: 'auth/login', '/api/auth/login' and absolute URLs → '/auth/login'. */
function apiPath(url: string | undefined): string {
  let p = url ?? '';
  if (/^https?:\/\//i.test(p)) {
    try {
      p = new URL(p).pathname;
    } catch {
      // keep as is
    }
  }
  p = `/${p.replace(/^\/+/, '')}`;
  return p.replace(/^\/api(?=\/)/, '');
}

/** Public auth endpoints: a 401 there means wrong password/code, never "session expired". */
export function isAuthEndpoint(url: string | undefined): boolean {
  return apiPath(url).startsWith('/auth/');
}

function bearerOf(config: InternalAxiosRequestConfig): string | null {
  const h = config.headers?.get?.('Authorization');
  return typeof h === 'string' && h.startsWith('Bearer ') ? h.slice(7) : null;
}

api.interceptors.request.use((config) => {
  // Explicit Authorization (refresh/logout send the refresh token) wins; auth endpoints get no access token.
  if (!config.headers.has('Authorization') && !isAuthEndpoint(config.url)) {
    const token = getAccessToken();
    if (token) config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

// ── Refresh: one request in flight, shared by every 401 that arrives meanwhile ──────────────────────────

let refreshPromise: Promise<string> | null = null;
let expiring = false;

const REFRESH_LOCK = 'travelluhh:refresh';

/**
 * Another tab shares this localStorage and may rotate the refresh token while ours is in flight (the server
 * then rejects our now-used token). If the stored refresh token is no longer the one this tab started with,
 * that tab won: adopt its fresh access token instead of logging everyone out.
 */
function rotatedElsewhere(startedWith: string | null): string | null {
  const now = getRefreshToken();
  const access = getAccessToken();
  return now && access && now !== startedWith ? access : null;
}

async function doRefresh(startedWith: string | null): Promise<string> {
  // Waited for another tab's refresh (navigator.locks): it already rotated the pair.
  const adopted = rotatedElsewhere(startedWith);
  if (adopted) return adopted;
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token');
  let res;
  try {
    res = await api.post<LoginResponse>('/auth/refresh', null, {
      headers: { Authorization: `Bearer ${refreshToken}` },
    });
  } catch (err) {
    const rotated = rotatedElsewhere(refreshToken);
    if (rotated) return rotated;
    throw err;
  }
  const accessToken = res.data?.accessToken;
  if (!accessToken) throw new Error('Refresh returned no access token');
  // The server rotates refresh tokens: keep the new one or the next refresh fails.
  saveSession({ accessToken, refreshToken: res.data.refreshToken || refreshToken, user: res.data.user });
  return accessToken;
}

/** Runs `fn` under a cross-tab lock when the browser has the Web Locks API; plain call otherwise. */
function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks || typeof locks.request !== 'function') return fn();
  let ran = false;
  const run = () => {
    ran = true;
    return fn();
  };
  try {
    return locks.request(REFRESH_LOCK, run).catch((err: unknown) => {
      if (ran) throw err;
      return fn(); // the lock itself failed (e.g. not allowed here): refresh without it
    });
  } catch {
    return fn();
  }
}

/** Single-flight token refresh (per tab, and across tabs where Web Locks exist). Resolves with the new access token. */
export function refreshSession(): Promise<string> {
  if (!refreshPromise) {
    const startedWith = getRefreshToken();
    refreshPromise = withRefreshLock(() => doRefresh(startedWith)).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function currentPath(): string {
  const { pathname, search, hash } = window.location;
  return `${pathname}${search}${hash}`;
}

/** Clear the session and send the person to log in, once, without looping on public pages. */
export function expireSession(): void {
  if (expiring) return;
  expiring = true;
  clearSession();
  const next = currentPath();
  const proceed = window.dispatchEvent(
    new CustomEvent<SessionExpiredDetail>(SESSION_EXPIRED_EVENT, { detail: { next }, cancelable: true })
  );
  const { pathname } = window.location;
  if (proceed && pathname !== '/' && !isAuthPage(pathname)) {
    window.location.assign(`/login?next=${encodeURIComponent(next)}`);
  }
  // SPA navigation keeps this module alive; allow a later expiry once things settle.
  setTimeout(() => {
    expiring = false;
  }, 1000);
}

/** Refresh failures that mean the session is really over (vs. a network blip or a server error). */
function refreshWasRejected(err: unknown): boolean {
  if (!isAxiosError(err)) return true; // no refresh token, malformed response
  const s = err.response?.status;
  return s === 400 || s === 401 || s === 403;
}

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    if (error.response?.status !== 401 || !config || isAuthEndpoint(config.url)) {
      return Promise.reject(error);
    }
    if (config._retry) {
      expireSession();
      return Promise.reject(error);
    }
    config._retry = true;

    try {
      const used = bearerOf(config);
      const current = getAccessToken();
      // Another request already refreshed while this one was in flight: just retry with the new token.
      const token = current && used && current !== used ? current : await refreshSession();
      config.headers.set('Authorization', `Bearer ${token}`);
      return api(config);
    } catch (refreshError) {
      if (refreshWasRejected(refreshError)) expireSession();
      return Promise.reject(isAxiosError(refreshError) && !refreshError.response ? refreshError : error);
    }
  }
);

// ── Errors ─────────────────────────────────────────────────────────────────────────────────────────────

/** Error thrown by hooks' imperative helpers: message is already human-readable. */
export class AppError extends Error {
  status?: number;
  fieldErrors: Record<string, string> | null;
  isNetwork: boolean;
  cause?: unknown;

  constructor(message: string, o: { status?: number; fieldErrors?: Record<string, string> | null; isNetwork?: boolean; cause?: unknown } = {}) {
    super(message);
    this.name = 'AppError';
    this.status = o.status;
    this.fieldErrors = o.fieldErrors ?? null;
    this.isNetwork = o.isNetwork ?? false;
    this.cause = o.cause;
  }
}

export function getErrorStatus(err: unknown): number | undefined {
  if (err instanceof AppError) return err.status;
  if (isAxiosError(err)) return err.response?.status;
  return undefined;
}

export function getErrorBody(err: unknown): ApiError | undefined {
  if (!isAxiosError(err)) return undefined;
  const data = err.response?.data;
  return data && typeof data === 'object' ? (data as ApiError) : undefined;
}

export function isNetworkError(err: unknown): boolean {
  if (err instanceof AppError) return err.isNetwork;
  return isAxiosError(err) && !err.response && err.code !== 'ERR_CANCELED';
}

export function getFieldErrors(err: unknown): Record<string, string> | null {
  if (err instanceof AppError) return err.fieldErrors;
  const fe = getErrorBody(err)?.fieldErrors;
  return fe && typeof fe === 'object' && Object.keys(fe).length > 0 ? fe : null;
}

function humanField(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_.]/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** {amount: 'must be greater than 0'} → 'Amount must be greater than 0.'; full sentences pass through. */
function fieldSentence(key: string, value: string): string {
  const v = value.trim().replace(/\.$/, '');
  const sentence = /^[A-Z]/.test(v) ? v : `${humanField(key)} ${v}`;
  return `${sentence}.`;
}

const GENERIC_MESSAGE = /^(validation failed|bad request|invalid request)\.?$/i;

/** Seconds to wait from a 429's Retry-After header (OTP resend throttling), or null. */
export function getRetryAfter(err: unknown): number | null {
  if (!isAxiosError(err) || err.response?.status !== 429) return null;
  const raw = (err.response.headers as Record<string, unknown> | undefined)?.['retry-after'];
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.ceil(n) : null;
}

const STATUS_FALLBACK: Record<number, string> = {
  400: "That didn't go through. Check the details and try again.",
  401: "Those details don't match. Try again.",
  403: "You don't have permission to do that on this trip.",
  404: "We couldn't find that. It may have been deleted.",
  409: 'That already exists.',
};

/**
 * A sentence to show the person, from any thrown value. Reads the contract error body (fieldErrors first,
 * then message); network failures get the friendly "can't reach the server" line.
 */
export function getErrorMessage(err: unknown, fallback = 'Something went wrong. Try again in a moment.'): string {
  if (err instanceof AppError) return err.message || fallback;
  if (isAxiosError(err)) {
    if (!err.response) return err.code === 'ERR_CANCELED' ? fallback : NETWORK_ERROR_MESSAGE;
    const body = err.response.data as unknown;
    const msg = body && typeof body === 'object' ? (body as ApiError).message : undefined;
    // The server's message is already a sentence ("Password must be between 8 and 128 characters").
    if (typeof msg === 'string' && msg.trim() && !GENERIC_MESSAGE.test(msg.trim())) return msg.trim();
    const fe = getFieldErrors(err);
    if (fe) {
      return Object.entries(fe)
        .slice(0, 2)
        .map(([k, v]) => fieldSentence(k, String(v)))
        .join(' ');
    }
    if (typeof body === 'string' && body.trim() && body.length < 200 && !body.trim().startsWith('<')) {
      return body.trim();
    }
    const status = err.response.status;
    if (status >= 500) return 'Something went wrong on our side. Try again in a moment.';
    return STATUS_FALLBACK[status] ?? fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return fallback;
}

/** Wrap anything thrown into an AppError with a readable message (keeps status and fieldErrors). */
export function toAppError(err: unknown, fallback?: string): AppError {
  if (err instanceof AppError) return err;
  return new AppError(getErrorMessage(err, fallback), {
    status: getErrorStatus(err),
    fieldErrors: getFieldErrors(err),
    isNetwork: isNetworkError(err),
    cause: err,
  });
}

export async function apiRequest<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await api.request<T>(config);
  return response.data;
}
