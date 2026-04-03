import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Idea, OpusVerdict, RejectionCategory } from './types.js';
import { MODELS } from './models.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function getGenAI() {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  return new GoogleGenerativeAI(GEMINI_API_KEY);
}

function getReviewerModel() {
  return getGenAI().getGenerativeModel({ model: MODELS.REVIEW });
}

/**
 * Review a pending idea using Gemini
 * Returns BUILD, SPARK, or REJECT verdict
 */
export async function reviewIdea(idea: Idea): Promise<OpusVerdict> {
  const prompt = `You are reviewing a research idea for an ambitious personal explorer. Be rigorous but not pedantic.

**Idea:**
Title: ${idea.title}
Description: ${idea.description}
Reasoning: ${idea.reasoning || 'N/A'}
Domain Pair: ${idea.domain_pair.join(' × ')}
Frontier Mode: ${idea.frontier_mode}
Novelty Score: ${idea.novelty_score?.toFixed(2) || 'N/A'}
Cross-Domain Distance: ${idea.cross_domain_distance?.toFixed(2) || 'N/A'}
Tractability Score: ${idea.tractability_score?.toFixed(2) || 'N/A'}

**Review Criteria:**
1. **Clarity** - Can I understand what's being proposed without a PhD? REJECT if it uses academic jargon like "modular", "paradigm", "leverage", "systemic", "polymorphic", "cascading", "entropy", "robust control" etc.
2. **Insight** - Does this reveal something genuinely new or useful?
3. **Actionable** - Could someone actually build/test this within 3-12 months?
4. **Interesting** - Would this be exciting to work on or talk about?

**Verdicts:**
- **BUILD**: Clear, insightful, tractable, and exciting. Worth dedicating serious time.
- **SPARK**: Has a kernel of something interesting but needs refinement. Save for later.
- **REJECT**: Too vague, obvious, jargon-heavy without substance, or not feasible.

**Rejection Categories** (if REJECT):
- poor_fit: Doesn't match personal interests or skills
- not_novel: Obvious or well-trodden ground
- wrong_approach: Approach is fundamentally flawed
- too_vague: Not specific enough to act on - what would you actually *do*?
- not_tractable: Requires years of work or unsolved problems

**IMPORTANT: Respond with ONLY the JSON object below, no additional text:**
{
  "verdict": "BUILD" | "SPARK" | "REJECT",
  "reasoning": "2-3 sentences explaining your decision in plain language",
  "rejection_category": "poor_fit" | "not_novel" | "wrong_approach" | "too_vague" | "not_tractable" (only if REJECT),
  "frontier_advancement_score": 0.0-1.0 (how much new ground does this break?)
}`;

  const result = await getReviewerModel().generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2000, // Increased significantly to ensure full response
      responseMimeType: 'application/json',
    },
  });

  // Debug: Check finish reason
  const candidate = result.response.candidates?.[0];
  console.log('[Reviewer] Finish reason:', candidate?.finishReason);
  console.log('[Reviewer] Safety ratings:', JSON.stringify(candidate?.safetyRatings));

  const text = result.response.text();
  console.log('[Reviewer] Full response text:', text);

  // Strip any text before first { and after last }
  const startIdx = text.indexOf('{');
  const endIdx = text.lastIndexOf('}');

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    console.error('[Reviewer] No valid braces. startIdx:', startIdx, 'endIdx:', endIdx, 'text length:', text.length);
    console.error('[Reviewer] First 500 chars:', text.substring(0, 500));
    throw new Error(`Reviewer: No valid JSON braces (start: ${startIdx}, end: ${endIdx}, len: ${text.length})`);
  }

  const jsonText = text.substring(startIdx, endIdx + 1);
  console.log('[Reviewer] Extracted JSON length:', jsonText.length);

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (parseError) {
    console.error('[Reviewer] Parse failed. JSON:', jsonText);
    throw new Error(`Reviewer JSON parse failed: ${parseError instanceof Error ? parseError.message : 'unknown'}`);
  }

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
