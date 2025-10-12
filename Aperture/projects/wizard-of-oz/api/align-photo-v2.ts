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
 * COMPLETE REBUILD - Eye Alignment Algorithm V2
 *
 * Goal: Position eyes at EXACT target coordinates in 1080x1080 output
 * - Baby's LEFT eye (appears on RIGHT in photo) → x=720, y=432
 * - Baby's RIGHT eye (appears on LEFT in photo) → x=360, y=432
 * - Inter-eye distance: 360px
 *
 * Approach:
 * 1. Scale image so inter-eye distance = 360px
 * 2. Calculate where eyes are after scaling
 * 3. Extract 1080x1080 region to place eyes at target positions
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

    console.log('=== ALIGNMENT V2 START ===');
    await log({
      functionName: 'align-photo-v2',
      level: 'info',
      message: 'ALIGNMENT V2 START',
      photoId,
      data: {
        inputDimensions: { width: landmarks.imageWidth, height: landmarks.imageHeight },
        detectedEyes: { left: landmarks.leftEye, right: landmarks.rightEye },
        eyesOpen: landmarks.eyesOpen,
        confidence: landmarks.confidence,
      },
    });

    console.log('Photo ID:', photoId);
    console.log('Input dimensions:', landmarks.imageWidth, 'x', landmarks.imageHeight);
    console.log('Detected eyes:', {
      left: landmarks.leftEye,
      right: landmarks.rightEye,
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

    // Constants
    const TARGET_LEFT_EYE = { x: 720, y: 432 };
    const TARGET_RIGHT_EYE = { x: 360, y: 432 };
    const TARGET_INTER_EYE_DISTANCE = 360;
    const OUTPUT_SIZE = 1080;

    // STEP 0: Calculate rotation angle to level eyes
    const deltaX = landmarks.leftEye.x - landmarks.rightEye.x;
    const deltaY = landmarks.leftEye.y - landmarks.rightEye.y;
    const rotationRadians = Math.atan2(deltaY, deltaX);
    const rotationDegrees = -(rotationRadians * 180 / Math.PI); // Negative to rotate counter-clockwise

    console.log('Eye tilt:', {
      deltaX: deltaX.toFixed(2),
      deltaY: deltaY.toFixed(2),
      rotationDegrees: rotationDegrees.toFixed(2),
    });

    // Rotate the image to level the eyes
    let rotatedBuffer: Buffer = imageBuffer;
    let rotatedWidth = landmarks.imageWidth;
    let rotatedHeight = landmarks.imageHeight;
    let rotatedLeftEye = { ...landmarks.leftEye };
    let rotatedRightEye = { ...landmarks.rightEye };

    if (Math.abs(rotationDegrees) > 0.5) {
      console.log('Rotating image by', rotationDegrees.toFixed(2), 'degrees');

      rotatedBuffer = Buffer.from(await sharp(imageBuffer)
        .rotate(rotationDegrees, { background: { r: 255, g: 255, b: 255 } })
        .toBuffer());

      const rotatedMeta = await sharp(rotatedBuffer).metadata();
      rotatedWidth = rotatedMeta.width!;
      rotatedHeight = rotatedMeta.height!;

      console.log('Rotated dimensions:', rotatedWidth, 'x', rotatedHeight);

      // Transform eye coordinates through rotation
      // Rotation is around image center
      const centerX = landmarks.imageWidth / 2;
      const centerY = landmarks.imageHeight / 2;

      // Translate to origin
      const leftRelX = landmarks.leftEye.x - centerX;
      const leftRelY = landmarks.leftEye.y - centerY;
      const rightRelX = landmarks.rightEye.x - centerX;
      const rightRelY = landmarks.rightEye.y - centerY;

      // Rotate (use same angle as image rotation: negative of rotationRadians)
      const cos = Math.cos(-rotationRadians);
      const sin = Math.sin(-rotationRadians);

      const leftRotX = leftRelX * cos - leftRelY * sin;
      const leftRotY = leftRelX * sin + leftRelY * cos;
      const rightRotX = rightRelX * cos - rightRelY * sin;
      const rightRotY = rightRelX * sin + rightRelY * cos;

      // Translate back to new center
      const newCenterX = rotatedWidth / 2;
      const newCenterY = rotatedHeight / 2;

      rotatedLeftEye = {
        x: leftRotX + newCenterX,
        y: leftRotY + newCenterY,
      };
      rotatedRightEye = {
        x: rightRotX + newCenterX,
        y: rightRotY + newCenterY,
      };

      console.log('Rotated eye positions:', {
        left: { x: rotatedLeftEye.x.toFixed(2), y: rotatedLeftEye.y.toFixed(2) },
        right: { x: rotatedRightEye.x.toFixed(2), y: rotatedRightEye.y.toFixed(2) },
      });
    } else {
      console.log('Skipping rotation (tilt < 0.5 degrees)');
    }

    // Calculate detected inter-eye distance (after rotation, should be horizontal)
    const detectedInterEyeDistance = Math.sqrt(
      Math.pow(rotatedLeftEye.x - rotatedRightEye.x, 2) +
      Math.pow(rotatedLeftEye.y - rotatedRightEye.y, 2)
    );

    console.log('Inter-eye distance after rotation:', detectedInterEyeDistance.toFixed(2), 'px');

    // STEP 1: Calculate scale factor
    const scale = TARGET_INTER_EYE_DISTANCE / detectedInterEyeDistance;
    console.log('Scale factor:', scale.toFixed(4));

    // STEP 2: Scale the rotated image
    const scaledWidth = Math.round(rotatedWidth * scale);
    const scaledHeight = Math.round(rotatedHeight * scale);
    console.log('Scaled dimensions:', scaledWidth, 'x', scaledHeight);

    const scaledBuffer = await sharp(rotatedBuffer)
      .resize(scaledWidth, scaledHeight, {
        kernel: 'lanczos3',
        fit: 'fill',
      })
      .toBuffer();

    // STEP 3: Calculate scaled eye positions (from rotated positions)
    const scaledLeftEye = {
      x: rotatedLeftEye.x * scale,
      y: rotatedLeftEye.y * scale,
    };
    const scaledRightEye = {
      x: rotatedRightEye.x * scale,
      y: rotatedRightEye.y * scale,
    };

    console.log('Scaled eye positions:', {
      left: { x: scaledLeftEye.x.toFixed(2), y: scaledLeftEye.y.toFixed(2) },
      right: { x: scaledRightEye.x.toFixed(2), y: scaledRightEye.y.toFixed(2) },
    });

    // STEP 4: Calculate extraction offset
    // We want scaledLeftEye to end up at TARGET_LEFT_EYE after extraction
    // If scaledLeftEye.x = 800 and we want it at 720, we need to extract starting at 80
    // Formula: extractLeft = scaledLeftEye.x - TARGET_LEFT_EYE.x
    const extractLeft = Math.round(scaledLeftEye.x - TARGET_LEFT_EYE.x);
    const extractTop = Math.round(scaledLeftEye.y - TARGET_LEFT_EYE.y);

    console.log('Extraction offset:', { left: extractLeft, top: extractTop });

    // STEP 5: Verify final positions
    const finalLeftEye = {
      x: scaledLeftEye.x - extractLeft,
      y: scaledLeftEye.y - extractTop,
    };
    const finalRightEye = {
      x: scaledRightEye.x - extractLeft,
      y: scaledRightEye.y - extractTop,
    };

    console.log('PREDICTED final eye positions:', {
      left: { x: finalLeftEye.x.toFixed(2), y: finalLeftEye.y.toFixed(2) },
      right: { x: finalRightEye.x.toFixed(2), y: finalRightEye.y.toFixed(2) },
    });
    console.log('EXPECTED final eye positions:', {
      left: TARGET_LEFT_EYE,
      right: TARGET_RIGHT_EYE,
    });
    console.log('ERROR (should be ~0):', {
      left: {
        x: (finalLeftEye.x - TARGET_LEFT_EYE.x).toFixed(2),
        y: (finalLeftEye.x - TARGET_LEFT_EYE.y).toFixed(2)
      },
      right: {
        x: (finalRightEye.x - TARGET_RIGHT_EYE.x).toFixed(2),
        y: (finalRightEye.y - TARGET_RIGHT_EYE.y).toFixed(2)
      },
    });

    // LOG CRITICAL ALIGNMENT DATA
    await log({
      functionName: 'align-photo-v2',
      level: 'info',
      message: 'Final eye position analysis',
      photoId,
      data: {
        predicted: {
          leftEye: { x: parseFloat(finalLeftEye.x.toFixed(2)), y: parseFloat(finalLeftEye.y.toFixed(2)) },
          rightEye: { x: parseFloat(finalRightEye.x.toFixed(2)), y: parseFloat(finalRightEye.y.toFixed(2)) },
        },
        expected: {
          leftEye: TARGET_LEFT_EYE,
          rightEye: TARGET_RIGHT_EYE,
        },
        error: {
          leftEye: {
            x: parseFloat((finalLeftEye.x - TARGET_LEFT_EYE.x).toFixed(2)),
            y: parseFloat((finalLeftEye.y - TARGET_LEFT_EYE.y).toFixed(2)),
          },
          rightEye: {
            x: parseFloat((finalRightEye.x - TARGET_RIGHT_EYE.x).toFixed(2)),
            y: parseFloat((finalRightEye.y - TARGET_RIGHT_EYE.y).toFixed(2)),
          },
        },
        rotationDegrees: parseFloat(rotationDegrees.toFixed(2)),
        scaleFactor: parseFloat(scale.toFixed(4)),
      },
    });

    // STEP 6: Handle out-of-bounds extraction
    let finalBuffer = scaledBuffer;
    let finalExtractLeft = extractLeft;
    let finalExtractTop = extractTop;

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
          background: { r: 255, g: 255, b: 255 },
        })
        .toBuffer();

      finalExtractLeft = extractLeft + extendLeft;
      finalExtractTop = extractTop + extendTop;

      console.log('Adjusted extraction offset:', { left: finalExtractLeft, top: finalExtractTop });
    }

    // STEP 7: Extract the final 1080x1080 region
    const alignedBuffer = await sharp(finalBuffer)
      .extract({
        left: finalExtractLeft,
        top: finalExtractTop,
        width: OUTPUT_SIZE,
        height: OUTPUT_SIZE,
      })
      .jpeg({ quality: 95 })
      .toBuffer();

    console.log('✅ Extraction complete, output size:', OUTPUT_SIZE, 'x', OUTPUT_SIZE);

    // STEP 7.5: Verify actual eye positions in the final output
    // This will tell us if our algorithm worked or if we messed up
    try {
      const alignedBase64 = alignedBuffer.toString('base64');
      const verifyResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=AIzaSyCcKbX_v19ulrB8VqRt8CwKZnZG4KYdkm8', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Detect the eye positions in this baby photo. Return ONLY a JSON object with this exact format: {"leftEye": {"x": number, "y": number}, "rightEye": {"x": number, "y": number}}. The leftEye is the baby\'s left eye (on the right side of the image). Measure from top-left corner of image.' },
              { inline_data: { mime_type: 'image/jpeg', data: alignedBase64 } }
            ]
          }],
          generationConfig: { temperature: 0, response_mime_type: 'application/json' }
        }),
      });

      const verifyResult = await verifyResponse.json();
      const verifyText = verifyResult.candidates?.[0]?.content?.parts?.[0]?.text;
      if (verifyText) {
        const actualEyes = JSON.parse(verifyText);

        await log({
          functionName: 'align-photo-v2',
          level: 'warning',
          message: '🔍 ACTUAL eye positions in final output (re-detected)',
          photoId,
          data: {
            actualDetected: actualEyes,
            expected: {
              leftEye: TARGET_LEFT_EYE,
              rightEye: TARGET_RIGHT_EYE,
            },
            actualError: {
              leftEye: {
                x: parseFloat((actualEyes.leftEye.x - TARGET_LEFT_EYE.x).toFixed(2)),
                y: parseFloat((actualEyes.leftEye.y - TARGET_LEFT_EYE.y).toFixed(2)),
              },
              rightEye: {
                x: parseFloat((actualEyes.rightEye.x - TARGET_RIGHT_EYE.x).toFixed(2)),
                y: parseFloat((actualEyes.rightEye.y - TARGET_RIGHT_EYE.y).toFixed(2)),
              },
            },
          },
        });
      }
    } catch (verifyError) {
      console.error('Failed to verify output eye positions:', verifyError);
    }

    // STEP 8: Upload to Supabase with cache-busting URL
    const alignedFileName = `${photo.user_id}/${photoId}-aligned-v2.jpg`;

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

    // Add cache-busting timestamp
    const cacheBustedUrl = `${publicUrl}?v=${Date.now()}`;

    // STEP 9: Update database
    const transform = {
      scale,
      translateX: extractLeft,
      translateY: extractTop,
      rotation: rotationDegrees,
      version: 'v2',
    };

    const { error: updateError } = await supabase
      .from('photos')
      .update({
        aligned_url: cacheBustedUrl,
        alignment_transform: transform,
      })
      .eq('id', photoId);

    if (updateError) {
      throw updateError;
    }

    console.log('=== ALIGNMENT V2 COMPLETE ===');
    console.log('Aligned URL:', cacheBustedUrl);

    await log({
      functionName: 'align-photo-v2',
      level: 'info',
      message: '✅ ALIGNMENT V2 COMPLETE',
      photoId,
      data: {
        alignedUrl: cacheBustedUrl,
        transform,
      },
    });

    return res.status(200).json({
      success: true,
      alignedUrl: cacheBustedUrl,
      transform,
      verification: {
        predictedLeftEye: finalLeftEye,
        predictedRightEye: finalRightEye,
        targetLeftEye: TARGET_LEFT_EYE,
        targetRightEye: TARGET_RIGHT_EYE,
        errorLeft: {
          x: finalLeftEye.x - TARGET_LEFT_EYE.x,
          y: finalLeftEye.y - TARGET_LEFT_EYE.y,
        },
        errorRight: {
          x: finalRightEye.x - TARGET_RIGHT_EYE.x,
          y: finalRightEye.y - TARGET_RIGHT_EYE.y,
        },
      },
    });

  } catch (error) {
    console.error('❌ Alignment V2 error:', error);

    await log({
      functionName: 'align-photo-v2',
      level: 'error',
      message: '❌ Alignment V2 failed',
      photoId: req.body?.photoId,
      data: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    });

    return res.status(500).json({
      error: 'Failed to align photo',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
