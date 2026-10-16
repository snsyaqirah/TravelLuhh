import { afterEach, describe, expect, it } from 'vitest';
import { currencyForCountry, initials, isEmail, maskEmail, passwordStrength, retryAfterSeconds } from '../authHelpers';
import { rememberOAuthNext, takeOAuthNext } from '../oauthNext';
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
});
