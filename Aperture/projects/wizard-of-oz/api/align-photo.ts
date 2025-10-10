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

    // Calculate how much space we need around the eyes
    // For a face photo, typically the face is about 4-6x the inter-eye distance
    const interEyeDistance = Math.sqrt(
      Math.pow(landmarks.rightEye.x - landmarks.leftEye.x, 2) +
        Math.pow(landmarks.rightEye.y - landmarks.leftEye.y, 2)
    );

    // Calculate scale for transform record
    const targetInterEyeDistance = landmarks.imageWidth * 0.25;
    const scale = targetInterEyeDistance / interEyeDistance;

    // Calculate translation for transform record
    const targetPosition = {
      x: landmarks.imageWidth * 0.5,
      y: landmarks.imageHeight * 0.4,
    };
    const translation = {
      x: targetPosition.x - eyeMidpoint.x,
      y: targetPosition.y - eyeMidpoint.y,
    };

    // Create alignment transform record
    const transform: AlignmentTransform = {
      translateX: translation.x,
      translateY: translation.y,
      rotation: rotationDegrees,
      scale,
    };

    console.log('Inter-eye distance:', interEyeDistance);

    // Simple approach: Extract a square region centered on the eyes
    // Make it 6x the inter-eye distance to ensure we get the full face
    const cropSize = Math.max(outputSize, Math.round(interEyeDistance * 6));
    const halfCrop = cropSize / 2;

    // Calculate crop bounds - centered on eye midpoint
    const cropLeft = Math.max(0, Math.round(eyeMidpoint.x - halfCrop));
    const cropTop = Math.max(0, Math.round(eyeMidpoint.y - halfCrop));

    // Ensure we don't go past image boundaries
    const cropWidth = Math.min(cropSize, landmarks.imageWidth - cropLeft);
    const cropHeight = Math.min(cropSize, landmarks.imageHeight - cropTop);

    console.log('Crop region:', { cropLeft, cropTop, cropWidth, cropHeight });

    // Step 1: Crop to region around face
    let processedImage = await sharp(imageBuffer)
      .extract({
        left: cropLeft,
        top: cropTop,
        width: cropWidth,
        height: cropHeight,
      })
      .toBuffer();

    console.log('After crop, image size:', (await sharp(processedImage).metadata()).width, 'x', (await sharp(processedImage).metadata()).height);

    // Step 2: Rotate if needed (Sharp rotates around center by default)
    if (Math.abs(rotationDegrees) > 0.5) {
      console.log('Rotating by', rotationDegrees, 'degrees');
      processedImage = await sharp(processedImage)
        .rotate(rotationDegrees, { background: '#ffffff' })
        .toBuffer();

      console.log('After rotation, image size:', (await sharp(processedImage).metadata()).width, 'x', (await sharp(processedImage).metadata()).height);
    }

    // Step 3: Resize to final output size
    // Since we cropped centered on the eyes, they should already be in the right position
    const alignedImage = await sharp(processedImage)
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
