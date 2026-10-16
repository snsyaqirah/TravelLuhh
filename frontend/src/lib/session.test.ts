import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS, getStoredUser, safeNextPath, sanitizeUser, scrubStoredUser } from './session';

beforeEach(() => localStorage.clear());

describe('sanitizeUser', () => {
  it('keeps only UserResponse fields (drops a leaked password hash)', () => {
    const u = sanitizeUser({
      id: 7,
      name: 'Siti',
      email: 'siti@example.com',
      authProvider: 'google',
      passwordHash: '$2a$10$abc',
      password: '$2a$10$abc',
      googleId: 'g-1',
      authorities: [],
      currency: 'MYR',
      hasPassword: false,
    });
    expect(u).toEqual({ id: 7, name: 'Siti', email: 'siti@example.com', authProvider: 'google', currency: 'MYR', hasPassword: false });
  });
  it('coerces ids to numbers and rejects non-users', () => {
    expect(sanitizeUser({ id: '7', email: 'a@b.c' })!.id).toBe(7);
    expect(sanitizeUser({ id: 'a@b.c', email: 'a@b.c' })!.id).toBe(0);
    expect(sanitizeUser(null)).toBeNull();
    expect(sanitizeUser({ id: 1 })).toBeNull();
  });
  it('rewrites a legacy stored user once', () => {
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify({ id: 1, email: 'a@b.c', name: 'A', passwordHash: 'h' }));
    scrubStoredUser();
    expect(localStorage.getItem(STORAGE_KEYS.user)).not.toContain('passwordHash');
    expect(getStoredUser()!.email).toBe('a@b.c');
  });
  it('drops unparseable stored values', () => {
    localStorage.setItem(STORAGE_KEYS.user, '{oops');
    expect(scrubStoredUser()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.user)).toBeNull();
  });
});

describe('safeNextPath', () => {
  it('allows in-app paths', () => {
    expect(safeNextPath('/trips/9/ledger?day=2026-11-14')).toBe('/trips/9/ledger?day=2026-11-14');
    expect(safeNextPath('%2Ftrips%2F9')).toBe('/home');
  });
  it('blocks open redirects and auth-page loops', () => {
    expect(safeNextPath('https://evil.example')).toBe('/home');
    expect(safeNextPath('//evil.example')).toBe('/home');
    expect(safeNextPath('/%2F/evil.example')).toBe('/home');
    expect(safeNextPath('/\\evil.example')).toBe('/home');
    expect(safeNextPath('/login?next=/trips')).toBe('/home');
    expect(safeNextPath(null, '/trips')).toBe('/trips');
  });
  it('rejects control characters and backslashes, raw or encoded (the URL parser drops tabs: /\t/x → //x)', () => {
    for (const bad of ['/%09/evil.example', '/\t/evil.example', '/\n/evil.example', '/%0A/evil.example', '/%0D%0A/x', '/%5C/evil.example', '/\\evil', '/trips\\..\\x', '/%00']) {
      expect(safeNextPath(bad)).toBe('/home');
    }
  });
  it('rejects other schemes and anything that leaves the origin', () => {
    for (const bad of ['javascript:alert(1)', 'JavaScript:alert(1)', '//evil', '///evil.example', 'data:text/html,x', '%2F%2Fevil.example']) {
      expect(safeNextPath(bad)).toBe('/home');
    }
  });
  it('returns the normalised same-origin path with its query and hash', () => {
    expect(safeNextPath('/trips/9/../8/fund?sheet=edit#top')).toBe('/trips/8/fund?sheet=edit#top');
    expect(safeNextPath('/trips/./9')).toBe('/trips/9');
    expect(safeNextPath('/trips/9/%2E%2E/%2E%2E/login')).toBe('/home');
  });
});
