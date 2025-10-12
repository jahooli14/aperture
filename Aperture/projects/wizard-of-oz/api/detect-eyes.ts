import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { retryWithBackoff } from './lib/retry.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
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

  try {
    const { photoId } = req.body;

    if (!photoId) {
      return res.status(400).json({ error: 'Missing photoId' });
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

    // Download image from Supabase Storage
    const imageUrl = photo.original_url;
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString('base64');

    // Call Gemini API for eye detection
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const prompt = `Analyze this baby photo and detect the CENTER of each eye socket with sub-pixel precision.

CRITICAL: Eyes may be OPEN or CLOSED - detect the eye center in BOTH cases:
- If eyes are OPEN: Detect the exact center of the iris/pupil
- If eyes are CLOSED: Detect the center of the eye socket beneath the eyelid
  • Look for eyelid curvature and bulge where the eyeball is
  • Use the midpoint between inner and outer eye corners (canthus)
  • The eye center is typically at the maximum bulge point of the closed eyelid

Return JSON with this exact structure (coordinates with 1 decimal place for sub-pixel precision):
{
  "leftEye": {"x": 453.2, "y": 320.7},
  "rightEye": {"x": 244.8, "y": 340.3},
  "confidence": 0.85,
  "imageWidth": 768,
  "imageHeight": 1024,
  "eyesOpen": true
}

VALIDATION REQUIREMENTS:
- leftEye is the baby's left eye (appears on the RIGHT side of the image when baby faces camera)
- rightEye is the baby's right eye (appears on the LEFT side of the image when baby faces camera)
- Inter-eye distance MUST be 10-35% of image width (allows close-ups and wide shots)
- Use pixel coordinates (NOT normalized), with 1 decimal place precision
- confidence: 0.75+ for open eyes, 0.65+ acceptable for closed eyes
- eyesOpen: true if both eyes clearly open, false if one or both eyes closed
- Return actual image dimensions in pixels`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: imageBase64, mimeType: 'image/jpeg' } },
    ]);

    const landmarks: EyeLandmarks = JSON.parse(result.response.text());

    // Adaptive confidence threshold based on eye state
    const minConfidence = landmarks.eyesOpen === false ? 0.65 : 0.75;

    if (landmarks.confidence < minConfidence) {
      return res.status(422).json({
        error: 'Low confidence eye detection',
        message: landmarks.eyesOpen === false
          ? `Eyes appear closed - confidence too low (${landmarks.confidence.toFixed(2)}). Try better lighting or wait for eyes to open.`
          : `Eyes detected but confidence too low (${landmarks.confidence.toFixed(2)}). Ensure good lighting and face is clearly visible.`,
        confidence: landmarks.confidence,
        eyesOpen: landmarks.eyesOpen,
      });
    }

    // Validate inter-eye distance (should be 10-35% of image width)
    // Allows for both wide shots and close-up photos
    const interEyeDistance = Math.sqrt(
      Math.pow(landmarks.rightEye.x - landmarks.leftEye.x, 2) +
        Math.pow(landmarks.rightEye.y - landmarks.leftEye.y, 2)
    );
    const interEyePercent = (interEyeDistance / landmarks.imageWidth) * 100;

    if (interEyePercent < 10 || interEyePercent > 50) {
      console.error('Invalid inter-eye distance:', {
        distance: interEyeDistance,
        percent: interEyePercent,
        imageWidth: landmarks.imageWidth,
      });
      return res.status(422).json({
        error: 'Invalid eye detection',
        message: `Eyes detected too ${interEyePercent < 10 ? 'close' : 'far'} apart (${interEyePercent.toFixed(1)}% of image width). Expected 10-50%. Please ensure the photo shows the baby's face clearly.`,
        interEyePercent,
      });
    }

    console.log('Eye detection successful:', {
      confidence: landmarks.confidence,
      eyesOpen: landmarks.eyesOpen,
      interEyeDistance: interEyeDistance.toFixed(1),
      interEyePercent: interEyePercent.toFixed(1) + '%',
    });

    // Update photo with eye coordinates
    const { error: updateError } = await supabase
      .from('photos')
      .update({ eye_coordinates: landmarks })
      .eq('id', photoId);

    if (updateError) {
      throw updateError;
    }

    // Trigger alignment processing
    // Construct base URL with proper fallbacks
    let baseUrl: string;
    if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else if (process.env.VERCEL_BRANCH_URL) {
      baseUrl = `https://${process.env.VERCEL_BRANCH_URL}`;
    } else {
      // Local development fallback
      baseUrl = 'http://localhost:5175';
    }

    // Prepare headers with Deployment Protection bypass
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'DetectEyesFunction/1.0',
    };

    // Add Vercel Deployment Protection bypass if available
    if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
      headers['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
      headers['x-vercel-set-bypass-cookie'] = 'samesitenone';
    }

    console.log('Calling align-photo API:', {
      baseUrl,
      photoId,
      hasProtectionBypass: !!process.env.VERCEL_AUTOMATION_BYPASS_SECRET
    });

    // Set timeout to avoid hanging requests (55s to allow for Sharp processing)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    try {
      // Retry align-photo call with exponential backoff (up to 3 attempts)
      await retryWithBackoff(
        async () => {
          const alignResponse = await fetch(`${baseUrl}/api/align-photo-v3`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ photoId, landmarks }),
            signal: controller.signal,
          });

          const responseText = await alignResponse.text();

          console.log('Align-photo response:', {
            status: alignResponse.status,
            ok: alignResponse.ok,
            bodyLength: responseText.length,
            bodyPreview: responseText.substring(0, 200),
          });

          if (!alignResponse.ok) {
            // Detect specific error types
            if (alignResponse.status === 401 || alignResponse.status === 403) {
              console.error('❌ Authentication failed - Deployment Protection may be blocking. Add VERCEL_AUTOMATION_BYPASS_SECRET environment variable.');
              // Don't retry auth errors
              throw new Error(`Authentication failed (${alignResponse.status}) - no retry`);
            } else if (alignResponse.status === 404) {
              console.error('❌ Align-photo endpoint not found - check deployment');
              // Don't retry 404s
              throw new Error('Endpoint not found (404) - no retry');
            } else if (alignResponse.status === 500) {
              console.error('❌ Align-photo internal error:', responseText.substring(0, 500));
              // Retry 500 errors
              throw new Error(`Server error (500) - will retry`);
            }
          } else {
            console.log('✅ Alignment triggered successfully');
          }

          return alignResponse;
        },
        {
          retries: 3,
          baseDelay: 2000,     // Start with 2s delay
          maxDelay: 10000,     // Max 10s delay
          factor: 2,           // Double each time
          jitter: true,        // Add randomization
          shouldRetry: (error) => {
            // Only retry if message contains "will retry"
            return error.message.includes('will retry');
          },
          onRetry: (error, attempt, delay) => {
            console.log(`🔄 Retrying align-photo (attempt ${attempt}/3) after ${delay}ms due to: ${error.message}`);
          },
        }
      );
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('❌ Align-photo request timed out after 55s');
      } else {
        console.error('❌ Align-photo request failed after retries:', error);
      }
      // Don't throw - eye detection still succeeded
    } finally {
      clearTimeout(timeout);
    }

    return res.status(200).json({ success: true, landmarks });
  } catch (error) {
    console.error('Error detecting eyes:', error);
    return res.status(500).json({
      error: 'Failed to detect eyes',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
