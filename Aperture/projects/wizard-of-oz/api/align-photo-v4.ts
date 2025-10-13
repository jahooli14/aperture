import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

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

    console.log('🎯 Starting alignment v4 for photo:', photoId);

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

    // Create temporary files
    const tmpDir = tmpdir();
    const inputPath = join(tmpDir, `input-${photoId}.jpg`);
    const outputPath = join(tmpDir, `output-${photoId}.jpg`);

    await fs.writeFile(inputPath, imageBuffer);

    console.log('📐 Image dimensions:', {
      detectionWidth: landmarks.imageWidth,
      detectionHeight: landmarks.imageHeight,
    });

    // CRITICAL: Scale coordinates from detection dimensions to actual dimensions
    // The database stores coordinates for 768x1024 downscaled images
    // We need to scale them to the actual image dimensions
    const actualImage = await import('sharp').then(s => s.default(imageBuffer));
    const metadata = await actualImage.metadata();
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
      expectedRange: '10-35% of image width',
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

    // Call Python OpenCV script
    const pythonScript = join(process.cwd(), 'align_photo_opencv.py');

    const pythonResult = await new Promise<any>((resolve, reject) => {
      const python = spawn('python3', [
        pythonScript,
        inputPath,
        outputPath,
        scaledLeftEye.x.toFixed(1),
        scaledLeftEye.y.toFixed(1),
        scaledRightEye.x.toFixed(1),
        scaledRightEye.y.toFixed(1),
      ]);

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        if (code !== 0) {
          console.error('❌ Python script failed:', { code, stderr });
          reject(new Error(`Python script failed with code ${code}: ${stderr}`));
        } else {
          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (e) {
            console.error('❌ Failed to parse Python output:', stdout);
            reject(new Error('Failed to parse Python output'));
          }
        }
      });
    });

    if (!pythonResult.success) {
      throw new Error(pythonResult.error || 'Python alignment failed');
    }

    console.log('✅ Python alignment successful:', pythonResult);

    // Read aligned image
    const alignedBuffer = await fs.readFile(outputPath);

    // Upload to Supabase Storage
    const alignedFileName = `aligned-${photoId}-${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(alignedFileName, alignedBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('photos')
      .getPublicUrl(alignedFileName);

    const alignedUrl = urlData.publicUrl;

    // Update database
    const { error: updateError } = await supabase
      .from('photos')
      .update({
        aligned_url: alignedUrl,
        processing_status: 'completed',
        aligned_at: new Date().toISOString(),
      })
      .eq('id', photoId);

    if (updateError) {
      throw updateError;
    }

    // Clean up temp files
    await Promise.all([
      fs.unlink(inputPath).catch(() => {}),
      fs.unlink(outputPath).catch(() => {}),
    ]);

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
      debug: pythonResult,
    });
  } catch (error) {
    console.error('❌ Alignment failed:', error);
    return res.status(500).json({
      error: 'Alignment failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
