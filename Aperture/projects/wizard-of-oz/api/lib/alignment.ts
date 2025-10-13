/**
 * Pure TypeScript implementation of similarity transformation for face alignment.
 *
 * This implements the same math as OpenCV's estimateAffinePartial2D but in TypeScript,
 * allowing us to use Sharp for image transformation without Python dependencies.
 */

interface Point {
  x: number;
  y: number;
}

interface AffineMatrix {
  a: number;  // scale * cos(angle)
  b: number;  // scale * sin(angle)
  c: number;  // translation x
  d: number;  // -scale * sin(angle)
  e: number;  // scale * cos(angle)
  f: number;  // translation y
}

/**
 * Calculate similarity transformation matrix (rotation + scale + translation)
 * to align source points to destination points.
 *
 * This is a 2D similarity transform that preserves angles and aspect ratio.
 * It's the correct approach for face alignment (no shearing/skewing).
 *
 * Based on: https://en.wikipedia.org/wiki/Similarity_(geometry)
 */
export function calculateSimilarityTransform(
  srcPoints: [Point, Point],
  dstPoints: [Point, Point]
): AffineMatrix {
  const [srcLeft, srcRight] = srcPoints;
  const [dstLeft, dstRight] = dstPoints;

  // Calculate source eye vector
  const srcDx = srcRight.x - srcLeft.x;
  const srcDy = srcRight.y - srcLeft.y;
  const srcDist = Math.sqrt(srcDx * srcDx + srcDy * srcDy);

  // Calculate destination eye vector
  const dstDx = dstRight.x - dstLeft.x;
  const dstDy = dstRight.y - dstLeft.y;
  const dstDist = Math.sqrt(dstDx * dstDx + dstDy * dstDy);

  // Calculate scale factor
  const scale = dstDist / srcDist;

  // Calculate rotation angle (difference between source and dest angles)
  const srcAngle = Math.atan2(srcDy, srcDx);
  const dstAngle = Math.atan2(dstDy, dstDx);
  const angle = dstAngle - srcAngle;

  // Build similarity transformation matrix
  // [ a  b  c ]   [ scale*cos(θ)  -scale*sin(θ)  tx ]
  // [ d  e  f ] = [ scale*sin(θ)   scale*cos(θ)  ty ]
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const a = scale * cos;
  const b = -scale * sin;
  const d = scale * sin;
  const e = scale * cos;

  // Calculate translation to map source left eye to destination left eye
  // After rotation and scaling
  const rotatedSrcX = a * srcLeft.x + b * srcLeft.y;
  const rotatedSrcY = d * srcLeft.x + e * srcLeft.y;

  const c = dstLeft.x - rotatedSrcX;
  const f = dstLeft.y - rotatedSrcY;

  return { a, b, c, d, e, f };
}

/**
 * Convert affine matrix to Sharp's affine format.
 * Sharp expects: [a, b, c, d] where the transformation is:
 * [ a  b ]
 * [ c  d ]
 *
 * But we also need to handle translation separately.
 */
export function matrixToSharpFormat(matrix: AffineMatrix) {
  return {
    // Transformation matrix (rotation + scale)
    matrix: [matrix.a, matrix.b, matrix.d, matrix.e] as [number, number, number, number],
    // Translation
    translation: { x: matrix.c, y: matrix.f },
  };
}

/**
 * Calculate target eye positions for 1080x1080 output.
 * Baby's left eye (right side of image): (720, 432)
 * Baby's right eye (left side of image): (360, 432)
 */
export const TARGET_EYE_POSITIONS = {
  leftEye: { x: 720, y: 432 },   // Baby's left eye (right side of image)
  rightEye: { x: 360, y: 432 },  // Baby's right eye (left side of image)
} as const;

export const OUTPUT_SIZE = {
  width: 1080,
  height: 1080,
} as const;
