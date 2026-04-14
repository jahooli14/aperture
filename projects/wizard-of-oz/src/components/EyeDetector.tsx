import { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import { logger } from '../lib/logger';

export interface EyeCoordinates {
  // Convention: leftEye is the eye that appears on the LEFT side of the image when
  // the face is upright (i.e. subject's RIGHT eye). rightEye is subject's LEFT eye.
  // alignPhoto uses this convention so a single rotation handles any input orientation.
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  confidence: number;
  imageWidth: number;
  imageHeight: number;
  // Quality signals
  eyesOpen?: number;        // 0-1, 1 = fully open
  faceWidth?: number;       // pixel width of face bounding box (for outlier checks across photos)
  irisAgreement?: number;   // 0-1, 1 = iris centers agree perfectly with corner-derived eye centers
}

interface EyeDetectorProps {
  imageFile: File;
  onDetection: (coords: EyeCoordinates | null) => void;
  onError?: (error: Error) => void;
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

/**
 * Find a named blendshape category score. MediaPipe returns these as an array of
 * { categoryName, score } entries. Not all models include every ARKit shape.
 */
function getBlendshape(result: FaceLandmarkerResult, faceIndex: number, name: string): number | undefined {
  const shapes = result.faceBlendshapes?.[faceIndex]?.categories;
  if (!shapes) return undefined;
  const entry = shapes.find((c) => c.categoryName === name);
  return entry?.score;
}

/**
 * Build an EyeCoordinates object for one detected face (given an index into
 * the multi-face result arrays). Returns null if required landmarks are
 * missing. All pixel coords are in the canvas's image space.
 */
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

  // Face bounding box for this face index.
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

/**
 * Draw a bitmap to a canvas, optionally rotated by 90/180/270°. Used for the
 * orientation-retry path — if MediaPipe can't find a face in the source
 * orientation, we try all three other cardinal rotations before giving up.
 */
function drawRotated(
  bitmap: ImageBitmap,
  degrees: 0 | 90 | 180 | 270
): HTMLCanvasElement {
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

/**
 * Un-rotate a point from a rotated canvas back into the original image's
 * coordinate space. Inverse of drawRotated.
 */
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
      // 90° CW: (x', y') = (h - y, x). Invert: (x, y) = (y', w - x').
      return { x: p.y, y: rotatedWidth - p.x };
    case 180:
      return { x: originalWidth - p.x, y: originalHeight - p.y };
    case 270:
      return { x: rotatedHeight - p.y, y: p.x };
  }
}

/**
 * Pick the best face from a multi-face detection. Baby photos commonly
 * include a parent — we prefer the SMALLEST face (babies have smaller heads
 * than adults), tie-broken by proximity to frame center. If only one face
 * is detected, we return that one.
 */
function pickBabyFace(
  result: FaceLandmarkerResult,
  canvasWidth: number,
  canvasHeight: number
): number {
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

    // Lower size = better; lower center distance = better. Weight size more.
    // Normalize both to [0,1] and combine.
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

export function EyeDetector({ imageFile, onDetection, onError }: EyeDetectorProps) {
  const [detector, setDetector] = useState<FaceLandmarker | null>(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize MediaPipe Face Landmarker once
  useEffect(() => {
    let mounted = true;

    async function initDetector() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
        );

        if (!mounted) return;

        const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU'
          },
          // Detect up to 3 faces so we can pick the baby (smallest / most
          // central) when parents or siblings are in frame.
          numFaces: 3,
          minFaceDetectionConfidence: 0.3, // kept permissive for challenging baby photos; confidence is recomputed below
          minFacePresenceConfidence: 0.3,
          minTrackingConfidence: 0.3,
          outputFaceBlendshapes: true,              // needed for eye-openness signal
          outputFacialTransformationMatrixes: false
        });

        if (!mounted) return;

        setDetector(faceLandmarker);
        setLoading(false);
      } catch (error) {
        logger.error('Failed to load MediaPipe detector', { error: error instanceof Error ? error.message : String(error) }, 'EyeDetector');
        if (mounted) {
          setLoading(false);
          onError?.(error instanceof Error ? error : new Error('Failed to initialize face detector'));
        }
      }
    }

    initDetector();

    return () => {
      mounted = false;
    };
  }, [onError]);

  // Detect eyes when image or detector changes
  useEffect(() => {
    if (!detector || !imageFile || loading) return;

    let mounted = true;
    const currentFile = imageFile; // capture reference to detect file change

    async function detectEyes() {
      try {
        logger.info('Starting eye detection', {
          fileName: currentFile.name,
          fileSize: currentFile.size,
          fileType: currentFile.type
        }, 'EyeDetector');

        // Use the SAME createImageBitmap options as compressImage() and alignPhoto().
        // imageOrientation: 'from-image' applies EXIF rotation before pixel access so
        // landmark coords are consistent with the bytes we later ship to alignPhoto.
        const bitmap = await createImageBitmap(currentFile, { imageOrientation: 'from-image' });

        if (!mounted) {
          bitmap.close();
          return;
        }

        logger.info('Bitmap created for eye detection', {
          width: bitmap.width,
          height: bitmap.height
        }, 'EyeDetector');

        if (!detector) {
          logger.warn('Detector not available', {}, 'EyeDetector');
          bitmap.close();
          onDetection(null);
          return;
        }

        // Retry pipeline: try each of the four cardinal orientations and pick
        // the one that produces the best (validated, highest-confidence)
        // detection. Covers photos that were saved without correct EXIF
        // orientation or deliberately rotated.
        const orientations: Array<0 | 90 | 180 | 270> = [0, 90, 180, 270];
        let best: { coords: EyeCoordinates; orientation: 0 | 90 | 180 | 270 } | null = null;

        for (const orientation of orientations) {
          if (!mounted) break;

          const canvas = drawRotated(bitmap, orientation);
          const result = detector.detect(canvas);
          if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
            logger.info('No faces at orientation', { orientation }, 'EyeDetector');
            continue;
          }

          const faceIndex = pickBabyFace(result, canvas.width, canvas.height);
          if (faceIndex < 0) continue;

          const coords = buildCoordsFromFace(result, faceIndex, canvas.width, canvas.height);
          if (!coords) continue;

          if (!validateEyeDetection(coords)) {
            logger.info('Candidate failed validation', { orientation, confidence: coords.confidence }, 'EyeDetector');
            continue;
          }

          logger.info('Candidate accepted', {
            orientation,
            confidence: coords.confidence,
            facesFound: result.faceLandmarks.length,
            pickedFace: faceIndex,
          }, 'EyeDetector');

          // Shortcut: if we have a high-confidence match at the native
          // orientation, don't bother rotating. Saves ~3× detection cost on
          // the happy path.
          if (orientation === 0 && coords.confidence >= 0.6) {
            best = { coords, orientation };
            break;
          }

          if (!best || coords.confidence > best.coords.confidence) {
            best = { coords, orientation };
          }
        }

        bitmap.close();

        if (!mounted) return;

        if (!best) {
          logger.warn('No valid face detected in any orientation', {}, 'EyeDetector');
          onDetection(null);
          return;
        }

        // If we picked a rotated orientation, un-rotate the eye coordinates
        // back into the original image's pixel space so downstream code
        // (alignPhoto) sees coords consistent with the bytes it receives.
        let finalCoords = best.coords;
        if (best.orientation !== 0) {
          const rotatedW = best.coords.imageWidth;
          const rotatedH = best.coords.imageHeight;
          const originalW = (best.orientation === 90 || best.orientation === 270) ? rotatedH : rotatedW;
          const originalH = (best.orientation === 90 || best.orientation === 270) ? rotatedW : rotatedH;
          finalCoords = {
            ...best.coords,
            leftEye: unrotatePoint(best.coords.leftEye, best.orientation, originalW, originalH, rotatedW, rotatedH),
            rightEye: unrotatePoint(best.coords.rightEye, best.orientation, originalW, originalH, rotatedW, rotatedH),
            imageWidth: originalW,
            imageHeight: originalH,
          };
          logger.info('Un-rotated coords back to source space', {
            orientation: best.orientation,
            source: { w: originalW, h: originalH },
          }, 'EyeDetector');
        }

        logger.info('Eye detection final', {
          leftEye: finalCoords.leftEye,
          rightEye: finalCoords.rightEye,
          confidence: finalCoords.confidence,
          orientation: best.orientation,
        }, 'EyeDetector');

        onDetection(finalCoords);
      } catch (error) {
        logger.error('Eye detection failed', { error: error instanceof Error ? error.message : String(error) }, 'EyeDetector');
        onError?.(error instanceof Error ? error : new Error('Eye detection failed'));
        onDetection(null);
      }
    }

    detectEyes();

    return () => {
      mounted = false;
    };
  }, [detector, imageFile, loading, onDetection, onError]);

  // We don't render anything visible - this is a logic-only component
  return <canvas ref={canvasRef} style={{ display: 'none' }} />;
}

export function validateEyeDetection(detection: EyeCoordinates): boolean {
  const { leftEye, rightEye, imageWidth, imageHeight } = detection;

  // In-bounds check
  if (
    leftEye.x < 0 || leftEye.x > imageWidth ||
    leftEye.y < 0 || leftEye.y > imageHeight ||
    rightEye.x < 0 || rightEye.x > imageWidth ||
    rightEye.y < 0 || rightEye.y > imageHeight
  ) {
    logger.error('Eye coordinates out of bounds', { leftEye, rightEye, imageWidth, imageHeight }, 'EyeDetector.validate');
    return false;
  }

  // Interocular distance relative to image width — detection is suspect outside this range.
  const eyeDistance = distance(leftEye, rightEye);
  const normalizedDistance = eyeDistance / imageWidth;

  // Relaxed range; eye-center anchors are stable so 8-50% covers close-ups to wide shots.
  if (normalizedDistance < 0.08 || normalizedDistance > 0.50) {
    logger.error('Eye distance out of range', { normalizedDistance, range: '0.08-0.50' }, 'EyeDetector.validate');
    return false;
  }

  // Horizontal tilt tolerance — allow head tilt up to 45° (tan 45° = 1.0).
  // Beyond this, landmark labels may be unreliable.
  const verticalDiff = Math.abs(leftEye.y - rightEye.y);
  if (verticalDiff > eyeDistance * 1.0) {
    logger.error('Eyes not horizontal enough', {
      verticalDiff, eyeDistance, ratio: verticalDiff / eyeDistance
    }, 'EyeDetector.validate');
    return false;
  }

  // Edge margin — eyes too close to frame edges produce bad crops.
  const margin = 0.03 * imageWidth;
  if (
    leftEye.x < margin || leftEye.x > imageWidth - margin ||
    rightEye.x < margin || rightEye.x > imageWidth - margin
  ) {
    logger.error('Eyes too close to edges', { leftEye, rightEye, margin, imageWidth }, 'EyeDetector.validate');
    return false;
  }

  logger.info('Eye detection validated', {
    normalizedDistance,
    verticalRatio: verticalDiff / eyeDistance,
  }, 'EyeDetector.validate');

  return true;
}
