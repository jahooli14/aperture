import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { supabase } from '../../projects/idea-engine/src/lib/supabase';
import type { Idea, FrontierBlock } from '../../projects/idea-engine/src/lib/types';

/**
 * Email Digest Endpoint
 * Sends daily summary at 8:30am UTC
 * Triggered by GitHub Actions cron
 */

const resend = new Resend(process.env.RESEND_API_KEY);
const TO_EMAIL = 'dmahorgan@gmail.com';
const FROM_EMAIL = 'ideas@your-domain.com'; // Update with your verified domain

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

  try {
    const userId = process.env.IDEA_ENGINE_USER_ID;
    if (!userId) throw new Error('IDEA_ENGINE_USER_ID not set');

    console.log('📧 Generating email digest...');

    // Get ideas from last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const { data: recentIdeas } = await supabase
      .from('ie_ideas')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', yesterday.toISOString())
      .order('created_at', { ascending: false });

    // Get latest review results (from overnight)
    const { data: recentlyReviewed } = await supabase
      .from('ie_ideas')
      .select('*')
      .eq('user_id', userId)
      .gte('reviewed_at', yesterday.toISOString())
      .order('reviewed_at', { ascending: false });

    // Get all-time stats
    const { data: allIdeas } = await supabase
      .from('ie_ideas')
      .select('status')
      .eq('user_id', userId);

    const { data: frontierBlocks } = await supabase
      .from('ie_frontier_blocks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    // Calculate stats
    const stats = {
      total: allIdeas?.length || 0,
      approved: allIdeas?.filter((i) => i.status === 'approved').length || 0,
      spark: allIdeas?.filter((i) => i.status === 'spark').length || 0,
      rejected: allIdeas?.filter((i) => i.status === 'rejected').length || 0,
      pending: allIdeas?.filter((i) => i.status === 'pending').length || 0,
      approvalRate: allIdeas?.length
        ? ((allIdeas.filter((i) => i.status === 'approved' || i.status === 'spark').length /
            allIdeas.length) *
            100).toFixed(1)
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

    // Build HTML email
    const htmlContent = buildEmailHTML({
      recentIdeas: recentIdeas || [],
      recentlyReviewed: recentlyReviewed || [],
      stats,
      last24h,
      frontierBlocks: frontierBlocks || [],
    });

    // Send email
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: TO_EMAIL,
      subject: `Idea Engine Daily Digest - ${new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
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
  } catch (error) {
    console.error('❌ Digest failed:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
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
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">

  <!-- Header -->
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px;">
    <h1 style="margin: 0 0 10px 0; font-size: 28px;">🧠 Idea Engine</h1>
    <p style="margin: 0; opacity: 0.9; font-size: 14px;">Daily Digest - ${new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })}</p>
  </div>

  <!-- Last 24h Summary -->
  <div style="background: white; border-radius: 12px; padding: 25px; margin-bottom: 25px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h2 style="margin: 0 0 20px 0; font-size: 20px; color: #667eea;">📊 Last 24 Hours</h2>

    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
      <div style="background: #f8f9ff; padding: 15px; border-radius: 8px; text-align: center;">
        <div style="font-size: 32px; font-weight: bold; color: #667eea;">${last24h.generated}</div>
        <div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Generated</div>
      </div>
      <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; text-align: center;">
        <div style="font-size: 32px; font-weight: bold; color: #16a34a;">${last24h.approved}</div>
        <div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Approved</div>
      </div>
      <div style="background: #fffbeb; padding: 15px; border-radius: 8px; text-align: center;">
        <div style="font-size: 32px; font-weight: bold; color: #d97706;">${last24h.spark}</div>
        <div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Sparks</div>
      </div>
      <div style="background: #fef2f2; padding: 15px; border-radius: 8px; text-align: center;">
        <div style="font-size: 32px; font-weight: bold; color: #dc2626;">${last24h.rejected}</div>
        <div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Rejected</div>
      </div>
    </div>
  </div>

  <!-- Approved Ideas -->
  ${approvedIdeas.length > 0 ? `
  <div style="background: white; border-radius: 12px; padding: 25px; margin-bottom: 25px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h2 style="margin: 0 0 20px 0; font-size: 20px; color: #16a34a;">✅ Approved Ideas (${approvedIdeas.length})</h2>
    ${approvedIdeas.map((idea) => `
      <div style="border-left: 4px solid #16a34a; padding: 15px; margin-bottom: 15px; background: #f0fdf4; border-radius: 4px;">
        <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #15803d;">${idea.title}</h3>
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #4b5563;">${idea.description}</p>
        <div style="display: flex; gap: 12px; font-size: 12px; color: #6b7280;">
          <span><strong>Domains:</strong> ${idea.domain_pair.join(' × ')}</span>
          <span><strong>Mode:</strong> ${idea.frontier_mode}</span>
        </div>
        ${idea.opus_verdict ? `
          <div style="margin-top: 10px; padding: 10px; background: #dcfce7; border-radius: 4px; font-size: 13px; color: #166534;">
            <strong>Review:</strong> ${idea.opus_verdict}
          </div>
        ` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}

  <!-- Spark Ideas -->
  ${sparkIdeas.length > 0 ? `
  <div style="background: white; border-radius: 12px; padding: 25px; margin-bottom: 25px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h2 style="margin: 0 0 20px 0; font-size: 20px; color: #d97706;">⚡ Spark Ideas (${sparkIdeas.length})</h2>
    ${sparkIdeas.slice(0, 3).map((idea) => `
      <div style="border-left: 4px solid #d97706; padding: 15px; margin-bottom: 15px; background: #fffbeb; border-radius: 4px;">
        <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #b45309;">${idea.title}</h3>
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #4b5563;">${idea.description}</p>
        <div style="font-size: 12px; color: #6b7280;">
          <strong>Domains:</strong> ${idea.domain_pair.join(' × ')}
        </div>
      </div>
    `).join('')}
  </div>
  ` : ''}

  <!-- All-Time Progress -->
  <div style="background: white; border-radius: 12px; padding: 25px; margin-bottom: 25px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h2 style="margin: 0 0 20px 0; font-size: 20px; color: #667eea;">📈 All-Time Progress</h2>

    <div style="margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span style="font-size: 14px; color: #6b7280;">Approval Rate</span>
        <span style="font-size: 14px; font-weight: bold; color: #667eea;">${stats.approvalRate}%</span>
      </div>
      <div style="background: #e5e7eb; height: 8px; border-radius: 4px; overflow: hidden;">
        <div style="background: linear-gradient(90deg, #667eea, #764ba2); height: 100%; width: ${stats.approvalRate}%; transition: width 0.3s;"></div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 13px;">
      <div style="text-align: center; padding: 10px; background: #f9fafb; border-radius: 6px;">
        <div style="font-weight: bold; color: #111827;">${stats.total}</div>
        <div style="color: #6b7280;">Total Ideas</div>
      </div>
      <div style="text-align: center; padding: 10px; background: #f9fafb; border-radius: 6px;">
        <div style="font-weight: bold; color: #16a34a;">${stats.approved + stats.spark}</div>
        <div style="color: #6b7280;">Accepted</div>
      </div>
      <div style="text-align: center; padding: 10px; background: #f9fafb; border-radius: 6px;">
        <div style="font-weight: bold; color: #667eea;">${stats.frontierBlockCount}</div>
        <div style="color: #6b7280;">Frontier Blocks</div>
      </div>
    </div>
  </div>

  <!-- Recent Frontier Blocks -->
  ${frontierBlocks.length > 0 ? `
  <div style="background: white; border-radius: 12px; padding: 25px; margin-bottom: 25px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h2 style="margin: 0 0 20px 0; font-size: 20px; color: #764ba2;">🎯 Latest Frontier Blocks</h2>
    ${frontierBlocks.slice(0, 3).map((block) => `
      <div style="border-left: 4px solid #764ba2; padding: 15px; margin-bottom: 15px; background: #faf5ff; border-radius: 4px;">
        <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #6b21a8;">${block.concept_name}</h3>
        <p style="margin: 0 0 10px 0; font-size: 14px; color: #4b5563;">${block.concept_description}</p>
        <div style="font-size: 12px; color: #6b7280;">
          <strong>FAS:</strong> ${block.frontier_advancement_score?.toFixed(2)} |
          <strong>Spawns:</strong> ${block.spawn_count} |
          <strong>Mode:</strong> ${block.frontier_mode}
        </div>
      </div>
    `).join('')}
  </div>
  ` : ''}

  <!-- Footer -->
  <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
    <p style="margin: 0 0 5px 0;">View all ideas at <a href="https://your-domain.vercel.app/ideas" style="color: #667eea; text-decoration: none;">your dashboard</a></p>
    <p style="margin: 0;">Idea Engine • Evolutionary Frontier Exploration</p>
  </div>

</body>
</html>
  `;
}
