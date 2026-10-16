import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import {
  NETWORK_ERROR_MESSAGE,
  SESSION_EXPIRED_EVENT,
  api,
  getErrorMessage,
  getFieldErrors,
  getErrorStatus,
  getRetryAfter,
  toAppError,
} from './axios';
import { STORAGE_KEYS } from './session';

type Handler = (config: InternalAxiosRequestConfig) => { status: number; data?: unknown; headers?: Record<string, string> } | 'network';

const calls: { url: string; auth: string | null }[] = [];
let handler: Handler = () => ({ status: 200, data: {} });

const fakeAdapter: AxiosAdapter = (config) => {
  const auth = (config.headers?.get?.('Authorization') as string | undefined) ?? null;
  calls.push({ url: config.url ?? '', auth });
  const result = handler(config);
  return new Promise((resolve, reject) => {
    // a tick of latency so concurrent requests really overlap
    setTimeout(() => {
      if (result === 'network') {
        reject(new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, {}));
        return;
      }
      const response: AxiosResponse = { data: result.data, status: result.status, statusText: '', headers: result.headers ?? {}, config, request: {} };
      if (result.status >= 200 && result.status < 300) resolve(response);
      else reject(new AxiosError(`Request failed with status code ${result.status}`, AxiosError.ERR_BAD_REQUEST, config, {}, response));
    }, 5);
  });
};

const originalAdapter = api.defaults.adapter;
let expired: CustomEvent[] = [];
const onExpired = (e: Event) => {
  e.preventDefault(); // jsdom can't navigate; assert on the event instead
  expired.push(e as CustomEvent);
};

beforeEach(() => {
  api.defaults.adapter = fakeAdapter;
  calls.length = 0;
  expired = [];
  localStorage.clear();
  window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
  window.history.pushState({}, '', '/trips/9/ledger?day=2026-11-14');
});

afterEach(() => {
  api.defaults.adapter = originalAdapter;
  window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  vi.useRealTimers();
});

function signIn(access = 'old', refresh = 'r1') {
  localStorage.setItem(STORAGE_KEYS.accessToken, access);
  localStorage.setItem(STORAGE_KEYS.refreshToken, refresh);
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify({ id: 1, email: 'siti@example.com', name: 'Siti', authProvider: 'local' }));
}

describe('401 on auth endpoints', () => {
  it('rejects with the server message, no refresh and no redirect (wrong password)', async () => {
    signIn();
    handler = (c) => (c.url === '/auth/login' ? { status: 401, data: { status: 401, message: 'Invalid email or password' } } : { status: 200 });
    const err = await api.post('/auth/login', { email: 'a@b.c', password: 'x' }).catch((e) => e);
    expect(getErrorStatus(err)).toBe(401);
    expect(getErrorMessage(err)).toBe('Invalid email or password');
    expect(calls.map((c) => c.url)).toEqual(['/auth/login']);
    expect(expired).toHaveLength(0);
    expect(localStorage.getItem(STORAGE_KEYS.accessToken)).toBe('old');
  });

  it('a wrong OTP code keeps the person on the page', async () => {
    handler = () => ({ status: 401, data: { message: 'That code is wrong or has expired.' } });
    const err = await api.post('/auth/verify-email', { email: 'a@b.c', code: '000000' }).catch((e) => e);
    expect(getErrorMessage(err)).toBe('That code is wrong or has expired.');
    expect(expired).toHaveLength(0);
  });

  it('does not attach the access token to auth endpoints, and keeps an explicit Authorization', async () => {
    signIn();
    handler = () => ({ status: 200, data: {} });
    await api.post('/auth/login', {});
    await api.post('/auth/logout', null, { headers: { Authorization: 'Bearer r1' } });
    await api.get('/trips');
    expect(calls).toEqual([
      { url: '/auth/login', auth: null },
      { url: '/auth/logout', auth: 'Bearer r1' },
      { url: '/trips', auth: 'Bearer old' },
    ]);
  });
});

describe('expired access token', () => {
  it('refreshes once for concurrent 401s, stores both rotated tokens and retries', async () => {
    signIn('old', 'r1');
    handler = (c) => {
      const auth = c.headers.get('Authorization');
      if (c.url === '/auth/refresh') {
        return auth === 'Bearer r1'
          ? { status: 200, data: { accessToken: 'new', refreshToken: 'r2', expiresIn: 1, user: { id: 1, email: 'siti@example.com', name: 'Siti', authProvider: 'local', passwordHash: 'x' } } }
          : { status: 401 };
      }
      return auth === 'Bearer new' ? { status: 200, data: { ok: c.url } } : { status: 401 };
    };
    const [a, b, c] = await Promise.all([api.get('/trips'), api.get('/trips/9'), api.get('/users/me')]);
    expect([a.data.ok, b.data.ok, c.data.ok]).toEqual(['/trips', '/trips/9', '/users/me']);
    expect(calls.filter((x) => x.url === '/auth/refresh')).toHaveLength(1);
    expect(localStorage.getItem(STORAGE_KEYS.accessToken)).toBe('new');
    expect(localStorage.getItem(STORAGE_KEYS.refreshToken)).toBe('r2');
    expect(localStorage.getItem(STORAGE_KEYS.user)).not.toContain('passwordHash');
    expect(expired).toHaveLength(0);
  });

  it('a late 401 carrying an already-replaced token retries without a second refresh', async () => {
    signIn('new', 'r2');
    handler = (c) => (c.headers.get('Authorization') === 'Bearer new' ? { status: 200, data: {} } : { status: 401 });
    await api.get('/trips', { headers: { Authorization: 'Bearer old' } });
    expect(calls.map((x) => x.url)).toEqual(['/trips', '/trips']);
    expect(calls[1].auth).toBe('Bearer new');
  });

  it('clears the session and asks to log in again with ?next when the refresh is rejected', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'], shouldAdvanceTime: true });
    signIn('old', 'r1');
    handler = (c) => (c.url === '/auth/refresh' ? { status: 401, data: { message: 'Refresh token revoked' } } : { status: 401 });
    const results = await Promise.allSettled([api.get('/trips'), api.get('/trips/9')]);
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(calls.filter((x) => x.url === '/auth/refresh')).toHaveLength(1);
    expect(localStorage.getItem(STORAGE_KEYS.accessToken)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.refreshToken)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.user)).toBeNull();
    expect(expired).toHaveLength(1);
    expect(expired[0].detail.next).toBe('/trips/9/ledger?day=2026-11-14');
    vi.advanceTimersByTime(1100);
  });

  it('keeps the session when the refresh only failed on the network', async () => {
    signIn('old', 'r1');
    handler = (c) => (c.url === '/auth/refresh' ? 'network' : { status: 401 });
    const err = await api.get('/trips').catch((e) => e);
    expect(getErrorMessage(err)).toBe(NETWORK_ERROR_MESSAGE);
    expect(localStorage.getItem(STORAGE_KEYS.refreshToken)).toBe('r1');
    expect(expired).toHaveLength(0);
  });

  it('with no refresh token at all, expires straight away', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'], shouldAdvanceTime: true });
    localStorage.setItem(STORAGE_KEYS.accessToken, 'old');
    handler = () => ({ status: 401 });
    await api.get('/trips').catch(() => undefined);
    expect(calls.map((x) => x.url)).toEqual(['/trips']);
    expect(expired).toHaveLength(1);
    vi.advanceTimersByTime(1100);
  });
});

describe('getErrorMessage', () => {
  it('uses the friendly line for network errors and timeouts', async () => {
    handler = () => 'network';
    const err = await api.get('/trips').catch((e) => e);
    expect(getErrorMessage(err)).toBe("Alamak, can't reach the server. Your entries are safe. Try again in a moment.");
    expect(toAppError(err).isNetwork).toBe(true);
  });

  it('prefers the server sentence, else turns fieldErrors into sentences', async () => {
    handler = () => ({
      status: 400,
      data: { status: 400, message: 'Password must be between 8 and 128 characters', fieldErrors: { password: 'Password must be between 8 and 128 characters' } },
    });
    expect(getErrorMessage(await api.post('/auth/complete-signup', {}).catch((e) => e))).toBe('Password must be between 8 and 128 characters');
    handler = () => ({ status: 400, data: { status: 400, message: 'Validation failed', fieldErrors: { amount: 'must be greater than 0', expenseDate: 'must not be null' } } });
    const err = await api.post('/expenses', {}).catch((e) => e);
    expect(getErrorMessage(err)).toBe('Amount must be greater than 0. Expense date must not be null.');
    expect(getFieldErrors(err)).toEqual({ amount: 'must be greater than 0', expenseDate: 'must not be null' });
  });

  it('falls back by status, and never leaks HTML', async () => {
    handler = () => ({ status: 403, data: '<html>Forbidden</html>' });
    expect(getErrorMessage(await api.get('/trips/9').catch((e) => e))).toBe("You don't have permission to do that on this trip.");
    handler = () => ({ status: 502 });
    expect(getErrorMessage(await api.get('/trips').catch((e) => e))).toBe('Something went wrong on our side. Try again in a moment.');
  });

  it('reads Retry-After on 429 (OTP resend throttle)', async () => {
    handler = () => ({ status: 429, data: { message: 'We just sent a code. Wait 42 seconds before asking for another.' }, headers: { 'retry-after': '42' } });
    const err = await api.post('/auth/initiate-signup', { email: 'a@b.c' }).catch((e) => e);
    expect(getRetryAfter(err)).toBe(42);
    expect(getErrorMessage(err)).toBe('We just sent a code. Wait 42 seconds before asking for another.');
    expect(expired).toHaveLength(0);
  });

  it('reads plain errors and strings', () => {
    expect(getErrorMessage(new Error('Boom'))).toBe('Boom');
    expect(getErrorMessage('Nope')).toBe('Nope');
    expect(getErrorMessage(undefined, 'Fallback')).toBe('Fallback');
  });
});
