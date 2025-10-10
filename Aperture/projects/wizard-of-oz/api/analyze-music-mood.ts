import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface MusicMood {
  emotion: 'peaceful' | 'joyful' | 'playful' | 'curious' | 'sleepy' | 'excited';
  energy: number; // 1-10
  musicStyle: string;
  instruments: string[];
  tempo: 'very-slow' | 'slow' | 'medium' | 'upbeat' | 'energetic';
  description: string;
  textPrompt: string; // For AI music generation APIs
}

interface PhotoAnalysis {
  photoId: string;
  timestamp: string;
  mood: MusicMood;
}

/**
 * Analyze baby photos to determine optimal music mood and style
 *
 * POST /api/analyze-music-mood
 * Body: { photoIds: string[] }
 *
 * Returns: Array of music mood analyses for timelapse soundtrack generation
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { photoIds } = req.body as { photoIds: string[] };

    if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return res.status(400).json({ error: 'photoIds array required' });
    }

    console.log(`🎵 Analyzing music moods for ${photoIds.length} photos`);

    // Fetch photos from database
    const { data: photos, error: fetchError } = await supabase
      .from('photos')
      .select('*')
      .in('id', photoIds)
      .order('upload_date', { ascending: true });

    if (fetchError) {
      throw fetchError;
    }

    if (!photos || photos.length === 0) {
      return res.status(404).json({ error: 'No photos found' });
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
    });

    const analyses: PhotoAnalysis[] = [];

    for (const photo of photos) {
      // Download image from Supabase Storage
      const imageUrl = photo.aligned_url || photo.original_url;
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      const imageBase64 = Buffer.from(imageBuffer).toString('base64');

      const prompt = `You are an expert at analyzing baby photos to create emotionally perfect music.

Analyze this baby photo and determine the ideal music mood for a timelapse soundtrack.

Consider:
- Baby's facial expression and emotional state
- Activity shown (sleeping, playing, eating, exploring)
- Lighting and atmosphere (bright daytime, cozy evening, soft morning)
- Overall mood and energy level

Return ONLY valid JSON with this exact structure (no markdown):
{
  "emotion": "peaceful|joyful|playful|curious|sleepy|excited",
  "energy": 1-10,
  "musicStyle": "gentle lullaby|upbeat playful|soft ambient|whimsical exploration|tender moment|joyful celebration",
  "instruments": ["piano", "strings", "guitar", "music box", "xylophone", "soft bells"],
  "tempo": "very-slow|slow|medium|upbeat|energetic",
  "description": "A 2-3 sentence description of the mood and suggested music feel",
  "textPrompt": "A detailed text prompt for AI music generation APIs (50-80 words describing instruments, mood, tempo, style)"
}

Examples:
- Sleeping baby: { emotion: "peaceful", energy: 2, musicStyle: "gentle lullaby", instruments: ["soft piano", "strings"], tempo: "very-slow", description: "...", textPrompt: "Gentle lullaby with soft piano and warm strings..." }
- Playing baby: { emotion: "joyful", energy: 7, musicStyle: "upbeat playful", instruments: ["xylophone", "light percussion"], tempo: "upbeat", description: "...", textPrompt: "Playful melody with xylophone and light percussion..." }`;

      const result = await model.generateContent([
        prompt,
        { inlineData: { data: imageBase64, mimeType: 'image/jpeg' } },
      ]);

      let responseText = result.response.text();

      // Clean up response - remove markdown code blocks if present
      responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      const mood: MusicMood = JSON.parse(responseText);

      console.log(`📊 Photo ${photo.id}: ${mood.emotion} (energy: ${mood.energy}/10, tempo: ${mood.tempo})`);

      analyses.push({
        photoId: photo.id,
        timestamp: photo.upload_date,
        mood,
      });

      // Store analysis in database for future use
      await supabase
        .from('photos')
        .update({
          metadata: {
            ...photo.metadata,
            musicMood: mood
          }
        })
        .eq('id', photo.id);
    }

    console.log(`✅ Analyzed ${analyses.length} photos for music generation`);

    return res.status(200).json({
      success: true,
      analyses,
      summary: {
        totalPhotos: analyses.length,
        averageEnergy: (analyses.reduce((sum, a) => sum + a.mood.energy, 0) / analyses.length).toFixed(1),
        dominantEmotion: getMostCommonEmotion(analyses),
      },
    });

  } catch (error) {
    console.error('❌ Error analyzing music moods:', error);
    return res.status(500).json({
      error: 'Failed to analyze music moods',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function getMostCommonEmotion(analyses: PhotoAnalysis[]): string {
  const counts = analyses.reduce((acc, a) => {
    acc[a.mood.emotion] = (acc[a.mood.emotion] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}
