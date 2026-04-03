import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Idea, OpusVerdict, RejectionCategory } from './types.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function getGenAI() {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  return new GoogleGenerativeAI(GEMINI_API_KEY);
}

function getReviewerModel() {
  return getGenAI().getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });
}

/**
 * Review a pending idea using Gemini
 * Returns BUILD, SPARK, or REJECT verdict
 */
export async function reviewIdea(idea: Idea): Promise<OpusVerdict> {
  const prompt = `You are reviewing a research idea for personal exploration. Your role is to assess whether this idea is worth pursuing.

**Idea:**
Title: ${idea.title}
Description: ${idea.description}
Reasoning: ${idea.reasoning || 'N/A'}
Domain Pair: ${idea.domain_pair.join(' × ')}
Frontier Mode: ${idea.frontier_mode}
Novelty Score: ${idea.novelty_score?.toFixed(2) || 'N/A'}
Cross-Domain Distance: ${idea.cross_domain_distance?.toFixed(2) || 'N/A'}
Tractability Score: ${idea.tractability_score?.toFixed(2) || 'N/A'}

**Verdicts:**
- **BUILD**: This idea is compelling, novel, and tractable. Worth investing significant time to explore/prototype.
- **SPARK**: Interesting angle or insight, but not fully formed. Save as inspiration for future work.
- **REJECT**: Not compelling, too vague, not novel, or not tractable within reasonable timeframe.

**Rejection Categories** (if REJECT):
- poor_fit: Idea doesn't align with interests or capabilities
- not_novel: Too similar to existing work or obvious
- wrong_approach: The proposed method won't work or is flawed
- too_vague: Not specific enough to act on
- not_tractable: Would require too much time/resources or fundamental breakthroughs

**Output format (JSON only):**
\`\`\`json
{
  "verdict": "BUILD" | "SPARK" | "REJECT",
  "reasoning": "2-3 sentence explanation of your decision",
  "rejection_category": "poor_fit" | "not_novel" | "wrong_approach" | "too_vague" | "not_tractable" (only if REJECT),
  "frontier_advancement_score": 0.0-1.0 (how much does this push into new territory?)
}
\`\`\``;

  const result = await getReviewerModel().generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 300,
    },
  });

  const text = result.response.text();

  // Parse JSON from response
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
  if (!jsonMatch) {
    throw new Error('Reviewer response does not contain valid JSON block');
  }

  const parsed = JSON.parse(jsonMatch[1]);

  // Validate verdict
  if (!['BUILD', 'SPARK', 'REJECT'].includes(parsed.verdict)) {
    throw new Error(`Invalid verdict: ${parsed.verdict}`);
  }

  return {
    idea_id: idea.id,
    verdict: parsed.verdict,
    reasoning: parsed.reasoning,
    rejection_category: parsed.rejection_category as RejectionCategory | undefined,
    frontier_advancement_score: parsed.frontier_advancement_score,
  };
}
