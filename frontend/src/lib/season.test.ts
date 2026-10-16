import { describe, expect, it } from 'vitest';
import { getSeason, seasonForTrip, seasonLabel } from './season';

describe('getSeason', () => {
  it('uses meteorological seasons in the north', () => {
    expect(getSeason('JP', '2026-11-12')).toBe('autumn');
    expect(getSeason('JP', '2026-12-01')).toBe('winter');
    expect(getSeason('JP', '2027-02-28')).toBe('winter');
    expect(getSeason('KR', '2026-04-05')).toBe('spring');
    expect(getSeason('GB', '2026-07-20')).toBe('summer');
  });
  it('shifts six months in the southern hemisphere', () => {
    expect(getSeason('AU', '2026-11-12')).toBe('spring');
    expect(getSeason('NZ', '2026-07-01')).toBe('winter');
    expect(getSeason('AR', '2026-01-10')).toBe('summer');
    expect(getSeason('CL', '2026-04-10')).toBe('autumn');
    expect(getSeason('ZA', '2026-12-25')).toBe('summer');
  });
  it('is tropical where the country has no seasons', () => {
    expect(getSeason('AE', '2026-11-12')).toBe('tropical');
    expect(getSeason('XX', '2026-11-12', false)).toBe('tropical');
    expect(getSeason('JP', '2026-11-12', false)).toBe('tropical');
  });
  it('accepts a Date and survives a bad date', () => {
    expect(getSeason('JP', new Date(2026, 10, 12))).toBe('autumn');
    expect(getSeason('JP', 'soon')).toBe('tropical');
  });
});

describe('seasonForTrip', () => {
  it('prefers the saved season', () => {
    expect(seasonForTrip({ destinationCountry: 'JP', startDate: '2026-11-12', season: 'winter' })).toBe('winter');
    expect(seasonForTrip({ destinationCountry: 'JP', startDate: '2026-11-12', season: null })).toBe('autumn');
  });
  it('labels', () => {
    expect(seasonLabel('tropical')).toBe('Tropical');
    expect(seasonLabel(null)).toBe('');
  });
});
