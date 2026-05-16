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

/** Use day-of-year as a stable daily seed for rotating copy */
function dayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function pick<T>(arr: T[]): T {
  return arr[dayOfYear() % arr.length];
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

  const { data: todayIdeas } = await supabase
    .from('ie_ideas')
    .select('status')
    .eq('user_id', userId)
    .gte('created_at', today);

  const todayGenerated = todayIdeas?.length || 0;
  const todayReviewed = todayIdeas?.filter(i => i.status !== 'pending').length || 0;
  const todayApproved = todayIdeas?.filter(i => i.status === 'approved').length || 0;

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

/** Fetch a random past approved idea to feature on quiet days */
async function getVaultIdea(userId: string): Promise<Idea | null> {
  const { data } = await supabase
    .from('ie_ideas')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .order('prefilter_score', { ascending: false })
    .limit(20);

  if (!data || data.length === 0) return null;
  return data[dayOfYear() % data.length] as Idea;
}

/**
 * Send daily digest email. Caller passes the curated high-signal subset of
 * today's approved ideas — the engine promotes every BUILD to a frontier
 * block, but only the meaningful ones surface here. Use progress.today.approved
 * for the true day's count.
 */
export async function sendDailyDigest(userId: string, ideas: Idea[]) {
  const resend = getResend();

  const highlights = ideas.filter(i => i.status === 'approved');

  const progress = await getProgressStats(userId);
  const vaultIdea = highlights.length === 0 ? await getVaultIdea(userId) : null;

  const html = highlights.length > 0
    ? generateDigestHTML(highlights, progress)
    : generateEmptyDigestHTML(progress, vaultIdea);

  const n = highlights.length;
  const total = progress.today.approved;
  const ofTotal = total > n ? ` of ${total}` : '';

  const approvedToday = progress.today.approved;
  const subject = n > 0
    ? pick([
        `${n} new idea${n === 1 ? '' : 's'}${ofTotal} worth your time today`,
        `${n}${ofTotal} idea${n === 1 ? '' : 's'} that covered new ground today`,
        `${n} idea${n === 1 ? '' : 's'} the engine hadn't found before${ofTotal}`,
        `Today's pick: ${n} idea${n === 1 ? '' : 's'} worth a look`,
        `${n} idea${n === 1 ? '' : 's'} stood out${ofTotal} today`,
      ])
    : approvedToday > 0
      ? pick([
          `${approvedToday} good idea${approvedToday === 1 ? '' : 's'} today, but none were new — they're in the app`,
          `Kept ${approvedToday} idea${approvedToday === 1 ? '' : 's'} today, all familiar ground — see the app`,
          `${approvedToday} solid idea${approvedToday === 1 ? '' : 's'} today, none new enough to feature`,
        ])
      : pick([
          'Quiet day — here\'s one worth a second look',
          'No new ideas today — revisit a past one',
          'Nothing kept today, but the engine\'s still running',
          'A slow day — one from the archive instead',
          'Nothing stood out today',
        ]);

  const { data, error } = await resend.emails.send({
    from: 'Idea Engine <onboarding@resend.dev>',
    to: DIGEST_EMAIL,
    subject: `Idea Engine — ${subject}`,
    html,
  });

  if (error) {
    console.error('Failed to send digest email:', error);
    throw error;
  }

  console.log(`Digest email sent to ${DIGEST_EMAIL} with ${highlights.length} highlights (of ${progress.today.approved} approved today)`);
  return { success: true, data, message: highlights.length > 0 ? 'Digest sent' : 'Empty digest sent (no high-signal ideas today)' };
}

function ideaCardHTML(idea: Idea, index?: number): string {
  const prefix = index !== undefined ? `${index + 1}. ` : '';
  return `
    <div style="margin-bottom: 24px; padding: 24px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #10b981;">
      <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #1e293b;">
        ${prefix}${idea.title}
      </h3>
      <p style="margin: 0 0 12px 0; font-size: 14px; line-height: 1.6; color: #475569;">
        ${idea.description}
      </p>
      <div style="display: flex; gap: 16px; font-size: 12px; color: #64748b; margin-bottom: 8px;">
        <span><strong>Domains:</strong> ${idea.domain_pair.join(' × ')}</span>
        <span><strong>Mode:</strong> ${idea.frontier_mode}</span>
      </div>
      <div style="display: flex; gap: 16px; font-size: 12px; color: #64748b;">
        <span><strong>Novelty:</strong> ${idea.novelty_score?.toFixed(2) || 'N/A'}</span>
        <span><strong>Tractability:</strong> ${idea.tractability_score?.toFixed(2) || 'N/A'}</span>
        <span><strong>Distance:</strong> ${idea.cross_domain_distance?.toFixed(2) || 'N/A'}</span>
        <span><strong>Overall:</strong> ${idea.prefilter_score?.toFixed(2) || 'N/A'}</span>
      </div>
    </div>`;
}

function progressBlockHTML(progress: ProgressStats): string {
  const approvalRate = progress.allTime.generated > 0
    ? ((progress.allTime.approved / progress.allTime.generated) * 100).toFixed(1)
    : '0';

  return `
    <div style="margin-bottom: 32px; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; color: white;">
      <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">${pick([
        'Building Block Progress',
        'The Numbers',
        'Pipeline Stats',
        'Frontier Dashboard',
        'How the Engine\'s Doing',
      ])}</h2>

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
        <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">All-Time</div>
        <div style="font-size: 13px; opacity: 0.9; line-height: 1.6;">
          ${progress.allTime.generated} generated •
          ${progress.allTime.approved} approved •
          ${progress.allTime.sparks} sparks •
          ${approvalRate}% approval rate
        </div>
      </div>
    </div>`;
}

function footerHTML(): string {
  return `
    <div style="margin-top: 48px; padding-top: 24px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 12px;">
      <p style="margin: 0;">${pick([
        'Your Idea Engine — exploring the frontier while you sleep',
        'Built by curiosity, filtered by taste',
        'The machine hums on — see you tomorrow',
        'Another day, another sweep of the possibility space',
        'Connecting dots across domains, one idea at a time',
      ])}</p>
    </div>`;
}

function generateDigestHTML(ideas: Idea[], progress: ProgressStats): string {
  const ideaRows = ideas.map((idea, i) => ideaCardHTML(idea, i)).join('');
  const n = ideas.length;
  const total = progress.today.approved;
  const ofTotal = total > n ? ` of ${total} approved` : '';

  const intro = pick([
    `${n} idea${n === 1 ? '' : 's'}${ofTotal} broke new ground today. These are the ones the engine hadn't tried before — the rest of today's good ideas are in the app.`,
    `The engine kept several ideas today. ${n}${ofTotal} of them were genuinely new — those are below. The others cover ground it's been over before.`,
    `${n} idea${n === 1 ? '' : 's'}${ofTotal} stood out today: good, and new. Featured here because the engine hadn't found these combinations before.`,
    `Your engine tried hundreds of combinations. ${n}${ofTotal} were both worth your time and new — here they are.`,
  ]);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #ffffff;">
  <div style="max-width: 680px; margin: 0 auto; padding: 40px 20px;">
    <div style="margin-bottom: 32px;">
      <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700; color: #0f172a;">
        Daily Idea Digest
      </h1>
      <p style="margin: 0 0 8px 0; font-size: 16px; color: #64748b;">
        ${intro}
      </p>
    </div>

    ${progressBlockHTML(progress)}
    ${ideaRows}
    ${footerHTML()}
  </div>
</body>
</html>
  `;
}

function generateEmptyDigestHTML(progress: ProgressStats, vaultIdea: Idea | null): string {
  const someApproved = progress.today.approved > 0;

  const n = progress.today.approved;
  const s = n === 1 ? '' : 's';
  const headline = someApproved
    ? pick([
        `${n} good idea${s} today, but none were new`,
        `Kept ${n} idea${s} — all close to ones you've seen`,
        `${n} solid idea${s}, nothing new enough to feature`,
      ])
    : pick([
        'Quiet day — nothing kept',
        'No ideas made the cut today',
        'Nothing kept — the engine\'s still running',
        'A slow day for new ideas',
        'No new ideas today',
      ]);

  const blurb = someApproved
    ? pick([
        `The engine kept ${n} idea${s} today. They're worth your time — but they sit close to ideas it has already found, so nothing gets featured up top. They're all in the app.`,
        `${n} idea${s} cleared review today: good, but not new. The engine only features ideas it hadn't tried before, and there were none of those today. See the full list in the app.`,
        `Two bars here: an idea has to be good, then it has to be new. Today's ${n} idea${s} cleared the first but not the second — they cover ground the engine has been over before. They're in the app.`,
      ])
    : pick([
        'Not every run finds something, and that\'s how it should work. A good idea has to clear two bars: worth your time, and new.',
        'Some days the combinations don\'t land. The engine will keep trying.',
        'The engine ran and reviewed, but nothing was both good and new. Tomorrow it tries again.',
        'A quiet inbox means the filter is doing its job. Weak ideas stay out.',
      ]);

  const diagnosticHTML = progress.today.generated === 0
    ? `<div style="padding: 24px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 14px; color: #92400e; line-height: 1.6;">
          <strong>Heads up:</strong> No ideas were generated in the last 24 hours. The generation workflow may not be running — check GitHub Actions.
        </p>
      </div>`
    : progress.today.reviewed === 0
      ? `<div style="padding: 24px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 24px;">
          <p style="margin: 0; font-size: 14px; color: #92400e; line-height: 1.6;">
            <strong>Heads up:</strong> ${progress.today.generated} ideas were generated but none were reviewed yet. The review workflow may not have run — check GitHub Actions.
          </p>
        </div>`
      : '';

  const vaultPreface = someApproved
    ? pick([
        'While today\'s approvals settle in the UI, here\'s an older one worth a second look:',
        'Alongside today\'s approvals, a past favourite worth revisiting:',
        'And from the archive — one the engine kept before:',
      ])
    : pick([
        'While the engine looks for something new, here\'s one it kept before:',
        'Nothing new today, but this past idea is worth another look:',
        'A different idea to chew on while the engine runs:',
        'Sometimes the best move is revisiting what you already have:',
      ]);

  const vaultHTML = vaultIdea
    ? `<div style="margin-bottom: 24px;">
        <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #0f172a;">
          ${pick(['From the Vault', 'Revisit', 'Past Gem', 'One to Reconsider', 'From the Archive'])}
        </h2>
        <p style="margin: 0 0 12px 0; font-size: 14px; color: #94a3b8;">
          ${vaultPreface}
        </p>
        ${ideaCardHTML(vaultIdea)}
      </div>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #ffffff;">
  <div style="max-width: 680px; margin: 0 auto; padding: 40px 20px;">
    <div style="margin-bottom: 32px;">
      <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700; color: #0f172a;">
        Daily Idea Digest
      </h1>
      <p style="margin: 0 0 8px 0; font-size: 16px; color: #64748b;">
        ${headline}
      </p>
      <p style="margin: 0; font-size: 14px; color: #94a3b8;">
        ${blurb}
      </p>
    </div>

    ${progressBlockHTML(progress)}
    ${diagnosticHTML}
    ${vaultHTML}
    ${footerHTML()}
  </div>
</body>
</html>
  `;
}
