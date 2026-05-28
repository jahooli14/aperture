// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { calculateAgeInWeeks, getUpcomingMilestones } from '../data/milestones';
import { toLocalDateString } from '../lib/dateUtils';

function daysAgoLocal(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toLocalDateString(d);
}

describe('calculateAgeInWeeks', () => {
  it('counts whole weeks since a past birthdate', () => {
    expect(calculateAgeInWeeks(daysAgoLocal(21))).toBe(3);
    expect(calculateAgeInWeeks(daysAgoLocal(0))).toBe(0);
  });

  it('returns 0 for a future birthdate instead of a positive count', () => {
    expect(calculateAgeInWeeks(daysAgoLocal(-35))).toBe(0);
  });
});

describe('getUpcomingMilestones', () => {
  it('treats a future-dated baby as newborn, not a 5-week-old', () => {
    // Math.abs used to turn a 35-day-future date into ~5 weeks of age and
    // surface 5-week milestones; it should match the newborn (age 0) set.
    const future = getUpcomingMilestones(calculateAgeInWeeks(daysAgoLocal(-35)));
    const newborn = getUpcomingMilestones(0);
    expect(future).toEqual(newborn);
  });
});
