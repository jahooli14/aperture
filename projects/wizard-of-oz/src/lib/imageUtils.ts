/**
 * Image manipulation utilities for photo uploads and alignment
 */

export interface EyeCoordinates {
  // Convention: leftEye appears on the LEFT side of the image when the face is
  // upright (i.e. subject's RIGHT eye). rightEye is subject's LEFT eye.
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  confidence: number;
  imageWidth: number;
  imageHeight: number;
  eyesOpen?: number;
  faceWidth?: number;
  irisAgreement?: number;
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
 * Compresses an image to reduce file size while maintaining quality.
 * Uses createImageBitmap with imageOrientation: 'from-image' to apply EXIF rotation
 * consistently across all browsers. This avoids the double-correction bug that occurs
 * when using an <img> element in Chrome 81+ where ctx.drawImage() already applies
 * CSS image-orientation: from-image before any manual EXIF transforms are applied.
 * @param file - The image file to compress
 * @param maxWidth - Maximum width (default 1920)
 * @param quality - JPEG quality 0-1 (default 0.85)
 * @returns Promise resolving to compressed image file with correct orientation and no EXIF
 */
export async function compressImage(
  file: File,
  maxWidth = 1920,
  quality = 0.85
): Promise<File> {
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const newFileName = `${baseName}.jpg`;

  // createImageBitmap with imageOrientation: 'from-image' applies EXIF rotation
  // before we ever touch the pixels. bitmap.width/height are the display dimensions
  // (already swapped for 90°/270° rotations). canvas.toBlob strips all metadata so
  // the output JPEG has orientation baked into its pixels with no EXIF tag.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

  let outW = bitmap.width;
  let outH = bitmap.height;
  if (outW > maxWidth) {
    outH = Math.round((outH * maxWidth) / outW);
    outW = maxWidth;
  }

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, outW, outH);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to compress image'));
          return;
        }
        resolve(new File([blob], newFileName, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      quality
    );
  });
}

/**
 * Rotates an image file by the specified degrees.
 * Uses createImageBitmap with { imageOrientation: 'from-image' } to mirror the
 * EXIF handling used by compressImage and the eye detector. Keeps the whole
 * upload pipeline on one consistent orientation path.
 * @param file - The image file to rotate
 * @param degrees - Degrees to rotate (0, 90, 180, or 270)
 * @returns Promise resolving to rotated image file
 */
export async function rotateImage(file: File, degrees: number): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (degrees === 90 || degrees === 270) {
    canvas.width = bitmap.height;
    canvas.height = bitmap.width;
  } else {
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
  }

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  ctx.restore();
  bitmap.close();

  const outputType = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg';
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to rotate image'));
          return;
        }
        resolve(new File([blob], file.name, { type: outputType }));
      },
      outputType,
      0.92
    );
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
 * Note: Size validation is relaxed because images are automatically compressed before upload.
 * We only reject extremely large files (>50MB) that would cause memory issues during compression.
 * @param file - The file to validate
 * @returns Object with isValid flag and optional error message
 */
export function validateImageFile(file: File): { isValid: boolean; error?: string } {
  // Validate file type
  if (!file.type.startsWith('image/')) {
    return { isValid: false, error: 'Please select an image file' };
  }

  // Only reject extremely large files that would cause memory issues
  // Normal large photos (10-30MB from modern cameras) are fine - we compress them
  if (file.size > 50 * 1024 * 1024) {
    return { isValid: false, error: 'Image is too large (max 50MB). Please select a smaller image.' };
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
 * Uses smooth, gradual transitions to avoid jarring jumps in timelapse
 * Zoom evolves as baby grows to show more context and environment
 *
 * @param ageInMonths - Baby's age in months at time of photo
 * @returns Y position as fraction (0-1) where eyes should be positioned
 */
export function calculateZoomLevel(ageInMonths: number): number {
  // Start: 0.40 (tight crop for newborns)
  // End: 0.20 (wide crop for 3+ years)
  // Smooth logarithmic curve for gradual zoom out

  const START_ZOOM = 0.40;
  const END_ZOOM = 0.20;
  const MAX_AGE = 36; // 3 years

  if (ageInMonths <= 0) return START_ZOOM;
  if (ageInMonths >= MAX_AGE) return END_ZOOM;

  // Use logarithmic interpolation for smooth, natural transition
  // More rapid change early (newborn phase) then gradual
  const t = ageInMonths / MAX_AGE;
  const logT = Math.log(1 + t * 9) / Math.log(10); // log scale 1-10

  return START_ZOOM - (START_ZOOM - END_ZOOM) * logT;
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
  try {
    // Matches compressImage + EyeDetector: EXIF rotation is applied before we touch
    // the pixels so eye coordinates stay valid regardless of camera orientation.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    // Use high-quality resampling — the affine transform can include up-scaling on
    // wide shots and the default nearest/bilinear produces visible softness.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    canvas.width = TARGET_WIDTH;
    canvas.height = TARGET_HEIGHT;

    const targetPositions = getTargetEyePositions(zoomLevel);
    const { leftEye, rightEye } = eyeCoords;

    // With the canonical convention (leftEye = subject's right eye = image-left for
    // upright faces), atan2(dy, dx) alone produces the correct rotation for upright,
    // tilted, 90°-rotated, and upside-down faces. No needsFlip second rotation.
    const dx = rightEye.x - leftEye.x;
    const dy = rightEye.y - leftEye.y;
    const angle = Math.atan2(dy, dx);

    const currentEyeDistance = Math.sqrt(dx * dx + dy * dy);
    const targetEyeDistance = targetPositions.rightEye.x - targetPositions.leftEye.x;
    const scale = targetEyeDistance / currentEyeDistance;

    const sourceCenterX = (leftEye.x + rightEye.x) / 2;
    const sourceCenterY = (leftEye.y + rightEye.y) / 2;
    const targetCenterX = (targetPositions.leftEye.x + targetPositions.rightEye.x) / 2;
    const targetCenterY = (targetPositions.leftEye.y + targetPositions.rightEye.y) / 2;

    // White background fills any uncovered regions after the affine transform.
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(targetCenterX, targetCenterY);
    ctx.rotate(-angle);
    ctx.scale(scale, scale);
    ctx.drawImage(bitmap, -sourceCenterX, -sourceCenterY);
    ctx.restore();
    bitmap.close();

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create aligned image'));
          return;
        }

        const alignedFile = new File(
          [blob],
          file.name.replace(/\.(jpg|jpeg|png)$/i, '-aligned.$1'),
          { type: file.type || 'image/jpeg' }
        );

        resolve({
          alignedImage: alignedFile,
          transform: {
            rotation: -angle * (180 / Math.PI),
            scale,
            translateX: targetCenterX - sourceCenterX * scale,
            translateY: targetCenterY - sourceCenterY * scale,
          },
        });
      }, file.type || 'image/jpeg', 0.95);
    });
  } catch (error) {
    throw error instanceof Error ? error : new Error('Failed to align image');
  }
}
