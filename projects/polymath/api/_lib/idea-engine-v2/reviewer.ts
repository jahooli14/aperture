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

function getFlashGateModel() {
  return getGenAI().getGenerativeModel({ model: MODELS.FILTER });
}

export interface FlashGateVerdict {
  pass: boolean;
  reasoning: string;
  rejection_category?: RejectionCategory;
}

/**
 * Stage-1 review: cheap mid-tier Gemini Flash pass that filters obvious junk
 * so the slower, more expensive Pro reviewer only sees candidates worth its
 * time. Bias is towards PASS — Pro has the final say on borderline calls.
 */
export async function flashGateIdea(idea: Idea): Promise<FlashGateVerdict> {
  const prompt = `You are the first-pass gate in a two-stage idea review pipeline. A slower, more expensive reviewer (Gemini Pro) comes after you. Your only job is to filter out obviously bad ideas so Pro's time isn't wasted. Lean towards PASS — if it's borderline or you're uncertain, PASS it through. Pro will make the final call.

**Idea:**
Title: ${idea.title}
Description: ${idea.description}
Reasoning: ${idea.reasoning || 'N/A'}
Domain Pair: ${idea.domain_pair.join(' × ')}
Frontier Mode: ${idea.frontier_mode}

**REJECT only if clearly bad:**
- Jargon-heavy with no substance (e.g. "modular", "paradigm", "leverage", "systemic", "polymorphic", "cascading", "entropy", "robust control" used without concrete specifics)
- Too vague to act on — no clear thing you could actually *do*
- Completely not novel, well-trodden ground
- Requires years of unsolved fundamental research to even attempt
- Fundamentally flawed approach

**Otherwise PASS.**

**Respond with ONLY the JSON object below, no additional text:**
{
  "verdict": "PASS" | "REJECT",
  "reasoning": "1-2 sentences in plain language",
  "rejection_category": "poor_fit" | "not_novel" | "wrong_approach" | "too_vague" | "not_tractable" (only if REJECT)
}`;

  const result = await getFlashGateModel().generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 500,
      responseMimeType: 'application/json',
    },
  });

  const text = result.response.text();
  const startIdx = text.indexOf('{');
  const endIdx = text.lastIndexOf('}');

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    throw new Error(`Flash gate: no valid JSON braces (len: ${text.length})`);
  }

  const parsed = JSON.parse(text.substring(startIdx, endIdx + 1));

  if (!['PASS', 'REJECT'].includes(parsed.verdict)) {
    throw new Error(`Invalid flash gate verdict: ${parsed.verdict}`);
  }

  return {
    pass: parsed.verdict === 'PASS',
    reasoning: parsed.reasoning,
    rejection_category: parsed.rejection_category as RejectionCategory | undefined,
  };
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
1. **Clarity (hard gate)** - Can a smart non-specialist understand it on first read? REJECT if it leans on academic dress-up like "endogenous", "isomorphism", "stochastic", "modular", "paradigm", "leverage", "systemic", "polymorphic", "cascading", "entropy", "robust control", "autonomous" (when "runs by itself" would do), "dynamically adjust", or stacked abstract nouns. The description should also tell the reader what they could actually build, run, or test — if it doesn't, REJECT as too_vague.
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
