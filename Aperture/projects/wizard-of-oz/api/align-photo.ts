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

    // SIMPLEST POSSIBLE ALIGNMENT - NO ROTATION, NO COMPLEX MATH
    // Just scale and center the image with eyes at target positions
    console.log('🔧 SIMPLE ALIGNMENT - Testing basic flow...');

    // Step 1: Scale image so inter-eye distance = 360px
    const scaledWidth = Math.round(landmarks.imageWidth * scaleFactor);
    const scaledHeight = Math.round(landmarks.imageHeight * scaleFactor);

    console.log('Scaling image by', scaleFactor.toFixed(3));
    console.log('  From:', landmarks.imageWidth, 'x', landmarks.imageHeight);
    console.log('  To:', scaledWidth, 'x', scaledHeight);

    const scaledImage = await sharp(imageBuffer)
      .resize(scaledWidth, scaledHeight, {
        kernel: 'lanczos3',
        fit: 'fill',
      })
      .toBuffer();

    // Step 2: Scale eye positions
    const scaledLeftEye = {
      x: detectedLeftEye.x * scaleFactor,
      y: detectedLeftEye.y * scaleFactor,
    };

    console.log('Scaled left eye position:', scaledLeftEye);
    console.log('Target left eye position:', TARGET_LEFT_EYE);

    // Step 3: Extract 1080x1080 region with left eye at target position
    const extractLeft = Math.round(scaledLeftEye.x - TARGET_LEFT_EYE.x);
    const extractTop = Math.round(scaledLeftEye.y - TARGET_LEFT_EYE.y);

    console.log('Extract offset:', extractLeft, extractTop);
    console.log('Extract region: (' + extractLeft + ',' + extractTop + ') to (' + (extractLeft + OUTPUT_SIZE) + ',' + (extractTop + OUTPUT_SIZE) + ')');

    // Handle out-of-bounds by extending canvas with white background
    let alignedImage: Buffer;

    if (extractLeft < 0 || extractTop < 0 ||
        (extractLeft + OUTPUT_SIZE) > scaledWidth ||
        (extractTop + OUTPUT_SIZE) > scaledHeight) {
      console.log('⚠️ Extraction out of bounds - extending canvas');
      console.log('  Scaled image size:', scaledWidth, 'x', scaledHeight);
      console.log('  Extract needs: from (' + extractLeft + ',' + extractTop + ') size ' + OUTPUT_SIZE + 'x' + OUTPUT_SIZE);

      // Calculate how much padding we need on each side
      const extendLeft = Math.max(0, -extractLeft);
      const extendTop = Math.max(0, -extractTop);
      const extendRight = Math.max(0, (extractLeft + OUTPUT_SIZE) - scaledWidth);
      const extendBottom = Math.max(0, (extractTop + OUTPUT_SIZE) - scaledHeight);

      console.log('  Adding padding:', { left: extendLeft, top: extendTop, right: extendRight, bottom: extendBottom });

      // Extend the canvas
      const extendedImage = await sharp(scaledImage)
        .extend({
          top: extendTop,
          bottom: extendBottom,
          left: extendLeft,
          right: extendRight,
          background: { r: 255, g: 255, b: 255 },
        })
        .toBuffer();

      // Adjust extraction coordinates for the extended canvas
      const newExtractLeft = extractLeft + extendLeft;
      const newExtractTop = extractTop + extendTop;

      console.log('  New extract position:', newExtractLeft, newExtractTop);

      alignedImage = await sharp(extendedImage)
        .extract({
          left: newExtractLeft,
          top: newExtractTop,
          width: OUTPUT_SIZE,
          height: OUTPUT_SIZE,
        })
        .jpeg({ quality: 95 })
        .toBuffer();
    } else {
      alignedImage = await sharp(scaledImage)
        .extract({
          left: extractLeft,
          top: extractTop,
          width: OUTPUT_SIZE,
          height: OUTPUT_SIZE,
        })
        .jpeg({ quality: 95 })
        .toBuffer();
    }

    console.log('✅ Basic alignment complete - no rotation applied');

    console.log('✅ Alignment complete!');
    console.log('🎯 Eyes are now at fixed positions:', {
      leftEye: TARGET_LEFT_EYE,
      rightEye: TARGET_RIGHT_EYE,
      interEyeDistance: TARGET_INTER_EYE_DISTANCE,
    });

    // Create alignment transform record
    const transform: AlignmentTransform = {
      translateX: extractLeft,
      translateY: extractTop,
      rotation: 0, // No rotation in simple version
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
