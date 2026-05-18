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

  it('rejects non-finite coordinates', () => {
    expect(validateEyeDetection(base({ leftEye: { x: NaN, y: 500 } }))).toBe(false);
    expect(validateEyeDetection(base({ rightEye: { x: Infinity, y: 500 } }))).toBe(false);
    expect(validateEyeDetection(base({ imageWidth: 0 }))).toBe(false);
  });

  it('rejects coordinates far outside the image bounds', () => {
    // > 5% tolerance past the edge — clearly the wrong subject / broken detect.
    expect(validateEyeDetection(base({ leftEye: { x: -200, y: 500 } }))).toBe(false);
    expect(validateEyeDetection(base({ rightEye: { x: 1400, y: 500 } }))).toBe(false);
    expect(validateEyeDetection(base({ leftEye: { x: 400, y: -200 } }))).toBe(false);
    expect(validateEyeDetection(base({ rightEye: { x: 400, y: 1900 } }))).toBe(false);
  });

  it('tolerates an eye a hair past the frame edge (alignment white-fills it)', () => {
    expect(validateEyeDetection(base({ leftEye: { x: -10, y: 500 } }))).toBe(true);
    expect(validateEyeDetection(base({ rightEye: { x: 1210, y: 500 } }))).toBe(true);
  });

  it('rejects eyes essentially coincident (degenerate transform)', () => {
    const coords = base({
      leftEye: { x: 600, y: 500 },
      rightEye: { x: 603, y: 500 }, // 3px apart on a 1200px image
    });
    expect(validateEyeDetection(coords)).toBe(false);
  });

  it('ACCEPTS a tight close-up (eyes >50% of image width)', () => {
    // This is the regression that broke stacking: a valid close-up was being
    // rejected and the unaligned original uploaded instead.
    const coords = base({
      leftEye: { x: 100, y: 500 },
      rightEye: { x: 1100, y: 500 }, // 1000 / 1200 ≈ 83%
    });
    expect(validateEyeDetection(coords)).toBe(true);
  });

  it('ACCEPTS a small/far face (eyes <8% of image width)', () => {
    // 1200 * 0.05 = 60 — far shot, still perfectly alignable.
    const coords = base({
      leftEye: { x: 570, y: 500 },
      rightEye: { x: 630, y: 500 }, // 60px ≈ 5% of width, above the 1% floor
    });
    expect(validateEyeDetection(coords)).toBe(true);
  });

  it('ACCEPTS eyes near the horizontal frame edges', () => {
    expect(
      validateEyeDetection(base({ leftEye: { x: 10, y: 500 }, rightEye: { x: 300, y: 500 } }))
    ).toBe(true);
    expect(
      validateEyeDetection(base({ leftEye: { x: 900, y: 500 }, rightEye: { x: 1195, y: 500 } }))
    ).toBe(true);
  });

  it('accepts steep head tilts (alignPhoto rotates them upright)', () => {
    expect(
      validateEyeDetection(base({
        leftEye: { x: 400, y: 500 },
        rightEye: { x: 500, y: 700 }, // ~63° from horizontal
      }))
    ).toBe(true);
  });
});
