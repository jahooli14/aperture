import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

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

    if (interEyePercent < 10 || interEyePercent > 35) {
      console.error('Invalid inter-eye distance:', {
        distance: interEyeDistance,
        percent: interEyePercent,
        imageWidth: landmarks.imageWidth,
      });
      return res.status(422).json({
        error: 'Invalid eye detection',
        message: `Eyes detected too ${interEyePercent < 10 ? 'close' : 'far'} apart (${interEyePercent.toFixed(1)}% of image width). Expected 10-35%. Please ensure the photo shows the baby's face clearly.`,
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
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : (req.headers.origin as string);

    console.log('Calling align-photo API:', { baseUrl, photoId });

    const alignResponse = await fetch(`${baseUrl}/api/align-photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId, landmarks }),
    });

    console.log('Align-photo response:', {
      status: alignResponse.status,
      ok: alignResponse.ok
    });

    if (!alignResponse.ok) {
      const errorText = await alignResponse.text();
      console.error('Align-photo failed:', errorText);
      // Don't throw - we still want to return success for eye detection
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
