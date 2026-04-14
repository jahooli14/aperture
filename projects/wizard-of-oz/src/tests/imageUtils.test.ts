import { describe, it, expect } from 'vitest';
import { calculateZoomLevel, computeCropRect } from '../lib/imageUtils';

describe('calculateZoomLevel', () => {
  it('uses tight crop (0.40) for newborns and clamps at 0 months', () => {
    expect(calculateZoomLevel(0)).toBeCloseTo(0.4, 5);
    expect(calculateZoomLevel(-5)).toBeCloseTo(0.4, 5);
  });

  it('uses wide crop (0.20) at and beyond 36 months', () => {
    expect(calculateZoomLevel(36)).toBeCloseTo(0.2, 5);
    expect(calculateZoomLevel(48)).toBeCloseTo(0.2, 5);
  });

  it('is strictly decreasing across the interpolated range', () => {
    const samples = [1, 3, 6, 12, 18, 24, 30, 35].map((m) => calculateZoomLevel(m));
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeLessThan(samples[i - 1]);
    }
  });

  it('stays within the declared range for all positive ages', () => {
    for (const m of [1, 5, 15, 25, 35]) {
      const z = calculateZoomLevel(m);
      expect(z).toBeGreaterThanOrEqual(0.2);
      expect(z).toBeLessThanOrEqual(0.4);
    }
  });
});

describe('computeCropRect', () => {
  it('returns null when the two eyes are coincident', () => {
    const rect = computeCropRect(
      { leftEye: { x: 500, y: 500 }, rightEye: { x: 500, y: 500 } },
      0.4
    );
    expect(rect).toBeNull();
  });

  it('computes a 4:5 crop centered near the eye midpoint when angle is 0 and zoom=0.5', () => {
    // When zoomLevel === 0.5, the crop's vertical center coincides with the eye
    // line; with angle=0 it should be exactly the eye midpoint.
    const rect = computeCropRect(
      { leftEye: { x: 400, y: 500 }, rightEye: { x: 600, y: 500 } },
      0.5
    )!;
    expect(rect).not.toBeNull();
    expect(rect.cx).toBeCloseTo(500, 3);
    expect(rect.cy).toBeCloseTo(500, 3);
    expect(rect.angleDeg).toBeCloseTo(0, 3);
    // 4:5 aspect ratio always
    expect(rect.width / rect.height).toBeCloseTo(1080 / 1350, 6);
  });

  it('shifts the crop center downward when zoomLevel < 0.5 (headroom above eyes)', () => {
    // Lower zoomLevel = eyes placed higher in the final frame = more body shown
    // below = crop center moves DOWN in image coords (y increases).
    const eyes = { leftEye: { x: 400, y: 500 }, rightEye: { x: 600, y: 500 } };
    const tight = computeCropRect(eyes, 0.4)!;
    const wide = computeCropRect(eyes, 0.2)!;
    expect(tight.cy).toBeGreaterThan(500);
    expect(wide.cy).toBeGreaterThan(tight.cy);
  });

  it('produces the correct angle for a tilted face', () => {
    const rect = computeCropRect(
      { leftEye: { x: 400, y: 500 }, rightEye: { x: 600, y: 700 } }, // 45° tilt
      0.5
    )!;
    expect(rect.angleDeg).toBeCloseTo(45, 1);
  });

  it('scales the source crop proportionally with detected eye distance', () => {
    // The alignment maps source eyeDist → 34% of TARGET_WIDTH, so the source
    // region needed to fill the target is proportional to the source eye
    // distance: a face that fills the source (big eyeDist) needs a large
    // source crop, while a face that is small in the source needs a tight
    // inner crop upscaled to target.
    const close = computeCropRect(
      { leftEye: { x: 400, y: 500 }, rightEye: { x: 600, y: 500 } }, // dist 200
      0.4
    )!;
    const far = computeCropRect(
      { leftEye: { x: 300, y: 500 }, rightEye: { x: 700, y: 500 } }, // dist 400
      0.4
    )!;
    expect(far.width).toBeGreaterThan(close.width);
    expect(far.width).toBeCloseTo(close.width * 2, 1);
  });
});
