/**
 * Onboarding chat — adaptive coverage planner
 *
 * Replaces the legacy /api/utilities?resource=analyze style pipeline for the
 * duration of the live conversation. One endpoint, two actions:
 *
 *   POST /api/onboarding-chat?action=start
 *     → returns { grid, anchor_question }
 *
 *   POST /api/onboarding-chat?action=turn
 *     body: { grid, latest_transcript, latest_question, latest_target_slot, skipped }
 *     → runs the planner, applies the decision to the grid, returns
 *       { decision, grid, newly_filled_slots, stopping_hint }
 *
 * Final analysis (themes/insight/project suggestions) stays on
 * /api/utilities?resource=analyze, now extended to accept a coverage grid.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  newCoverageGrid,
  runPlanner,
  applyDecisionToGrid,
  newlyFilledSlots,
  computeStoppingHint,
  ANCHOR_QUESTION,
} from './_lib/onboarding/coverage.js'
import type { CoverageGrid, CoverageSlotId } from '../src/types'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '2mb',
    },
  },
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const action = (req.query.action as string) || 'turn'

  try {
    if (action === 'start') {
      const grid = newCoverageGrid()
      return res.status(200).json({
        grid,
        anchor_question: ANCHOR_QUESTION,
      })
    }

    if (action === 'turn') {
      return handleTurn(req, res)
    }

    return res.status(400).json({ error: `Unknown action: ${action}` })
  } catch (err: any) {
    console.error('[onboarding-chat] handler error:', err?.message, err?.stack)
    return res.status(500).json({ error: 'Onboarding chat error' })
  }
}

async function handleTurn(req: VercelRequest, res: VercelResponse) {
  const {
    grid,
    latest_transcript,
    latest_question,
    latest_target_slot,
    skipped,
  } = (req.body || {}) as {
    grid: CoverageGrid
    latest_transcript: string
    latest_question: string
    latest_target_slot: CoverageSlotId | null
    skipped: boolean
  }

  if (!grid || !grid.slots || !Array.isArray(grid.turns)) {
    return res.status(400).json({ error: 'Invalid grid' })
  }
  if (typeof latest_question !== 'string' || latest_question.length === 0) {
    return res.status(400).json({ error: 'latest_question is required' })
  }

  const isSkipped = Boolean(skipped) || isSkipTranscript(latest_transcript)
  const transcript = isSkipped ? '' : (latest_transcript || '').trim()

  const decision = await runPlanner({
    grid,
    latest_transcript: transcript,
    latest_question,
    latest_target_slot: latest_target_slot ?? null,
    skipped: isSkipped,
  })

  const nextGrid = applyDecisionToGrid(grid, {
    question: latest_question,
    transcript,
    target_slot: latest_target_slot ?? null,
    skipped: isSkipped,
    decision,
  })

  const filled = newlyFilledSlots(grid, nextGrid)

  // Server-side stopping hint (independent of planner's should_stop) — use as
  // an extra safety check on the client.
  const stopping_hint = computeStoppingHint(nextGrid, decision.depth_signal)

  // If the hard ceiling or coverage target says stop, override planner.
  const forcedStop = stopping_hint.should_stop

  return res.status(200).json({
    decision: forcedStop
      ? { ...decision, should_stop: true, next_move: 'stop', next_question: null, next_slot_target: null }
      : decision,
    grid: forcedStop
      ? { ...nextGrid, completed_at: new Date().toISOString() }
      : nextGrid,
    newly_filled_slots: filled,
    stopping_hint,
  })
}

function isSkipTranscript(t: string | undefined | null): boolean {
  if (!t) return true
  const cleaned = t.trim().toLowerCase()
  if (cleaned.length === 0) return true
  if (/^(skip|pass|dunno|i don'?t know|no idea|nothing|idk)\.?$/.test(cleaned)) return true
  // Very short non-answers (< 3 meaningful words)
  const words = cleaned.split(/\s+/).filter(w => w.length > 2)
  if (words.length < 3) return true
  return false
}
