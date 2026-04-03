import { Resend } from 'resend';
import type { Idea } from './types.js';
import { supabase } from './supabase.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DIGEST_EMAIL = process.env.DIGEST_EMAIL || 'dmahorgan@gmail.com';

function getResend() {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured');
  }
  return new Resend(RESEND_API_KEY);
}

interface ProgressStats {
  today: {
    generated: number;
    reviewed: number;
    approved: number;
  };
  allTime: {
    generated: number;
    reviewed: number;
    approved: number;
    sparks: number;
  };
}

async function getProgressStats(userId: string): Promise<ProgressStats> {
  const today = new Date().toISOString().split('T')[0];

  // Today's stats
  const { data: todayIdeas } = await supabase
    .from('ie_ideas')
    .select('status')
    .eq('user_id', userId)
    .gte('created_at', today);

  const todayGenerated = todayIdeas?.length || 0;
  const todayReviewed = todayIdeas?.filter(i => i.status !== 'pending').length || 0;
  const todayApproved = todayIdeas?.filter(i => i.status === 'approved').length || 0;

  // All-time stats
  const { data: allIdeas } = await supabase
    .from('ie_ideas')
    .select('status')
    .eq('user_id', userId);

  const allGenerated = allIdeas?.length || 0;
  const allReviewed = allIdeas?.filter(i => i.status !== 'pending').length || 0;
  const allApproved = allIdeas?.filter(i => i.status === 'approved').length || 0;
  const allSparks = allIdeas?.filter(i => i.status === 'spark').length || 0;

  return {
    today: {
      generated: todayGenerated,
      reviewed: todayReviewed,
      approved: todayApproved,
    },
    allTime: {
      generated: allGenerated,
      reviewed: allReviewed,
      approved: allApproved,
      sparks: allSparks,
    },
  };
}

/**
 * Send daily digest email with pending ideas for review
 */
export async function sendDailyDigest(userId: string, ideas: Idea[]) {
  const resend = getResend();

  if (ideas.length === 0) {
    console.log('No pending ideas to send in digest');
    return { success: true, message: 'No pending ideas' };
  }

  const progress = await getProgressStats(userId);
  const html = generateDigestHTML(ideas, progress);

  const { data, error } = await resend.emails.send({
    from: 'Idea Engine <onboarding@resend.dev>',
    to: DIGEST_EMAIL,
    subject: `🔬 Daily Idea Digest — ${ideas.length} ideas awaiting review`,
    html,
  });

  if (error) {
    console.error('Failed to send digest email:', error);
    throw error;
  }

  console.log(`Digest email sent to ${DIGEST_EMAIL} with ${ideas.length} ideas`);
  return { success: true, data };
}

function generateDigestHTML(ideas: Idea[], progress: ProgressStats): string {
  const ideaRows = ideas
    .map(
      (idea, index) => `
    <div style="margin-bottom: 32px; padding: 24px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #4f46e5;">
      <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #1e293b;">
        ${index + 1}. ${idea.title}
      </h3>
      <p style="margin: 0 0 12px 0; font-size: 14px; line-height: 1.6; color: #475569;">
        ${idea.description}
      </p>
      <div style="display: flex; gap: 16px; font-size: 12px; color: #64748b; margin-bottom: 12px;">
        <span><strong>Domains:</strong> ${idea.domain_pair.join(' × ')}</span>
        <span><strong>Mode:</strong> ${idea.frontier_mode}</span>
      </div>
      <div style="display: flex; gap: 16px; font-size: 12px; color: #64748b;">
        <span><strong>Novelty:</strong> ${idea.novelty_score?.toFixed(2) || 'N/A'}</span>
        <span><strong>Tractability:</strong> ${idea.tractability_score?.toFixed(2) || 'N/A'}</span>
        <span><strong>Distance:</strong> ${idea.cross_domain_distance?.toFixed(2) || 'N/A'}</span>
        <span><strong>Overall:</strong> ${idea.prefilter_score?.toFixed(2) || 'N/A'}</span>
      </div>
      <div style="margin-top: 16px;">
        <a href="https://polymath-dan.vercel.app/ideas/${idea.id}?action=approve"
           style="display: inline-block; padding: 8px 16px; background: #10b981; color: white; text-decoration: none; border-radius: 4px; font-size: 14px; margin-right: 8px;">
          ✓ BUILD
        </a>
        <a href="https://polymath-dan.vercel.app/ideas/${idea.id}?action=spark"
           style="display: inline-block; padding: 8px 16px; background: #f59e0b; color: white; text-decoration: none; border-radius: 4px; font-size: 14px; margin-right: 8px;">
          ⚡ SPARK
        </a>
        <a href="https://polymath-dan.vercel.app/ideas/${idea.id}?action=reject"
           style="display: inline-block; padding: 8px 16px; background: #ef4444; color: white; text-decoration: none; border-radius: 4px; font-size: 14px;">
          ✕ REJECT
        </a>
      </div>
    </div>
  `
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Idea Digest</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #ffffff;">
  <div style="max-width: 680px; margin: 0 auto; padding: 40px 20px;">
    <div style="margin-bottom: 32px;">
      <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700; color: #0f172a;">
        🔬 Daily Idea Digest
      </h1>
      <p style="margin: 0; font-size: 16px; color: #64748b;">
        ${ideas.length} ideas generated and awaiting your review
      </p>
    </div>

    <!-- Progress Stats -->
    <div style="margin-bottom: 32px; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; color: white;">
      <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">Building Block Progress</h2>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
        <div>
          <div style="font-size: 24px; font-weight: 700; margin-bottom: 4px;">${progress.today.generated}</div>
          <div style="font-size: 13px; opacity: 0.9;">Generated Today</div>
        </div>
        <div>
          <div style="font-size: 24px; font-weight: 700; margin-bottom: 4px;">${progress.today.approved}</div>
          <div style="font-size: 13px; opacity: 0.9;">Approved Today</div>
        </div>
      </div>

      <div style="border-top: 1px solid rgba(255,255,255,0.3); padding-top: 16px; margin-top: 16px;">
        <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">All-Time Progress</div>
        <div style="font-size: 13px; opacity: 0.9; line-height: 1.6;">
          ${progress.allTime.generated} ideas generated •
          ${progress.allTime.approved} approved (BUILD) •
          ${progress.allTime.sparks} sparks saved
        </div>
      </div>
    </div>

    ${ideaRows}

    <div style="margin-top: 48px; padding-top: 24px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 12px;">
      <p style="margin: 0;">
        Generated by your Idea Engine • Running 24/7 to explore the frontier
      </p>
    </div>
  </div>
</body>
</html>
  `;
}
