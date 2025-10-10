import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

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

interface AlignmentTransform {
  translateX: number;
  translateY: number;
  rotation: number;
  scale: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('align-photo called with:', { photoId: req.body?.photoId });

    const { photoId, landmarks } = req.body as {
      photoId: string;
      landmarks: EyeLandmarks;
    };

    if (!photoId || !landmarks) {
      console.error('Missing required fields:', { photoId, landmarks });
      return res.status(400).json({ error: 'Missing photoId or landmarks' });
    }

    console.log('Processing alignment for photo:', photoId);

    // Fetch photo from database
    const { data: photo, error: fetchError } = await supabase
      .from('photos')
      .select('*')
      .eq('id', photoId)
      .single();

    if (fetchError || !photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Download original image
    const imageResponse = await fetch(photo.original_url);
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // FIXED TARGET EYE POSITIONS in 1080×1080 output (for perfect stacking)
    // These coordinates NEVER change - every photo will have eyes at these exact positions
    const TARGET_LEFT_EYE = { x: 360, y: 432 };   // 33.3% horizontal, 40% vertical
    const TARGET_RIGHT_EYE = { x: 720, y: 432 };  // 66.7% horizontal, 40% vertical
    const TARGET_INTER_EYE_DISTANCE = 360;         // pixels between eyes
    const OUTPUT_SIZE = 1080;                      // square output

    console.log('🎯 Target eye positions (fixed):', {
      leftEye: TARGET_LEFT_EYE,
      rightEye: TARGET_RIGHT_EYE,
      interEyeDistance: TARGET_INTER_EYE_DISTANCE,
      eyesWereOpen: landmarks.eyesOpen,
    });

    // Calculate detected eye positions
    const detectedLeftEye = landmarks.leftEye;
    const detectedRightEye = landmarks.rightEye;

    console.log('👁️ Detected eye positions:', {
      leftEye: detectedLeftEye,
      rightEye: detectedRightEye,
    });

    // Calculate rotation angle to level eyes horizontally
    // Note: leftEye is baby's left (appears on right in photo)
    //       rightEye is baby's right (appears on left in photo)
    const eyeAngle = Math.atan2(
      detectedRightEye.y - detectedLeftEye.y,
      detectedRightEye.x - detectedLeftEye.x
    );
    let rotationDegrees = -(eyeAngle * 180) / Math.PI;

    // Normalize rotation to ±90° range (prevent upside-down)
    if (rotationDegrees > 90) {
      rotationDegrees = rotationDegrees - 180;
    } else if (rotationDegrees < -90) {
      rotationDegrees = rotationDegrees + 180;
    }

    console.log('🔄 Rotation required:', rotationDegrees.toFixed(2), 'degrees');

    // Calculate current inter-eye distance
    const detectedInterEyeDistance = Math.sqrt(
      Math.pow(detectedRightEye.x - detectedLeftEye.x, 2) +
        Math.pow(detectedRightEye.y - detectedLeftEye.y, 2)
    );

    // Calculate scale factor to normalize inter-eye distance to target (360px)
    const scaleFactor = TARGET_INTER_EYE_DISTANCE / detectedInterEyeDistance;

    console.log('📏 Scale calculation:', {
      detectedInterEyeDistance: detectedInterEyeDistance.toFixed(2),
      targetInterEyeDistance: TARGET_INTER_EYE_DISTANCE,
      scaleFactor: scaleFactor.toFixed(3),
    });

    // AFFINE TRANSFORMATION APPROACH (Industry Standard)
    // Combines rotation + scale + translation in correct mathematical order
    // This ensures eyes land at EXACT target positions

    // Calculate eye centers for rotation pivot
    const eyeCenter = {
      x: (detectedLeftEye.x + detectedRightEye.x) / 2,
      y: (detectedLeftEye.y + detectedRightEye.y) / 2,
    };
    const targetEyeCenter = {
      x: (TARGET_LEFT_EYE.x + TARGET_RIGHT_EYE.x) / 2,
      y: (TARGET_LEFT_EYE.y + TARGET_RIGHT_EYE.y) / 2,
    };

    console.log('📍 Eye centers:', {
      detected: eyeCenter,
      target: targetEyeCenter,
    });

    // STEP 1: Scale image to normalize inter-eye distance
    console.log('Step 1: Scaling image...');
    const scaledWidth = Math.round(landmarks.imageWidth * scaleFactor);
    const scaledHeight = Math.round(landmarks.imageHeight * scaleFactor);

    let processedImage = await sharp(imageBuffer)
      .resize(scaledWidth, scaledHeight, {
        kernel: 'lanczos3',
        fit: 'fill',
      })
      .toBuffer();

    console.log('✓ Scaled to:', scaledWidth, 'x', scaledHeight);

    // Calculate scaled eye positions
    const scaledLeftEye = {
      x: detectedLeftEye.x * scaleFactor,
      y: detectedLeftEye.y * scaleFactor,
    };
    const scaledRightEye = {
      x: detectedRightEye.x * scaleFactor,
      y: detectedRightEye.y * scaleFactor,
    };
    const scaledEyeCenter = {
      x: eyeCenter.x * scaleFactor,
      y: eyeCenter.y * scaleFactor,
    };

    console.log('Eyes after scaling:', {
      leftEye: scaledLeftEye,
      rightEye: scaledRightEye,
      center: scaledEyeCenter,
    });

    // STEP 2: Rotate image around scaled eye center
    let alignedImage: Buffer;

    if (Math.abs(rotationDegrees) > 0.5) {
      console.log('Step 2: Rotating by', rotationDegrees.toFixed(2), 'degrees around eye center...');

      // Rotate around eye center by translating, rotating, then translating back
      // Sharp rotates around image center, so we need to adjust

      const angleRadians = (rotationDegrees * Math.PI) / 180;
      const cosAngle = Math.cos(angleRadians);
      const sinAngle = Math.sin(angleRadians);

      // After rotation around image center, calculate new eye positions
      const imageCenterX = scaledWidth / 2;
      const imageCenterY = scaledHeight / 2;

      // Vector from image center to left eye
      const leftRelX = scaledLeftEye.x - imageCenterX;
      const leftRelY = scaledLeftEye.y - imageCenterY;

      // Apply rotation matrix
      const rotatedLeftEye = {
        x: leftRelX * cosAngle - leftRelY * sinAngle + imageCenterX,
        y: leftRelX * sinAngle + leftRelY * cosAngle + imageCenterY,
      };

      // Vector from image center to right eye
      const rightRelX = scaledRightEye.x - imageCenterX;
      const rightRelY = scaledRightEye.y - imageCenterY;

      const rotatedRightEye = {
        x: rightRelX * cosAngle - rightRelY * sinAngle + imageCenterX,
        y: rightRelX * sinAngle + rightRelY * cosAngle + imageCenterY,
      };

      console.log('Calculated eye positions after rotation:', {
        leftEye: rotatedLeftEye,
        rightEye: rotatedRightEye,
      });

      // Rotate the image
      const rotatedBuffer = await sharp(processedImage)
        .rotate(rotationDegrees, { background: '#ffffff' })
        .toBuffer();

      const rotatedMeta = await sharp(rotatedBuffer).metadata();
      const rotatedWidth = rotatedMeta.width!;
      const rotatedHeight = rotatedMeta.height!;

      console.log('✓ Rotated. New dimensions:', rotatedWidth, 'x', rotatedHeight);

      // STEP 3: Extract OUTPUT_SIZE region with eyes at target positions
      console.log('Step 3: Extracting with eyes at target positions...');

      // Account for any size change from rotation (Sharp adds padding)
      const widthChange = rotatedWidth - scaledWidth;
      const heightChange = rotatedHeight - scaledHeight;

      // Adjust eye positions for the padding added during rotation
      const adjustedLeftEye = {
        x: rotatedLeftEye.x + widthChange / 2,
        y: rotatedLeftEye.y + heightChange / 2,
      };

      console.log('Eye position accounting for rotation padding:', adjustedLeftEye);

      // Calculate extraction region to place eyes at targets
      const extractLeft = Math.round(adjustedLeftEye.x - TARGET_LEFT_EYE.x);
      const extractTop = Math.round(adjustedLeftEye.y - TARGET_LEFT_EYE.y);

      console.log('Extraction offset:', { extractLeft, extractTop });

      // Handle out-of-bounds extraction
      if (extractLeft < 0 || extractTop < 0 ||
          (extractLeft + OUTPUT_SIZE) > rotatedWidth ||
          (extractTop + OUTPUT_SIZE) > rotatedHeight) {

        console.log('⚠️ Extraction out of bounds, extending canvas...');

        const extendLeft = Math.max(0, -extractLeft);
        const extendTop = Math.max(0, -extractTop);
        const extendRight = Math.max(0, (extractLeft + OUTPUT_SIZE) - rotatedWidth);
        const extendBottom = Math.max(0, (extractTop + OUTPUT_SIZE) - rotatedHeight);

        const extendedBuffer = await sharp(rotatedBuffer)
          .extend({
            top: extendTop,
            bottom: extendBottom,
            left: extendLeft,
            right: extendRight,
            background: { r: 255, g: 255, b: 255 },
          })
          .toBuffer();

        const finalExtractLeft = extractLeft + extendLeft;
        const finalExtractTop = extractTop + extendTop;

        alignedImage = await sharp(extendedBuffer)
          .extract({
            left: finalExtractLeft,
            top: finalExtractTop,
            width: OUTPUT_SIZE,
            height: OUTPUT_SIZE,
          })
          .jpeg({ quality: 95 })
          .toBuffer();
      } else {
        alignedImage = await sharp(rotatedBuffer)
          .extract({
            left: extractLeft,
            top: extractTop,
            width: OUTPUT_SIZE,
            height: OUTPUT_SIZE,
          })
          .jpeg({ quality: 95 })
          .toBuffer();
      }

      console.log('✓ Extracted final', OUTPUT_SIZE, 'x', OUTPUT_SIZE, 'region');

    } else {
      // No rotation needed - just extract
      console.log('Step 2: No rotation needed (eyes already level)');

      const extractLeft = Math.round(scaledLeftEye.x - TARGET_LEFT_EYE.x);
      const extractTop = Math.round(scaledLeftEye.y - TARGET_LEFT_EYE.y);

      console.log('Extraction offset:', { extractLeft, extractTop });

      // Handle out-of-bounds
      if (extractLeft < 0 || extractTop < 0 ||
          (extractLeft + OUTPUT_SIZE) > scaledWidth ||
          (extractTop + OUTPUT_SIZE) > scaledHeight) {

        const extendLeft = Math.max(0, -extractLeft);
        const extendTop = Math.max(0, -extractTop);
        const extendRight = Math.max(0, (extractLeft + OUTPUT_SIZE) - scaledWidth);
        const extendBottom = Math.max(0, (extractTop + OUTPUT_SIZE) - scaledHeight);

        processedImage = await sharp(processedImage)
          .extend({
            top: extendTop,
            bottom: extendBottom,
            left: extendLeft,
            right: extendRight,
            background: { r: 255, g: 255, b: 255 },
          })
          .toBuffer();

        const finalExtractLeft = extractLeft + extendLeft;
        const finalExtractTop = extractTop + extendTop;

        alignedImage = await sharp(processedImage)
          .extract({
            left: finalExtractLeft,
            top: finalExtractTop,
            width: OUTPUT_SIZE,
            height: OUTPUT_SIZE,
          })
          .jpeg({ quality: 95 })
          .toBuffer();
      } else {
        alignedImage = await sharp(processedImage)
          .extract({
            left: extractLeft,
            top: extractTop,
            width: OUTPUT_SIZE,
            height: OUTPUT_SIZE,
          })
          .jpeg({ quality: 95 })
          .toBuffer();
      }

      console.log('✓ Extracted final', OUTPUT_SIZE, 'x', OUTPUT_SIZE, 'region');
    }

    console.log('✅ Alignment complete!');
    console.log('🎯 Eyes are now at fixed positions:', {
      leftEye: TARGET_LEFT_EYE,
      rightEye: TARGET_RIGHT_EYE,
      interEyeDistance: TARGET_INTER_EYE_DISTANCE,
    });

    // Create alignment transform record
    const transform: AlignmentTransform = {
      translateX: -extractLeft,  // How much we shifted the image
      translateY: -extractTop,
      rotation: rotationDegrees,
      scale: scaleFactor,
    };

    // Upload aligned image to Supabase Storage
    const { data: userData } = await supabase.auth.admin.getUserById(photo.user_id);
    const alignedFileName = `${photo.user_id}/${photoId}-aligned.jpg`;

    console.log('Uploading aligned image to bucket:', { fileName: alignedFileName, size: alignedImage.length });

    const { error: uploadError } = await supabase.storage
      .from('aligned')
      .upload(alignedFileName, alignedImage, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw uploadError;
    }

    console.log('Upload successful, getting public URL');

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('aligned')
      .getPublicUrl(alignedFileName);

    // Update photo record with aligned URL and transform
    console.log('Updating database with aligned URL:', { photoId, publicUrl });

    const { error: updateError } = await supabase
      .from('photos')
      .update({
        aligned_url: publicUrl,
        alignment_transform: transform,
      })
      .eq('id', photoId);

    if (updateError) {
      console.error('Database update error:', updateError);
      throw updateError;
    }

    console.log('✅ Alignment complete for photo:', photoId);

    return res.status(200).json({
      success: true,
      alignedUrl: publicUrl,
      transform,
    });
  } catch (error) {
    console.error('❌ Error aligning photo:', error);
    return res.status(500).json({
      error: 'Failed to align photo',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
