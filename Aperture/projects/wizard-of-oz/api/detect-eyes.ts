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

    const prompt = `Analyze this baby photo and detect facial landmarks with high precision.

Return JSON with this exact structure:
{
  "leftEye": {"x": pixel_x, "y": pixel_y},
  "rightEye": {"x": pixel_x, "y": pixel_y},
  "confidence": 0.0-1.0,
  "imageWidth": original_image_width,
  "imageHeight": original_image_height
}

IMPORTANT:
- The x,y coordinates should be the center of each eye's iris/pupil
- Use pixel coordinates (not normalized)
- leftEye is the baby's left eye (appears on the right side of the image when facing camera)
- rightEye is the baby's right eye (appears on the left side of the image when facing camera)
- confidence should reflect detection certainty (0.8+ is good)
- Return actual image dimensions in pixels`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: imageBase64, mimeType: 'image/jpeg' } },
    ]);

    const landmarks: EyeLandmarks = JSON.parse(result.response.text());

    // Validate confidence
    if (landmarks.confidence < 0.7) {
      return res.status(422).json({
        error: 'Low confidence eye detection',
        message: 'Please retake the photo with better lighting and ensure the face is clearly visible',
        confidence: landmarks.confidence,
      });
    }

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
