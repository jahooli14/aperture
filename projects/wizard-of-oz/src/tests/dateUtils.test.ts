// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  toLocalDateString,
  getTodayLocalDateString,
  formatRelativeDate,
  formatDuration,
} from '../lib/dateUtils';

describe('toLocalDateString', () => {
  it('formats using local calendar fields', () => {
    expect(toLocalDateString(new Date(2025, 0, 5, 12, 0))).toBe('2025-01-05');
  });

  it('zero-pads month and day', () => {
    expect(toLocalDateString(new Date(2025, 8, 9, 0, 0))).toBe('2025-09-09');
  });

  it('keeps a late-evening date on the local day (no UTC roll-forward)', () => {
    // 23:59 local on the last day of the year. toISOString() would roll this
    // forward to next year in any timezone behind UTC; the local formatter
    // must not.
    const d = new Date(2025, 11, 31, 23, 59);
    expect(toLocalDateString(d)).toBe('2025-12-31');
    // Guard: confirm it tracks the date's own local fields, whatever the
    // runner's timezone is.
    expect(toLocalDateString(d)).toBe(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`
    );
  });
});

describe('getTodayLocalDateString', () => {
  it('returns the local YYYY-MM-DD for now', () => {
    expect(getTodayLocalDateString()).toBe(toLocalDateString(new Date()));
    expect(getTodayLocalDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatDuration', () => {
  it('uses days under two weeks', () => {
    expect(formatDuration(1)).toBe('1 day');
    expect(formatDuration(5)).toBe('5 days');
    expect(formatDuration(13)).toBe('13 days');
  });

  it('uses weeks up to about two months', () => {
    expect(formatDuration(14)).toBe('2 weeks');
    expect(formatDuration(49)).toBe('7 weeks');
  });

  it('uses approximate months past ~8 weeks', () => {
    expect(formatDuration(94)).toBe('about 3 months');
    expect(formatDuration(365)).toBe('about 12 months');
  });

  it('keeps months up to two years (how babies are described)', () => {
    expect(formatDuration(Math.round(30.44 * 14))).toBe('about 14 months');
  });

  it('uses years past two years, with remaining months', () => {
    expect(formatDuration(365 * 2)).toBe('about 2 years');
    expect(formatDuration(Math.round(30.44 * 26))).toBe('about 2 years, 2 months');
  });
});

describe('formatRelativeDate', () => {
  const today = '2025-05-29';

  it('labels today and yesterday', () => {
    expect(formatRelativeDate('2025-05-29', today)).toBe('Today');
    expect(formatRelativeDate('2025-05-28', today)).toBe('Yesterday');
  });

  it('uses "N days ago" within the past week', () => {
    expect(formatRelativeDate('2025-05-26', today)).toBe('3 days ago');
    expect(formatRelativeDate('2025-05-24', today)).toBe('5 days ago');
  });

  it('falls back to the short date beyond a week and for future dates', () => {
    expect(formatRelativeDate('2025-05-01', today)).toBe('May 1');
    expect(formatRelativeDate('2025-06-10', today)).toBe('Jun 10');
  });

  it('returns empty string for missing input', () => {
    expect(formatRelativeDate(null, today)).toBe('');
  });
});
