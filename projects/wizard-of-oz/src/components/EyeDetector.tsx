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
function getBlendshape(result: FaceLandmarkerResult, name: string): number | undefined {
  const shapes = result.faceBlendshapes?.[0]?.categories;
  if (!shapes) return undefined;
  const entry = shapes.find((c) => c.categoryName === name);
  return entry?.score;
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
          numFaces: 1,
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
        // The compressed file passed in already has orientation baked in and no EXIF
        // tag, but specifying this option makes the pipeline robust if a raw file is
        // ever passed directly.
        const bitmap = await createImageBitmap(currentFile, { imageOrientation: 'from-image' });

        if (!mounted) {
          bitmap.close();
          return;
        }

        logger.info('Bitmap created for eye detection', {
          width: bitmap.width,
          height: bitmap.height
        }, 'EyeDetector');

        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();

        if (!mounted) return;

        if (!detector) {
          logger.warn('Detector not available', {}, 'EyeDetector');
          onDetection(null);
          return;
        }

        const results: FaceLandmarkerResult = detector.detect(canvas);

        if (!mounted) return;

        if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
          logger.warn('No face landmarks detected', {}, 'EyeDetector');
          onDetection(null);
          return;
        }

        const landmarks = results.faceLandmarks[0];

        // Canonical anchor: eye center = midpoint of inner and outer corner.
        // This is landmark-index-stable and less noisy than iris for closed eyes.
        // Convention: leftEye = subject's RIGHT eye (landmarks 33/133) → appears
        // on LEFT side of upright image. rightEye = subject's LEFT eye.
        if (
          landmarks.length <= IDX_LEFT_IRIS ||
          !landmarks[IDX_RIGHT_EYE_OUTER] ||
          !landmarks[IDX_RIGHT_EYE_INNER] ||
          !landmarks[IDX_LEFT_EYE_OUTER] ||
          !landmarks[IDX_LEFT_EYE_INNER]
        ) {
          logger.warn('Required eye landmarks missing', { landmarkCount: landmarks.length }, 'EyeDetector');
          onDetection(null);
          return;
        }

        const leftEyeNorm = midpoint(landmarks[IDX_RIGHT_EYE_OUTER], landmarks[IDX_RIGHT_EYE_INNER]);
        const rightEyeNorm = midpoint(landmarks[IDX_LEFT_EYE_OUTER], landmarks[IDX_LEFT_EYE_INNER]);

        // Convert normalized [0,1] landmarks to pixel coords.
        const leftEye = { x: leftEyeNorm.x * canvas.width, y: leftEyeNorm.y * canvas.height };
        const rightEye = { x: rightEyeNorm.x * canvas.width, y: rightEyeNorm.y * canvas.height };

        // Iris sanity check: iris centers should nearly coincide with corner-derived
        // eye centers. If they disagree significantly, MediaPipe likely has a poor
        // read on this face — lower confidence rather than rejecting outright.
        const leftIris = landmarks[IDX_RIGHT_IRIS]
          ? { x: landmarks[IDX_RIGHT_IRIS].x * canvas.width, y: landmarks[IDX_RIGHT_IRIS].y * canvas.height }
          : null;
        const rightIris = landmarks[IDX_LEFT_IRIS]
          ? { x: landmarks[IDX_LEFT_IRIS].x * canvas.width, y: landmarks[IDX_LEFT_IRIS].y * canvas.height }
          : null;

        const eyeDistance = distance(leftEye, rightEye);
        let irisAgreement = 1.0;
        if (leftIris && rightIris && eyeDistance > 0) {
          const leftDelta = distance(leftEye, leftIris) / eyeDistance;
          const rightDelta = distance(rightEye, rightIris) / eyeDistance;
          // Perfect agreement → 0 delta. >15% of eye distance → treat as full disagreement.
          irisAgreement = clamp(1.0 - Math.max(leftDelta, rightDelta) / 0.15, 0, 1);
        }

        // Face bounding box (for outlier checks across a user's photo history).
        let minX = Infinity, maxX = -Infinity;
        for (const lm of landmarks) {
          if (lm.x < minX) minX = lm.x;
          if (lm.x > maxX) maxX = lm.x;
        }
        const faceWidth = (maxX - minX) * canvas.width;

        // Eye openness from blendshapes. ARKit convention: blink=1 means closed.
        // Note blendshape names are subject-relative (eyeBlinkLeft = subject's left eye).
        const blinkLeft = getBlendshape(results, 'eyeBlinkLeft') ?? 0;
        const blinkRight = getBlendshape(results, 'eyeBlinkRight') ?? 0;
        const eyesOpen = clamp(1 - Math.max(blinkLeft, blinkRight), 0, 1);

        // Composite confidence score — replaces the old hardcoded 0.8.
        // Factors:
        //  - eye openness (clamped to [0.4, 1] so fully-closed eyes don't get zero)
        //  - iris agreement
        //  - horizontal alignment (penalise heavily-tilted detections)
        const verticalRatio = Math.abs(leftEye.y - rightEye.y) / Math.max(eyeDistance, 1);
        const horizontalQuality = clamp(1 - verticalRatio / 0.5, 0, 1);
        const openGate = clamp(eyesOpen, 0.4, 1);
        const confidence = clamp(openGate * (0.5 + 0.5 * irisAgreement) * horizontalQuality, 0, 1);

        const coords: EyeCoordinates = {
          leftEye,
          rightEye,
          confidence,
          imageWidth: canvas.width,
          imageHeight: canvas.height,
          eyesOpen,
          faceWidth,
          irisAgreement,
        };

        logger.info('Eye detection candidate', {
          leftEye, rightEye,
          imageSize: { width: canvas.width, height: canvas.height },
          eyeDistance,
          normalizedDistance: eyeDistance / canvas.width,
          eyesOpen,
          irisAgreement,
          confidence,
        }, 'EyeDetector');

        if (!validateEyeDetection(coords)) {
          logger.warn('Eye detection failed validation', {}, 'EyeDetector');
          onDetection(null);
          return;
        }

        onDetection(coords);
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
