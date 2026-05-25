// @vitest-environment node
// imageUtils' tested surface (calculateZoomLevel, computeCropRect,
// computeAlignmentPadding, hasWhiteCorners) is pure math — no DOM needed, and
// skipping jsdom dodges an ESM/TLA load issue under recent Node versions.
import { describe, it, expect } from 'vitest';
import { calculateZoomLevel, computeCropRect, computeAlignmentPadding, hasWhiteCorners } from '../lib/imageUtils';

const TARGET_WIDTH = 1080;
const EYE_LINE_FRAC = 0.34; // alignPhoto maps source eye distance → 34% of TARGET_WIDTH

// Pretend the source has eyes at the given midpoint with the given eye distance
// and tilt. Returns the alignment_transform fields that alignPhoto would store.
function fakeAlignment(
  eyeMidX: number,
  eyeMidY: number,
  eyeDistance: number,
  tiltDeg: number
) {
  const angleRad = (tiltDeg * Math.PI) / 180;
  const scale = (TARGET_WIDTH * EYE_LINE_FRAC) / eyeDistance;
  const halfEye = eyeDistance / 2;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const leftEye = { x: eyeMidX - cos * halfEye, y: eyeMidY - sin * halfEye };
  const rightEye = { x: eyeMidX + cos * halfEye, y: eyeMidY + sin * halfEye };
  return {
    transform: { rotation: -tiltDeg, scale, translateX: 0, translateY: 0 },
    eyes: leftEye.x !== undefined ? { leftEye, rightEye } : { leftEye, rightEye },
    angleRad,
    scale,
  };
}

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

describe('computeAlignmentPadding', () => {
  it('is zero on every side when the source dwarfs the needed crop', () => {
    // Source 4000×4000 with face centered and eyes 800px apart → scale ~0.46;
    // the projected output canvas is well inside the source, no padding needed.
    const { angleRad, scale } = fakeAlignment(2000, 2000, 800, 0);
    const pad = computeAlignmentPadding(4000, 4000, 2000, 2000, angleRad, scale, 0.40);
    expect(pad.padLeft).toBe(0);
    expect(pad.padRight).toBe(0);
    expect(pad.padTop).toBe(0);
    expect(pad.padBottom).toBe(0);
  });

  it('pads only the side the face is close to', () => {
    // Face near the LEFT edge of a 2000×2000 source.
    const { angleRad, scale } = fakeAlignment(200, 1000, 800, 0);
    const pad = computeAlignmentPadding(2000, 2000, 200, 1000, angleRad, scale, 0.40);
    expect(pad.padLeft).toBeGreaterThan(0);
    expect(pad.padRight).toBe(0);
  });

  it('adds padding on both axes when the photo is tilted', () => {
    // Centered face on a 1500×1500 source, 45° tilt — the rotated canvas
    // diagonal extends past the source edges on every side.
    const { angleRad, scale } = fakeAlignment(750, 750, 600, 45);
    const pad = computeAlignmentPadding(1500, 1500, 750, 750, angleRad, scale, 0.40);
    expect(pad.padLeft + pad.padRight + pad.padTop + pad.padBottom).toBeGreaterThan(0);
  });
});

describe('hasWhiteCorners', () => {
  it('returns false for a well-framed, untilted shot', () => {
    const { transform, eyes } = fakeAlignment(2000, 2000, 800, 0);
    expect(
      hasWhiteCorners(transform, { ...eyes, imageWidth: 4000, imageHeight: 4000 }, 0.40)
    ).toBe(false);
  });

  it('returns true when the face sits close to a source edge', () => {
    const { transform, eyes } = fakeAlignment(150, 1000, 800, 0);
    expect(
      hasWhiteCorners(transform, { ...eyes, imageWidth: 2000, imageHeight: 2000 }, 0.40)
    ).toBe(true);
  });

  it('returns true for a heavily tilted face on a tight crop', () => {
    const { transform, eyes } = fakeAlignment(750, 750, 600, 30);
    expect(
      hasWhiteCorners(transform, { ...eyes, imageWidth: 1500, imageHeight: 1500 }, 0.40)
    ).toBe(true);
  });
});
