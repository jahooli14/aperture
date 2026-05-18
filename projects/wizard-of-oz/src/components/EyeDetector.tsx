import { useEffect } from 'react';
import { detectEyesFromImage, type EyeCoordinates } from '../lib/faceDetection';
import { logger } from '../lib/logger';

// Re-export so existing imports (and tests) keep working after the detection
// logic moved into the shared lib/faceDetection module.
export { validateEyeDetection } from '../lib/faceDetection';
export type { EyeCoordinates } from '../lib/faceDetection';

interface EyeDetectorProps {
  imageFile: File;
  onDetection: (coords: EyeCoordinates | null) => void;
  onError?: (error: Error) => void;
}

/**
 * Logic-only component: runs eye detection whenever the selected file changes
 * and reports the result. All of the actual detection (model init, the
 * four-orientation retry, baby-face picking, validation, un-rotation) lives in
 * lib/faceDetection so the same pipeline can re-align the existing backlog.
 */
export function EyeDetector({ imageFile, onDetection, onError }: EyeDetectorProps) {
  useEffect(() => {
    if (!imageFile) return;
    let mounted = true;

    (async () => {
      try {
        logger.info('Starting eye detection', {
          fileName: imageFile.name,
          fileSize: imageFile.size,
          fileType: imageFile.type,
        }, 'EyeDetector');

        const coords = await detectEyesFromImage(imageFile);
        if (!mounted) return;

        if (!coords) {
          logger.warn('No valid face detected in any orientation', {}, 'EyeDetector');
          onDetection(null);
          return;
        }

        logger.info('Eye detection final', {
          leftEye: coords.leftEye,
          rightEye: coords.rightEye,
          confidence: coords.confidence,
        }, 'EyeDetector');
        onDetection(coords);
      } catch (error) {
        logger.error('Eye detection failed', {
          error: error instanceof Error ? error.message : String(error),
        }, 'EyeDetector');
        if (!mounted) return;
        onError?.(error instanceof Error ? error : new Error('Eye detection failed'));
        onDetection(null);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [imageFile, onDetection, onError]);

  return null;
}
