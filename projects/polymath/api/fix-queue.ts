import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase, isSupabaseConfigured } from './_lib/idea-engine-v2/supabase.js'
import { draftFix } from './_lib/fix-queue/drafter.js'
import { executeFix } from './_lib/fix-queue/runner.js'
import type { FixDraft, FixStatus } from './_lib/fix-queue/types.js'

const USER_ID = process.env.IDEA_ENGINE_USER_ID

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action as string

  // Cron actions require bearer token auth
  const cronActions = ['draft-pending', 'run-fixes']
  if (cronActions.includes(action)) {
    const authHeader = req.headers.authorization
    const expectedToken = process.env.IDEA_ENGINE_SECRET
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  if (!USER_ID || !isSupabaseConfigured) {
    return res.status(500).json({ error: 'Missing configuration' })
  }

  try {
    switch (action) {
      case 'draft-pending':
        return await handleDraftPending(res)
      case 'run-fixes':
        return await handleRunFixes(res)
      case 'approve':
        return await handleApprove(req, res)
      case 'reject':
        return await handleReject(req, res)
      case 'list':
        return await handleList(req, res)
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }
  } catch (error) {
    console.error(`[fix-queue] ${action} failed:`, error)
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Cron job: Pick up automatable annoyances with draft_pending status,
 * generate fix drafts using AI, and store them for approval.
 */
async function handleDraftPending(res: VercelResponse) {
  // Find fix queue list items that need drafting
  const { data: fixQueue } = await supabase
    .from('lists')
    .select('id')
    .eq('user_id', USER_ID)
    .eq('type', 'fix')
    .maybeSingle()

  if (!fixQueue) {
    return res.json({ drafted: 0, message: 'No fix queue exists yet' })
  }

  // Get items needing drafts
  const { data: pendingItems } = await supabase
    .from('list_items')
    .select('*')
    .eq('list_id', fixQueue.id)
    .eq('user_id', USER_ID)
    .not('metadata->automatable', 'eq', 'false')
    .filter('metadata->fix_status', 'eq', 'draft_pending')
    .order('created_at', { ascending: true })
    .limit(5) // Draft up to 5 per run

  if (!pendingItems?.length) {
    return res.json({ drafted: 0, message: 'No pending items to draft' })
  }

  // Get user email for fix actions
  const { data: userData } = await supabase.auth.admin.getUserById(USER_ID!)
  const userEmail = userData?.user?.email || ''

  let drafted = 0
  const results: Array<{ item: string; status: string; draft?: FixDraft }> = []

  for (const item of pendingItems) {
    const meta = item.metadata || {}

    const draft = await draftFix({
      content: item.content,
      original_thought: meta.original_thought || '',
      fix_hint: meta.fix_hint || '',
      severity: meta.severity || 'annoying',
      user_email: userEmail
    })

    if (draft) {
      // Store the draft in the list item metadata
      await supabase
        .from('list_items')
        .update({
          metadata: {
            ...meta,
            fix_status: 'drafted' as FixStatus,
            fix_draft: draft
          }
        })
        .eq('id', item.id)

      drafted++
      results.push({ item: item.content, status: 'drafted', draft })
    } else {
      // AI determined this can't be automated — mark as manual
      await supabase
        .from('list_items')
        .update({
          metadata: {
            ...meta,
            fix_status: 'manual' as FixStatus
          }
        })
        .eq('id', item.id)

      results.push({ item: item.content, status: 'manual' })
    }
  }

  return res.json({ drafted, total: pendingItems.length, results })
}

/**
 * Cron job: Execute all approved fixes whose schedule matches now.
 * Uses a simple cron-matching approach against the current time.
 */
async function handleRunFixes(res: VercelResponse) {
  const { data: fixQueue } = await supabase
    .from('lists')
    .select('id')
    .eq('user_id', USER_ID)
    .eq('type', 'fix')
    .maybeSingle()

  if (!fixQueue) {
    return res.json({ run: 0, message: 'No fix queue exists yet' })
  }

  // Get all approved (deployed) fixes
  const { data: deployedItems } = await supabase
    .from('list_items')
    .select('*')
    .eq('list_id', fixQueue.id)
    .eq('user_id', USER_ID)
    .filter('metadata->fix_status', 'eq', 'deployed')

  if (!deployedItems?.length) {
    return res.json({ run: 0, message: 'No deployed fixes to run' })
  }

  const now = new Date()
  const results = []
  let runCount = 0

  for (const item of deployedItems) {
    const draft = item.metadata?.fix_draft as FixDraft | undefined
    if (!draft?.schedule?.cron) continue

    // Check if this fix should run now (within the cron window)
    if (shouldRunNow(draft.schedule.cron, now)) {
      const result = await executeFix(draft)
      runCount++
      results.push(result)

      // Record last run time
      await supabase
        .from('list_items')
        .update({
          metadata: {
            ...item.metadata,
            last_run_at: now.toISOString(),
            last_run_success: result.success
          }
        })
        .eq('id', item.id)
    }
  }

  return res.json({ run: runCount, total_deployed: deployedItems.length, results })
}

/**
 * User action: Approve a drafted fix → mark as deployed.
 */
async function handleApprove(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })

  const { item_id } = req.body
  if (!item_id) return res.status(400).json({ error: 'item_id required' })

  const { data: item } = await supabase
    .from('list_items')
    .select('*')
    .eq('id', item_id)
    .single()

  if (!item) return res.status(404).json({ error: 'Item not found' })

  const meta = item.metadata || {}
  if (meta.fix_status !== 'drafted') {
    return res.status(400).json({ error: `Cannot approve item with status: ${meta.fix_status}` })
  }

  await supabase
    .from('list_items')
    .update({
      status: 'active',
      metadata: {
        ...meta,
        fix_status: 'deployed' as FixStatus,
        deployed_at: new Date().toISOString()
      }
    })
    .eq('id', item_id)

  return res.json({ approved: true, item_id, fix: meta.fix_draft })
}

/**
 * User action: Reject a drafted fix.
 */
async function handleReject(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })

  const { item_id, reason } = req.body
  if (!item_id) return res.status(400).json({ error: 'item_id required' })

  const { data: item } = await supabase
    .from('list_items')
    .select('*')
    .eq('id', item_id)
    .single()

  if (!item) return res.status(404).json({ error: 'Item not found' })

  await supabase
    .from('list_items')
    .update({
      metadata: {
        ...item.metadata,
        fix_status: 'rejected' as FixStatus,
        rejection_reason: reason || null
      }
    })
    .eq('id', item_id)

  return res.json({ rejected: true, item_id })
}

/**
 * List all fix queue items with their statuses.
 */
async function handleList(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' })

  const status = req.query.status as string | undefined

  const { data: fixQueue } = await supabase
    .from('lists')
    .select('id')
    .eq('user_id', USER_ID)
    .eq('type', 'fix')
    .maybeSingle()

  if (!fixQueue) {
    return res.json({ items: [] })
  }

  let query = supabase
    .from('list_items')
    .select('*')
    .eq('list_id', fixQueue.id)
    .eq('user_id', USER_ID)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.filter('metadata->fix_status', 'eq', status)
  }

  const { data: items } = await query
  return res.json({ items: items || [] })
}

/**
 * Simple cron matching — checks if a cron expression matches the current time.
 * Supports: minute, hour, day-of-month, month, day-of-week
 * Runner fires every 30 min, so we match within a 30-min window.
 */
function shouldRunNow(cron: string, now: Date): boolean {
  const parts = cron.split(' ')
  if (parts.length !== 5) return false

  const [minExpr, hourExpr, domExpr, monExpr, dowExpr] = parts
  const minute = now.getUTCMinutes()
  const hour = now.getUTCHours()
  const dayOfMonth = now.getUTCDate()
  const month = now.getUTCMonth() + 1
  const dayOfWeek = now.getUTCDay()

  return (
    matchField(minExpr, minute, 30) && // 30-min window for runner frequency
    matchField(hourExpr, hour) &&
    matchField(domExpr, dayOfMonth) &&
    matchField(monExpr, month) &&
    matchField(dowExpr, dayOfWeek)
  )
}

function matchField(expr: string, value: number, window = 0): boolean {
  if (expr === '*') return true

  // Handle */n (every n)
  if (expr.startsWith('*/')) {
    const step = parseInt(expr.slice(2))
    return value % step < (window || 1)
  }

  // Handle comma-separated values
  const values = expr.split(',').map(Number)
  if (window > 0) {
    return values.some(v => Math.abs(value - v) < window)
  }
  return values.includes(value)
}
