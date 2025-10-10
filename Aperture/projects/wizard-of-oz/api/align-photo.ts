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
    const eyeAngle = Math.atan2(
      landmarks.rightEye.y - landmarks.leftEye.y,
      landmarks.rightEye.x - landmarks.leftEye.x
    );
    const rotationDegrees = -(eyeAngle * 180) / Math.PI;

    // Target eye position (50% width, 40% height - eyes slightly above center)
    const targetPosition = {
      x: landmarks.imageWidth * 0.5,
      y: landmarks.imageHeight * 0.4,
    };

    // Calculate translation
    const translation = {
      x: targetPosition.x - eyeMidpoint.x,
      y: targetPosition.y - eyeMidpoint.y,
    };

    // Calculate scale to normalize inter-eye distance
    const interEyeDistance = Math.sqrt(
      Math.pow(landmarks.rightEye.x - landmarks.leftEye.x, 2) +
        Math.pow(landmarks.rightEye.y - landmarks.leftEye.y, 2)
    );
    const targetInterEyeDistance = landmarks.imageWidth * 0.25; // 25% of image width
    const scale = targetInterEyeDistance / interEyeDistance;

    // Create alignment transform record
    const transform: AlignmentTransform = {
      translateX: translation.x,
      translateY: translation.y,
      rotation: rotationDegrees,
      scale,
    };

    // Process image with Sharp
    // New approach: First extract a generous region around the face, THEN rotate
    // This avoids the rotation coordinate transformation problem

    const outputSize = 1080; // Square output

    // Calculate extraction region: centered on eye midpoint, large enough to contain face after rotation
    // Use 1.5x the inter-eye distance as a buffer for rotation
    const interEyeDistance = Math.sqrt(
      Math.pow(landmarks.rightEye.x - landmarks.leftEye.x, 2) +
        Math.pow(landmarks.rightEye.y - landmarks.leftEye.y, 2)
    );

    // Extract region size: make it generous to account for rotation
    // Use 4x inter-eye distance to ensure full face is captured
    const extractSize = Math.max(outputSize, Math.round(interEyeDistance * 4));
    const halfExtractSize = Math.round(extractSize / 2);

    // Calculate extraction bounds (before rotation)
    const extractLeft = Math.max(0, Math.round(eyeMidpoint.x - halfExtractSize));
    const extractTop = Math.max(0, Math.round(eyeMidpoint.y - halfExtractSize));
    const extractWidth = Math.min(
      extractSize,
      landmarks.imageWidth - extractLeft
    );
    const extractHeight = Math.min(
      extractSize,
      landmarks.imageHeight - extractTop
    );

    console.log('Extraction region:', { extractLeft, extractTop, extractWidth, extractHeight, eyeMidpoint });

    // Step 1: Extract the region containing the face
    const extractedImage = await sharp(imageBuffer)
      .extract({
        left: extractLeft,
        top: extractTop,
        width: extractWidth,
        height: extractHeight,
      })
      .toBuffer();

    // Step 2: Calculate the eye position within the extracted region
    const eyeInExtract = {
      x: eyeMidpoint.x - extractLeft,
      y: eyeMidpoint.y - extractTop,
    };

    console.log('Eye position in extracted region:', eyeInExtract);

    // Step 3: Rotate the extracted image
    const rotatedImage = await sharp(extractedImage)
      .rotate(rotationDegrees, { background: '#ffffff' })
      .toBuffer();

    // Step 4: Get rotated image dimensions
    const rotatedMetadata = await sharp(rotatedImage).metadata();
    const rotatedWidth = rotatedMetadata.width || extractWidth;
    const rotatedHeight = rotatedMetadata.height || extractHeight;

    // Step 5: Calculate where the eye midpoint is after rotation
    // Apply rotation matrix to transform coordinates
    const angleRadians = (rotationDegrees * Math.PI) / 180;
    const centerX = extractWidth / 2;
    const centerY = extractHeight / 2;

    // Translate to origin, rotate, translate back
    const relativeX = eyeInExtract.x - centerX;
    const relativeY = eyeInExtract.y - centerY;

    const rotatedEyeX = relativeX * Math.cos(angleRadians) - relativeY * Math.sin(angleRadians) + rotatedWidth / 2;
    const rotatedEyeY = relativeX * Math.sin(angleRadians) + relativeY * Math.cos(angleRadians) + rotatedHeight / 2;

    console.log('Rotated eye position:', { rotatedEyeX, rotatedEyeY, rotatedWidth, rotatedHeight });

    // Step 6: Crop around the rotated eye position to create final square image
    const finalHalfSize = outputSize / 2;
    const finalLeft = Math.max(0, Math.round(rotatedEyeX - finalHalfSize));
    const finalTop = Math.max(0, Math.round(rotatedEyeY - finalHalfSize * 1.1)); // Eyes slightly above center
    const finalWidth = Math.min(outputSize, rotatedWidth - finalLeft);
    const finalHeight = Math.min(outputSize, rotatedHeight - finalTop);

    console.log('Final crop region:', { finalLeft, finalTop, finalWidth, finalHeight });

    const alignedImage = await sharp(rotatedImage)
      .extract({
        left: finalLeft,
        top: finalTop,
        width: finalWidth,
        height: finalHeight,
      })
      .resize(outputSize, outputSize, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: 95 })
      .toBuffer();

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
