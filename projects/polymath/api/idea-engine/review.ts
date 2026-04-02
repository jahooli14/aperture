import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '../../../idea-engine/src/lib/supabase';
import { calculateFAS, createFrontierBlock } from '../../../idea-engine/src/lib/frontier-advancement';
import { extractAbstractPattern } from '../../../idea-engine/src/lib/gemini-client';
import { updateModeSuccessRate } from '../../../idea-engine/src/lib/mode-selector';
import type { Idea, OpusVerdict } from '../../../idea-engine/src/lib/types';

/**
 * Idea Engine Review Endpoint
 * Triggered by GitHub Actions cron 2x/week (Mon/Thu)
 *
 * Workflow:
 * 1. Fetch pending ideas
 * 2. Cluster into ~8 groups (TODO: implement clustering)
 * 3. Send to Gemini 3.1 Pro for batch review
 * 4. Parse verdicts
 * 5. Update idea statuses
 * 6. Create frontier blocks for high FAS approved ideas
 * 7. Update rejection patterns
 * 8. Record evolutionary feedback
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY not set');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const reviewModel = genAI.getGenerativeModel({ model: 'gemini-3.1-pro-preview' });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify secret token
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.IDEA_ENGINE_SECRET;

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const userId = process.env.IDEA_ENGINE_USER_ID;
    if (!userId) {
      throw new Error('IDEA_ENGINE_USER_ID not set');
    }

    console.log('🔍 Starting Opus review...');

    // Step 1: Fetch pending ideas
    const { data: pendingIdeas, error: fetchError } = await supabase
      .from('ie_ideas')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50); // Review up to 50 ideas per batch

    if (fetchError) {
      throw new Error(`Failed to fetch pending ideas: ${fetchError.message}`);
    }

    if (!pendingIdeas || pendingIdeas.length === 0) {
      console.log('No pending ideas to review');
      return res.status(200).json({
        success: true,
        ideas_reviewed: 0,
        message: 'No pending ideas',
      });
    }

    console.log(`Found ${pendingIdeas.length} pending ideas`);

    // Step 2: Build Opus prompt
    const ideasList = pendingIdeas
      .map(
        (idea, idx) =>
          `### Idea ${idx + 1}: ${idea.title}
**Domains:** ${idea.domain_pair.join(' × ')}
**Mode:** ${idea.frontier_mode}
**Description:** ${idea.description}
**Reasoning:** ${idea.reasoning || 'N/A'}
**Scores:** Novelty=${idea.novelty_score?.toFixed(2)}, Distance=${idea.cross_domain_distance?.toFixed(2)}, Tractability=${idea.tractability_score?.toFixed(2)}`
      )
      .join('\n\n');

    const prompt = `You are reviewing ideas from an evolutionary idea generation system. These ideas combine concepts from different domains using specific cognitive operations.

Your task: Assess each idea and return a verdict.

**Verdict types:**
- **BUILD**: High-value idea worth immediate exploration. Concrete, novel, tractable.
- **SPARK**: Interesting direction but needs refinement. Could inspire future work.
- **REJECT**: Not valuable enough. Too vague, not novel, poor fit, or not tractable.

**For REJECT verdicts, provide:**
- Clear reason (1-2 sentences)
- Category: poor_fit | not_novel | wrong_approach | too_vague | not_tractable

**For BUILD/SPARK verdicts:**
- Brief reasoning (1 sentence)
- Estimate frontier advancement (0-1 scale): How much does this genuinely advance the frontier?

---

${ideasList}

---

**Output format (JSON array):**
\`\`\`json
[
  {
    "idea_number": 1,
    "verdict": "BUILD" | "SPARK" | "REJECT",
    "reasoning": "...",
    "rejection_category": "poor_fit" | "not_novel" | "wrong_approach" | "too_vague" | "not_tractable" | null,
    "frontier_advancement_score": 0.85
  },
  ...
]
\`\`\`

Return ONLY the JSON array, no other text.`;

    // Step 3: Call Gemini 3.1 Pro
    console.log('🤖 Calling Gemini 3.1 Pro...');

    const result = await reviewModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4000,
      },
    });

    const responseText = result.response.text();

    // Parse JSON response
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      throw new Error('Gemini response does not contain valid JSON');
    }

    const verdicts = JSON.parse(jsonMatch[1]) as Array<{
      idea_number: number;
      verdict: 'BUILD' | 'SPARK' | 'REJECT';
      reasoning: string;
      rejection_category?: string;
      frontier_advancement_score?: number;
    }>;

    console.log(`Received ${verdicts.length} verdicts from Opus`);

    // Step 4: Process verdicts
    const approved: string[] = [];
    const rejected: string[] = [];
    const rejectionReasons: Record<string, { reason: string; category: string }> = {};

    for (let i = 0; i < verdicts.length; i++) {
      const verdict = verdicts[i];
      const idea = pendingIdeas[i] as Idea;

      if (!idea) continue;

      // Map verdict to status
      const status =
        verdict.verdict === 'BUILD' || verdict.verdict === 'SPARK'
          ? verdict.verdict === 'BUILD'
            ? 'approved'
            : 'spark'
          : 'rejected';

      // Update idea
      await supabase
        .from('ie_ideas')
        .update({
          status,
          opus_verdict: verdict.reasoning,
          rejection_reason:
            status === 'rejected' ? verdict.reasoning : null,
          rejection_category:
            status === 'rejected' ? verdict.rejection_category : null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', idea.id);

      // Track for evolutionary feedback
      if (status === 'approved' || status === 'spark') {
        approved.push(idea.id);

        // Update mode success rate
        await updateModeSuccessRate(userId, idea.frontier_mode, true);

        // Update domain pair success rate
        const [a, b] = idea.domain_pair.sort();
        await supabase.rpc('increment_domain_pair_success', {
          p_user_id: userId,
          p_domain_a: a,
          p_domain_b: b,
        }).catch(() => {
          // Fallback if function doesn't exist
          supabase
            .from('ie_domain_pairs')
            .update({
              times_approved: supabase.raw('times_approved + 1'),
              success_rate: supabase.raw(
                'CASE WHEN times_generated > 0 THEN (times_approved + 1)::float / times_generated ELSE 0 END'
              ),
            })
            .eq('user_id', userId)
            .eq('domain_a', a)
            .eq('domain_b', b);
        });

        // Calculate FAS for approved ideas
        console.log(`Calculating FAS for "${idea.title}"...`);
        const { data: frontierBlocks } = await supabase
          .from('ie_frontier_blocks')
          .select('*')
          .eq('user_id', userId);

        const fas = await calculateFAS(userId, idea, frontierBlocks || []);

        console.log(`FAS: ${fas.overall.toFixed(2)} (qualifies: ${fas.qualifies_as_frontier_block})`);

        // Create frontier block if qualifies
        if (fas.qualifies_as_frontier_block) {
          const abstractPattern = await extractAbstractPattern({
            title: idea.title,
            description: idea.description,
            reasoning: idea.reasoning || '',
          });

          await createFrontierBlock(userId, idea, fas, abstractPattern);
        }
      } else {
        rejected.push(idea.id);

        // Update mode success rate
        await updateModeSuccessRate(userId, idea.frontier_mode, false);

        // Track rejection reason
        rejectionReasons[idea.id] = {
          reason: verdict.reasoning,
          category: verdict.rejection_category || 'unknown',
        };

        // Update rejection patterns
        const [a, b] = idea.domain_pair.sort();
        await supabase.from('ie_rejection_patterns').upsert(
          {
            user_id: userId,
            pattern_type: 'domain_combo',
            pattern_signature: `${a}|${b}`,
            rejection_count: supabase.raw('COALESCE(rejection_count, 0) + 1'),
            penalty_weight: supabase.raw('COALESCE(penalty_weight, 0) + 0.1'),
            typical_reasons: supabase.raw(
              `array_append(COALESCE(typical_reasons, ARRAY[]::text[]), '${verdict.reasoning.replace(/'/g, "''")}')`
            ),
            last_rejected_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,pattern_type,pattern_signature',
          }
        );
      }
    }

    // Step 5: Record evolutionary feedback
    await supabase.from('ie_evolutionary_feedback').insert({
      user_id: userId,
      cycle_date: new Date().toISOString().split('T')[0],
      ideas_generated: pendingIdeas.length,
      approved_ids: approved,
      rejected_ids: rejected,
      rejection_reasons: rejectionReasons,
    });

    console.log(`✅ Review complete: ${approved.length} approved, ${rejected.length} rejected`);

    return res.status(200).json({
      success: true,
      ideas_reviewed: pendingIdeas.length,
      approved: approved.length,
      rejected: rejected.length,
      verdicts: verdicts.map((v) => ({
        idea_number: v.idea_number,
        verdict: v.verdict,
      })),
    });
  } catch (error) {
    console.error('❌ Review failed:', error);

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
