import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateIdea, scoreIdea } from './_lib/idea-engine-v2/gemini-client.js';
import { sampleDomainPair, recordDomainPairGeneration } from './_lib/idea-engine-v2/domain-sampler.js';
import { selectFrontierMode, recordModeUsage } from './_lib/idea-engine-v2/mode-selector.js';
import { generateIdeaEmbedding, storeIdeaWithDedupe } from './_lib/idea-engine-v2/deduplication.js';
import { getLatestFeedbackSummary } from './_lib/idea-engine-v2/feedback-summarizer.js';
import { supabase, isSupabaseConfigured } from './_lib/idea-engine-v2/supabase.js';

const USER_ID = process.env.IDEA_ENGINE_USER_ID;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify auth
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.IDEA_ENGINE_SECRET;
  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const action = req.query.action as string;

  // Force cache bust

  // Validate environment
  if (!USER_ID) {
    return res.status(500).json({ error: 'IDEA_ENGINE_USER_ID not configured' });
  }

  if (!isSupabaseConfigured) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  try {
    switch (action) {
      case 'generate':
        return await handleGenerate(res);
      case 'send-digest':
        return res.status(200).json({ success: true, message: 'Digest not yet implemented' });
      case 'review':
        return res.status(200).json({ success: true, message: 'Review not yet implemented' });
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (error) {
    console.error(`[idea-engine] ${action} failed:`, error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleGenerate(res: VercelResponse) {
  const startTime = Date.now();

  // 1. Create generation batch
  const { data: batch, error: batchError } = await supabase
    .from('ie_generation_batches')
    .insert({
      user_id: USER_ID,
      batch_type: 'scheduled',
      ideas_count: 0,
      prefilter_pass_count: 0,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (batchError) {
    console.error('Failed to create batch:', batchError);
    return res.status(500).json({ error: 'Failed to create generation batch', details: batchError.message });
  }

  const batchId = batch.id;

  try {
    // 2. Sample domain pair and frontier mode
    const [domainA, domainB] = await sampleDomainPair(USER_ID!);
    const mode = await selectFrontierMode(USER_ID!);

    // 3. Get feedback context for prompt injection
    const feedbackContext = await getLatestFeedbackSummary(USER_ID!) || undefined;

    // 4. Generate idea via Gemini
    const ideaResponse = await generateIdea(domainA, domainB, mode, feedbackContext);

    // 5. Generate embedding for deduplication
    const embedding = await generateIdeaEmbedding(ideaResponse);

    // 6. Fetch recent ideas for pre-filter scoring
    const { data: recentIdeas } = await supabase
      .from('ie_ideas')
      .select('title, description')
      .eq('user_id', USER_ID)
      .order('created_at', { ascending: false })
      .limit(20);

    // 7. Pre-filter score
    const preFilterScore = await scoreIdea(
      {
        title: ideaResponse.title,
        description: ideaResponse.description,
        reasoning: ideaResponse.reasoning,
        domain_pair: [domainA, domainB],
        frontier_mode: mode,
      },
      recentIdeas || []
    );

    // 8. Store with deduplication check
    const storeResult = await storeIdeaWithDedupe(
      USER_ID!,
      {
        title: ideaResponse.title,
        description: ideaResponse.description,
        reasoning: ideaResponse.reasoning,
        domain_pair: [domainA, domainB],
        frontier_mode: mode,
        generation_batch_id: batchId,
        novelty_score: preFilterScore.novelty,
        tractability_score: preFilterScore.tractability,
        cross_domain_distance: preFilterScore.cross_domain_distance,
        prefilter_score: preFilterScore.overall,
        status: 'pending',
        generation_number: 1,
      },
      embedding
    );

    // 9. Record usage stats
    await Promise.all([
      recordDomainPairGeneration(USER_ID!, domainA, domainB),
      recordModeUsage(USER_ID!, mode),
    ]);

    // 10. Update batch status
    const passCount = storeResult.success ? 1 : 0;
    await supabase
      .from('ie_generation_batches')
      .update({
        ideas_count: 1,
        prefilter_pass_count: passCount,
        prefilter_pass_rate: passCount,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', batchId);

    const elapsed = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      batch_id: batchId,
      idea: storeResult.success
        ? {
            id: storeResult.idea?.id,
            title: ideaResponse.title,
            domain_pair: [domainA, domainB],
            frontier_mode: mode,
            prefilter_score: preFilterScore.overall,
          }
        : null,
      duplicate: storeResult.duplicate || false,
      message: storeResult.success
        ? `Generated: "${ideaResponse.title}" (score: ${preFilterScore.overall.toFixed(2)})`
        : storeResult.message,
      elapsed_ms: elapsed,
    });
  } catch (error) {
    // Mark batch as failed
    await supabase
      .from('ie_generation_batches')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', batchId);

    throw error;
  }
}
// Build timestamp: Fri  3 Apr 2026 09:52:18 BST
// Updated with gemini-3.1-flash-lite-preview model
