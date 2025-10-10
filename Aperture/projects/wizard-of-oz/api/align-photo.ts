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

    // Calculate eye midpoint for rotation center
    const eyeMidpoint = {
      x: (detectedLeftEye.x + detectedRightEye.x) / 2,
      y: (detectedLeftEye.y + detectedRightEye.y) / 2,
    };

    // STEP 1: Rotate image to level eyes
    let processedImage = imageBuffer;
    let currentWidth = landmarks.imageWidth;
    let currentHeight = landmarks.imageHeight;

    if (Math.abs(rotationDegrees) > 0.5) {
      console.log('Step 1: Rotating image to level eyes...');
      processedImage = await sharp(imageBuffer)
        .rotate(rotationDegrees, { background: '#ffffff' })
        .toBuffer();

      const meta = await sharp(processedImage).metadata();
      currentWidth = meta.width!;
      currentHeight = meta.height!;
      console.log('✓ Rotated. New size:', currentWidth, 'x', currentHeight);
    }

    // STEP 2: Calculate where eyes are after rotation
    const angleRadians = (rotationDegrees * Math.PI) / 180;
    const originalCenterX = landmarks.imageWidth / 2;
    const originalCenterY = landmarks.imageHeight / 2;

    // Transform left eye position
    const leftRelX = detectedLeftEye.x - originalCenterX;
    const leftRelY = detectedLeftEye.y - originalCenterY;
    const rotatedLeftX = leftRelX * Math.cos(angleRadians) - leftRelY * Math.sin(angleRadians) + currentWidth / 2;
    const rotatedLeftY = leftRelX * Math.sin(angleRadians) + leftRelY * Math.cos(angleRadians) + currentHeight / 2;

    // Transform right eye position
    const rightRelX = detectedRightEye.x - originalCenterX;
    const rightRelY = detectedRightEye.y - originalCenterY;
    const rotatedRightX = rightRelX * Math.cos(angleRadians) - rightRelY * Math.sin(angleRadians) + currentWidth / 2;
    const rotatedRightY = rightRelX * Math.sin(angleRadians) + rightRelY * Math.cos(angleRadians) + currentHeight / 2;

    console.log('Step 2: Eyes after rotation:', {
      leftEye: { x: rotatedLeftX.toFixed(2), y: rotatedLeftY.toFixed(2) },
      rightEye: { x: rotatedRightX.toFixed(2), y: rotatedRightY.toFixed(2) },
    });

    // STEP 3: Scale image to normalize inter-eye distance
    console.log('Step 3: Scaling to normalize inter-eye distance...');
    const scaledWidth = Math.round(currentWidth * scaleFactor);
    const scaledHeight = Math.round(currentHeight * scaleFactor);

    processedImage = await sharp(processedImage)
      .resize(scaledWidth, scaledHeight, {
        kernel: 'lanczos3', // High-quality scaling
        fit: 'fill',
      })
      .toBuffer();

    console.log('✓ Scaled. New size:', scaledWidth, 'x', scaledHeight);

    // Scale eye positions accordingly
    const scaledLeftX = rotatedLeftX * scaleFactor;
    const scaledLeftY = rotatedLeftY * scaleFactor;
    const scaledRightX = rotatedRightX * scaleFactor;
    const scaledRightY = rotatedRightY * scaleFactor;

    console.log('Eyes after scaling:', {
      leftEye: { x: scaledLeftX.toFixed(2), y: scaledLeftY.toFixed(2) },
      rightEye: { x: scaledRightX.toFixed(2), y: scaledRightY.toFixed(2) },
    });

    // STEP 4: Calculate extraction region to place eyes at target positions
    // If left eye is at scaledLeftX in the scaled image,
    // and we want it at TARGET_LEFT_EYE.x in the final output,
    // we need to extract starting from (scaledLeftX - TARGET_LEFT_EYE.x)
    const extractLeft = Math.round(scaledLeftX - TARGET_LEFT_EYE.x);
    const extractTop = Math.round(scaledLeftY - TARGET_LEFT_EYE.y);

    console.log('Step 4: Extraction calculation:', {
      scaledLeftEye: { x: scaledLeftX.toFixed(2), y: scaledLeftY.toFixed(2) },
      targetLeftEye: TARGET_LEFT_EYE,
      extractionOffset: { left: extractLeft, top: extractTop },
    });

    console.log('Step 5: Extracting final', OUTPUT_SIZE, 'x', OUTPUT_SIZE, 'region...');
    console.log('Extract region:', {
      left: extractLeft,
      top: extractTop,
      width: OUTPUT_SIZE,
      height: OUTPUT_SIZE,
    });

    // STEP 5: Extract final OUTPUT_SIZE×OUTPUT_SIZE region
    // Handle out-of-bounds extraction by extending canvas if needed
    let alignedImage: Buffer;

    const needsExtension = extractLeft < 0 || extractTop < 0 ||
                          (extractLeft + OUTPUT_SIZE) > scaledWidth ||
                          (extractTop + OUTPUT_SIZE) > scaledHeight;

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
