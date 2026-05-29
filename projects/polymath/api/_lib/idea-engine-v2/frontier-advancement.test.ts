import { describe, it, expect } from 'vitest';
import {
  structuralNoveltyFromCount,
  HIGH_SIGNAL_THRESHOLD,
} from './frontier-advancement.js';

describe('structuralNoveltyFromCount', () => {
  // Regression: the pair is stamped at generate time, so by the time FAS runs
  // at review the count already includes this idea. A first-ever connection
  // (count === 1) must read as fully novel — the old time-decay formula made
  // it ~0, which put the digest bar out of reach for weeks.
  it('treats a first-time connection (count 1) as fully novel', () => {
    expect(structuralNoveltyFromCount(1)).toBe(1.0);
  });

  it('treats an unseen pair (count 0) as fully novel', () => {
    expect(structuralNoveltyFromCount(0)).toBe(1.0);
  });

  it('erodes 0.1 per prior exploration', () => {
    expect(structuralNoveltyFromCount(2)).toBeCloseTo(0.9); // 1 prior
    expect(structuralNoveltyFromCount(6)).toBeCloseTo(0.5); // 5 prior
  });

  it('never goes negative for a heavily mined pair', () => {
    expect(structuralNoveltyFromCount(50)).toBe(0);
  });

  it('lets a novel pair reach the digest bar with decent distance + surprise', () => {
    // The combination that should clear the bar: brand-new pair, mid distance,
    // no tractability leap, mid surprise. This is the case the bug suppressed.
    const fas =
      structuralNoveltyFromCount(1) * 0.3 + // 0.30
      0.5 * 0.25 + // distance      0.125
      0 * 0.2 + //    leap          0
      0.55 * 0.25; // surprise      0.1375
    expect(fas).toBeGreaterThan(HIGH_SIGNAL_THRESHOLD);
  });

  it('keeps a well-mined pair below the bar even when good', () => {
    // Same distance/surprise but the connection has been mined 6 times before:
    // structural collapses and the idea no longer counts as "new".
    const fas =
      structuralNoveltyFromCount(7) * 0.3 + // 0.4 * 0.3 = 0.12
      0.5 * 0.25 +
      0 * 0.2 +
      0.55 * 0.25;
    expect(fas).toBeLessThan(HIGH_SIGNAL_THRESHOLD);
  });
});
