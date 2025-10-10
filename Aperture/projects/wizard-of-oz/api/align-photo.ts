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

    // SIMPLIFIED ALIGNMENT ALGORITHM
    // a) Rotate photo to get eyes on horizontal line
    // b) Center image so eyes are symmetric around midpoint
    // c) Scale to place eyes at exact target pixel positions

    // STEP 1: ROTATE to level eyes horizontally
    console.log('Step 1: Rotating to level eyes...');

    let processedImage = imageBuffer;
    let currentWidth = landmarks.imageWidth;
    let currentHeight = landmarks.imageHeight;
    let currentLeftEye = { ...detectedLeftEye };
    let currentRightEye = { ...detectedRightEye };

    if (Math.abs(rotationDegrees) > 0.5) {
      processedImage = await sharp(imageBuffer)
        .rotate(rotationDegrees, { background: '#ffffff' })
        .toBuffer();

      const rotatedMeta = await sharp(processedImage).metadata();
      currentWidth = rotatedMeta.width!;
      currentHeight = rotatedMeta.height!;

      console.log('✓ Rotated by', rotationDegrees.toFixed(2), 'degrees');
      console.log('  Original size:', landmarks.imageWidth, 'x', landmarks.imageHeight);
      console.log('  Rotated size:', currentWidth, 'x', currentHeight);

      // Calculate where eyes are after rotation
      const angleRadians = (rotationDegrees * Math.PI) / 180;
      const cosAngle = Math.cos(angleRadians);
      const sinAngle = Math.sin(angleRadians);

      const origCenterX = landmarks.imageWidth / 2;
      const origCenterY = landmarks.imageHeight / 2;

      // Rotate left eye around original center
      const leftRelX = detectedLeftEye.x - origCenterX;
      const leftRelY = detectedLeftEye.y - origCenterY;
      const rotatedLeftX = leftRelX * cosAngle - leftRelY * sinAngle;
      const rotatedLeftY = leftRelX * sinAngle + leftRelY * cosAngle;

      // Rotate right eye around original center
      const rightRelX = detectedRightEye.x - origCenterX;
      const rightRelY = detectedRightEye.y - origCenterY;
      const rotatedRightX = rightRelX * cosAngle - rightRelY * sinAngle;
      const rotatedRightY = rightRelX * sinAngle + rightRelY * cosAngle;

      // After rotation, Sharp adds padding to fit the rotated image
      // The rotated coordinates are relative to the original image center
      // We need to translate them to the new padded image coordinate system
      const paddingX = (currentWidth - landmarks.imageWidth) / 2;
      const paddingY = (currentHeight - landmarks.imageHeight) / 2;

      // Place rotated coordinates in padded image space
      // Original center is now at (origCenterX + paddingX, origCenterY + paddingY)
      currentLeftEye = {
        x: rotatedLeftX + origCenterX + paddingX,
        y: rotatedLeftY + origCenterY + paddingY,
      };
      currentRightEye = {
        x: rotatedRightX + origCenterX + paddingX,
        y: rotatedRightY + origCenterY + paddingY,
      };

      console.log('  Eyes after rotation:', {
        leftEye: currentLeftEye,
        rightEye: currentRightEye,
        padding: { x: paddingX, y: paddingY },
      });
    } else {
      console.log('✓ No rotation needed (eyes already level)');
    }

    // STEP 2: SCALE to make inter-eye distance match target (360px)
    console.log('Step 2: Scaling to target inter-eye distance...');

    const currentInterEyeDistance = Math.sqrt(
      Math.pow(currentRightEye.x - currentLeftEye.x, 2) +
      Math.pow(currentRightEye.y - currentLeftEye.y, 2)
    );

    const scaledWidth = Math.round(currentWidth * scaleFactor);
    const scaledHeight = Math.round(currentHeight * scaleFactor);

    processedImage = await sharp(processedImage)
      .resize(scaledWidth, scaledHeight, {
        kernel: 'lanczos3',
        fit: 'fill',
      })
      .toBuffer();

    console.log('✓ Scaled by', scaleFactor.toFixed(3));
    console.log('  New size:', scaledWidth, 'x', scaledHeight);

    // Scale eye positions
    currentLeftEye = {
      x: currentLeftEye.x * scaleFactor,
      y: currentLeftEye.y * scaleFactor,
    };
    currentRightEye = {
      x: currentRightEye.x * scaleFactor,
      y: currentRightEye.y * scaleFactor,
    };

    console.log('  Eyes after scaling:', {
      leftEye: currentLeftEye,
      rightEye: currentRightEye,
    });

    // STEP 3: EXTRACT to place left eye at exact target position
    console.log('Step 3: Extracting to place left eye at target position...');

    console.log('  Current left eye:', currentLeftEye);
    console.log('  Target left eye:', TARGET_LEFT_EYE);

    // Extract so that current left eye lands at TARGET_LEFT_EYE position
    // If left eye is at (500, 600) and we want it at (360, 432):
    // Extract from (500-360, 600-432) = (140, 168)
    const extractLeft = Math.round(currentLeftEye.x - TARGET_LEFT_EYE.x);
    const extractTop = Math.round(currentLeftEye.y - TARGET_LEFT_EYE.y);

    console.log('  Extraction offset:', { extractLeft, extractTop });
    console.log('  This will extract region from:', extractLeft, ',', extractTop, 'to', extractLeft + OUTPUT_SIZE, ',', extractTop + OUTPUT_SIZE);

    // Handle out-of-bounds by extending canvas
    let alignedImage: Buffer;

    if (extractLeft < 0 || extractTop < 0 ||
        (extractLeft + OUTPUT_SIZE) > scaledWidth ||
        (extractTop + OUTPUT_SIZE) > scaledHeight) {

      console.log('  ⚠️ Out of bounds - extending canvas...');

      const extendLeft = Math.max(0, -extractLeft);
      const extendTop = Math.max(0, -extractTop);
      const extendRight = Math.max(0, (extractLeft + OUTPUT_SIZE) - scaledWidth);
      const extendBottom = Math.max(0, (extractTop + OUTPUT_SIZE) - scaledHeight);

      console.log('  Extension:', { extendLeft, extendTop, extendRight, extendBottom });

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

    console.log('✅ Alignment complete!');
    console.log('🎯 Eyes are now at fixed positions:', {
      leftEye: TARGET_LEFT_EYE,
      rightEye: TARGET_RIGHT_EYE,
      interEyeDistance: TARGET_INTER_EYE_DISTANCE,
    });

    // Create alignment transform record
    const transform: AlignmentTransform = {
      translateX: currentLeftEye.x - TARGET_LEFT_EYE.x,
      translateY: currentLeftEye.y - TARGET_LEFT_EYE.y,
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
