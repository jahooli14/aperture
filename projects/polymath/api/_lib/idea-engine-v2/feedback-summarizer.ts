import { supabase } from './supabase.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { EvolutionaryFeedback, FeedbackSummary } from './types.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function getGenAI() {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  return new GoogleGenerativeAI(GEMINI_API_KEY);
}

function getSummarizerModel() {
  return getGenAI().getGenerativeModel({ model: 'gemini-3-flash-preview' }); // Good enough for summaries
}

/**
 * Feedback Summarizer
 * Compresses 3 weeks of rejection/approval feedback into ~250 tokens
 * for injection into agent prompts
 */

export interface FeedbackWindow {
  start: Date;
  end: Date;
  rejections: Array<{
    title: string;
    reason: string;
    category: string;
    domain_pair: [string, string];
    frontier_mode: string;
  }>;
  approvals: Array<{
    title: string;
    domain_pair: [string, string];
    frontier_mode: string;
  }>;
}

/**
 * Get feedback from the last N days
 */
export async function getFeedbackWindow(
  userId: string,
  daysBack: number = 21 // 3 weeks
): Promise<FeedbackWindow> {
  const end = new Date();
  const start = new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000);

  // Get reviewed ideas from this window
  const { data, error } = await supabase
    .from('ie_ideas')
    .select('*')
    .eq('user_id', userId)
    .gte('reviewed_at', start.toISOString())
    .lte('reviewed_at', end.toISOString())
    .not('reviewed_at', 'is', null);

  if (error) {
    console.error('Error fetching feedback window:', error);
    return { start, end, rejections: [], approvals: [] };
  }

  const rejections = (data || [])
    .filter((idea) => idea.status === 'rejected')
    .map((idea) => ({
      title: idea.title,
      reason: idea.rejection_reason || 'No reason provided',
      category: idea.rejection_category || 'unknown',
      domain_pair: idea.domain_pair as [string, string],
      frontier_mode: idea.frontier_mode,
    }));

  const approvals = (data || [])
    .filter((idea) => idea.status === 'approved' || idea.status === 'spark')
    .map((idea) => ({
      title: idea.title,
      domain_pair: idea.domain_pair as [string, string],
      frontier_mode: idea.frontier_mode,
    }));

  return { start, end, rejections, approvals };
}

/**
 * Compress rejection patterns into ~250 tokens
 */
export async function summarizeRejections(
  rejections: FeedbackWindow['rejections']
): Promise<string> {
  if (rejections.length === 0) {
    return 'No rejection patterns yet.';
  }

  // Group by category
  const byCategory = rejections.reduce(
    (acc, r) => {
      if (!acc[r.category]) acc[r.category] = [];
      acc[r.category].push(r);
      return acc;
    },
    {} as Record<string, typeof rejections>
  );

  // Build prompt for summarizer
  const prompt = `Compress these rejection reasons into 3-5 clear patterns (max 250 tokens):

${Object.entries(byCategory)
  .map(
    ([category, items]) =>
      `**${category}** (${items.length}):\n${items
        .slice(0, 5)
        .map((r) => `- "${r.title}": ${r.reason}`)
        .join('\n')}`
  )
  .join('\n\n')}

Output format:
1. [Category]: [Pattern description]
2. [Category]: [Pattern description]
...

Be concise and actionable.`;

  const result = await getSummarizerModel().generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 300,
    },
  });

  return result.response.text().trim();
}

/**
 * Compress approval patterns into ~250 tokens
 */
export async function summarizeApprovals(
  approvals: FeedbackWindow['approvals']
): Promise<string> {
  if (approvals.length === 0) {
    return 'No approved ideas yet.';
  }

  // Group by domain pair and mode
  const domainPairs = approvals.reduce(
    (acc, a) => {
      const key = a.domain_pair.sort().join(' × ');
      if (!acc[key]) acc[key] = 0;
      acc[key]++;
      return acc;
    },
    {} as Record<string, number>
  );

  const modes = approvals.reduce(
    (acc, a) => {
      if (!acc[a.frontier_mode]) acc[a.frontier_mode] = 0;
      acc[a.frontier_mode]++;
      return acc;
    },
    {} as Record<string, number>
  );

  const prompt = `Compress these approval patterns into 3-5 insights (max 250 tokens):

**Approved ideas** (${approvals.length} total):
${approvals.slice(0, 10).map((a) => `- ${a.title}`).join('\n')}

**Top domain pairs:**
${Object.entries(domainPairs)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([pair, count]) => `- ${pair}: ${count} approvals`)
  .join('\n')}

**Top modes:**
${Object.entries(modes)
  .sort((a, b) => b[1] - a[1])
  .map(([mode, count]) => `- ${mode}: ${count} approvals`)
  .join('\n')}

Output format:
1. [Insight about successful patterns]
2. [Insight about successful patterns]
...

Be concise and actionable.`;

  const result = await getSummarizerModel().generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 300,
    },
  });

  return result.response.text().trim();
}

/**
 * Create and store feedback summary
 */
export async function createFeedbackSummary(
  userId: string,
  windowDays: number = 21
): Promise<FeedbackSummary | null> {
  const window = await getFeedbackWindow(userId, windowDays);

  if (window.rejections.length === 0 && window.approvals.length === 0) {
    console.log('No feedback to summarize yet');
    return null;
  }

  const [rejectionSummary, approvalSummary] = await Promise.all([
    summarizeRejections(window.rejections),
    summarizeApprovals(window.approvals),
  ]);

  const totalReviewed = window.rejections.length + window.approvals.length;
  const approvalRate = window.approvals.length / totalReviewed;

  const { data, error } = await supabase
    .from('ie_feedback_summaries')
    .insert({
      user_id: userId,
      window_start: window.start.toISOString().split('T')[0],
      window_end: window.end.toISOString().split('T')[0],
      rejection_patterns_summary: rejectionSummary,
      approval_patterns_summary: approvalSummary,
      ideas_reviewed: totalReviewed,
      approval_rate: approvalRate,
    })
    .select()
    .single();

  if (error) {
    console.error('Error storing feedback summary:', error);
    return null;
  }

  console.log(`Created feedback summary for ${totalReviewed} ideas (${(approvalRate * 100).toFixed(1)}% approval rate)`);

  return data as FeedbackSummary;
}

/**
 * Get the latest feedback summary for prompt injection
 */
export async function getLatestFeedbackSummary(
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('ie_feedback_summaries')
    .select('*')
    .eq('user_id', userId)
    .order('window_end', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  const summary = `**Patterns to avoid:**\n${data.rejection_patterns_summary}\n\n**Patterns that work:**\n${data.approval_patterns_summary}`;

  return summary;
}
