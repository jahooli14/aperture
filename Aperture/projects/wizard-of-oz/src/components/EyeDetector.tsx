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
          minFaceDetectionConfidence: 0.4, // Lower for baby photos
          minFacePresenceConfidence: 0.4,
          minTrackingConfidence: 0.4,
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

    async function detectEyes() {
      const img = new Image();
      const url = URL.createObjectURL(imageFile);

      img.onload = async () => {
        try {
          if (!detector) {
            onDetection(null);
            return;
          }

          const results: FaceLandmarkerResult = detector.detect(img);

          if (!mounted) {
            URL.revokeObjectURL(url);
            return;
          }

          if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            const landmarks = results.faceLandmarks[0];
            let leftEye, rightEye;

            // Try to use iris center landmarks if available (indices 468 and 473)
            if (landmarks.length > 473) {
              leftEye = landmarks[473]; // Left iris center
              rightEye = landmarks[468]; // Right iris center
            } else {
              // Fallback: Use eye contour centers
              leftEye = landmarks[362]; // Left eye inner corner
              rightEye = landmarks[133]; // Right eye inner corner
            }

            // MediaPipe returns normalized coordinates (0-1), convert to pixels
            const coords: EyeCoordinates = {
              leftEye: {
                x: leftEye.x * img.width,
                y: leftEye.y * img.height
              },
              rightEye: {
                x: rightEye.x * img.width,
                y: rightEye.y * img.height
              },
              confidence: 0.8, // MediaPipe doesn't provide per-landmark confidence
              imageWidth: img.width,
              imageHeight: img.height
            };

            // Validate detection
            const isValid = validateEyeDetection(coords);

            if (isValid) {
              onDetection(coords);
            } else {
              onDetection(null);
            }
          } else {
            onDetection(null);
          }
        } catch (error) {
          logger.error('Eye detection failed', { error: error instanceof Error ? error.message : String(error) }, 'EyeDetector');
          onError?.(error instanceof Error ? error : new Error('Eye detection failed'));
          onDetection(null);
        } finally {
          URL.revokeObjectURL(url);
        }
      };

      img.onerror = () => {
        logger.error('Failed to load image for detection', {}, 'EyeDetector');
        URL.revokeObjectURL(url);
        onError?.(new Error('Failed to load image for detection'));
        onDetection(null);
      };

      img.src = url;
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
    return false;
  }

  // Calculate eye distance
  const eyeDistance = calculateDistance(leftEye, rightEye);
  const normalizedDistance = eyeDistance / imageWidth;

  // Baby eye distance typically 0.12-0.35 of image width
  if (normalizedDistance < 0.12 || normalizedDistance > 0.35) {
    return false;
  }

  // Check eyes are roughly horizontal (allowing for tilted head)
  const verticalDiff = Math.abs(leftEye.y - rightEye.y);
  const verticalTolerance = 0.4; // More lenient for babies

  if (verticalDiff > eyeDistance * verticalTolerance) {
    return false;
  }

  // Check eyes aren't too close to image edges (margin = 5% of width)
  const margin = 0.05 * imageWidth;
  if (leftEye.x < margin || rightEye.x > imageWidth - margin) {
    return false;
  }

  return true;
}
