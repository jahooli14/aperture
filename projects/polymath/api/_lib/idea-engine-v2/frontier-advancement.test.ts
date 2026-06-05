import { describe, it, expect } from 'vitest';
import {
  structuralNoveltyFromCount,
  HIGH_SIGNAL_THRESHOLD,
  RECENT_MINING_WINDOW_DAYS,
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

describe('renewable novelty window', () => {
  // The count fed to structuralNoveltyFromCount is now scoped to a rolling
  // window (calculateDomainPairNovelty counts ie_ideas in the last
  // RECENT_MINING_WINDOW_DAYS), not all-time. This is what makes novelty
  // recover: a pair mined heavily long ago, then left alone, ages back to a
  // low recent count and reads as novel again — so a finite pair space can't
  // permanently drain the structural slice and lock the digest bar shut.
  it('uses a positive, finite recency window', () => {
    expect(RECENT_MINING_WINDOW_DAYS).toBeGreaterThan(0);
    expect(Number.isFinite(RECENT_MINING_WINDOW_DAYS)).toBe(true);
  });

  it('a pair that has gone quiet (low recent count) reads as novel again', () => {
    // Same pair, two moments in time. Once it has 8 mines inside the window its
    // structural novelty is suppressed; after it ages out to 1 recent mine it
    // is fully novel again — the all-time counter could never do this.
    const whileHot = structuralNoveltyFromCount(8); // 0.3
    const onceQuiet = structuralNoveltyFromCount(1); // 1.0
    expect(onceQuiet).toBeGreaterThan(whileHot);
    expect(onceQuiet).toBe(1.0);
  });
});
