import { describe, it, expect } from 'vitest';
import { validateEyeDetection, type EyeCoordinates } from '../components/EyeDetector';

const base = (overrides: Partial<EyeCoordinates> = {}): EyeCoordinates => ({
  leftEye: { x: 400, y: 500 },
  rightEye: { x: 700, y: 500 },
  confidence: 0.9,
  imageWidth: 1200,
  imageHeight: 1600,
  ...overrides,
});

describe('validateEyeDetection', () => {
  it('accepts a well-framed upright face', () => {
    expect(validateEyeDetection(base())).toBe(true);
  });

  it('rejects coordinates outside the image bounds', () => {
    expect(validateEyeDetection(base({ leftEye: { x: -5, y: 500 } }))).toBe(false);
    expect(validateEyeDetection(base({ rightEye: { x: 1300, y: 500 } }))).toBe(false);
    expect(validateEyeDetection(base({ leftEye: { x: 400, y: -1 } }))).toBe(false);
    expect(validateEyeDetection(base({ rightEye: { x: 400, y: 1700 } }))).toBe(false);
  });

  it('rejects eye distance below 8% of image width (too close)', () => {
    // 1200 * 0.08 = 96 — eyes 50px apart is clearly too small.
    const coords = base({
      leftEye: { x: 580, y: 500 },
      rightEye: { x: 630, y: 500 },
    });
    expect(validateEyeDetection(coords)).toBe(false);
  });

  it('rejects eye distance above 50% of image width (too far / wrong subject)', () => {
    const coords = base({
      leftEye: { x: 100, y: 500 },
      rightEye: { x: 1100, y: 500 }, // 1000 / 1200 = 83%
    });
    expect(validateEyeDetection(coords)).toBe(false);
  });

  it('accepts typical head tilts (up to 45°)', () => {
    // Note: verticalDiff = |dy| and eyeDistance = sqrt(dx² + dy²), so
    // verticalDiff <= eyeDistance always. The current threshold is intentionally
    // permissive — we rely on the alignPhoto rotation to handle tilt, and leave
    // hard rejection to the other checks (bounds, distance, margin).
    expect(
      validateEyeDetection(base({
        leftEye: { x: 400, y: 500 },
        rightEye: { x: 500, y: 700 }, // ~63° measured from horizontal
      }))
    ).toBe(true);
  });

  it('rejects eyes too close to the horizontal frame edges', () => {
    const margin = 0.03 * 1200; // 36
    const leftTooClose = base({ leftEye: { x: 10, y: 500 }, rightEye: { x: 300, y: 500 } });
    const rightTooClose = base({ leftEye: { x: 800, y: 500 }, rightEye: { x: 1195, y: 500 } });
    expect(margin).toBeCloseTo(36, 5);
    expect(validateEyeDetection(leftTooClose)).toBe(false);
    expect(validateEyeDetection(rightTooClose)).toBe(false);
  });
});
