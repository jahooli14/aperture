import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  TARGET_EYE_POSITIONS,
  OUTPUT_SIZE,
} from './lib/alignment.js';

const execAsync = promisify(exec);

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

    // Use Python OpenCV for alignment (proven working solution)
    // This is the correct approach - OpenCV's warpAffine handles affine
    // transformation + output sizing correctly
    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `input-${photoId}.jpg`);
    const outputPath = path.join(tmpDir, `output-${photoId}.jpg`);

    try {
      // Write input image to temp file
      await writeFile(inputPath, imageBuffer);

      // Call Python OpenCV script
      const scriptPath = path.join(process.cwd(), 'tools', 'align_photo_opencv.py');
      const command = `python3 ${scriptPath} ${inputPath} ${outputPath} ${scaledLeftEye.x} ${scaledLeftEye.y} ${scaledRightEye.x} ${scaledRightEye.y}`;

      console.log('🐍 Calling Python OpenCV script:', {
        script: scriptPath,
        leftEye: scaledLeftEye,
        rightEye: scaledRightEye,
      });

      const { stdout, stderr } = await execAsync(command, { timeout: 30000 });

      if (stderr) {
        console.warn('Python stderr:', stderr);
      }

      // Parse Python output
      const result = JSON.parse(stdout);
      console.log('✅ Python OpenCV result:', result);

      if (!result.success) {
        throw new Error(`Python alignment failed: ${result.error}`);
      }

      // Read aligned image
      const aligned = await sharp(outputPath).toBuffer();

      // Clean up temp files
      await unlink(inputPath).catch(() => {});
      await unlink(outputPath).catch(() => {});

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
          sourceEyes: { left: scaledLeftEye, right: scaledRightEye },
          targetEyes: TARGET_EYE_POSITIONS,
        },
      });
    } catch (pythonError) {
      // Clean up temp files on error
      await unlink(inputPath).catch(() => {});
      await unlink(outputPath).catch(() => {});
      throw pythonError;
    }
  } catch (error) {
    console.error('❌ Alignment failed:', error);
    return res.status(500).json({
      error: 'Alignment failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
