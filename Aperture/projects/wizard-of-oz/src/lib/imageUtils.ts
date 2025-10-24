/**
 * Image manipulation utilities for photo uploads and alignment
 */

export interface EyeCoordinates {
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  confidence: number;
  imageWidth: number;
  imageHeight: number;
}

export interface AlignmentResult {
  alignedImage: File;
  transform: {
    rotation: number;
    scale: number;
    translateX: number;
    translateY: number;
  };
}

/**
 * Compresses an image to reduce file size while maintaining quality
 * @param file - The image file to compress
 * @param maxWidth - Maximum width (default 1920)
 * @param quality - JPEG quality 0-1 (default 0.85)
 * @returns Promise resolving to compressed image file
 */
export async function compressImage(
  file: File,
  maxWidth = 1920,
  quality = 0.85
): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      // Calculate new dimensions maintaining aspect ratio
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw image
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob with compression
      canvas.toBlob(
        (blob) => {
          const compressedFile = new File([blob!], file.name, { type: 'image/jpeg' });
          URL.revokeObjectURL(url);
          resolve(compressedFile);
        },
        'image/jpeg',
        quality
      );
    };

    img.src = url;
  });
}

/**
 * Rotates an image file by the specified degrees
 * @param file - The image file to rotate
 * @param degrees - Degrees to rotate (0, 90, 180, or 270)
 * @returns Promise resolving to rotated image file
 */
export async function rotateImage(file: File, degrees: number): Promise<File> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();

    img.onload = () => {
      // Set canvas dimensions based on rotation
      if (degrees === 90 || degrees === 270) {
        canvas.width = img.height;
        canvas.height = img.width;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      // Clear canvas and apply rotation
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();

      // Move to center of canvas
      ctx.translate(canvas.width / 2, canvas.height / 2);

      // Rotate
      ctx.rotate((degrees * Math.PI) / 180);

      // Draw image centered
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();

      // Convert canvas to blob then to file
      canvas.toBlob((blob) => {
        const rotatedFile = new File([blob!], file.name, { type: file.type });
        resolve(rotatedFile);
      }, file.type, 0.85);
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Converts a File to a data URL for preview display
 * @param file - The file to convert
 * @returns Promise resolving to data URL string
 */
export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Validates an image file
 * @param file - The file to validate
 * @returns Object with isValid flag and optional error message
 */
export function validateImageFile(file: File): { isValid: boolean; error?: string } {
  // Validate file type
  if (!file.type.startsWith('image/')) {
    return { isValid: false, error: 'Please select an image file' };
  }

  // Validate file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    return { isValid: false, error: 'Image must be smaller than 10MB' };
  }

  return { isValid: true };
}

/**
 * Target dimensions for aligned photos
 * Eyes should be horizontally aligned at variable Y position (age-based)
 * Left eye at 33%, right eye at 67% horizontally
 */
const TARGET_WIDTH = 1080;
const TARGET_HEIGHT = 1350;

/**
 * Calculate appropriate zoom level (eye Y position) based on baby's age
 * Zoom evolves as baby grows to show more context and environment
 *
 * @param ageInMonths - Baby's age in months at time of photo
 * @returns Y position as fraction (0-1) where eyes should be positioned
 */
export function calculateZoomLevel(ageInMonths: number): number {
  if (ageInMonths < 6) return 0.40;      // 0-6 months: Tight crop, face focus (newborn)
  if (ageInMonths < 18) return 0.30;     // 6-18 months: Medium crop, shows torso (sitting/crawling)
  if (ageInMonths < 36) return 0.25;     // 18-36 months: Wide crop, upper body (toddler standing)
  return 0.20;                            // 3+ years: Very wide, almost full body
}

/**
 * Get target eye positions for a given zoom level
 * @param zoomLevel - Y position as fraction (0-1) where eyes should be
 * @returns Object with left and right eye target positions
 */
function getTargetEyePositions(zoomLevel: number) {
  return {
    leftEye: { x: TARGET_WIDTH * 0.33, y: TARGET_HEIGHT * zoomLevel },
    rightEye: { x: TARGET_WIDTH * 0.67, y: TARGET_HEIGHT * zoomLevel }
  };
}

/**
 * Aligns a photo based on detected eye coordinates
 * Uses affine transformation to rotate, scale, and translate the image
 * so that eyes match target positions
 *
 * @param file - The image file to align
 * @param eyeCoords - Detected eye coordinates
 * @param zoomLevel - Y position (0-1) where eyes should be placed (default 0.40 for backward compatibility)
 * @returns Promise resolving to aligned image file and transformation details
 */
export async function alignPhoto(
  file: File,
  eyeCoords: EyeCoordinates,
  zoomLevel: number = 0.40
): Promise<AlignmentResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;

        // Set output dimensions
        canvas.width = TARGET_WIDTH;
        canvas.height = TARGET_HEIGHT;

        // Get target eye positions for the specified zoom level
        const targetPositions = getTargetEyePositions(zoomLevel);

        // Calculate transformation parameters
        const { leftEye, rightEye } = eyeCoords;

        // Calculate angle between eyes
        const dx = rightEye.x - leftEye.x;
        const dy = rightEye.y - leftEye.y;
        const angle = Math.atan2(dy, dx);

        // Calculate scale to match target eye distance
        const currentEyeDistance = Math.sqrt(dx * dx + dy * dy);
        const targetEyeDistance = targetPositions.rightEye.x - targetPositions.leftEye.x;
        const scale = targetEyeDistance / currentEyeDistance;

        // Calculate center point between eyes (source)
        const sourceCenterX = (leftEye.x + rightEye.x) / 2;
        const sourceCenterY = (leftEye.y + rightEye.y) / 2;

        // Calculate center point between eyes (target)
        const targetCenterX = (targetPositions.leftEye.x + targetPositions.rightEye.x) / 2;
        const targetCenterY = (targetPositions.leftEye.y + targetPositions.rightEye.y) / 2;

        // Determine if image needs 180° rotation based on eye left-right order
        // If leftEye.x > rightEye.x, eyes are swapped (upside-down) and need flipping
        const eyesSwapped = leftEye.x > rightEye.x;
        const needsFlip = eyesSwapped;

        // Fill with white background first
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Apply transformation
        ctx.save();

        // Move origin to target eye center
        ctx.translate(targetCenterX, targetCenterY);

        // Rotate to align eyes
        ctx.rotate(-angle);

        // Scale to match target eye distance
        ctx.scale(scale, scale);

        // Rotate 180 degrees to flip image right-side up (only if needed)
        if (needsFlip) {
          ctx.rotate(Math.PI);
        }

        // Draw image centered at origin
        ctx.drawImage(img, -sourceCenterX, -sourceCenterY);

        ctx.restore();

        // Convert canvas to blob then to file
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to create aligned image'));
            return;
          }

          const alignedFile = new File(
            [blob],
            file.name.replace(/\.(jpg|jpeg|png)$/i, '-aligned.$1'),
            { type: file.type }
          );

          resolve({
            alignedImage: alignedFile,
            transform: {
              rotation: -angle * (180 / Math.PI), // Convert to degrees
              scale,
              translateX: targetCenterX - sourceCenterX * scale,
              translateY: targetCenterY - sourceCenterY * scale,
            },
          });

          URL.revokeObjectURL(url);
        }, file.type, 0.95);
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for alignment'));
    };

    img.src = url;
  });
}
