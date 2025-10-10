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

    // Calculate eye midpoint
    const eyeMidpoint = {
      x: (landmarks.leftEye.x + landmarks.rightEye.x) / 2,
      y: (landmarks.leftEye.y + landmarks.rightEye.y) / 2,
    };

    // Calculate rotation angle to level eyes
    // Note: leftEye is baby's left (appears on right in photo)
    //       rightEye is baby's right (appears on left in photo)
    const eyeAngle = Math.atan2(
      landmarks.rightEye.y - landmarks.leftEye.y,
      landmarks.rightEye.x - landmarks.leftEye.x
    );
    let rotationDegrees = -(eyeAngle * 180) / Math.PI;

    // Sanity check: If rotation is > 90°, the photo might be upside down
    // or the eye labels are swapped. Normalize to ±45° range.
    if (rotationDegrees > 90) {
      rotationDegrees = rotationDegrees - 180;
    } else if (rotationDegrees < -90) {
      rotationDegrees = rotationDegrees + 180;
    }

    console.log('Calculated rotation:', rotationDegrees, 'degrees (original angle:', (eyeAngle * 180 / Math.PI).toFixed(2), ')');

    // Process image with Sharp
    // Simplified approach: Just crop and rotate, no complex transformations

    const outputSize = 1080; // Square output

    console.log('Starting alignment with landmarks:', {
      leftEye: landmarks.leftEye,
      rightEye: landmarks.rightEye,
      eyeMidpoint,
      imageSize: { width: landmarks.imageWidth, height: landmarks.imageHeight },
      rotationDegrees
    });

    // CRITICAL: Check if coordinates are normalized (0-1) instead of pixels
    // If leftEye.x is less than 10, it's probably normalized
    let actualLeftEye = landmarks.leftEye;
    let actualRightEye = landmarks.rightEye;
    let actualEyeMidpoint = eyeMidpoint;

    if (landmarks.leftEye.x < 10 && landmarks.rightEye.x < 10) {
      console.warn('⚠️ Detected normalized coordinates! Converting to pixels...');
      actualLeftEye = {
        x: landmarks.leftEye.x * landmarks.imageWidth,
        y: landmarks.leftEye.y * landmarks.imageHeight,
      };
      actualRightEye = {
        x: landmarks.rightEye.x * landmarks.imageWidth,
        y: landmarks.rightEye.y * landmarks.imageHeight,
      };
      actualEyeMidpoint = {
        x: (actualLeftEye.x + actualRightEye.x) / 2,
        y: (actualLeftEye.y + actualRightEye.y) / 2,
      };
      console.log('Converted to pixels:', { actualLeftEye, actualRightEye, actualEyeMidpoint });
    }

    // Calculate how much space we need around the eyes
    const interEyeDistance = Math.sqrt(
      Math.pow(actualRightEye.x - actualLeftEye.x, 2) +
        Math.pow(actualRightEye.y - actualLeftEye.y, 2)
    );

    console.log('Inter-eye distance:', interEyeDistance, 'pixels');
    console.log('Inter-eye distance as % of image width:', (interEyeDistance / landmarks.imageWidth * 100).toFixed(1) + '%');

    // Calculate scale for transform record
    const targetInterEyeDistance = landmarks.imageWidth * 0.25;
    const scale = targetInterEyeDistance / interEyeDistance;

    // Calculate translation for transform record
    const targetPosition = {
      x: landmarks.imageWidth * 0.5,
      y: landmarks.imageHeight * 0.4,
    };
    const translation = {
      x: targetPosition.x - actualEyeMidpoint.x,
      y: targetPosition.y - actualEyeMidpoint.y,
    };

    // Create alignment transform record
    const transform: AlignmentTransform = {
      translateX: translation.x,
      translateY: translation.y,
      rotation: rotationDegrees,
      scale,
    };

    // Simple approach: Extract a square region centered on the eyes
    // Make it large enough to capture full face - use 3x the image width
    // This is more reliable than using inter-eye distance
    const cropSize = Math.round(landmarks.imageWidth * 1.5); // 1.5x image width
    const halfCrop = cropSize / 2;

    // NEW APPROACH: Rotate first, THEN crop
    // This way we don't lose the face when rotating by large angles

    let processedImage = imageBuffer;
    let currentWidth = landmarks.imageWidth;
    let currentHeight = landmarks.imageHeight;
    let rotatedEyeMidpoint = actualEyeMidpoint;

    // Step 1: Rotate the full image if needed
    if (Math.abs(rotationDegrees) > 0.5) {
      console.log('Step 1: Rotating full image by', rotationDegrees, 'degrees');
      processedImage = await sharp(imageBuffer)
        .rotate(rotationDegrees, { background: '#ffffff' })
        .toBuffer();

      const rotatedMeta = await sharp(processedImage).metadata();
      currentWidth = rotatedMeta.width || currentWidth;
      currentHeight = rotatedMeta.height || currentHeight;

      console.log('After rotation, image size:', currentWidth, 'x', currentHeight);

      // Calculate where the eye midpoint is after rotation
      // Rotation happens around the center of the image
      const angleRadians = (rotationDegrees * Math.PI) / 180;
      const originalCenterX = landmarks.imageWidth / 2;
      const originalCenterY = landmarks.imageHeight / 2;

      // Vector from center to eye midpoint
      const relX = actualEyeMidpoint.x - originalCenterX;
      const relY = actualEyeMidpoint.y - originalCenterY;

      // Apply rotation matrix
      const rotatedRelX = relX * Math.cos(angleRadians) - relY * Math.sin(angleRadians);
      const rotatedRelY = relX * Math.sin(angleRadians) + relY * Math.cos(angleRadians);

      // New eye position in rotated image
      rotatedEyeMidpoint = {
        x: rotatedRelX + currentWidth / 2,
        y: rotatedRelY + currentHeight / 2,
      };

      console.log('Eye midpoint after rotation:', rotatedEyeMidpoint);
    }

    // Step 2: Crop around the rotated eye position
    console.log('Step 2: Cropping around eye midpoint');
    console.log('Crop size:', cropSize, 'pixels (1.5x original image width)');

    const cropLeft = Math.max(0, Math.round(rotatedEyeMidpoint.x - halfCrop));
    const cropTop = Math.max(0, Math.round(rotatedEyeMidpoint.y - halfCrop));
    const cropWidth = Math.min(cropSize, currentWidth - cropLeft);
    const cropHeight = Math.min(cropSize, currentHeight - cropTop);

    console.log('Crop region:', { cropLeft, cropTop, cropWidth, cropHeight });

    const croppedImage = await sharp(processedImage)
      .extract({
        left: cropLeft,
        top: cropTop,
        width: cropWidth,
        height: cropHeight,
      })
      .toBuffer();

    console.log('After crop, image size:', (await sharp(croppedImage).metadata()).width, 'x', (await sharp(croppedImage).metadata()).height);

    // Step 3: Resize to final output size
    const alignedImage = await sharp(croppedImage)
      .resize(outputSize, outputSize, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: 95 })
      .toBuffer();

    console.log('Final image size:', outputSize, 'x', outputSize);

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
