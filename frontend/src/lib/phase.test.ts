import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { dayIndex, daysUntilStart, durationLabel, getPhase, isLiveTrip, phaseLabel, tripDays } from './phase';

// Tokyo autumn: 12–20 Nov 2026, 9D8N.
const tokyo = { startDate: '2026-11-12', endDate: '2026-11-20' };

describe('phase in Asia/Kuala_Lumpur', () => {
  beforeAll(() => {
    vi.stubEnv('TZ', 'Asia/Kuala_Lumpur');
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('runs at UTC+8', () => {
    expect(new Date(2026, 10, 20).getTimezoneOffset()).toBe(-480);
  });

  it('is upcoming until the start day', () => {
    expect(getPhase(tokyo, new Date(2026, 10, 11, 23, 59, 59))).toBe('upcoming');
    expect(getPhase(tokyo, new Date(2026, 10, 12, 0, 0, 0))).toBe('onTheRoad');
  });

  it('stays onTheRoad for the whole last day, past 08:00 (the old UTC bug)', () => {
    expect(getPhase(tokyo, new Date(2026, 10, 20, 8, 30))).toBe('onTheRoad');
    expect(getPhase(tokyo, new Date(2026, 10, 20, 23, 59, 59))).toBe('onTheRoad');
    expect(getPhase(tokyo, new Date(2026, 10, 21, 0, 0, 0))).toBe('home');
  });

  it('numbers the days from 1 while on the road', () => {
    expect(dayIndex(tokyo, new Date(2026, 10, 12, 9))).toBe(1);
    expect(dayIndex(tokyo, new Date(2026, 10, 14, 21))).toBe(3);
    expect(dayIndex(tokyo, new Date(2026, 10, 20, 23))).toBe(9);
    expect(dayIndex(tokyo, new Date(2026, 10, 11))).toBeNull();
    expect(dayIndex(tokyo, new Date(2026, 10, 21))).toBeNull();
  });

  it('counts days to go', () => {
    expect(daysUntilStart(tokyo, new Date(2026, 9, 15, 22))).toBe(28);
    expect(daysUntilStart(tokyo, new Date(2026, 10, 11, 23))).toBe(1);
  });

  it('builds PhaseTag text', () => {
    expect(phaseLabel(tokyo, new Date(2026, 9, 15))).toBe('UPCOMING · 28 DAYS');
    expect(phaseLabel(tokyo, new Date(2026, 9, 15), { saving: true })).toBe('SAVING · 28 DAYS');
    expect(phaseLabel(tokyo, new Date(2026, 10, 11))).toBe('UPCOMING · 1 DAY');
    expect(phaseLabel(tokyo, new Date(2026, 10, 14))).toBe('ON THE ROAD · DAY 3/9');
    expect(phaseLabel(tokyo, new Date(2026, 10, 25))).toBe('HOME · 20 NOV');
  });
});

describe('durations', () => {
  it('tripDays is inclusive and at least 1', () => {
    expect(tripDays(tokyo)).toBe(9);
    expect(tripDays({ startDate: '2026-11-12', endDate: '2026-11-12' })).toBe(1);
    expect(tripDays({ startDate: '2026-11-12', endDate: '2026-11-01' })).toBe(1);
    expect(tripDays({ startDate: '2026-01-01', endDate: '2026-03-01' })).toBe(60);
    expect(tripDays({ startDate: 'bad', endDate: '2026-11-12' })).toBe(1);
  });
  it('crosses DST boundaries without losing a day', () => {
    expect(tripDays({ startDate: '2026-03-01', endDate: '2026-03-31' })).toBe(31);
    expect(tripDays({ startDate: '2026-10-20', endDate: '2026-11-05' })).toBe(17);
  });
  it('durationLabel uses the 9D8N format', () => {
    expect(durationLabel(9)).toBe('9D8N');
    expect(durationLabel(2)).toBe('2D1N');
    expect(durationLabel(1)).toBe('1D');
    expect(durationLabel(0)).toBe('1D');
    expect(durationLabel(NaN)).toBe('1D');
    expect(durationLabel(60)).toBe('60D59N');
  });
});

describe('isLiveTrip', () => {
  it('is true only for group trips on the road', () => {
    const today = new Date(2026, 10, 14);
    expect(isLiveTrip({ ...tokyo, budgetType: 'shared', memberCount: 3 }, today)).toBe(true);
    expect(isLiveTrip({ ...tokyo, budgetType: 'solo', memberCount: 1 }, today)).toBe(false);
    expect(isLiveTrip({ ...tokyo, budgetType: 'shared', memberCount: 3 }, new Date(2026, 10, 25))).toBe(false);
    expect(isLiveTrip(null, today)).toBe(false);
  });
});
