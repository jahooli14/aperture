import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Resend } from 'resend';
import { supabase } from '../lib/idea-engine/supabase';
import { sampleDomainPair, recordDomainPairGeneration } from '../lib/idea-engine/domain-sampler';
import { selectFrontierMode, recordModeUsage, updateModeSuccessRate } from '../lib/idea-engine/mode-selector';
import { generateIdea, scoreIdea, extractAbstractPattern } from '../lib/idea-engine/gemini-client';
import { generateIdeaEmbedding, storeIdeaWithDedupe } from '../lib/idea-engine/deduplication';
import { getLatestFeedbackSummary } from '../lib/idea-engine/feedback-summarizer';
import { calculateFAS, createFrontierBlock } from '../lib/idea-engine/frontier-advancement';
import type { Idea, FrontierBlock } from '../lib/idea-engine/types';

/**
 * Consolidated Idea Engine Endpoint
 * Handles: generate, review, send-digest
 * Query param "action" determines which operation to run
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY not set');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const reviewModel = genAI.getGenerativeModel({ model: 'gemini-3.1-pro-preview' });

const resend = new Resend(process.env.RESEND_API_KEY);
const TO_EMAIL = 'dmahorgan@gmail.com';
const FROM_EMAIL = 'onboarding@resend.dev'; // Use Resend's testing domain (or verify your own domain)

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

  try {
    switch (action) {
      case 'generate':
        return await handleGenerate(res);
      case 'review':
        return await handleReview(res);
      case 'send-digest':
        return await handleSendDigest(res);
      default:
        return res.status(400).json({ error: 'Invalid action. Use ?action=generate|review|send-digest' });
    }
  } catch (error) {
    console.error(`❌ ${action} failed:`, error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ========== GENERATE ==========
async function handleGenerate(res: VercelResponse) {
  const userId = process.env.IDEA_ENGINE_USER_ID;
  if (!userId) throw new Error('IDEA_ENGINE_USER_ID not set');

  console.log('🚀 Starting idea generation...');

  const { data: batch, error: batchError } = await supabase
    .from('ie_generation_batches')
    .insert({
      user_id: userId,
      batch_type: 'scheduled',
      status: 'running',
    })
    .select()
    .single();

  if (batchError) throw new Error(`Failed to create batch: ${batchError.message}`);
  const batchId = batch.id;

  console.log('📊 Sampling domain pair...');
  const domainPair = await sampleDomainPair(userId);
  console.log(`Selected domains: ${domainPair.join(' × ')}`);

  console.log('🎯 Selecting frontier mode...');
  const frontierMode = await selectFrontierMode(userId);
  console.log(`Selected mode: ${frontierMode}`);

  console.log('📝 Loading feedback context...');
  const feedbackContext = await getLatestFeedbackSummary(userId);

  console.log('💡 Generating idea...');
  const ideaResponse = await generateIdea(
    domainPair[0],
    domainPair[1],
    frontierMode,
    feedbackContext || undefined
  );
  console.log(`Generated: "${ideaResponse.title}"`);

  console.log('⚖️  Scoring idea...');
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

  const PREFILTER_THRESHOLD = 0.55;

  if (score.overall < PREFILTER_THRESHOLD) {
    console.log('❌ Idea failed pre-filter');
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
  console.log('🔢 Generating embedding...');
  const embedding = await generateIdeaEmbedding({
    title: ideaResponse.title,
    description: ideaResponse.description,
    reasoning: ideaResponse.reasoning,
  });

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
  await Promise.all([
    recordDomainPairGeneration(userId, domainPair[0], domainPair[1]),
    recordModeUsage(userId, frontierMode),
  ]);

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
}

// ========== REVIEW ==========
async function handleReview(res: VercelResponse) {
  const userId = process.env.IDEA_ENGINE_USER_ID;
  if (!userId) throw new Error('IDEA_ENGINE_USER_ID not set');

  console.log('🔍 Starting Opus review...');

  const { data: pendingIdeas, error: fetchError } = await supabase
    .from('ie_ideas')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50);

  if (fetchError) throw new Error(`Failed to fetch pending ideas: ${fetchError.message}`);

  if (!pendingIdeas || pendingIdeas.length === 0) {
    console.log('No pending ideas to review');
    return res.status(200).json({
      success: true,
      ideas_reviewed: 0,
      message: 'No pending ideas',
    });
  }

  console.log(`Found ${pendingIdeas.length} pending ideas`);

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

  console.log('🤖 Calling Gemini 3.1 Pro...');
  const result = await reviewModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4000,
    },
  });

  const responseText = result.response.text();
  const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
  if (!jsonMatch) throw new Error('Gemini response does not contain valid JSON');

  const verdicts = JSON.parse(jsonMatch[1]) as Array<{
    idea_number: number;
    verdict: 'BUILD' | 'SPARK' | 'REJECT';
    reasoning: string;
    rejection_category?: string;
    frontier_advancement_score?: number;
  }>;

  console.log(`Received ${verdicts.length} verdicts from Opus`);

  const approved: string[] = [];
  const rejected: string[] = [];
  const rejectionReasons: Record<string, { reason: string; category: string }> = {};

  for (let i = 0; i < verdicts.length; i++) {
    const verdict = verdicts[i];
    const idea = pendingIdeas[i] as Idea;
    if (!idea) continue;

    const status =
      verdict.verdict === 'BUILD' || verdict.verdict === 'SPARK'
        ? verdict.verdict === 'BUILD'
          ? 'approved'
          : 'spark'
        : 'rejected';

    await supabase
      .from('ie_ideas')
      .update({
        status,
        opus_verdict: verdict.reasoning,
        rejection_reason: status === 'rejected' ? verdict.reasoning : null,
        rejection_category: status === 'rejected' ? verdict.rejection_category : null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', idea.id);

    if (status === 'approved' || status === 'spark') {
      approved.push(idea.id);
      await updateModeSuccessRate(userId, idea.frontier_mode, true);

      const [a, b] = idea.domain_pair.sort();
      const rpcResult = await supabase.rpc('increment_domain_pair_success', {
        p_user_id: userId,
        p_domain_a: a,
        p_domain_b: b,
      });

      if (rpcResult.error) {
        const { data: pairData } = await supabase
          .from('ie_domain_pairs')
          .select('times_approved, times_generated')
          .eq('user_id', userId)
          .eq('domain_a', a)
          .eq('domain_b', b)
          .single();

        if (pairData) {
          const newApproved = pairData.times_approved + 1;
          const newSuccessRate = pairData.times_generated > 0 ? newApproved / pairData.times_generated : 0;

          await supabase
            .from('ie_domain_pairs')
            .update({
              times_approved: newApproved,
              success_rate: newSuccessRate,
            })
            .eq('user_id', userId)
            .eq('domain_a', a)
            .eq('domain_b', b);
        }
      }

      console.log(`Calculating FAS for "${idea.title}"...`);
      const { data: frontierBlocks } = await supabase
        .from('ie_frontier_blocks')
        .select('*')
        .eq('user_id', userId);

      const fas = await calculateFAS(userId, idea, frontierBlocks || []);
      console.log(`FAS: ${fas.overall.toFixed(2)} (qualifies: ${fas.qualifies_as_frontier_block})`);

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
      await updateModeSuccessRate(userId, idea.frontier_mode, false);

      rejectionReasons[idea.id] = {
        reason: verdict.reasoning,
        category: verdict.rejection_category || 'unknown',
      };

      const [a, b] = idea.domain_pair.sort();
      const patternSignature = `${a}|${b}`;

      const { data: existingPattern } = await supabase
        .from('ie_rejection_patterns')
        .select('rejection_count, penalty_weight, typical_reasons')
        .eq('user_id', userId)
        .eq('pattern_type', 'domain_combo')
        .eq('pattern_signature', patternSignature)
        .single();

      const newRejectionCount = (existingPattern?.rejection_count || 0) + 1;
      const newPenaltyWeight = (existingPattern?.penalty_weight || 0) + 0.1;
      const newReasons = [...(existingPattern?.typical_reasons || []), verdict.reasoning];

      await supabase.from('ie_rejection_patterns').upsert(
        {
          user_id: userId,
          pattern_type: 'domain_combo',
          pattern_signature: patternSignature,
          rejection_count: newRejectionCount,
          penalty_weight: newPenaltyWeight,
          typical_reasons: newReasons,
          last_rejected_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,pattern_type,pattern_signature',
        }
      );
    }
  }

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
}

// ========== SEND DIGEST ==========
async function handleSendDigest(res: VercelResponse) {
  const userId = process.env.IDEA_ENGINE_USER_ID;
  if (!userId) throw new Error('IDEA_ENGINE_USER_ID not set');

  console.log('📧 Generating email digest...');

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const { data: recentIdeas } = await supabase
    .from('ie_ideas')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', yesterday.toISOString())
    .order('created_at', { ascending: false });

  const { data: recentlyReviewed } = await supabase
    .from('ie_ideas')
    .select('*')
    .eq('user_id', userId)
    .gte('reviewed_at', yesterday.toISOString())
    .order('reviewed_at', { ascending: false });

  const { data: allIdeas } = await supabase.from('ie_ideas').select('status').eq('user_id', userId);

  const { data: frontierBlocks } = await supabase
    .from('ie_frontier_blocks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  const stats = {
    total: allIdeas?.length || 0,
    approved: allIdeas?.filter((i) => i.status === 'approved').length || 0,
    spark: allIdeas?.filter((i) => i.status === 'spark').length || 0,
    rejected: allIdeas?.filter((i) => i.status === 'rejected').length || 0,
    pending: allIdeas?.filter((i) => i.status === 'pending').length || 0,
    approvalRate: allIdeas?.length
      ? (
          ((allIdeas.filter((i) => i.status === 'approved' || i.status === 'spark').length / allIdeas.length) *
            100)
        ).toFixed(1)
      : '0',
    frontierBlockCount: frontierBlocks?.length || 0,
  };

  const last24h = {
    generated: recentIdeas?.length || 0,
    reviewed: recentlyReviewed?.length || 0,
    approved: recentlyReviewed?.filter((i) => i.status === 'approved').length || 0,
    spark: recentlyReviewed?.filter((i) => i.status === 'spark').length || 0,
    rejected: recentlyReviewed?.filter((i) => i.status === 'rejected').length || 0,
  };

  const htmlContent = buildEmailHTML({
    recentIdeas: recentIdeas || [],
    recentlyReviewed: recentlyReviewed || [],
    stats,
    last24h,
    frontierBlocks: frontierBlocks || [],
  });

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: TO_EMAIL,
    subject: `Idea Engine Daily Digest - ${new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`,
    html: htmlContent,
  });

  if (error) {
    console.error('Error sending email:', error);
    return res.status(500).json({ error: error.message });
  }

  console.log('✅ Email sent:', data?.id);

  return res.status(200).json({
    success: true,
    emailId: data?.id,
    stats: last24h,
  });
}

function buildEmailHTML(data: {
  recentIdeas: Idea[];
  recentlyReviewed: Idea[];
  stats: any;
  last24h: any;
  frontierBlocks: FrontierBlock[];
}) {
  const { recentIdeas, recentlyReviewed, stats, last24h, frontierBlocks } = data;

  const approvedIdeas = recentlyReviewed.filter((i) => i.status === 'approved');
  const sparkIdeas = recentlyReviewed.filter((i) => i.status === 'spark');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Idea Engine Daily Digest</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; line-height: 1.6; color: #1f2937; max-width: 650px; margin: 0 auto; padding: 20px; background: #f9fafb;">

  <!-- Header -->
  <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 40px 32px; border-radius: 8px; margin-bottom: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <h1 style="margin: 0 0 8px 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Idea Engine</h1>
    <p style="margin: 0; opacity: 0.95; font-size: 15px; font-weight: 500;">Daily Digest · ${new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })}</p>
  </div>

  <!-- Last 24h Summary -->
  <div style="background: white; border-radius: 8px; padding: 28px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #e5e7eb;">
    <h2 style="margin: 0 0 24px 0; font-size: 18px; font-weight: 700; color: #111827;">Last 24 Hours</h2>

    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
      <div style="background: #f8faff; padding: 20px; border-radius: 6px; text-align: center; border: 1px solid #e0e7ff;">
        <div style="font-size: 36px; font-weight: 700; color: #4f46e5; line-height: 1;">${last24h.generated}</div>
        <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-top: 8px; font-weight: 600;">Generated</div>
      </div>
      <div style="background: #f0fdf4; padding: 20px; border-radius: 6px; text-align: center; border: 1px solid #d1fae5;">
        <div style="font-size: 36px; font-weight: 700; color: #059669; line-height: 1;">${last24h.approved}</div>
        <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-top: 8px; font-weight: 600;">Approved</div>
      </div>
      <div style="background: #fffbeb; padding: 20px; border-radius: 6px; text-align: center; border: 1px solid #fde68a;">
        <div style="font-size: 36px; font-weight: 700; color: #d97706; line-height: 1;">${last24h.spark}</div>
        <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-top: 8px; font-weight: 600;">Sparks</div>
      </div>
      <div style="background: #fef2f2; padding: 20px; border-radius: 6px; text-align: center; border: 1px solid #fecaca;">
        <div style="font-size: 36px; font-weight: 700; color: #dc2626; line-height: 1;">${last24h.rejected}</div>
        <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-top: 8px; font-weight: 600;">Rejected</div>
      </div>
    </div>
  </div>

  <!-- Approved Ideas -->
  ${
    approvedIdeas.length > 0
      ? `
  <div style="background: white; border-radius: 8px; padding: 28px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #e5e7eb;">
    <h2 style="margin: 0 0 24px 0; font-size: 18px; font-weight: 700; color: #111827;">Approved Ideas <span style="font-weight: 400; color: #6b7280;">(${approvedIdeas.length})</span></h2>
    ${approvedIdeas
      .map(
        (idea) => `
      <div style="border-left: 3px solid #059669; padding: 18px; margin-bottom: 16px; background: #f9fafb; border-radius: 6px;">
        <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600; color: #111827; line-height: 1.4;">${idea.title}</h3>
        <p style="margin: 0 0 12px 0; font-size: 14px; color: #4b5563; line-height: 1.6;">${idea.description}</p>
        <div style="display: flex; gap: 16px; font-size: 12px; color: #6b7280; margin-bottom: ${idea.opus_verdict ? '12px' : '0'};">
          <span><strong style="font-weight: 600;">Domains:</strong> ${idea.domain_pair.join(' × ')}</span>
          <span><strong style="font-weight: 600;">Mode:</strong> ${idea.frontier_mode.replace(/_/g, ' ')}</span>
        </div>
        ${
          idea.opus_verdict
            ? `
          <div style="margin-top: 12px; padding: 12px; background: white; border-radius: 4px; font-size: 13px; color: #374151; border: 1px solid #d1fae5;">
            <strong style="font-weight: 600; color: #059669;">Review:</strong> ${idea.opus_verdict}
          </div>
        `
            : ''
        }
      </div>
    `
      )
      .join('')}
  </div>
  `
      : ''
  }

  <!-- Spark Ideas -->
  ${
    sparkIdeas.length > 0
      ? `
  <div style="background: white; border-radius: 8px; padding: 28px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #e5e7eb;">
    <h2 style="margin: 0 0 24px 0; font-size: 18px; font-weight: 700; color: #111827;">Spark Ideas <span style="font-weight: 400; color: #6b7280;">(${sparkIdeas.length})</span></h2>
    ${sparkIdeas
      .slice(0, 3)
      .map(
        (idea) => `
      <div style="border-left: 3px solid #d97706; padding: 18px; margin-bottom: 16px; background: #f9fafb; border-radius: 6px;">
        <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600; color: #111827; line-height: 1.4;">${idea.title}</h3>
        <p style="margin: 0 0 12px 0; font-size: 14px; color: #4b5563; line-height: 1.6;">${idea.description}</p>
        <div style="font-size: 12px; color: #6b7280;">
          <strong style="font-weight: 600;">Domains:</strong> ${idea.domain_pair.join(' × ')}
        </div>
      </div>
    `
      )
      .join('')}
  </div>
  `
      : ''
  }

  <!-- All-Time Progress -->
  <div style="background: white; border-radius: 8px; padding: 28px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #e5e7eb;">
    <h2 style="margin: 0 0 24px 0; font-size: 18px; font-weight: 700; color: #111827;">All-Time Progress</h2>

    <div style="margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
        <span style="font-size: 14px; color: #6b7280; font-weight: 500;">Approval Rate</span>
        <span style="font-size: 14px; font-weight: 700; color: #4f46e5;">${stats.approvalRate}%</span>
      </div>
      <div style="background: #e5e7eb; height: 10px; border-radius: 5px; overflow: hidden;">
        <div style="background: linear-gradient(90deg, #4f46e5, #7c3aed); height: 100%; width: ${stats.approvalRate}%;"></div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
      <div style="text-align: center; padding: 16px 12px; background: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb;">
        <div style="font-weight: 700; color: #111827; font-size: 24px; line-height: 1;">${stats.total}</div>
        <div style="color: #6b7280; font-size: 12px; margin-top: 6px; font-weight: 500;">Total Ideas</div>
      </div>
      <div style="text-align: center; padding: 16px 12px; background: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb;">
        <div style="font-weight: 700; color: #059669; font-size: 24px; line-height: 1;">${stats.approved + stats.spark}</div>
        <div style="color: #6b7280; font-size: 12px; margin-top: 6px; font-weight: 500;">Accepted</div>
      </div>
      <div style="text-align: center; padding: 16px 12px; background: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb;">
        <div style="font-weight: 700; color: #4f46e5; font-size: 24px; line-height: 1;">${stats.frontierBlockCount}</div>
        <div style="color: #6b7280; font-size: 12px; margin-top: 6px; font-weight: 500;">Frontier Blocks</div>
      </div>
    </div>
  </div>

  <!-- Recent Frontier Blocks -->
  ${
    frontierBlocks.length > 0
      ? `
  <div style="background: white; border-radius: 8px; padding: 28px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #e5e7eb;">
    <h2 style="margin: 0 0 24px 0; font-size: 18px; font-weight: 700; color: #111827;">Latest Frontier Blocks <span style="font-weight: 400; color: #6b7280;">(${frontierBlocks.length})</span></h2>
    ${frontierBlocks
      .slice(0, 3)
      .map(
        (block) => `
      <div style="border-left: 3px solid #7c3aed; padding: 18px; margin-bottom: 16px; background: #f9fafb; border-radius: 6px;">
        <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600; color: #111827; line-height: 1.4;">${block.concept_name}</h3>
        <p style="margin: 0 0 12px 0; font-size: 14px; color: #4b5563; line-height: 1.6;">${block.concept_description}</p>
        <div style="font-size: 12px; color: #6b7280;">
          <strong style="font-weight: 600;">FAS:</strong> ${block.frontier_advancement_score?.toFixed(2)} •
          <strong style="font-weight: 600;">Spawns:</strong> ${block.spawn_count} •
          <strong style="font-weight: 600;">Mode:</strong> ${block.frontier_mode.replace(/_/g, ' ')}
        </div>
      </div>
    `
      )
      .join('')}
  </div>
  `
      : ''
  }

  <!-- Footer -->
  <div style="text-align: center; padding: 24px 20px; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; margin-top: 8px;">
    <p style="margin: 0; font-weight: 500; color: #6b7280;">Idea Engine · Evolutionary Frontier Exploration</p>
  </div>

</body>
</html>
  `;
}
