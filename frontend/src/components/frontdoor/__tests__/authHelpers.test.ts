import { afterEach, describe, expect, it, vi } from 'vitest';
import { currencyForCountry, initials, isEmail, maskEmail, passwordStrength, retryAfterSeconds } from '../authHelpers';
import { OAUTH_FLOW_TTL_MS, beginOAuthFlow, rememberOAuthNext, takeOAuthFlow, takeOAuthNext } from '../oauthNext';
import { checkNewPassword } from '../stepHelpers';
import { apiError } from './testUtils';

describe('maskEmail', () => {
  it('keeps the first letter and the domain', () => {
    expect(maskEmail('syaqirah@gmail.com')).toBe('s•••@gmail.com');
    expect(maskEmail('  a@b.co ')).toBe('a•••@b.co');
  });
  it('leaves non-emails alone', () => {
    expect(maskEmail('nope')).toBe('nope');
  });
});

describe('retryAfterSeconds', () => {
  it('prefers the Retry-After header', () => {
    expect(retryAfterSeconds(apiError(429, 'Wait 59 seconds.', { 'retry-after': '42' }))).toBe(42);
  });
  it('falls back to the number in the message when CORS hides the header', () => {
    expect(retryAfterSeconds(apiError(429, 'We just sent a code. Wait 17 seconds before asking for another.'))).toBe(17);
  });
  it('falls back to 60 otherwise', () => {
    expect(retryAfterSeconds(apiError(429, 'Slow down.'))).toBe(60);
    expect(retryAfterSeconds(new Error('x'), 30)).toBe(30);
  });
});

describe('passwordStrength', () => {
  it('counts down to 8 characters', () => {
    expect(passwordStrength('').hint).toBe('At least 8 characters.');
    expect(passwordStrength('abcdef1').level).toBe(0);
    expect(passwordStrength('abcdef1').hint).toBe('1 more character to go.');
  });
  it('grows with length and mix', () => {
    expect(passwordStrength('abcdefgh').label).toBe('Okay');
    expect(passwordStrength('abcdefghijkl').label).toBe('Good');
    expect(passwordStrength('teh-tarik-2026').label).toBe('Strong');
    expect(passwordStrength('a'.repeat(16)).label).toBe('Strong');
  });
});

describe('small helpers', () => {
  it('isEmail', () => {
    expect(isEmail('a@b.co')).toBe(true);
    expect(isEmail('a@b')).toBe(false);
  });
  it('initials', () => {
    expect(initials('Syaqirah Osman')).toBe('SO');
    expect(initials('Siti')).toBe('SI');
    expect(initials('')).toBe('');
  });
  it('currencyForCountry', () => {
    expect(currencyForCountry('MY')).toBe('MYR');
    expect(currencyForCountry('jp')).toBe('JPY');
    expect(currencyForCountry('ZZ')).toBeNull();
  });
  it('checkNewPassword', () => {
    expect(checkNewPassword('short', 'short')).toEqual({ password: 'Use at least 8 characters.' });
    expect(checkNewPassword('long enough', 'long enougH')).toEqual({ confirm: "The two passwords don't match." });
    expect(checkNewPassword('long enough', 'long enough')).toEqual({});
  });
});

describe('oauthNext', () => {
  afterEach(() => sessionStorage.clear());
  it('round-trips a safe path once', () => {
    rememberOAuthNext('/trips/5/ledger?day=2026-10-14');
    expect(takeOAuthNext()).toBe('/trips/5/ledger?day=2026-10-14');
    expect(takeOAuthNext()).toBe('/home');
  });
  it('drops unsafe paths', () => {
    rememberOAuthNext('//evil.example/x');
    expect(takeOAuthNext()).toBe('/home');
    rememberOAuthNext('/login');
    expect(takeOAuthNext()).toBe('/home');
  });
  it('a started flow is accepted once, within 10 minutes, with a random nonce', () => {
    const t0 = 1_800_000_000_000;
    expect(takeOAuthFlow(t0)).toBe(false);
    beginOAuthFlow(t0);
    const first = JSON.parse(sessionStorage.getItem('travelluhh_oauth_flow') as string).nonce;
    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(takeOAuthFlow(t0 + 60_000)).toBe(true);
    expect(takeOAuthFlow(t0 + 60_000)).toBe(false);
    beginOAuthFlow(t0);
    expect(JSON.parse(sessionStorage.getItem('travelluhh_oauth_flow') as string).nonce).not.toBe(first);
    expect(takeOAuthFlow(t0 + OAUTH_FLOW_TTL_MS)).toBe(false);
    sessionStorage.setItem('travelluhh_oauth_flow', '{"at":1}');
    expect(takeOAuthFlow(t0)).toBe(false);
  });
  it('blocked storage means no flow, never a crash', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => beginOAuthFlow()).not.toThrow();
    expect(takeOAuthFlow()).toBe(false);
    get.mockRestore();
    set.mockRestore();
  });
});
