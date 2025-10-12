import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { log } from './lib/logger.js';

// Optimize Sharp for Vercel serverless
sharp.cache(false);
sharp.concurrency(1);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface EyeLandmarks {
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  confidence: number;
  imageWidth: number;
  imageHeight: number;
  eyesOpen?: boolean;
}

/**
 * Eye Alignment Algorithm V3 - Simplified Affine Approach
 *
 * Goal: Position eyes at EXACT target coordinates in 1080x1080 output
 * - Baby's LEFT eye (appears on RIGHT in photo) → x=720, y=432
 * - Baby's RIGHT eye (appears on LEFT in photo) → x=360, y=432
 * - Inter-eye distance: 360px
 *
 * Approach: Direct transformation without coordinate tracking
 * 1. Calculate rotation angle to level eyes
 * 2. Calculate scale factor for 360px inter-eye distance
 * 3. Apply rotation and scale in CORRECT order
 * 4. Extract region with proper offset calculation
 * 5. Verify output by re-detecting eyes
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { photoId, landmarks } = req.body as {
      photoId: string;
      landmarks: EyeLandmarks;
    };

    if (!photoId || !landmarks) {
      return res.status(400).json({ error: 'Missing photoId or landmarks' });
    }

    console.log('=== ALIGNMENT V3 START ===');
    await log({
      functionName: 'align-photo-v3',
      level: 'info',
      message: 'ALIGNMENT V3 START',
      photoId,
      data: {
        inputDimensions: { width: landmarks.imageWidth, height: landmarks.imageHeight },
        detectedEyes: { left: landmarks.leftEye, right: landmarks.rightEye },
        eyesOpen: landmarks.eyesOpen,
        confidence: landmarks.confidence,
      },
    });

    // Fetch photo from database
    const { data: photo, error: fetchError } = await supabase
      .from('photos')
      .select('*')
      .eq('id', photoId)
      .single();

    if (fetchError || !photo) {
      throw new Error('Photo not found');
    }

    // Download original image
    const imageResponse = await fetch(photo.original_url);
    if (!imageResponse.ok) {
      throw new Error('Failed to fetch original image');
    }
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // Target positions in output image
    const TARGET_LEFT_EYE = { x: 720, y: 432 };
    const TARGET_RIGHT_EYE = { x: 360, y: 432 };
    const TARGET_INTER_EYE_DISTANCE = 360;
    const OUTPUT_SIZE = 1080;

    // STEP 1: Calculate rotation angle
    const deltaX = landmarks.leftEye.x - landmarks.rightEye.x;
    const deltaY = landmarks.leftEye.y - landmarks.rightEye.y;
    const angleDegrees = -(Math.atan2(deltaY, deltaX) * 180 / Math.PI);

    console.log('Rotation angle:', angleDegrees.toFixed(2), 'degrees');

    // STEP 2: Calculate scale factor
    const detectedDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const scaleFactor = TARGET_INTER_EYE_DISTANCE / detectedDistance;

    console.log('Scale factor:', scaleFactor.toFixed(4));
    console.log('Detected inter-eye distance:', detectedDistance.toFixed(2), 'px');

    // STEP 3: Calculate center point between eyes (rotation pivot)
    const eyeCenterX = (landmarks.leftEye.x + landmarks.rightEye.x) / 2;
    const eyeCenterY = (landmarks.leftEye.y + landmarks.rightEye.y) / 2;

    console.log('Eye center (pivot):', { x: eyeCenterX.toFixed(2), y: eyeCenterY.toFixed(2) });

    // STEP 4: Rotate image around eye center
    // First translate image so eye center is at origin, then rotate
    const angleRadians = (angleDegrees * Math.PI) / 180;

    // Calculate the bounding box of rotated image
    const cos = Math.abs(Math.cos(angleRadians));
    const sin = Math.abs(Math.sin(angleRadians));
    const rotatedWidth = Math.ceil(landmarks.imageWidth * cos + landmarks.imageHeight * sin);
    const rotatedHeight = Math.ceil(landmarks.imageHeight * cos + landmarks.imageWidth * sin);

    console.log('Rotated dimensions (calculated):', rotatedWidth, 'x', rotatedHeight);

    // Perform rotation with white background
    let rotatedBuffer = await sharp(imageBuffer)
      .rotate(angleDegrees, { background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .toBuffer();

    // Get actual rotated dimensions
    const rotatedMeta = await sharp(rotatedBuffer).metadata();
    const actualRotatedWidth = rotatedMeta.width!;
    const actualRotatedHeight = rotatedMeta.height!;

    console.log('Rotated dimensions (actual):', actualRotatedWidth, 'x', actualRotatedHeight);

    // Calculate where eye center moved to after rotation
    // Sharp rotates around image center, so we need to account for canvas expansion
    const originalCenterX = landmarks.imageWidth / 2;
    const originalCenterY = landmarks.imageHeight / 2;
    const newCenterX = actualRotatedWidth / 2;
    const newCenterY = actualRotatedHeight / 2;

    // Vector from original center to eye center
    const eyeOffsetX = eyeCenterX - originalCenterX;
    const eyeOffsetY = eyeCenterY - originalCenterY;

    // Rotate this vector
    const rotatedOffsetX = eyeOffsetX * Math.cos(angleRadians) - eyeOffsetY * Math.sin(angleRadians);
    const rotatedOffsetY = eyeOffsetX * Math.sin(angleRadians) + eyeOffsetY * Math.cos(angleRadians);

    // New eye center position
    const rotatedEyeCenterX = newCenterX + rotatedOffsetX;
    const rotatedEyeCenterY = newCenterY + rotatedOffsetY;

    console.log('Rotated eye center:', { x: rotatedEyeCenterX.toFixed(2), y: rotatedEyeCenterY.toFixed(2) });

    // STEP 5: Scale the image
    const scaledWidth = Math.round(actualRotatedWidth * scaleFactor);
    const scaledHeight = Math.round(actualRotatedHeight * scaleFactor);

    console.log('Scaled dimensions:', scaledWidth, 'x', scaledHeight);

    const scaledBuffer = await sharp(rotatedBuffer)
      .resize(scaledWidth, scaledHeight, {
        kernel: 'lanczos3',
        fit: 'fill',
      })
      .toBuffer();

    // Eye center scales linearly
    const scaledEyeCenterX = rotatedEyeCenterX * scaleFactor;
    const scaledEyeCenterY = rotatedEyeCenterY * scaleFactor;

    console.log('Scaled eye center:', { x: scaledEyeCenterX.toFixed(2), y: scaledEyeCenterY.toFixed(2) });

    // STEP 6: Calculate where to place eye center in output
    // Eyes should be at (360, 432) and (720, 432), so center should be at (540, 432)
    const targetEyeCenterX = (TARGET_LEFT_EYE.x + TARGET_RIGHT_EYE.x) / 2;
    const targetEyeCenterY = (TARGET_LEFT_EYE.y + TARGET_RIGHT_EYE.y) / 2;

    console.log('Target eye center:', { x: targetEyeCenterX, y: targetEyeCenterY });

    // Calculate extraction offset
    // We want scaledEyeCenter to appear at targetEyeCenter in output
    // So extract starting at (scaledEyeCenter - targetEyeCenter)
    let extractLeft = Math.round(scaledEyeCenterX - targetEyeCenterX);
    let extractTop = Math.round(scaledEyeCenterY - targetEyeCenterY);

    console.log('Extract offset:', { left: extractLeft, top: extractTop });

    // STEP 7: Handle out-of-bounds extraction
    let finalBuffer = scaledBuffer;

    if (extractLeft < 0 || extractTop < 0 ||
        (extractLeft + OUTPUT_SIZE) > scaledWidth ||
        (extractTop + OUTPUT_SIZE) > scaledHeight) {

      console.log('⚠️  Extraction out of bounds, extending canvas...');

      const extendLeft = Math.max(0, -extractLeft);
      const extendTop = Math.max(0, -extractTop);
      const extendRight = Math.max(0, (extractLeft + OUTPUT_SIZE) - scaledWidth);
      const extendBottom = Math.max(0, (extractTop + OUTPUT_SIZE) - scaledHeight);

      console.log('Canvas extension:', { extendLeft, extendTop, extendRight, extendBottom });

      finalBuffer = await sharp(scaledBuffer)
        .extend({
          top: extendTop,
          bottom: extendBottom,
          left: extendLeft,
          right: extendRight,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .toBuffer();

      extractLeft = extractLeft + extendLeft;
      extractTop = extractTop + extendTop;

      console.log('Adjusted extraction offset:', { left: extractLeft, top: extractTop });
    }

    // STEP 8: Extract final 1080x1080 region
    const alignedBuffer = await sharp(finalBuffer)
      .extract({
        left: extractLeft,
        top: extractTop,
        width: OUTPUT_SIZE,
        height: OUTPUT_SIZE,
      })
      .jpeg({ quality: 95 })
      .toBuffer();

    console.log('✅ Extraction complete, output size:', OUTPUT_SIZE, 'x', OUTPUT_SIZE);

    // STEP 9: Verify actual eye positions in output image
    console.log('🔍 Verifying actual eye positions...');

    try {
      const alignedBase64 = alignedBuffer.toString('base64');
      const verifyResponse = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=' +
        process.env.GEMINI_API_KEY,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  text: 'Detect the CENTER of each eye socket in this baby photo with sub-pixel precision. ' +
                        'Eyes may be open or closed - detect the eye CENTER in both cases. ' +
                        'Return ONLY valid JSON: {"leftEye": {"x": number, "y": number}, "rightEye": {"x": number, "y": number}}. ' +
                        'leftEye is baby\'s left (RIGHT side of image), rightEye is baby\'s right (LEFT side of image).'
                },
                { inline_data: { mime_type: 'image/jpeg', data: alignedBase64 } }
              ]
            }],
            generationConfig: {
              temperature: 0,
              response_mime_type: 'application/json'
            }
          }),
        }
      );

      if (verifyResponse.ok) {
        const verifyResult = await verifyResponse.json();
        const verifyText = verifyResult.candidates?.[0]?.content?.parts?.[0]?.text;

        if (verifyText) {
          const actualEyes = JSON.parse(verifyText);

          const leftError = {
            x: parseFloat((actualEyes.leftEye.x - TARGET_LEFT_EYE.x).toFixed(2)),
            y: parseFloat((actualEyes.leftEye.y - TARGET_LEFT_EYE.y).toFixed(2)),
          };
          const rightError = {
            x: parseFloat((actualEyes.rightEye.x - TARGET_RIGHT_EYE.x).toFixed(2)),
            y: parseFloat((actualEyes.rightEye.y - TARGET_RIGHT_EYE.y).toFixed(2)),
          };

          const maxError = Math.max(
            Math.abs(leftError.x), Math.abs(leftError.y),
            Math.abs(rightError.x), Math.abs(rightError.y)
          );

          console.log('Verification result:', {
            actualLeftEye: actualEyes.leftEye,
            actualRightEye: actualEyes.rightEye,
            leftError,
            rightError,
            maxError: maxError.toFixed(2) + 'px'
          });

          await log({
            functionName: 'align-photo-v3',
            level: maxError > 20 ? 'error' : 'info',
            message: '🔍 VERIFIED: Actual eye positions in output',
            photoId,
            data: {
              actual: {
                leftEye: actualEyes.leftEye,
                rightEye: actualEyes.rightEye,
              },
              expected: {
                leftEye: TARGET_LEFT_EYE,
                rightEye: TARGET_RIGHT_EYE,
              },
              error: {
                leftEye: leftError,
                rightEye: rightError,
                maxError: parseFloat(maxError.toFixed(2)),
              },
              status: maxError > 20 ? 'FAILED' : 'SUCCESS',
            },
          });
        }
      } else {
        console.error('Verification request failed:', verifyResponse.status);
      }
    } catch (verifyError) {
      console.error('Failed to verify output eye positions:', verifyError);
      await log({
        functionName: 'align-photo-v3',
        level: 'warning',
        message: 'Verification step failed',
        photoId,
        data: { error: String(verifyError) },
      });
    }

    // STEP 10: Upload to Supabase
    const alignedFileName = `${photo.user_id}/${photoId}-aligned-v3.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('aligned')
      .upload(alignedFileName, alignedBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('aligned')
      .getPublicUrl(alignedFileName);

    const cacheBustedUrl = `${publicUrl}?v=${Date.now()}`;

    // Update database with aligned URL
    const { error: updateError } = await supabase
      .from('photos')
      .update({
        aligned_url: cacheBustedUrl,
        alignment_version: 'v3'
      })
      .eq('id', photoId);

    if (updateError) {
      throw updateError;
    }

    await log({
      functionName: 'align-photo-v3',
      level: 'info',
      message: '✅ ALIGNMENT V3 COMPLETE',
      photoId,
      data: {
        alignedUrl: cacheBustedUrl,
        transform: {
          rotation: parseFloat(angleDegrees.toFixed(2)),
          scale: parseFloat(scaleFactor.toFixed(4)),
          extractLeft,
          extractTop,
        },
      },
    });

    console.log('=== ALIGNMENT V3 SUCCESS ===');

    return res.status(200).json({
      success: true,
      alignedUrl: cacheBustedUrl,
      version: 'v3',
    });

  } catch (error) {
    console.error('Alignment V3 error:', error);

    await log({
      functionName: 'align-photo-v3',
      level: 'error',
      message: 'Alignment V3 failed',
      photoId: req.body?.photoId,
      data: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    });

    return res.status(500).json({
      error: 'Failed to align photo',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
