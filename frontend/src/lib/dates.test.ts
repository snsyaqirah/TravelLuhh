import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  calendarDaysBetween,
  eachDateISO,
  formatDayMonth,
  formatOverlineDate,
  formatRange,
  formatWeekdayDayMonth,
  greeting,
  isValidDate,
  parseLocalDate,
  parseServerDateTime,
  toISODate,
} from './dates';

describe.each(['Asia/Kuala_Lumpur', 'America/Los_Angeles'])('dates in %s', (tz) => {
  beforeAll(() => {
    vi.stubEnv('TZ', tz);
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('runs in the stubbed timezone', () => {
    const offset = new Date(2026, 10, 20).getTimezoneOffset();
    expect(tz === 'Asia/Kuala_Lumpur' ? offset === -480 : offset > 0).toBe(true);
  });

  it('parseLocalDate gives local midnight on the same calendar day', () => {
    const d = parseLocalDate('2026-11-20');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(10);
    expect(d.getDate()).toBe(20);
    expect(d.getHours()).toBe(0);
    expect(toISODate(d)).toBe('2026-11-20');
  });

  it('round-trips through toISODate', () => {
    for (const s of ['2026-01-01', '2026-02-28', '2028-02-29', '2026-12-31']) expect(toISODate(parseLocalDate(s))).toBe(s);
  });

  it('rejects junk and impossible dates', () => {
    expect(isValidDate(parseLocalDate('nope'))).toBe(false);
    expect(isValidDate(parseLocalDate('2026-02-31'))).toBe(false);
    expect(isValidDate(parseLocalDate(undefined))).toBe(false);
  });

  it('parses offset-less server timestamps as local time', () => {
    const d = parseServerDateTime('2026-10-15T21:04:00');
    expect(d.getHours()).toBe(21);
    expect(d.getMinutes()).toBe(4);
    expect(parseServerDateTime('2026-10-15T21:04:05.123456').getMilliseconds()).toBe(123);
    expect(parseServerDateTime('2026-10-15T13:04:00Z').toISOString()).toBe('2026-10-15T13:04:00.000Z');
  });
});

describe('calendar maths', () => {
  it('counts calendar days regardless of time of day', () => {
    expect(calendarDaysBetween(new Date(2026, 10, 12, 23, 59), new Date(2026, 10, 13, 0, 1))).toBe(1);
    expect(calendarDaysBetween(new Date(2026, 10, 20), new Date(2026, 10, 12))).toBe(-8);
  });
  it('lists every date in a range', () => {
    expect(eachDateISO('2026-11-12', '2026-11-14')).toEqual(['2026-11-12', '2026-11-13', '2026-11-14']);
    expect(eachDateISO('2026-11-12', '2026-11-12')).toEqual(['2026-11-12']);
    expect(eachDateISO('2026-11-14', '2026-11-12')).toEqual(['2026-11-14']);
    expect(eachDateISO('bad', '2026-11-12')).toEqual([]);
  });
});

describe('formatting', () => {
  it('formats ranges in mono style', () => {
    expect(formatRange('2026-11-12', '2026-11-20')).toBe('12–20 NOV 2026');
    expect(formatRange('2026-11-28', '2026-12-03')).toBe('28 NOV – 3 DEC 2026');
    expect(formatRange('2026-12-28', '2027-01-03')).toBe('28 DEC 2026 – 3 JAN 2027');
    expect(formatRange('2026-11-12', '2026-11-12')).toBe('12 NOV 2026');
  });
  it('formats short dates', () => {
    expect(formatDayMonth('2026-11-14')).toBe('14 NOV');
    expect(formatWeekdayDayMonth('2026-11-14')).toBe('SAT 14 NOV');
    expect(formatOverlineDate(new Date(2026, 9, 15, 17, 0))).toBe('THU 15 OCT 2026');
  });
});

describe('greeting', () => {
  it('Pagi before noon, Petang until 18:59, Malam from 19:00', () => {
    expect(greeting(new Date(2026, 9, 15, 0, 30))).toBe('Pagi');
    expect(greeting(new Date(2026, 9, 15, 11, 59))).toBe('Pagi');
    expect(greeting(new Date(2026, 9, 15, 12, 0))).toBe('Petang');
    expect(greeting(new Date(2026, 9, 15, 18, 59))).toBe('Petang');
    expect(greeting(new Date(2026, 9, 15, 19, 0))).toBe('Malam');
  });
});
