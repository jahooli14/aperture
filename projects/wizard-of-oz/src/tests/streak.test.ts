// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { currentStreak } from '../lib/streak';

const today = '2025-05-29';

describe('currentStreak', () => {
  it('counts consecutive days ending today', () => {
    expect(currentStreak(['2025-05-29', '2025-05-28', '2025-05-27'], today)).toBe(3);
  });

  it('keeps the streak alive when today is not yet captured but yesterday was', () => {
    expect(currentStreak(['2025-05-28', '2025-05-27'], today)).toBe(2);
  });

  it('is zero when neither today nor yesterday has a photo', () => {
    expect(currentStreak(['2025-05-27', '2025-05-26'], today)).toBe(0);
  });

  it('stops at the first gap', () => {
    expect(currentStreak(['2025-05-29', '2025-05-28', '2025-05-26'], today)).toBe(2);
  });

  it('ignores duplicates and order', () => {
    expect(currentStreak(['2025-05-28', '2025-05-29', '2025-05-29', '2025-05-28'], today)).toBe(2);
  });

  it('crosses month boundaries', () => {
    expect(currentStreak(['2025-05-01', '2025-04-30', '2025-04-29'], '2025-05-01')).toBe(3);
  });

  it('is zero for no photos', () => {
    expect(currentStreak([], today)).toBe(0);
  });
});
