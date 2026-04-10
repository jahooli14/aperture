import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateIdea, scoreIdea } from './_lib/idea-engine-v2/gemini-client.js';
import { sampleDomainPair, recordDomainPairGeneration } from './_lib/idea-engine-v2/domain-sampler.js';
import { selectFrontierMode, recordModeUsage } from './_lib/idea-engine-v2/mode-selector.js';
import { generateIdeaEmbedding, storeIdeaWithDedupe } from './_lib/idea-engine-v2/deduplication.js';
import { getLatestFeedbackSummary } from './_lib/idea-engine-v2/feedback-summarizer.js';
import { supabase, isSupabaseConfigured } from './_lib/idea-engine-v2/supabase.js';
import { reviewIdea, flashGateIdea } from './_lib/idea-engine-v2/reviewer.js';
import { sendDailyDigest } from './_lib/idea-engine-v2/digest-email.js';
import type { Idea } from './_lib/idea-engine-v2/types.js';

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
        return await handleSendDigest(res);
      case 'review':
        return await handleReview(res);
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
        prefilter_pass_rate: passCount === 1 ? 100 : 0,
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

async function handleReview(res: VercelResponse) {
  const startTime = Date.now();

  const { data: pendingIdeas, error } = await supabase
    .from('ie_ideas')
    .select('*')
    .eq('user_id', USER_ID)
    .eq('status', 'pending')
    .order('prefilter_score', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Failed to fetch pending ideas:', error);
    return res.status(500).json({ error: 'Failed to fetch pending ideas', details: error.message });
  }

  if (!pendingIdeas || pendingIdeas.length === 0) {
    return res.status(200).json({ success: true, message: 'No pending ideas to review', reviewed: 0 });
  }

  // Stage-gated review pipeline, all ideas in parallel:
  //   Stage 1 — Flash gate (mid-tier, cheap, fast): filters obvious junk.
  //   Stage 2 — Pro review (slow, expensive): final verdict on survivors.
  // Each idea runs its own Flash→Pro pipeline; all 10 pipelines run
  // concurrently so wall-clock ≈ single pipeline and we stay under the 60s
  // Vercel budget. Flash-rejected ideas skip Pro entirely, saving cost. If
  // Flash errors, we fall through to Pro rather than silently lose the idea.
  const results = await Promise.all(
    pendingIdeas.map(async (idea) => {
      const typedIdea = idea as Idea;

      // Stage 1: Flash gate
      try {
        const gate = await flashGateIdea(typedIdea);
        if (!gate.pass) {
          const { error: updateError } = await supabase
            .from('ie_ideas')
            .update({
              status: 'rejected',
              opus_verdict: gate.reasoning,
              rejection_reason: gate.reasoning,
              rejection_category: gate.rejection_category || 'too_vague',
              reviewed_at: new Date().toISOString(),
            })
            .eq('id', typedIdea.id);

          if (updateError) {
            console.error(`Failed to update flash-rejected idea ${typedIdea.id}:`, updateError);
            return { id: typedIdea.id, success: false, stage: 'flash' as const, error: updateError.message };
          }
          return { id: typedIdea.id, success: true, stage: 'flash' as const, verdict: 'REJECT' as const, title: typedIdea.title };
        }
      } catch (error) {
        console.error(`Flash gate failed for ${typedIdea.id}, falling through to Pro:`, error);
        // Deliberate fall-through: don't lose an idea due to a transient Flash error.
      }

      // Stage 2: Pro review (Flash passed or errored)
      try {
        const verdict = await reviewIdea(typedIdea);

        const updateData: any = {
          status: verdict.verdict === 'BUILD' ? 'approved' : verdict.verdict === 'SPARK' ? 'spark' : 'rejected',
          opus_verdict: verdict.reasoning,
          reviewed_at: new Date().toISOString(),
        };

        if (verdict.rejection_category) {
          updateData.rejection_reason = verdict.reasoning;
          updateData.rejection_category = verdict.rejection_category;
        }

        const { error: updateError } = await supabase
          .from('ie_ideas')
          .update(updateData)
          .eq('id', typedIdea.id);

        if (updateError) {
          console.error(`Failed to update idea ${typedIdea.id}:`, updateError);
          return { id: typedIdea.id, success: false, stage: 'pro' as const, error: updateError.message };
        }

        return { id: typedIdea.id, success: true, stage: 'pro' as const, verdict: verdict.verdict, title: typedIdea.title };
      } catch (error) {
        console.error(`Failed to review idea ${typedIdea.id}:`, error);
        return { id: typedIdea.id, success: false, stage: 'pro' as const, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    })
  );

  const elapsed = Date.now() - startTime;
  const successCount = results.filter((r) => r.success).length;
  const flashRejected = results.filter((r) => r.stage === 'flash' && r.success).length;
  const proReviewed = results.filter((r) => r.stage === 'pro').length;

  return res.status(200).json({
    success: true,
    reviewed: successCount,
    total: results.length,
    flash_rejected: flashRejected,
    pro_reviewed: proReviewed,
    results,
    elapsed_ms: elapsed,
  });
}

async function handleSendDigest(res: VercelResponse) {
  const startTime = Date.now();

  // Fetch approved ideas that haven't been sent in a digest yet
  // We look for ideas approved today that don't have digest_sent_at set
  const today = new Date().toISOString().split('T')[0];
  const { data: approvedIdeas, error } = await supabase
    .from('ie_ideas')
    .select('*')
    .eq('user_id', USER_ID)
    .eq('status', 'approved')
    .gte('reviewed_at', today)
    .is('digest_sent_at', null)
    .order('prefilter_score', { ascending: false });

  if (error) {
    console.error('Failed to fetch approved ideas:', error);
    return res.status(500).json({ error: 'Failed to fetch approved ideas', details: error.message });
  }

  try {
    const result = await sendDailyDigest(USER_ID!, approvedIdeas as Idea[]);

    // Mark ideas as sent in digest
    if (approvedIdeas && approvedIdeas.length > 0) {
      const ideaIds = approvedIdeas.map(i => i.id);
      await supabase
        .from('ie_ideas')
        .update({ digest_sent_at: new Date().toISOString() })
        .in('id', ideaIds);
    }

    const elapsed = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      ideas_count: approvedIdeas?.length || 0,
      message: result.message || 'Digest sent successfully',
      elapsed_ms: elapsed,
    });
  } catch (error) {
    console.error('Failed to send digest:', error);
    return res.status(500).json({
      error: 'Failed to send digest',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
// Build timestamp: Fri  3 Apr 2026 10:28:15 BST
// Complete implementation with review and digest endpoints
