import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface GrowthMeasurement {
  date: string;
  facialLength: number; // pixels, normalized
  facialWidth: number;
  eyeSpacing: number;
  headCircumference: number; // estimated
  confidence: number;
}

interface MilestonePrediction {
  milestone: string;
  predictedDate: string;
  confidence: number;
  reasoning: string;
  visualIndicators: string[];
}

interface GrowthVelocityAnalysis {
  measurements: GrowthMeasurement[];
  growthRate: {
    facialLengthPerMonth: number;
    facialWidthPerMonth: number;
    percentileEstimate: string; // "50th percentile", "75th percentile"
  };
  milestonePredictions: MilestonePrediction[];
  developmentalInsights: string[];
  nextExpectedChanges: string[];
}

/**
 * EXTREME FRONTIER: Growth Velocity Analysis & Milestone Prediction
 *
 * Analyzes photo sequence to:
 * 1. Measure facial growth velocity over time
 * 2. Predict future developmental milestones
 * 3. Compare to population growth curves
 * 4. Forecast when visual changes will occur
 *
 * POST /api/analyze-growth-velocity
 * Body: { userId: string, startDate?: string, endDate?: string }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, startDate, endDate } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    console.log(`📈 Analyzing growth velocity for user ${userId}`);

    // Fetch all photos with eye coordinates (for measurements)
    let query = supabase
      .from('photos')
      .select('*')
      .eq('user_id', userId)
      .not('eye_coordinates', 'is', null)
      .not('aligned_url', 'is', null)
      .order('upload_date', { ascending: true });

    if (startDate) {
      query = query.gte('upload_date', startDate);
    }
    if (endDate) {
      query = query.lte('upload_date', endDate);
    }

    const { data: photos, error: fetchError } = await query;

    if (fetchError) {
      throw fetchError;
    }

    if (!photos || photos.length < 2) {
      return res.status(400).json({
        error: 'Insufficient data',
        message: 'Need at least 2 photos with eye detection for growth analysis',
      });
    }

    console.log(`Found ${photos.length} photos for analysis`);

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
    });

    // Extract measurements from each photo
    const measurements: GrowthMeasurement[] = [];

    for (const photo of photos) {
      const eyeCoords = photo.eye_coordinates;

      // Calculate facial metrics
      const interEyeDistance = Math.sqrt(
        Math.pow(eyeCoords.rightEye.x - eyeCoords.leftEye.x, 2) +
          Math.pow(eyeCoords.rightEye.y - eyeCoords.leftEye.y, 2)
      );

      // Normalize measurements (inter-eye distance as reference)
      const facialLength = eyeCoords.imageHeight / interEyeDistance;
      const facialWidth = eyeCoords.imageWidth / interEyeDistance;
      const headCircumference = Math.PI * ((facialWidth + facialLength) / 2); // Rough estimate

      measurements.push({
        date: photo.upload_date,
        facialLength: Math.round(facialLength * 100) / 100,
        facialWidth: Math.round(facialWidth * 100) / 100,
        eyeSpacing: Math.round(interEyeDistance * 100) / 100,
        headCircumference: Math.round(headCircumference * 100) / 100,
        confidence: eyeCoords.confidence,
      });
    }

    // Calculate growth velocities
    const firstMeasurement = measurements[0];
    const lastMeasurement = measurements[measurements.length - 1];
    const timeSpanDays =
      (new Date(lastMeasurement.date).getTime() - new Date(firstMeasurement.date).getTime()) /
      (1000 * 60 * 60 * 24);
    const timeSpanMonths = timeSpanDays / 30;

    const facialLengthChange = lastMeasurement.facialLength - firstMeasurement.facialLength;
    const facialWidthChange = lastMeasurement.facialWidth - firstMeasurement.facialWidth;

    const growthRate = {
      facialLengthPerMonth: Math.round((facialLengthChange / timeSpanMonths) * 1000) / 1000,
      facialWidthPerMonth: Math.round((facialWidthChange / timeSpanMonths) * 1000) / 1000,
      percentileEstimate: estimatePercentile(facialLengthChange, timeSpanMonths),
    };

    console.log(`📊 Growth rate: ${growthRate.facialLengthPerMonth} length/month, ${growthRate.facialWidthPerMonth} width/month`);

    // Use Gemini to predict milestones based on growth pattern
    const milestonePrompt = `You are a pediatric development expert analyzing baby facial growth patterns.

GROWTH DATA:
- Time period: ${timeSpanMonths.toFixed(1)} months
- Facial length change: ${facialLengthChange.toFixed(2)} (normalized units)
- Facial width change: ${facialWidthChange.toFixed(2)} (normalized units)
- Growth rate: ${growthRate.facialLengthPerMonth}/month length, ${growthRate.facialWidthPerMonth}/month width
- Estimated growth percentile: ${growthRate.percentileEstimate}

MEASUREMENTS OVER TIME:
${JSON.stringify(measurements.slice(0, 10), null, 2)}

Based on this growth velocity pattern, predict:
1. **Future Visual Milestones**: When will noticeable facial changes occur?
   - First tooth emergence (visible in photos)
   - Baby fat loss/face lengthening
   - Nose bridge development
   - Jaw definition

2. **Growth Trajectory**: Is this growth pattern typical, accelerated, or slower?

3. **Next Expected Changes**: What visual changes should parents expect in next 1-3 months?

Return ONLY valid JSON (no markdown):
{
  "milestonePredictions": [
    {
      "milestone": "First visible tooth",
      "predictedDate": "2025-06-15",
      "confidence": 0.75,
      "reasoning": "Based on current age and facial development rate...",
      "visualIndicators": ["Smile will show emerging bottom teeth", "Gum line changes visible"]
    }
  ],
  "developmentalInsights": [
    "Growth velocity indicates healthy development at 60th percentile",
    "Facial lengthening pattern suggests upcoming baby fat reduction phase"
  ],
  "nextExpectedChanges": [
    "Within 1 month: Slight nose bridge elevation",
    "Within 2 months: Jaw definition beginning to appear",
    "Within 3 months: Face will appear 5-10% longer relative to width"
  ]
}

Predict 3-5 milestones, provide detailed reasoning.`;

    const milestoneResult = await model.generateContent(milestonePrompt);
    let milestoneText = milestoneResult.response.text();
    milestoneText = milestoneText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const milestoneData = JSON.parse(milestoneText);

    const analysis: GrowthVelocityAnalysis = {
      measurements,
      growthRate,
      milestonePredictions: milestoneData.milestonePredictions,
      developmentalInsights: milestoneData.developmentalInsights,
      nextExpectedChanges: milestoneData.nextExpectedChanges,
    };

    console.log(`✅ Predicted ${analysis.milestonePredictions.length} future milestones`);

    // Store analysis in database for future reference
    await supabase.from('growth_analyses').insert({
      user_id: userId,
      analysis_date: new Date().toISOString(),
      time_span_months: timeSpanMonths,
      growth_rate: growthRate,
      milestone_predictions: analysis.milestonePredictions,
      photo_count: photos.length,
    });

    return res.status(200).json({
      success: true,
      analysis,
      metadata: {
        photoCount: photos.length,
        timeSpanDays: Math.round(timeSpanDays),
        timeSpanMonths: Math.round(timeSpanMonths * 10) / 10,
        measurementQuality: 'high', // All photos had eye detection
      },
      visualization: {
        chartData: measurements.map((m) => ({
          date: m.date,
          facialLength: m.facialLength,
          facialWidth: m.facialWidth,
        })),
        trendline: calculateTrendline(measurements),
      },
    });
  } catch (error) {
    console.error('❌ Error analyzing growth velocity:', error);
    return res.status(500).json({
      error: 'Failed to analyze growth velocity',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function estimatePercentile(change: number, months: number): string {
  const ratePerMonth = change / months;

  // Rough percentile estimation based on typical baby facial growth
  // This is simplified - real percentiles require population data
  if (ratePerMonth < 0.05) return '25th percentile (slower growth)';
  if (ratePerMonth < 0.1) return '50th percentile (average growth)';
  if (ratePerMonth < 0.15) return '75th percentile (faster growth)';
  return '90th percentile (very rapid growth)';
}

function calculateTrendline(measurements: GrowthMeasurement[]) {
  // Simple linear regression for trendline
  const n = measurements.length;
  const x = measurements.map((_, i) => i); // Time index
  const y = measurements.map((m) => m.facialLength);

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return {
    slope: Math.round(slope * 1000) / 1000,
    intercept: Math.round(intercept * 1000) / 1000,
    equation: `y = ${slope.toFixed(3)}x + ${intercept.toFixed(3)}`,
  };
}
