// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { calculateAge, formatAge, formatAgeCompact } from '../lib/ageUtils';

describe('calculateAge', () => {
  it('reports the calendar days into the current month, not the week remainder', () => {
    // Born Jan 1, photo Apr 11 -> 3 months, 10 calendar days into the month.
    const age = calculateAge('2025-01-01', '2025-04-11');
    expect(age.years).toBe(0);
    expect(age.months).toBe(3);
    expect(age.days).toBe(10);
  });

  it('returns zero days exactly on a monthly anniversary', () => {
    const age = calculateAge('2025-01-15', '2025-04-15');
    expect(age.months).toBe(3);
    expect(age.days).toBe(0);
  });

  it('handles the day rolling back across a month boundary', () => {
    // Born Jan 31, photo Mar 1 -> 1 month + 1 day (Feb has 28 days in 2025).
    const age = calculateAge('2025-01-31', '2025-03-01');
    expect(age.months).toBe(1);
    expect(age.days).toBe(1);
  });

  it('never reports negative days for "born on the 31st" across short months', () => {
    // Regression: the old single-step borrow underflowed (Feb has only 28 days).
    for (const photoDate of ['2025-02-28', '2025-03-01', '2025-03-15']) {
      const age = calculateAge('2025-01-31', photoDate);
      expect(age.days).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('formatAge', () => {
  it('shows just "1 year" on the first birthday (no phantom day)', () => {
    expect(formatAge(calculateAge('2024-05-28', '2025-05-28'))).toBe('1 year');
  });

  it('does not append meaningless days to a round age in years', () => {
    expect(formatAge(calculateAge('2023-05-28', '2025-05-28'))).toBe('2 years');
  });

  it('shows months and calendar days for an under-2 baby', () => {
    expect(formatAge(calculateAge('2025-01-01', '2025-04-11'))).toContain('3 months');
  });
});

describe('formatAgeCompact', () => {
  it('pairs weeks with the week-day remainder', () => {
    // 21 days -> 3 weeks, 0 day remainder.
    expect(formatAgeCompact(calculateAge('2025-05-01', '2025-05-22'))).toBe('3w 0d');
  });

  it('pairs months with calendar days into the month', () => {
    expect(formatAgeCompact(calculateAge('2025-01-01', '2025-04-11'))).toBe('3mo 10d');
  });
});
