import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import {
  calculateSimilarityTransform,
  TARGET_EYE_POSITIONS,
  OUTPUT_SIZE,
} from './lib/alignment.js';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();

  try {
    const { photoId, landmarks } = req.body;

    if (!photoId || !landmarks) {
      return res.status(400).json({ error: 'Missing photoId or landmarks' });
    }

    console.log('🎯 Starting alignment v4 (Pure TypeScript/Sharp) for photo:', photoId);

    // Fetch photo from database
    const { data: photo, error: fetchError } = await supabase
      .from('photos')
      .select('*')
      .eq('id', photoId)
      .single();

    if (fetchError || !photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Download original image from Supabase Storage
    const imageUrl = photo.original_url;
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    console.log('📐 Image dimensions:', {
      detectionWidth: landmarks.imageWidth,
      detectionHeight: landmarks.imageHeight,
    });

    // CRITICAL: Scale coordinates from detection dimensions to actual dimensions
    // The database stores coordinates for 768x1024 downscaled images
    // We need to scale them to the actual image dimensions
    const metadata = await sharp(imageBuffer).metadata();
    const actualWidth = metadata.width!;
    const actualHeight = metadata.height!;

    console.log('📐 Actual image dimensions:', {
      actualWidth,
      actualHeight,
    });

    const scaleFactor = actualWidth / landmarks.imageWidth;

    console.log('📐 Scale factor:', scaleFactor.toFixed(4));

    const scaledLeftEye = {
      x: landmarks.leftEye.x * scaleFactor,
      y: landmarks.leftEye.y * scaleFactor,
    };

    const scaledRightEye = {
      x: landmarks.rightEye.x * scaleFactor,
      y: landmarks.rightEye.y * scaleFactor,
    };

    console.log('👁️  Eye coordinates:', {
      original: {
        left: landmarks.leftEye,
        right: landmarks.rightEye,
      },
      scaled: {
        left: scaledLeftEye,
        right: scaledRightEye,
      },
    });

    // Input validation (catch coordinate scaling bugs early)
    const interEyeDistance = Math.sqrt(
      Math.pow(scaledRightEye.x - scaledLeftEye.x, 2) +
        Math.pow(scaledRightEye.y - scaledLeftEye.y, 2)
    );
    const interEyePercent = (interEyeDistance / actualWidth) * 100;

    console.log('✅ Input validation:', {
      interEyeDistance: interEyeDistance.toFixed(1),
      interEyePercent: interEyePercent.toFixed(1) + '%',
      expectedRange: '10-50% of image width',
    });

    if (interEyePercent < 10 || interEyePercent > 50) {
      console.error('❌ COORDINATE SCALING BUG DETECTED');
      console.error('Inter-eye distance is outside valid range:', {
        distance: interEyeDistance.toFixed(1),
        percent: interEyePercent.toFixed(1) + '%',
        scaleFactor,
        detectionDimensions: `${landmarks.imageWidth}x${landmarks.imageHeight}`,
        actualDimensions: `${actualWidth}x${actualHeight}`,
      });

      return res.status(422).json({
        error: 'Invalid eye coordinates after scaling',
        message: 'Coordinate scaling produced invalid eye positions. This indicates a bug.',
        details: {
          interEyePercent,
          expectedRange: '10-50%',
          scaleFactor,
        },
      });
    }

    // Calculate similarity transformation matrix
    const matrix = calculateSimilarityTransform(
      [scaledLeftEye, scaledRightEye],
      [TARGET_EYE_POSITIONS.leftEye, TARGET_EYE_POSITIONS.rightEye]
    );

    console.log('🔢 Transformation matrix:', matrix);

    // Apply affine transformation
    // Sharp's affine will expand canvas - we'll get a larger image than input
    const transformedImage = sharp(imageBuffer)
      .affine(
        [matrix.a, matrix.b, matrix.d, matrix.e],
        {
          background: { r: 255, g: 255, b: 255, alpha: 1 },
          interpolator: sharp.interpolators.bicubic,
          idx: matrix.c,
          idy: matrix.f,
        }
      );

    const transformedBuffer = await transformedImage.toBuffer({ resolveWithObject: true });

    console.log('📐 Transformed image size:', {
      width: transformedBuffer.info.width,
      height: transformedBuffer.info.height,
    });

    // Now we need to extract 1080x1080 from the transformed image
    // The target eye positions (360, 432) and (720, 432) tell us where to extract from
    // Since the transformation is already applied, the eyes should already be at these positions
    // We just need to extract the OUTPUT_SIZE region centered on these coordinates

    const centerX = (TARGET_EYE_POSITIONS.leftEye.x + TARGET_EYE_POSITIONS.rightEye.x) / 2;
    const centerY = TARGET_EYE_POSITIONS.leftEye.y;

    // Calculate top-left corner for extraction
    const extractLeft = Math.max(0, Math.round(centerX - OUTPUT_SIZE.width / 2));
    const extractTop = Math.max(0, Math.round(centerY - OUTPUT_SIZE.height / 2));

    console.log('📍 Extraction parameters:', {
      centerX: centerX.toFixed(1),
      centerY: centerY.toFixed(1),
      extractLeft,
      extractTop,
      extractWidth: OUTPUT_SIZE.width,
      extractHeight: OUTPUT_SIZE.height,
    });

    // Extract the final 1080x1080 region
    let aligned: Buffer;
    try {
      aligned = await sharp(transformedBuffer.data)
        .extract({
          left: extractLeft,
          top: extractTop,
          width: OUTPUT_SIZE.width,
          height: OUTPUT_SIZE.height,
        })
        .jpeg({ quality: 95 })
        .toBuffer();
    } catch (extractError) {
      console.error('❌ Extract failed - transformed image may be too small:', extractError);
      // If extract fails, resize the whole transformed image as fallback
      console.log('⚠️ Falling back to resize');
      aligned = await sharp(transformedBuffer.data)
        .resize(OUTPUT_SIZE.width, OUTPUT_SIZE.height, {
          fit: 'cover',
          position: 'centre',
        })
        .jpeg({ quality: 95 })
        .toBuffer();
    }

    console.log('✅ Alignment complete, uploading to storage...');

    // Upload to Supabase Storage (same bucket as originals)
    const alignedFileName = `aligned/${photoId}-${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('originals')
      .upload(alignedFileName, aligned, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('originals')
      .getPublicUrl(alignedFileName);

    const alignedUrl = urlData.publicUrl;

    // Update database
    const { error: updateError } = await supabase
      .from('photos')
      .update({
        aligned_url: alignedUrl,
      })
      .eq('id', photoId);

    if (updateError) {
      throw updateError;
    }

    const processingTime = Date.now() - startTime;

    console.log('✅ Alignment complete:', {
      photoId,
      processingTime: `${processingTime}ms`,
      alignedUrl,
    });

    return res.status(200).json({
      success: true,
      alignedUrl,
      processingTime,
      debug: {
        scaleFactor,
        matrix,
        sourceEyes: { left: scaledLeftEye, right: scaledRightEye },
        targetEyes: TARGET_EYE_POSITIONS,
      },
    });
  } catch (error) {
    console.error('❌ Alignment failed:', error);
    return res.status(500).json({
      error: 'Alignment failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
