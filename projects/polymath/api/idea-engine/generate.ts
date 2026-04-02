import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../idea-engine/src/lib/supabase';
import { sampleDomainPair, recordDomainPairGeneration } from '../../../idea-engine/src/lib/domain-sampler';
import { selectFrontierMode, recordModeUsage } from '../../../idea-engine/src/lib/mode-selector';
import { generateIdea, scoreIdea } from '../../../idea-engine/src/lib/gemini-client';
import { generateIdeaEmbedding, storeIdeaWithDedupe } from '../../../idea-engine/src/lib/deduplication';
import { getLatestFeedbackSummary } from '../../../idea-engine/src/lib/feedback-summarizer';

/**
 * Idea Engine Generation Endpoint
 * Triggered by GitHub Actions cron every 50 minutes
 *
 * Workflow:
 * 1. Sample domain pair (from knowledge graph)
 * 2. Select frontier mode (with entropy tracking)
 * 3. Generate idea (Gemini Flash-Lite)
 * 4. Score idea (pre-filter)
 * 5. Check duplicates (pgvector)
 * 6. Store if passes filters
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify secret token (set in GitHub Actions secrets)
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.IDEA_ENGINE_SECRET;

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get user ID (for now, use a single user)
    // TODO: Support multiple users
    const userId = process.env.IDEA_ENGINE_USER_ID;
    if (!userId) {
      throw new Error('IDEA_ENGINE_USER_ID not set');
    }

    console.log('🚀 Starting idea generation...');

    // Create generation batch
    const { data: batch, error: batchError } = await supabase
      .from('ie_generation_batches')
      .insert({
        user_id: userId,
        batch_type: 'scheduled',
        status: 'running',
      })
      .select()
      .single();

    if (batchError) {
      throw new Error(`Failed to create batch: ${batchError.message}`);
    }

    const batchId = batch.id;

    // Step 1: Sample domain pair
    console.log('📊 Sampling domain pair...');
    const domainPair = await sampleDomainPair(userId);
    console.log(`Selected domains: ${domainPair.join(' × ')}`);

    // Step 2: Select frontier mode
    console.log('🎯 Selecting frontier mode...');
    const frontierMode = await selectFrontierMode(userId);
    console.log(`Selected mode: ${frontierMode}`);

    // Step 3: Get feedback context
    console.log('📝 Loading feedback context...');
    const feedbackContext = await getLatestFeedbackSummary(userId);

    // Step 4: Generate idea
    console.log('💡 Generating idea...');
    const ideaResponse = await generateIdea(
      domainPair[0],
      domainPair[1],
      frontierMode,
      feedbackContext || undefined
    );

    console.log(`Generated: "${ideaResponse.title}"`);

    // Step 5: Score idea (pre-filter)
    console.log('⚖️  Scoring idea...');

    // Get recent ideas for novelty comparison
    const { data: recentIdeas } = await supabase
      .from('ie_ideas')
      .select('title, description')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    const score = await scoreIdea(
      {
        title: ideaResponse.title,
        description: ideaResponse.description,
        reasoning: ideaResponse.reasoning,
        domain_pair: domainPair,
        frontier_mode: frontierMode,
      },
      recentIdeas || []
    );

    console.log(`Scores: novelty=${score.novelty.toFixed(2)}, distance=${score.cross_domain_distance.toFixed(2)}, tractability=${score.tractability.toFixed(2)}, overall=${score.overall.toFixed(2)}`);

    // Pre-filter threshold: 33% pass rate (overall > 0.55)
    const PREFILTER_THRESHOLD = 0.55;

    if (score.overall < PREFILTER_THRESHOLD) {
      console.log('❌ Idea failed pre-filter');

      // Update batch
      await supabase
        .from('ie_generation_batches')
        .update({
          ideas_count: 1,
          prefilter_pass_count: 0,
          prefilter_pass_rate: 0,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', batchId);

      return res.status(200).json({
        success: true,
        passed_filter: false,
        reason: 'Failed pre-filter',
        score,
      });
    }

    console.log('✅ Passed pre-filter');

    // Step 6: Generate embedding
    console.log('🔢 Generating embedding...');
    const embedding = await generateIdeaEmbedding({
      title: ideaResponse.title,
      description: ideaResponse.description,
      reasoning: ideaResponse.reasoning,
    });

    // Step 7: Check for duplicates and store
    console.log('🔍 Checking for duplicates...');
    const storeResult = await storeIdeaWithDedupe(
      userId,
      {
        title: ideaResponse.title,
        description: ideaResponse.description,
        reasoning: ideaResponse.reasoning,
        domain_pair: domainPair,
        frontier_mode: frontierMode,
        generation_batch_id: batchId,
        novelty_score: score.novelty,
        tractability_score: score.tractability,
        cross_domain_distance: score.cross_domain_distance,
        prefilter_score: score.overall,
        status: 'pending',
        generation_number: 0,
      },
      embedding
    );

    if (!storeResult.success) {
      console.log(`⚠️  Storage failed: ${storeResult.message}`);

      // Update batch
      await supabase
        .from('ie_generation_batches')
        .update({
          ideas_count: 1,
          prefilter_pass_count: 1,
          prefilter_pass_rate: 1.0,
          status: storeResult.duplicate ? 'completed' : 'failed',
          completed_at: new Date().toISOString(),
          error_message: storeResult.message,
        })
        .eq('id', batchId);

      return res.status(200).json({
        success: true,
        passed_filter: true,
        stored: false,
        duplicate: storeResult.duplicate,
        reason: storeResult.message,
      });
    }

    console.log('💾 Idea stored successfully');

    // Step 8: Record usage stats
    await Promise.all([
      recordDomainPairGeneration(userId, domainPair[0], domainPair[1]),
      recordModeUsage(userId, frontierMode),
    ]);

    // Update batch
    await supabase
      .from('ie_generation_batches')
      .update({
        ideas_count: 1,
        prefilter_pass_count: 1,
        prefilter_pass_rate: 1.0,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', batchId);

    console.log('✨ Generation complete');

    return res.status(200).json({
      success: true,
      passed_filter: true,
      stored: true,
      idea: {
        id: storeResult.idea!.id,
        title: storeResult.idea!.title,
        domain_pair: domainPair,
        frontier_mode: frontierMode,
        score,
      },
    });
  } catch (error) {
    console.error('❌ Generation failed:', error);

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
