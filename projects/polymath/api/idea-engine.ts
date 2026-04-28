import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  generateIdea,
  generateIdeaFromBlock,
  scoreIdea,
  extractAbstractPattern,
} from './_lib/idea-engine-v2/gemini-client.js';
import { sampleDomainPair, recordDomainPairGeneration } from './_lib/idea-engine-v2/domain-sampler.js';
import { selectFrontierMode, recordModeUsage } from './_lib/idea-engine-v2/mode-selector.js';
import { generateIdeaEmbedding, storeIdeaWithDedupe } from './_lib/idea-engine-v2/deduplication.js';
import { getLatestFeedbackSummary } from './_lib/idea-engine-v2/feedback-summarizer.js';
import { supabase, isSupabaseConfigured } from './_lib/idea-engine-v2/supabase.js';
import { reviewIdea, flashGateIdea } from './_lib/idea-engine-v2/reviewer.js';
import { sendDailyDigest } from './_lib/idea-engine-v2/digest-email.js';
import {
  sampleActiveBlock,
  getTopActiveBlocks,
  pickMutation,
  mutateDomains,
  markBlockSpawned,
  updateBlockLifecycle,
  sweepDormantBlocks,
  formatFrontierGravity,
} from './_lib/idea-engine-v2/block-sampler.js';
import {
  calculateFAS,
  createFrontierBlock,
  HIGH_SIGNAL_THRESHOLD,
} from './_lib/idea-engine-v2/frontier-advancement.js';
import type { Idea } from './_lib/idea-engine-v2/types.js';

// Probability that a generation run spawns from an existing frontier block
// (rather than drawing a fresh domain pair). Only takes effect when active
// blocks exist.
const SPAWN_PROBABILITY = 0.4;

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

  // Decide up-front whether this run spawns from a frontier block or draws
  // fresh. Done before the batch insert so the batch is tagged correctly.
  const parentBlock =
    Math.random() < SPAWN_PROBABILITY
      ? await sampleActiveBlock(USER_ID!)
      : null;
  const isSpawn = parentBlock !== null;

  const { data: batch, error: batchError } = await supabase
    .from('ie_generation_batches')
    .insert({
      user_id: USER_ID,
      batch_type: isSpawn ? 'spawn' : 'scheduled',
      ideas_count: 0,
      prefilter_pass_count: 0,
      status: 'running',
      started_at: new Date().toISOString(),
      config: isSpawn
        ? { parent_block_id: parentBlock!.id, parent_concept: parentBlock!.concept_name }
        : undefined,
    })
    .select()
    .single();

  if (batchError) {
    console.error('Failed to create batch:', batchError);
    return res.status(500).json({ error: 'Failed to create generation batch', details: batchError.message });
  }

  const batchId = batch.id;

  try {
    const feedbackContext = (await getLatestFeedbackSummary(USER_ID!)) || undefined;

    let domainA: string;
    let domainB: string;
    let mode: Idea['frontier_mode'];
    let ideaResponse: Awaited<ReturnType<typeof generateIdea>>;
    let parentIdeaId: string | undefined;
    let sourceBlockId: string | undefined;
    let generationNumber = 1;
    let mutationLabel: string | undefined;

    if (isSpawn && parentBlock) {
      // Spawn path: mutate a proven frontier block.
      const mutation = pickMutation();
      mutationLabel = mutation;
      [domainA, domainB] = mutateDomains(parentBlock.domain_pair, mutation);
      // Inversion always runs in 'inversion' mode; other mutations inherit
      // the parent's cognitive operation so the lineage stays coherent.
      mode = mutation === 'inversion' ? 'inversion' : parentBlock.frontier_mode;
      parentIdeaId = parentBlock.source_idea_id;
      sourceBlockId = parentBlock.id;
      generationNumber = (parentBlock.generation || 0) + 1;

      ideaResponse = await generateIdeaFromBlock(
        parentBlock,
        mutation,
        domainA,
        domainB,
        feedbackContext
      );

      await markBlockSpawned(USER_ID!, parentBlock.id);
    } else {
      // Fresh path: sample domain + mode, but bias toward extending the
      // current frontier via top-block context.
      [domainA, domainB] = await sampleDomainPair(USER_ID!);
      mode = await selectFrontierMode(USER_ID!);
      const topBlocks = await getTopActiveBlocks(USER_ID!, 3);
      const frontierGravity = formatFrontierGravity(topBlocks) || undefined;

      ideaResponse = await generateIdea(
        domainA,
        domainB,
        mode,
        feedbackContext,
        frontierGravity
      );
    }

    const embedding = await generateIdeaEmbedding(ideaResponse);

    const { data: recentIdeas } = await supabase
      .from('ie_ideas')
      .select('title, description')
      .eq('user_id', USER_ID)
      .order('created_at', { ascending: false })
      .limit(20);

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
        generation_number: generationNumber,
        parent_idea_id: parentIdeaId,
        source_frontier_block_id: sourceBlockId,
      },
      embedding
    );

    await Promise.all([
      recordDomainPairGeneration(USER_ID!, domainA, domainB),
      recordModeUsage(USER_ID!, mode),
    ]);

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
      mode: isSpawn ? 'spawn' : 'fresh',
      parent_block: isSpawn
        ? { id: sourceBlockId, concept: parentBlock!.concept_name, mutation: mutationLabel }
        : undefined,
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
        ? `${isSpawn ? `Spawned (${mutationLabel})` : 'Generated'}: "${ideaResponse.title}" (score: ${preFilterScore.overall.toFixed(2)})`
        : storeResult.message,
      elapsed_ms: elapsed,
    });
  } catch (error) {
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

/**
 * Promote an approved idea to a frontier block. Every BUILD becomes a block —
 * the sampler weights by FAS, so low-FAS blocks fade naturally without us
 * having to delete them. Returns null only on extraction or DB failure.
 */
async function maybePromoteToFrontierBlock(idea: Idea): Promise<string | null> {
  try {
    const fas = await calculateFAS(USER_ID!, idea, []);

    // Extract a domain-agnostic pattern so domain_shift mutations have
    // something portable to apply to a new pair.
    let pattern: string | undefined;
    try {
      pattern = await extractAbstractPattern({
        title: idea.title,
        description: idea.description,
        reasoning: idea.reasoning ?? '',
      });
    } catch (err) {
      console.error(`[promote] extractAbstractPattern failed for ${idea.id}:`, err);
    }

    const block = await createFrontierBlock(USER_ID!, idea, fas, pattern);
    return block?.id || null;
  } catch (err) {
    console.error(`[promote] FAS/block creation failed for ${idea.id}:`, err);
    return null;
  }
}

async function handleReview(res: VercelResponse) {
  const startTime = Date.now();

  // Retire stale blocks once per cycle so the sampler's weighted pool reflects
  // the live frontier. Cheap; one DB read + one conditional update per user.
  await sweepDormantBlocks(USER_ID!).catch((err) =>
    console.error('[review] sweepDormantBlocks failed:', err)
  );

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

          // Flash rejection still counts as a failed spawn against the parent
          // block's success rate — otherwise exhausted blocks never retire.
          if (typedIdea.source_frontier_block_id) {
            await updateBlockLifecycle(
              USER_ID!,
              typedIdea.source_frontier_block_id,
              false
            );
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

        const approved = verdict.verdict === 'BUILD';

        // Credit or penalise the parent block. SPARK counts as failure for
        // lineage purposes: we want spawns that land, not almost-lands.
        if (typedIdea.source_frontier_block_id) {
          await updateBlockLifecycle(
            USER_ID!,
            typedIdea.source_frontier_block_id,
            approved
          );
        }

        // BUILD + high FAS → new frontier block the sampler can mine next cycle.
        let promotedBlockId: string | null = null;
        if (approved) {
          promotedBlockId = await maybePromoteToFrontierBlock(typedIdea);
        }

        return {
          id: typedIdea.id,
          success: true,
          stage: 'pro' as const,
          verdict: verdict.verdict,
          title: typedIdea.title,
          promoted_block_id: promotedBlockId || undefined,
        };
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
  const promotedBlocks = results.filter(
    (r) => 'promoted_block_id' in r && r.promoted_block_id
  ).length;

  return res.status(200).json({
    success: true,
    reviewed: successCount,
    total: results.length,
    flash_rejected: flashRejected,
    pro_reviewed: proReviewed,
    promoted_blocks: promotedBlocks,
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

  // Curate: surface only high-FAS ideas in the email. Every BUILD becomes a
  // block (so the engine grows), but the human only wants the meaningful
  // subset. FAS lives on the block; pull it via source_idea_id.
  const allApproved = (approvedIdeas ?? []) as Idea[];
  let highlights: Idea[] = [];
  if (allApproved.length > 0) {
    const ideaIds = allApproved.map(i => i.id);
    const { data: blocks } = await supabase
      .from('ie_frontier_blocks')
      .select('source_idea_id, frontier_advancement_score')
      .in('source_idea_id', ideaIds);
    const fasByIdea = new Map<string, number>(
      (blocks ?? []).map((b: { source_idea_id: string; frontier_advancement_score: number | null }) =>
        [b.source_idea_id, b.frontier_advancement_score ?? 0]
      )
    );
    highlights = allApproved
      .map(idea => ({ idea, fas: fasByIdea.get(idea.id) ?? 0 }))
      .filter(x => x.fas > HIGH_SIGNAL_THRESHOLD)
      .sort((a, b) => b.fas - a.fas)
      .map(x => x.idea);
  }

  try {
    const result = await sendDailyDigest(USER_ID!, highlights);

    // Mark every approved-today idea as sent — they've all been considered
    // for the digest. Low-FAS ones stay accessible via the UI but won't
    // re-surface in tomorrow's email.
    if (allApproved.length > 0) {
      const ideaIds = allApproved.map(i => i.id);
      await supabase
        .from('ie_ideas')
        .update({ digest_sent_at: new Date().toISOString() })
        .in('id', ideaIds);
    }

    const elapsed = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      ideas_count: highlights.length,
      approved_count: allApproved.length,
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
