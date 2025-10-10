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
    const { photoId, landmarks } = req.body as {
      photoId: string;
      landmarks: EyeLandmarks;
    };

    if (!photoId || !landmarks) {
      return res.status(400).json({ error: 'Missing photoId or landmarks' });
    }

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
    // Step 1: Rotate to level eyes
    const rotatedImage = await sharp(imageBuffer)
      .rotate(rotationDegrees, { background: '#ffffff' })
      .toBuffer();

    // Step 2: Get rotated image metadata
    const rotatedMetadata = await sharp(rotatedImage).metadata();

    // Step 3: Calculate new eye positions after rotation (simplified - just translate)
    // For more accurate rotation compensation, you'd apply the rotation matrix
    const newEyeMidpoint = {
      x: eyeMidpoint.x + translation.x,
      y: eyeMidpoint.y + translation.y,
    };

    // Step 4: Extract region centered on eyes and resize
    const outputSize = 1080; // Square output
    const halfSize = outputSize / 2;

    const extractLeft = Math.max(0, Math.round(newEyeMidpoint.x - halfSize));
    const extractTop = Math.max(0, Math.round(newEyeMidpoint.y - halfSize));

    const alignedImage = await sharp(rotatedImage)
      .extract({
        left: extractLeft,
        top: extractTop,
        width: Math.min(outputSize, (rotatedMetadata.width || landmarks.imageWidth) - extractLeft),
        height: Math.min(outputSize, (rotatedMetadata.height || landmarks.imageHeight) - extractTop),
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

    const { error: uploadError } = await supabase.storage
      .from('aligned')
      .upload(alignedFileName, alignedImage, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('aligned')
      .getPublicUrl(alignedFileName);

    // Update photo record with aligned URL and transform
    const { error: updateError } = await supabase
      .from('photos')
      .update({
        aligned_url: publicUrl,
        alignment_transform: transform,
      })
      .eq('id', photoId);

    if (updateError) {
      throw updateError;
    }

    return res.status(200).json({
      success: true,
      alignedUrl: publicUrl,
      transform,
    });
  } catch (error) {
    console.error('Error aligning photo:', error);
    return res.status(500).json({
      error: 'Failed to align photo',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
