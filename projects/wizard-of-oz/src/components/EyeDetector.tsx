import { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import { logger } from '../lib/logger';

export interface EyeCoordinates {
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  confidence: number;
  imageWidth: number;
  imageHeight: number;
}

interface EyeDetectorProps {
  imageFile: File;
  onDetection: (coords: EyeCoordinates | null) => void;
  onError?: (error: Error) => void;
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
          minFaceDetectionConfidence: 0.3, // Even lower for challenging baby photos
          minFacePresenceConfidence: 0.3,
          minTrackingConfidence: 0.3,
          outputFaceBlendshapes: false,
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
    const currentFile = imageFile; // Capture file reference to detect if it changed

    async function detectEyes() {
      try {
        logger.info('Starting eye detection', {
          fileName: currentFile.name,
          fileSize: currentFile.size,
          fileType: currentFile.type
        }, 'EyeDetector');

        // Use createImageBitmap to ensure consistent EXIF orientation handling
        // This is critical for camera photos which may have rotation metadata
        // Without this, eye detection coordinates would be for the un-rotated image
        // but the compressed image (which uses createImageBitmap) would be rotated
        const bitmap = await createImageBitmap(currentFile);

        // Check if file changed while we were loading the bitmap
        if (!mounted) {
          bitmap.close();
          return;
        }

        logger.info('Bitmap created for eye detection', {
          width: bitmap.width,
          height: bitmap.height
        }, 'EyeDetector');

        // Create a canvas to draw the bitmap (MediaPipe needs an HTMLImageElement or canvas)
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();

        if (!mounted) {
          return;
        }

        if (!detector) {
          logger.warn('Detector not available', {}, 'EyeDetector');
          onDetection(null);
          return;
        }

        const results: FaceLandmarkerResult = detector.detect(canvas);

        if (!mounted) {
          return;
        }

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          const landmarks = results.faceLandmarks[0];

          // Try multiple landmark combinations to find the best detection
          const landmarkCombinations = [
            // Best: Iris centers (most accurate)
            landmarks.length > 473 ? {
              leftEye: landmarks[473],
              rightEye: landmarks[468],
              name: 'iris centers'
            } : null,
            // Good: Eye outer corners (reliable for alignment)
            {
              leftEye: landmarks[263],  // Left eye outer corner
              rightEye: landmarks[33],   // Right eye outer corner
              name: 'outer corners'
            },
            // Fallback: Eye inner corners
            {
              leftEye: landmarks[362],  // Left eye inner corner
              rightEye: landmarks[133],  // Right eye inner corner
              name: 'inner corners'
            },
            // Last resort: Average of multiple eye landmarks
            {
              leftEye: {
                x: (landmarks[362].x + landmarks[263].x) / 2,
                y: (landmarks[362].y + landmarks[263].y) / 2,
                z: (landmarks[362].z + landmarks[263].z) / 2
              },
              rightEye: {
                x: (landmarks[133].x + landmarks[33].x) / 2,
                y: (landmarks[133].y + landmarks[33].y) / 2,
                z: (landmarks[133].z + landmarks[33].z) / 2
              },
              name: 'averaged landmarks'
            }
          ].filter(Boolean);

          // Try each combination until one validates
          for (const combination of landmarkCombinations) {
            if (!combination) continue;

            const { leftEye, rightEye, name } = combination;

            // MediaPipe returns normalized coordinates (0-1), convert to pixels
            const coords: EyeCoordinates = {
              leftEye: {
                x: leftEye.x * canvas.width,
                y: leftEye.y * canvas.height
              },
              rightEye: {
                x: rightEye.x * canvas.width,
                y: rightEye.y * canvas.height
              },
              confidence: 0.8, // MediaPipe doesn't provide per-landmark confidence
              imageWidth: canvas.width,
              imageHeight: canvas.height
            };

            logger.info('Trying landmark combination', {
              method: name,
              leftEye: coords.leftEye,
              rightEye: coords.rightEye,
              imageSize: { width: canvas.width, height: canvas.height }
            }, 'EyeDetector');

            // Validate detection
            const isValid = validateEyeDetection(coords);

            if (isValid) {
              logger.info('Eye detection validation passed', { method: name }, 'EyeDetector');
              onDetection(coords);
              return; // Success - exit function
            } else {
              logger.warn('Eye detection validation failed for method', { method: name }, 'EyeDetector');
            }
          }

          // All combinations failed
          logger.warn('All landmark combinations failed validation', {}, 'EyeDetector');
          onDetection(null);
        } else {
          logger.warn('No face landmarks detected', {}, 'EyeDetector');
          onDetection(null);
        }
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

// Helper functions

function calculateDistance(point1: { x: number; y: number }, point2: { x: number; y: number }): number {
  return Math.sqrt(
    Math.pow(point2.x - point1.x, 2) +
    Math.pow(point2.y - point1.y, 2)
  );
}

function validateEyeDetection(detection: EyeCoordinates): boolean {
  const { leftEye, rightEye, imageWidth, imageHeight } = detection;

  // Check if coordinates are within image bounds
  if (
    leftEye.x < 0 || leftEye.x > imageWidth ||
    leftEye.y < 0 || leftEye.y > imageHeight ||
    rightEye.x < 0 || rightEye.x > imageWidth ||
    rightEye.y < 0 || rightEye.y > imageHeight
  ) {
    logger.error('Eye coordinates out of bounds', {
      leftEye,
      rightEye,
      imageWidth,
      imageHeight
    }, 'EyeDetector.validateEyeDetection');
    return false;
  }

  // Calculate eye distance
  const eyeDistance = calculateDistance(leftEye, rightEye);
  const normalizedDistance = eyeDistance / imageWidth;

  // Baby eye distance typically 0.10-0.40 of image width (relaxed range)
  if (normalizedDistance < 0.10 || normalizedDistance > 0.40) {
    logger.error('Eye distance out of range', {
      eyeDistance,
      normalizedDistance,
      imageWidth,
      range: '0.10-0.40'
    }, 'EyeDetector.validateEyeDetection');
    return false;
  }

  // Check eyes are roughly horizontal (allowing for more head tilt)
  const verticalDiff = Math.abs(leftEye.y - rightEye.y);
  const verticalTolerance = 0.5; // Even more lenient for babies with head tilt

  if (verticalDiff > eyeDistance * verticalTolerance) {
    logger.error('Eyes not horizontal enough', {
      verticalDiff,
      eyeDistance,
      ratio: verticalDiff / eyeDistance,
      tolerance: verticalTolerance
    }, 'EyeDetector.validateEyeDetection');
    return false;
  }

  // Check eyes aren't too close to image edges (margin = 3% of width, more lenient)
  const margin = 0.03 * imageWidth;
  if (leftEye.x < margin || rightEye.x > imageWidth - margin) {
    logger.error('Eyes too close to edges', {
      leftEyeX: leftEye.x,
      rightEyeX: rightEye.x,
      margin,
      imageWidth
    }, 'EyeDetector.validateEyeDetection');
    return false;
  }

  logger.info('Eye detection validated successfully', {
    normalizedDistance,
    verticalRatio: verticalDiff / eyeDistance
  }, 'EyeDetector.validateEyeDetection');

  return true;
}
