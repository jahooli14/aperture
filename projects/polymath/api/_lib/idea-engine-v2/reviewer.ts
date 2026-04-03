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
  return getGenAI().getGenerativeModel({ model: 'gemini-3.1-pro-preview' }); // High quality reviews
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
1. **Clarity** - Can I understand what's being proposed without a PhD?
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

**Output format (JSON only):**
\`\`\`json
{
  "verdict": "BUILD" | "SPARK" | "REJECT",
  "reasoning": "2-3 sentences explaining your decision in plain language",
  "rejection_category": "poor_fit" | "not_novel" | "wrong_approach" | "too_vague" | "not_tractable" (only if REJECT),
  "frontier_advancement_score": 0.0-1.0 (how much new ground does this break?)
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
