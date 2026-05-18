import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import { logger } from './logger';

export interface EyeCoordinates {
  // Convention: leftEye is the eye that appears on the LEFT side of the image
  // when the face is upright (i.e. subject's RIGHT eye). rightEye is subject's
  // LEFT eye. alignPhoto relies on this so a single rotation handles any input
  // orientation.
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  confidence: number;
  imageWidth: number;
  imageHeight: number;
  eyesOpen?: number;        // 0-1, 1 = fully open
  faceWidth?: number;       // px width of face bbox (outlier checks across photos)
  irisAgreement?: number;   // 0-1, 1 = iris centers agree with corner-derived centers
}

// MediaPipe Face Mesh canonical landmark indices (subject-relative).
// Subject's RIGHT eye (appears LEFT side in an upright image):
const IDX_RIGHT_EYE_OUTER = 33;
const IDX_RIGHT_EYE_INNER = 133;
const IDX_RIGHT_IRIS = 468;
// Subject's LEFT eye (appears RIGHT side in an upright image):
const IDX_LEFT_EYE_OUTER = 263;
const IDX_LEFT_EYE_INNER = 362;
const IDX_LEFT_IRIS = 473;

type Landmark = { x: number; y: number; z?: number };

function midpoint(a: Landmark, b: Landmark): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function getBlendshape(result: FaceLandmarkerResult, faceIndex: number, name: string): number | undefined {
  const shapes = result.faceBlendshapes?.[faceIndex]?.categories;
  if (!shapes) return undefined;
  return shapes.find((c) => c.categoryName === name)?.score;
}

function buildCoordsFromFace(
  result: FaceLandmarkerResult,
  faceIndex: number,
  canvasWidth: number,
  canvasHeight: number
): EyeCoordinates | null {
  const landmarks = result.faceLandmarks?.[faceIndex];
  if (!landmarks) return null;
  if (
    landmarks.length <= IDX_LEFT_IRIS ||
    !landmarks[IDX_RIGHT_EYE_OUTER] ||
    !landmarks[IDX_RIGHT_EYE_INNER] ||
    !landmarks[IDX_LEFT_EYE_OUTER] ||
    !landmarks[IDX_LEFT_EYE_INNER]
  ) {
    return null;
  }

  const leftEyeNorm = midpoint(landmarks[IDX_RIGHT_EYE_OUTER], landmarks[IDX_RIGHT_EYE_INNER]);
  const rightEyeNorm = midpoint(landmarks[IDX_LEFT_EYE_OUTER], landmarks[IDX_LEFT_EYE_INNER]);
  const leftEye = { x: leftEyeNorm.x * canvasWidth, y: leftEyeNorm.y * canvasHeight };
  const rightEye = { x: rightEyeNorm.x * canvasWidth, y: rightEyeNorm.y * canvasHeight };

  const leftIris = landmarks[IDX_RIGHT_IRIS]
    ? { x: landmarks[IDX_RIGHT_IRIS].x * canvasWidth, y: landmarks[IDX_RIGHT_IRIS].y * canvasHeight }
    : null;
  const rightIris = landmarks[IDX_LEFT_IRIS]
    ? { x: landmarks[IDX_LEFT_IRIS].x * canvasWidth, y: landmarks[IDX_LEFT_IRIS].y * canvasHeight }
    : null;

  const eyeDistance = distance(leftEye, rightEye);
  let irisAgreement = 1.0;
  if (leftIris && rightIris && eyeDistance > 0) {
    const leftDelta = distance(leftEye, leftIris) / eyeDistance;
    const rightDelta = distance(rightEye, rightIris) / eyeDistance;
    irisAgreement = clamp(1.0 - Math.max(leftDelta, rightDelta) / 0.15, 0, 1);
  }

  let minX = Infinity, maxX = -Infinity;
  for (const lm of landmarks) {
    if (lm.x < minX) minX = lm.x;
    if (lm.x > maxX) maxX = lm.x;
  }
  const faceWidth = (maxX - minX) * canvasWidth;

  const blinkLeft = getBlendshape(result, faceIndex, 'eyeBlinkLeft') ?? 0;
  const blinkRight = getBlendshape(result, faceIndex, 'eyeBlinkRight') ?? 0;
  const eyesOpen = clamp(1 - Math.max(blinkLeft, blinkRight), 0, 1);

  const verticalRatio = Math.abs(leftEye.y - rightEye.y) / Math.max(eyeDistance, 1);
  const horizontalQuality = clamp(1 - verticalRatio / 0.5, 0, 1);
  const openGate = clamp(eyesOpen, 0.4, 1);
  const confidence = clamp(openGate * (0.5 + 0.5 * irisAgreement) * horizontalQuality, 0, 1);

  return {
    leftEye,
    rightEye,
    confidence,
    imageWidth: canvasWidth,
    imageHeight: canvasHeight,
    eyesOpen,
    faceWidth,
    irisAgreement,
  };
}

function drawRotated(bitmap: ImageBitmap, degrees: 0 | 90 | 180 | 270): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const w = bitmap.width;
  const h = bitmap.height;
  if (degrees === 90 || degrees === 270) {
    canvas.width = h;
    canvas.height = w;
  } else {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(bitmap, -w / 2, -h / 2);
  ctx.restore();
  return canvas;
}

function unrotatePoint(
  p: { x: number; y: number },
  degrees: 0 | 90 | 180 | 270,
  originalWidth: number,
  originalHeight: number,
  rotatedWidth: number,
  rotatedHeight: number
): { x: number; y: number } {
  switch (degrees) {
    case 0:
      return p;
    case 90:
      return { x: p.y, y: rotatedWidth - p.x };
    case 180:
      return { x: originalWidth - p.x, y: originalHeight - p.y };
    case 270:
      return { x: rotatedHeight - p.y, y: p.x };
  }
}

/**
 * Pick the best face from a multi-face detection. Baby photos commonly include
 * a parent — prefer the SMALLEST face (babies have smaller heads), tie-broken
 * by proximity to frame center.
 */
function pickBabyFace(result: FaceLandmarkerResult, canvasWidth: number, canvasHeight: number): number {
  const faces = result.faceLandmarks ?? [];
  if (faces.length === 0) return -1;
  if (faces.length === 1) return 0;

  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  const diagonal = Math.hypot(canvasWidth, canvasHeight);

  let bestIndex = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < faces.length; i++) {
    const lm = faces[i];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let sumX = 0, sumY = 0;
    for (const p of lm) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
      sumX += p.x;
      sumY += p.y;
    }
    const faceW = (maxX - minX) * canvasWidth;
    const faceH = (maxY - minY) * canvasHeight;
    const faceSize = Math.max(faceW, faceH);
    const faceCx = (sumX / lm.length) * canvasWidth;
    const faceCy = (sumY / lm.length) * canvasHeight;
    const centerDist = Math.hypot(faceCx - cx, faceCy - cy);

    const sizeScore = 1 - Math.min(1, faceSize / Math.min(canvasWidth, canvasHeight));
    const centerScore = 1 - Math.min(1, centerDist / (diagonal / 2));
    const score = sizeScore * 0.7 + centerScore * 0.3;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return bestIndex;
}

/**
 * Reject only *implausible* detections, never valid ones.
 *
 * This is an eye-STACKING aligner: alignPhoto() normalises scale (eye spacing →
 * a fixed 34% of the output width), rotation, and centre. So the absolute eye
 * spacing and how close the face sits to a frame edge are irrelevant — those
 * are exactly the things alignment fixes. The old range/edge gates were
 * silently throwing away good detections (tight baby close-ups exceed 50% of
 * width; wide shots fall under 8%), which dumped an *unaligned original* into
 * the timeline and is the root cause of the gallery not stacking.
 */
export function validateEyeDetection(detection: EyeCoordinates): boolean {
  const { leftEye, rightEye, imageWidth, imageHeight } = detection;

  const finite = (n: number) => Number.isFinite(n);
  if (
    !finite(leftEye.x) || !finite(leftEye.y) ||
    !finite(rightEye.x) || !finite(rightEye.y) ||
    !finite(imageWidth) || !finite(imageHeight) ||
    imageWidth <= 0 || imageHeight <= 0
  ) {
    logger.error('Eye coordinates not finite', { leftEye, rightEye, imageWidth, imageHeight }, 'faceDetection.validate');
    return false;
  }

  // Allow a small tolerance past the edge: MediaPipe occasionally places an eye
  // a pixel or two outside the bitmap on profile shots, and alignment (with its
  // white fill) still handles those fine. Only a wildly out-of-frame point
  // indicates the wrong subject / a broken detection.
  const tol = 0.05;
  if (
    leftEye.x < -tol * imageWidth || leftEye.x > imageWidth * (1 + tol) ||
    leftEye.y < -tol * imageHeight || leftEye.y > imageHeight * (1 + tol) ||
    rightEye.x < -tol * imageWidth || rightEye.x > imageWidth * (1 + tol) ||
    rightEye.y < -tol * imageHeight || rightEye.y > imageHeight * (1 + tol)
  ) {
    logger.error('Eye coordinates far out of bounds', { leftEye, rightEye, imageWidth, imageHeight }, 'faceDetection.validate');
    return false;
  }

  // Degenerate-transform guard only. Eyes essentially coincident (or a few px
  // apart on a large image) means a misdetection that would up-scale the source
  // enormously. An order of magnitude below the old 8% gate so real close-ups
  // and wide shots both pass.
  const eyeDistance = distance(leftEye, rightEye);
  if (eyeDistance < 8 || eyeDistance < imageWidth * 0.01) {
    logger.error('Eyes too close together — likely misdetection', {
      eyeDistance, imageWidth, normalized: eyeDistance / imageWidth,
    }, 'faceDetection.validate');
    return false;
  }

  logger.info('Eye detection validated', {
    normalizedDistance: eyeDistance / imageWidth,
    verticalRatio: Math.abs(leftEye.y - rightEye.y) / eyeDistance,
  }, 'faceDetection.validate');

  return true;
}

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

/**
 * Lazily create a single shared FaceLandmarker. Reused by both the live
 * upload detector and the backlog re-align pass so we only pay the
 * model-download / GPU-init cost once per session.
 */
export function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
      );
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        numFaces: 3,
        minFaceDetectionConfidence: 0.3,
        minFacePresenceConfidence: 0.3,
        minTrackingConfidence: 0.3,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false,
      });
    })().catch((error) => {
      // Reset so a transient init failure (e.g. offline) can retry next call.
      landmarkerPromise = null;
      throw error;
    });
  }
  return landmarkerPromise;
}

/**
 * Detect the baby's eyes in an image, in the pixel space of the EXIF-corrected
 * bitmap (`createImageBitmap(..., { imageOrientation: 'from-image' })`), which
 * is exactly the space alignPhoto() consumes. Tries all four cardinal
 * orientations and un-rotates the winner back into source space so callers can
 * feed the result straight into alignPhoto without any orientation bookkeeping.
 *
 * Returns null when no validated face is found in any orientation.
 */
export async function detectEyesFromImage(file: File): Promise<EyeCoordinates | null> {
  const detector = await getFaceLandmarker();
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

  try {
    const orientations: Array<0 | 90 | 180 | 270> = [0, 90, 180, 270];
    let best: { coords: EyeCoordinates; orientation: 0 | 90 | 180 | 270 } | null = null;

    for (const orientation of orientations) {
      const canvas = drawRotated(bitmap, orientation);
      const result = detector.detect(canvas);
      if (!result.faceLandmarks || result.faceLandmarks.length === 0) continue;

      const faceIndex = pickBabyFace(result, canvas.width, canvas.height);
      if (faceIndex < 0) continue;

      const coords = buildCoordsFromFace(result, faceIndex, canvas.width, canvas.height);
      if (!coords || !validateEyeDetection(coords)) continue;

      // Happy path: a confident hit at native orientation — skip the rotations.
      if (orientation === 0 && coords.confidence >= 0.6) {
        best = { coords, orientation };
        break;
      }
      if (!best || coords.confidence > best.coords.confidence) {
        best = { coords, orientation };
      }
    }

    if (!best) return null;

    if (best.orientation === 0) return best.coords;

    const rotatedW = best.coords.imageWidth;
    const rotatedH = best.coords.imageHeight;
    const originalW = best.orientation === 90 || best.orientation === 270 ? rotatedH : rotatedW;
    const originalH = best.orientation === 90 || best.orientation === 270 ? rotatedW : rotatedH;
    return {
      ...best.coords,
      leftEye: unrotatePoint(best.coords.leftEye, best.orientation, originalW, originalH, rotatedW, rotatedH),
      rightEye: unrotatePoint(best.coords.rightEye, best.orientation, originalW, originalH, rotatedW, rotatedH),
      imageWidth: originalW,
      imageHeight: originalH,
    };
  } finally {
    bitmap.close();
  }
}
