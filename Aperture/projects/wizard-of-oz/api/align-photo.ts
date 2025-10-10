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

    // SIMPLER APPROACH: Scale first, then rotate and extract in one operation
    // This avoids the padding issues from rotating first

    // STEP 1: Scale image to normalize inter-eye distance
    console.log('Step 1: Scaling to normalize inter-eye distance...');
    const scaledWidth = Math.round(landmarks.imageWidth * scaleFactor);
    const scaledHeight = Math.round(landmarks.imageHeight * scaleFactor);

    let processedImage = await sharp(imageBuffer)
      .resize(scaledWidth, scaledHeight, {
        kernel: 'lanczos3',
        fit: 'fill',
      })
      .toBuffer();

    console.log('✓ Scaled. New size:', scaledWidth, 'x', scaledHeight);

    // Scale eye positions accordingly
    const scaledLeftX = detectedLeftEye.x * scaleFactor;
    const scaledLeftY = detectedLeftEye.y * scaleFactor;
    const scaledRightX = detectedRightEye.x * scaleFactor;
    const scaledRightY = detectedRightEye.y * scaleFactor;

    console.log('Eyes after scaling:', {
      leftEye: { x: scaledLeftX.toFixed(2), y: scaledLeftY.toFixed(2) },
      rightEye: { x: scaledRightX.toFixed(2), y: scaledRightY.toFixed(2) },
    });

    // STEP 2: Calculate extraction region centered on eyes
    // We want to extract OUTPUT_SIZE × OUTPUT_SIZE with left eye at TARGET_LEFT_EYE
    const extractLeft = Math.round(scaledLeftX - TARGET_LEFT_EYE.x);
    const extractTop = Math.round(scaledLeftY - TARGET_LEFT_EYE.y);

    console.log('Step 2: Extraction calculation:', {
      scaledLeftEye: { x: scaledLeftX.toFixed(2), y: scaledLeftY.toFixed(2) },
      targetLeftEye: TARGET_LEFT_EYE,
      extractionOffset: { left: extractLeft, top: extractTop },
    });

    console.log('Step 3: Extracting', OUTPUT_SIZE, 'x', OUTPUT_SIZE, 'region...');
    console.log('Extract region:', {
      left: extractLeft,
      top: extractTop,
      width: OUTPUT_SIZE,
      height: OUTPUT_SIZE,
    });

    // STEP 3: Extract region around eyes
    // Handle out-of-bounds extraction by extending canvas if needed
    let extractedImage: Buffer;

    const needsExtension = extractLeft < 0 || extractTop < 0 ||
                          (extractLeft + OUTPUT_SIZE) > scaledWidth ||
                          (extractLeft + OUTPUT_SIZE) > scaledHeight;

    if (needsExtension) {
      console.log('⚠️ Extraction would go out of bounds. Extending canvas...');

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

      console.log('✓ Canvas extended:', { extendTop, extendBottom, extendLeft, extendRight });

      // Adjust extraction coordinates for extended canvas
      const finalExtractLeft = extractLeft + extendLeft;
      const finalExtractTop = extractTop + extendTop;

      extractedImage = await sharp(processedImage)
        .extract({
          left: finalExtractLeft,
          top: finalExtractTop,
          width: OUTPUT_SIZE,
          height: OUTPUT_SIZE,
        })
        .toBuffer();
    } else {
      extractedImage = await sharp(processedImage)
        .extract({
          left: extractLeft,
          top: extractTop,
          width: OUTPUT_SIZE,
          height: OUTPUT_SIZE,
        })
        .toBuffer();
    }

    console.log('✓ Extracted', OUTPUT_SIZE, 'x', OUTPUT_SIZE, 'region');

    // STEP 4: Rotate the extracted region to level eyes
    let alignedImage: Buffer;

    if (Math.abs(rotationDegrees) > 0.5) {
      console.log('Step 4: Rotating extracted region by', rotationDegrees.toFixed(2), 'degrees...');

      alignedImage = await sharp(extractedImage)
        .rotate(rotationDegrees, { background: '#ffffff' })
        .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({ quality: 95 })
        .toBuffer();

      console.log('✓ Rotated and cropped to final', OUTPUT_SIZE, 'x', OUTPUT_SIZE);
    } else {
      alignedImage = await sharp(extractedImage)
        .jpeg({ quality: 95 })
        .toBuffer();

      console.log('✓ No rotation needed');
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
