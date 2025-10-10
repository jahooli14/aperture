import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SoundtrackSegment {
  timestamp: string;
  duration: number;
  musicPrompt: string;
  emotion: string;
  narration?: string;
}

/**
 * Generate complete timelapse soundtrack with AI narration
 *
 * POST /api/generate-timelapse-soundtrack
 * Body: {
 *   photoIds: string[],
 *   includeNarration: boolean,
 *   narratorStyle?: string
 * }
 *
 * Returns: Soundtrack plan with music prompts and optional AI-generated narration
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      photoIds,
      includeNarration = false,
      narratorStyle = 'warm parent',
      segmentDuration = 3 // seconds per photo
    } = req.body;

    if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return res.status(400).json({ error: 'photoIds array required' });
    }

    console.log(`🎬 Generating soundtrack for ${photoIds.length} photos`);

    // Fetch photos with music mood analysis
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

    // Check if photos have music mood analysis
    const needsAnalysis = photos.some(p => !p.metadata?.musicMood);

    if (needsAnalysis) {
      return res.status(400).json({
        error: 'Photos need music mood analysis first',
        message: 'Call /api/analyze-music-mood first to analyze photos'
      });
    }

    const segments: SoundtrackSegment[] = [];

    // Create music segments based on mood transitions
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const mood = photo.metadata.musicMood;

      segments.push({
        timestamp: photo.upload_date,
        duration: segmentDuration,
        musicPrompt: mood.textPrompt,
        emotion: mood.emotion,
      });
    }

    console.log(`🎵 Created ${segments.length} music segments`);

    // Generate AI narration if requested
    if (includeNarration) {
      console.log(`🎙️ Generating AI narration with ${narratorStyle} style`);

      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
      });

      // Create timeline summary for narration context
      const timelineSummary = photos.map(p => ({
        date: p.upload_date,
        emotion: p.metadata.musicMood.emotion,
        description: p.metadata.musicMood.description,
      }));

      const narrationPrompt = `You are creating a beautiful narration for a baby's photo timelapse video.

Narrator style: ${narratorStyle}

Photo timeline:
${JSON.stringify(timelineSummary, null, 2)}

Create a heartwarming narration that:
1. Introduces the baby's journey (opening 1-2 sentences)
2. Highlights 3-5 special moments from the timeline with emotional depth
3. Concludes with a touching reflection (closing 1-2 sentences)

Use emotion tags for text-to-speech:
- [gentle] for tender moments
- [cheerful] for joyful moments
- [soothing] for peaceful moments
- [excited] for playful moments

Keep total narration to 60-90 seconds when spoken.
Return ONLY valid JSON:

{
  "opening": "[gentle] Your narration opening...",
  "moments": [
    { "timestamp": "2025-01-15", "text": "[cheerful] Narration for this moment..." },
    { "timestamp": "2025-02-20", "text": "[excited] Narration for this moment..." }
  ],
  "closing": "[soothing] Your narration closing..."
}`;

      const narrationResult = await model.generateContent(narrationPrompt);
      let narrationText = narrationResult.response.text();

      // Clean up markdown
      narrationText = narrationText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      const narration = JSON.parse(narrationText);

      console.log(`✅ Generated narration with ${narration.moments.length} moments`);

      // Add narration to segments
      segments[0].narration = narration.opening;

      for (const moment of narration.moments) {
        const segment = segments.find(s => s.timestamp === moment.timestamp);
        if (segment) {
          segment.narration = moment.text;
        }
      }

      if (segments.length > 0) {
        segments[segments.length - 1].narration =
          (segments[segments.length - 1].narration || '') + ' ' + narration.closing;
      }
    }

    // Create optimized music prompts with smooth transitions
    const optimizedSegments = createSmoothTransitions(segments);

    const totalDuration = segments.length * segmentDuration;

    console.log(`✅ Soundtrack complete: ${totalDuration}s duration`);

    return res.status(200).json({
      success: true,
      soundtrack: {
        segments: optimizedSegments,
        totalDuration,
        hasNarration: includeNarration,
      },
      instructions: {
        musicGeneration: 'Use textPrompts with Suno AI, Beatoven, or similar music generation API',
        narration: includeNarration ? 'Use Gemini 2.5 TTS with emotion tags for voice generation' : null,
        mixing: 'Layer music segments with crossfade transitions. Duck music volume -6dB when narration plays.',
      },
    });

  } catch (error) {
    console.error('❌ Error generating soundtrack:', error);
    return res.status(500).json({
      error: 'Failed to generate soundtrack',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function createSmoothTransitions(segments: SoundtrackSegment[]): SoundtrackSegment[] {
  // Analyze mood changes and add transition instructions
  return segments.map((segment, i) => {
    if (i === 0) return segment;

    const prevEmotion = segments[i - 1].emotion;
    const currentEmotion = segment.emotion;

    if (prevEmotion !== currentEmotion) {
      // Add transition instruction to music prompt
      return {
        ...segment,
        musicPrompt: `[Transition from ${prevEmotion} to ${currentEmotion}] ${segment.musicPrompt}. Use 2-second crossfade with gradual tempo/mood shift.`,
      };
    }

    return segment;
  });
}
