import { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from '@mediapipe/tasks-vision';

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
        console.log('🔍 Initializing MediaPipe Face Landmarker...');

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
        } as any); // TypeScript types may not include all options

        if (!mounted) return;

        setDetector(faceLandmarker);
        setLoading(false);
        console.log('✅ MediaPipe Face Landmarker initialized successfully');
      } catch (error) {
        console.error('❌ Failed to load MediaPipe detector:', error);
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
          console.log('🔍 Running eye detection...', {
            imageWidth: img.width,
            imageHeight: img.height
          });

          if (!detector) {
            console.error('❌ Detector not initialized');
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

            console.log('📊 Detected', landmarks.length, 'landmarks');

            let leftEye, rightEye;

            // Try to use iris center landmarks if available (indices 468 and 473)
            // These are the most accurate for eye position when refineLandmarks is enabled
            if (landmarks.length > 473) {
              console.log('Using iris center landmarks (468, 473)');
              leftEye = landmarks[473]; // Left iris center
              rightEye = landmarks[468]; // Right iris center
            } else {
              // Fallback: Use eye contour centers (always available in 468-landmark model)
              // Left eye contour: landmarks 362-382 (approximate center)
              // Right eye contour: landmarks 133-153 (approximate center)
              console.log('Using eye contour fallback (133, 362)');
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
              console.log('✅ Eye detection successful:', {
                leftEye: coords.leftEye,
                rightEye: coords.rightEye,
                eyeDistance: calculateDistance(coords.leftEye, coords.rightEye),
                normalizedDistance: calculateDistance(coords.leftEye, coords.rightEye) / img.width
              });
              onDetection(coords);
            } else {
              console.warn('⚠️ Eye detection validation failed');
              onDetection(null);
            }
          } else {
            console.warn('⚠️ No face detected in image');
            onDetection(null);
          }
        } catch (error) {
          console.error('❌ Eye detection failed:', error);
          onError?.(error instanceof Error ? error : new Error('Eye detection failed'));
          onDetection(null);
        } finally {
          URL.revokeObjectURL(url);
        }
      };

      img.onerror = () => {
        console.error('❌ Failed to load image');
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
    console.warn('Validation failed: Coordinates out of bounds');
    return false;
  }

  // Calculate eye distance
  const eyeDistance = calculateDistance(leftEye, rightEye);
  const normalizedDistance = eyeDistance / imageWidth;

  // Baby eye distance typically 0.12-0.35 of image width
  // (more lenient than adult range of 0.2-0.3)
  if (normalizedDistance < 0.12 || normalizedDistance > 0.35) {
    console.warn('Validation failed: Eye distance out of range', {
      eyeDistance,
      normalizedDistance,
      expected: '0.12-0.35'
    });
    return false;
  }

  // Check eyes are roughly horizontal (allowing for tilted head)
  const verticalDiff = Math.abs(leftEye.y - rightEye.y);
  const verticalTolerance = 0.4; // More lenient for babies (40% vs 30% for adults)

  if (verticalDiff > eyeDistance * verticalTolerance) {
    console.warn('Validation failed: Eyes not horizontally aligned', {
      verticalDiff,
      maxAllowed: eyeDistance * verticalTolerance
    });
    return false;
  }

  // Check eyes aren't too close to image edges (margin = 5% of width)
  const margin = 0.05 * imageWidth;
  if (leftEye.x < margin || rightEye.x > imageWidth - margin) {
    console.warn('Validation failed: Eyes too close to image edge');
    return false;
  }

  return true;
}
