import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface AgeProgressionPrediction {
  targetAge: number;
  confidence: number;
  facialFeatureChanges: {
    faceShape: string;
    eyeSize: string;
    noseShape: string;
    mouthShape: string;
    skinTexture: string;
  };
  growthVelocity: {
    facialLengthening: number; // percentage per year
    facialWidening: number;
    featureProminence: string[];
  };
  detailedDescription: string;
  imageGenerationPrompt: string; // For Stable Diffusion/DALL-E
}

/**
 * FRONTIER FEATURE: AI-Powered Baby Age Progression Prediction
 *
 * Uses Gemini 2.0's advanced multimodal reasoning to predict how a baby
 * will look at future ages based on current photos, facial analysis, and
 * developmental patterns.
 *
 * POST /api/predict-future-appearance
 * Body: {
 *   photoId: string,
 *   targetAges: number[], // e.g. [1, 3, 5, 10, 18, 25]
 *   includeParentalPhotos?: boolean,
 *   parentalPhotoUrls?: string[]
 * }
 *
 * Returns: Age progression predictions with image generation prompts
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      photoId,
      targetAges = [1, 3, 5, 10, 18],
      includeParentalPhotos = false,
      parentalPhotoUrls = [],
    } = req.body;

    if (!photoId) {
      return res.status(400).json({ error: 'photoId required' });
    }

    console.log(`🔮 Predicting future appearance for photo ${photoId} at ages:`, targetAges);

    // Fetch baby photo
    const { data: photo, error: fetchError } = await supabase
      .from('photos')
      .select('*')
      .eq('id', photoId)
      .single();

    if (fetchError || !photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Get baby's current estimated age from upload_date
    const uploadDate = new Date(photo.upload_date);
    const now = new Date();
    const ageInMonths = Math.floor(
      (now.getTime() - uploadDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
    );

    // Download baby photo
    const imageUrl = photo.aligned_url || photo.original_url;
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = Buffer.from(imageBuffer).toString('base64');

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
    });

    const predictions: AgeProgressionPrediction[] = [];

    for (const targetAge of targetAges) {
      const prompt = `You are an expert in pediatric facial development and age progression prediction.

CURRENT SITUATION:
- Baby is approximately ${ageInMonths} months old
- Analyzing current facial features from photo
${includeParentalPhotos ? `- Parent photos available for genetic inheritance patterns` : ''}

TASK: Predict how this baby will look at age ${targetAge} years old.

Analyze:
1. **Current Facial Structure**: Face shape, eye spacing, nose bridge, mouth proportions
2. **Developmental Patterns**: How faces change from baby → child → teen → adult
3. **Growth Velocity**: Rate of facial lengthening, widening, feature prominence
4. **Genetic Patterns**: ${includeParentalPhotos ? 'Incorporate parental features visible in provided photos' : 'Infer from baby features'}

Predict changes by age ${targetAge}:
- Face shape evolution (baby fat loss, bone structure definition)
- Eye size relative to face (babies have proportionally larger eyes)
- Nose development (bridge height, tip shape, nostril width)
- Mouth and jaw (teeth emergence, jaw definition, lip proportions)
- Skin texture changes (baby skin → child skin → teen/adult skin)
- Hair pattern and texture evolution

CRITICAL: Be scientifically accurate about developmental milestones:
- Ages 0-2: Baby fat, large eyes relative to face, soft features
- Ages 3-5: Face lengthens, baby fat reduces, features define
- Ages 6-12: Permanent teeth, jaw widens, nose bridge develops
- Ages 13-18: Puberty changes, facial bone maturation, adult proportions
- Ages 18+: Fully mature facial structure

Return ONLY valid JSON (no markdown):
{
  "targetAge": ${targetAge},
  "confidence": 0.0-1.0,
  "facialFeatureChanges": {
    "faceShape": "Detailed description of face shape evolution",
    "eyeSize": "How eye size changes relative to face",
    "noseShape": "Nose development pattern",
    "mouthShape": "Mouth and jaw changes",
    "skinTexture": "Skin texture evolution"
  },
  "growthVelocity": {
    "facialLengthening": 15.5,
    "facialWidening": 8.2,
    "featureProminence": ["cheekbones become defined", "jawline sharpens", "nose bridge raises"]
  },
  "detailedDescription": "A comprehensive 3-4 sentence description of predicted appearance",
  "imageGenerationPrompt": "Detailed prompt for Stable Diffusion/DALL-E to generate the age-progressed image, including: age, gender, facial features, expression, lighting, background. 100+ words, photorealistic style."
}

Be specific, detailed, and scientifically grounded.`;

      const images = [{ inlineData: { data: imageBase64, mimeType: 'image/jpeg' } }];

      // Add parental photos if provided
      if (includeParentalPhotos && parentalPhotoUrls.length > 0) {
        for (const parentUrl of parentalPhotoUrls.slice(0, 2)) {
          // Max 2 parent photos
          try {
            const parentResponse = await fetch(parentUrl);
            const parentBuffer = await parentResponse.arrayBuffer();
            const parentBase64 = Buffer.from(parentBuffer).toString('base64');
            images.push({
              inlineData: { data: parentBase64, mimeType: 'image/jpeg' },
            });
          } catch (error) {
            console.warn('Failed to fetch parental photo:', parentUrl);
          }
        }
      }

      const result = await model.generateContent([prompt, ...images]);

      let responseText = result.response.text();
      responseText = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const prediction: AgeProgressionPrediction = JSON.parse(responseText);

      console.log(`✅ Predicted age ${targetAge}: ${prediction.confidence.toFixed(2)} confidence`);

      predictions.push(prediction);
    }

    // Calculate overall growth trajectory
    const growthTrajectory = {
      averageConfidence: (
        predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length
      ).toFixed(2),
      keyMilestones: predictions.map((p) => ({
        age: p.targetAge,
        summary: p.detailedDescription.split('.')[0], // First sentence
      })),
      developmentalPhases: categorizeByPhase(predictions),
    };

    console.log(`🔮 Generated ${predictions.length} age progression predictions`);

    return res.status(200).json({
      success: true,
      currentAgeMonths: ageInMonths,
      predictions,
      growthTrajectory,
      instructions: {
        imageGeneration:
          'Use imageGenerationPrompt with Stable Diffusion, DALL-E 3, or Midjourney to generate visual predictions',
        videoCreation:
          'Combine age-progressed images with RIFE frame interpolation for smooth aging animation',
        integration:
          'Display as interactive timeline where parents can slide through predicted ages',
      },
    });
  } catch (error) {
    console.error('❌ Error predicting future appearance:', error);
    return res.status(500).json({
      error: 'Failed to predict future appearance',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function categorizeByPhase(predictions: AgeProgressionPrediction[]) {
  const phases = {
    infant: predictions.filter((p) => p.targetAge <= 1),
    toddler: predictions.filter((p) => p.targetAge > 1 && p.targetAge <= 3),
    child: predictions.filter((p) => p.targetAge > 3 && p.targetAge <= 12),
    teen: predictions.filter((p) => p.targetAge > 12 && p.targetAge <= 18),
    adult: predictions.filter((p) => p.targetAge > 18),
  };

  return Object.entries(phases)
    .filter(([_, preds]) => preds.length > 0)
    .map(([phase, preds]) => ({
      phase,
      ageRange: `${Math.min(...preds.map((p) => p.targetAge))}-${Math.max(...preds.map((p) => p.targetAge))} years`,
      count: preds.length,
    }));
}
