/**
 * Utilities API - Consolidated endpoint for small utility functions
 *
 * Resources in one file (respecting 12-API cap):
 *   POST ?resource=shape-project            — One dump in, a whole project out (title, labels, steps)
 *   POST ?resource=upload-image             — Generate signed upload URL for images
 *   GET  ?resource=book-search&q=...        — Google Books auto-complete
 *   POST ?resource=analyze                  — Analyse onboarding transcripts → themes, insight, project suggestions
 *   POST ?resource=refine-idea              — Reshape an idea given voice feedback
 *   GET  ?resource=session-brief&projectId= — AI project briefing on open
 *   POST ?resource=onboarding-start         — Bootstrap a coverage grid for the contextual onboarding chat
 *   POST ?resource=onboarding-observe       — Observe-only planner call (no next-question gen) for the Live API hybrid
 *   POST ?resource=onboarding-token         — Mint an ephemeral Live API token for the browser
 *   POST ?resource=onboarding-segment       — Re-read the full voice chat and cut it into coherent memory chunks
 *   POST ?resource=reset-onboarding         — Wipe all onboarding-origin artifacts so the user can redo it
 *   GET  ?resource=project-ideas             — Latest batch of generated project ideas
 *   POST ?resource=project-ideas-feedback    — Mark an idea saved/rejected/built
 *   POST ?resource=generate-project-ideas    — Generate a fresh batch (cron + manual)
 *   GET  ?resource=idea-prompt               — User's custom "suggest an idea" brief (+ default)
 *   POST ?resource=idea-prompt               — Update or reset the brief (null/empty = reset)
 *
 *   -- Execution rebuild (SPEC.md) — folded in here rather than as their own
 *   -- files (sessions.ts / sparks.ts / proposals.ts) because that put the
 *   -- polymath deployment at 14 top-level api/*.ts files, over Vercel's
 *   -- 12-function cap and silently un-deployable. Bodies are otherwise
 *   -- unchanged from the original three files; see EXECUTION_SESSIONS_RESOURCES
 *   -- / EXECUTION_SPARKS_RESOURCES / EXECUTION_PROPOSALS_RESOURCES below for
 *   -- the exact resource lists each wrapped handler answers.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenAI } from '@google/genai'
import { getSupabaseClient } from './_lib/supabase.js'
import { getUserId } from './_lib/auth.js'
import { generateText } from './_lib/gemini-chat.js'
import { generateEmbedding, cosineSimilarity } from './_lib/gemini-embeddings.js'
import {
  newCoverageGrid,
  applyDecisionToGrid,
  newlyFilledSlots,
  computeStoppingHint,
  ANCHOR_QUESTION,
  SLOT_CATALOGUE,
} from './_lib/onboarding/coverage.js'
import { MODELS } from './_lib/models.js'
import { PLAIN_ENGLISH_RULES, CHAT_TURN_RULES } from './_lib/plain-english.js'
import { DEFAULT_IDEA_BRIEF } from './_lib/project-ideas/default-prompt.js'
import type { CoverageGrid } from '../src/types'
import { deriveSessionShapes, needsMvsSeed, measuredMvs, type SlotInput, type SessionShape } from './_lib/session-shapes.js'
import { shapeSession } from './_lib/session-shaper.js'
import { shapeProjectFromDump } from './_lib/project-shaping.js'
import { generateTaskSpine, generateFirstCutTasks, toStoredTasks } from './_lib/task-spine.js'
import { debriefSession, type DebriefOpenTask } from './_lib/debrief-matcher.js'
import { bumpEstimate } from './_lib/session-estimate.js'
import { insertAfterDone, normalizeTaskOrder } from './_lib/task-order.js'
import { judgeFinishLine } from './_lib/finish-line.js'
import { pickNextSparkType, type SparkHistoryEntry } from './_lib/spark-types.js'
import { generateSpark } from './_lib/spark-generator.js'
import { canMorphProject, anyProjectMorphedToday, MORPH_COOLDOWN_DAYS } from './_lib/morph.js'
import { considerMorph } from './_lib/morph-generator.js'
import { getStalledProjects, attachFragments, proposeComposite } from './_lib/composite-generator.js'
import { mineJoints } from './_lib/joint-miner.js'
import { runDriftDecay } from './_lib/drift-runner.js'

/** Bearer-token cron auth, duplicated per-file to match this codebase's
 *  existing convention (projects.ts and idea-engine.ts each keep their own
 *  copy rather than sharing one from _lib). */
function getCronUserId(req: VercelRequest): string | null {
  const authHeader = req.headers.authorization
  const expectedToken = process.env.IDEA_ENGINE_SECRET
  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) return null
  return process.env.IDEA_ENGINE_USER_ID ?? null
}

const EXECUTION_SESSIONS_RESOURCES = new Set([
  'shape', 'shape-project', 'replan',
  'start', 'close', 'pending-closeout', 'log-retro', 'declare-live',
  'live-reask', 'different-thing-status', 'harvest', 'mirror', 'book',
])
const EXECUTION_SPARKS_RESOURCES = new Set(['bake', 'today', 'respond'])
const EXECUTION_PROPOSALS_RESOURCES = new Set([
  'generate-morph', 'drift-decay', 'mine-joints', 'generate-composite',
  'pending', 'accept', 'reject',
])

export const config = {
  // Vercel caps execution at 60s by default. Bumped to 300s for
  // generate-project-ideas, which can run several Flash calls in a
  // retry loop. Other utilities resources run far shorter — bumping
  // the cap is harmless for them.
  maxDuration: 300,
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const resource = req.query.resource as string

  // Execution rebuild (SPEC.md) — routed by disjoint resource-name sets so
  // none of the checks below cost anything extra for the pre-existing
  // utilities resources.
  if (EXECUTION_SESSIONS_RESOURCES.has(resource)) return handleExecutionSessions(req, res)
  if (EXECUTION_SPARKS_RESOURCES.has(resource)) return handleExecutionSparks(req, res)
  if (EXECUTION_PROPOSALS_RESOURCES.has(resource)) return handleExecutionProposals(req, res)

  if (req.method === 'POST' && resource === 'upload-image') {
    return handleUploadImage(req, res)
  }

  if (req.method === 'GET' && resource === 'book-search') {
    return handleBookSearch(req, res)
  }

  if (req.method === 'POST' && resource === 'analyze') {
    return handleAnalyze(req, res)
  }

  if (req.method === 'POST' && resource === 'refine-idea') {
    return handleRefineIdea(req, res)
  }

  if (req.method === 'POST' && resource === 'onboarding-start') {
    return handleOnboardingStart(req, res)
  }

  if (req.method === 'POST' && resource === 'onboarding-observe') {
    return handleOnboardingObserve(req, res)
  }

  if (req.method === 'POST' && resource === 'onboarding-token') {
    return handleOnboardingToken(req, res)
  }

  if (req.method === 'POST' && resource === 'onboarding-segment') {
    return handleOnboardingSegment(req, res)
  }

  if (req.method === 'POST' && resource === 'reset-onboarding') {
    return handleResetOnboarding(req, res)
  }

  if (req.method === 'GET' && resource === 'session-brief') {
    return handleSessionBrief(req, res)
  }

  if (req.method === 'GET' && resource === 'project-ideas') {
    return handleProjectIdeasGet(req, res)
  }

  if (req.method === 'POST' && resource === 'project-ideas-feedback') {
    return handleProjectIdeasFeedback(req, res)
  }

  if (req.method === 'POST' && resource === 'generate-project-ideas') {
    return handleGenerateProjectIdeas(req, res)
  }

  if (resource === 'idea-prompt') {
    return handleIdeaPrompt(req, res)
  }

  return res.status(404).json({ error: 'Not found' })
}

// ── Reset Onboarding ───────────────────────────────────────────────────────
// Wipes every artifact created by the onboarding voice chat so the user can
// run it again. Each surface carries an identifying marker:
//   memories              → tags contains 'onboarding' (foundational)
//   list_items            → metadata.origin = 'onboarding'
//   lists                 → settings.origin = 'onboarding' (only delete if empty
//                           after items are gone, so we never nuke a list the
//                           user also added to manually)
//   projects              → metadata.source = 'onboarding-capture'
//   project_suggestions   → metadata.source = 'onboarding'
// Returns per-surface counts so the UI can show a meaningful confirmation.
async function handleResetOnboarding(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Sign in to access your data' })
  const supabase = getSupabaseClient()

  const result = {
    memories: 0,
    list_items: 0,
    lists: 0,
    projects: 0,
    project_suggestions: 0,
  }

  try {
    // 1. Memories tagged 'onboarding'. Use `overlaps` against the text[] tags
    //    column — catches both 'onboarding' and 'live-hybrid' markers.
    const { data: mems, error: memErr } = await supabase
      .from('memories')
      .delete()
      .eq('user_id', userId)
      .overlaps('tags', ['onboarding', 'live-hybrid'])
      .select('id')
    if (memErr) throw memErr
    result.memories = mems?.length || 0

    // 2. List items stamped with metadata.origin = 'onboarding'.
    const { data: items, error: itemsErr } = await supabase
      .from('list_items')
      .delete()
      .eq('user_id', userId)
      .eq('metadata->>origin', 'onboarding')
      .select('id, list_id')
    if (itemsErr) throw itemsErr
    result.list_items = items?.length || 0

    // 3. Onboarding-origin lists, but only if they now have zero items.
    //    Avoids clobbering lists the user has since added to manually.
    const { data: originLists, error: listFetchErr } = await supabase
      .from('lists')
      .select('id, items:list_items(count)')
      .eq('user_id', userId)
      .eq('settings->>origin', 'onboarding')
    if (listFetchErr) throw listFetchErr
    const emptyListIds = (originLists || [])
      .filter((l: any) => !l.items || l.items[0]?.count === 0)
      .map((l: any) => l.id)
    if (emptyListIds.length > 0) {
      const { data: deletedLists, error: listDelErr } = await supabase
        .from('lists')
        .delete()
        .eq('user_id', userId)
        .in('id', emptyListIds)
        .select('id')
      if (listDelErr) throw listDelErr
      result.lists = deletedLists?.length || 0
    }

    // 4. Active projects captured as in-progress during onboarding.
    const { data: projs, error: projErr } = await supabase
      .from('projects')
      .delete()
      .eq('user_id', userId)
      .eq('metadata->>source', 'onboarding-capture')
      .select('id')
    if (projErr) throw projErr
    result.projects = projs?.length || 0

    // 5. Project suggestions saved as "idea" from onboarding (these
    //    feed Mode 1 of The Moment on Home).
    const { data: sugs, error: sugErr } = await supabase
      .from('project_suggestions')
      .delete()
      .eq('user_id', userId)
      .eq('metadata->>source', 'onboarding')
      .select('id')
    if (sugErr) throw sugErr
    result.project_suggestions = sugs?.length || 0

    return res.status(200).json({ success: true, deleted: result })
  } catch (err: any) {
    console.error('[utilities/reset-onboarding] failed', err)
    return res.status(500).json({ error: err.message || 'Reset failed', deleted: result })
  }
}

// ── Upload Image ───────────────────────────────────────────────────────────
async function handleUploadImage(req: VercelRequest, res: VercelResponse) {
  try {
    const userId = await getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Sign in to upload' })

    const supabase = getSupabaseClient()
    const { fileName, fileType } = req.body

    if (!fileName || !fileType) {
      console.error('[utilities/upload-image] Missing required fields:', { fileName, fileType })
      return res.status(400).json({
        error: 'Missing required fields: fileName, fileType',
        details: 'Both fileName and fileType are required'
      })
    }

    // Validate file type
    if (!fileType.startsWith('image/')) {
      console.error('[utilities/upload-image] Invalid file type:', fileType)
      return res.status(400).json({
        error: 'Invalid file type',
        details: 'Only image files are allowed'
      })
    }

    console.log('[utilities/upload-image] Generating signed URL for:', { fileName, fileType })

    // Create a Signed Upload URL
    // Tries to upload to 'thought-images' bucket
    // The token allows uploading a specific file for a limited time (e.g. 60s)
    const { data, error } = await supabase.storage
      .from('thought-images')
      .createSignedUploadUrl(fileName)

    if (error) {
      console.error('[utilities/upload-image] Supabase error creating signed URL:', {
        message: error.message,
        name: error.name
      })
      return res.status(500).json({
        error: 'Failed to create upload URL',
        details: error.message || 'Supabase storage error'
      })
    }

    if (!data || !data.signedUrl) {
      console.error('[utilities/upload-image] No signed URL returned from Supabase')
      return res.status(500).json({
        error: 'Failed to create upload URL',
        details: 'No signed URL returned from storage'
      })
    }

    // Return the signed URL for the frontend to PUT the file to
    // And the public URL for reference after upload
    const { data: publicUrlData } = supabase.storage
      .from('thought-images')
      .getPublicUrl(fileName)

    console.log('[utilities/upload-image] Successfully generated URLs for:', fileName)

    return res.status(200).json({
      success: true,
      signedUrl: data.signedUrl,
      path: data.path, // Internal storage path
      token: data.token, // Upload token if needed manually
      publicUrl: publicUrlData.publicUrl
    })

  } catch (error) {
    console.error('[utilities/upload-image] Unexpected error:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return res.status(500).json({
      error: 'Upload preparation failed',
      details: error instanceof Error ? error.message : String(error)
    })
  }
}

// ── Book Search ────────────────────────────────────────────────────────────
async function handleBookSearch(req: VercelRequest, res: VercelResponse) {
  const query = (req.query.q as string || '').trim()
  if (!query || query.length < 2) {
    return res.status(400).json({ error: 'Query too short' })
  }

  const apiKey = process.env.GOOGLE_BOOKS_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Google Books API key not configured' })
  }

  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5&key=${apiKey}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(`Google Books API error: ${response.status}`)
    }

    const data: any = await response.json()
    const results = (data.items || []).map((item: any) => {
      const info = item.volumeInfo || {}
      return {
        title: info.title || 'Untitled',
        author: (info.authors || []).join(', ') || 'Unknown author',
        thumbnail: (info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '').replace('http://', 'https://'),
        description: (info.description || '').slice(0, 200),
      }
    })

    return res.status(200).json({ results })
  } catch (error: any) {
    console.error('[utilities/book-search] Book search error:', error.message)
    return res.status(500).json({ error: 'Book search failed' })
  }
}

// ── Analyze ────────────────────────────────────────────────────────────────
async function handleAnalyze(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Sign in to access your data' })
  const { responses, books, coverage_grid } = req.body as {
    responses?: Array<{ transcript: string; question_number: number }>
    books?: Array<{ title: string; author: string }>
    /** New: adaptive onboarding chat feeds the full coverage grid. */
    coverage_grid?: {
      turns: Array<{
        index: number
        question: string
        transcript: string
        target_slot: string | null
        skipped: boolean
      }>
      slots: Record<string, {
        id: string
        status: string
        confidence: number
        grounding_phrases: string[]
      }>
    }
  }

  const hasGrid = !!coverage_grid && Array.isArray(coverage_grid.turns) && coverage_grid.turns.length > 0
  const hasResponses = Array.isArray(responses) && responses.length > 0

  if (!hasGrid && !hasResponses) {
    return res.status(400).json({ error: 'No responses or coverage_grid provided' })
  }

  const legacyQuestions = [
    "What's been on your mind lately — something you're in the middle of?",
    "What's something you made or figured out recently that felt good?",
    "Pick a topic you're genuinely curious about and just talk about it.",
    "What's something you're good at that most people wouldn't guess?",
    "What's an idea you keep coming back to — something you'd love to build or try?",
  ]

  try {
    let transcriptBlock: string
    let coverageHint = ''

    if (hasGrid) {
      // Adaptive onboarding path — richer context (question + slot target + phrases)
      transcriptBlock = coverage_grid!.turns
        .filter(t => !t.skipped && t.transcript.trim().length > 0)
        .map(t => {
          const slotTag = t.target_slot ? ` [slot: ${t.target_slot}]` : ''
          return `Turn ${t.index}${slotTag}\nQ: ${t.question}\nA: ${t.transcript}`
        })
        .join('\n\n')

      const filledSlots = Object.values(coverage_grid!.slots)
        .filter(s => s.confidence >= 0.6)
        .map(s => `${s.id}: ${s.grounding_phrases.slice(0, 4).join(' / ')}`)

      if (filledSlots.length > 0) {
        coverageHint = `\n\nSignal the planner extracted, by dimension:\n${filledSlots.map(s => `- ${s}`).join('\n')}`
      }
    } else {
      // Legacy 5-question path (kept for any unmigrated callers).
      transcriptBlock = responses!
        .map((r) => `Q${r.question_number} ("${legacyQuestions[r.question_number - 1] || ''}"): "${r.transcript}"`)
        .join('\n\n')
    }

    const bookBlock = books && books.length > 0
      ? `\n\nThey also shared 3 books they've enjoyed:\n${books.map((b, i) => `${i + 1}. "${b.title}" by ${b.author}`).join('\n')}`
      : ''

    const prompt = `You've just listened to someone talk about their life, interests, and skills. Read between the lines — notice what connects across what they said. Be specific, not generic.

Below are their responses to an adaptive onboarding chat — spoken out loud as voice notes, so the language is natural and conversational. ${books && books.length > 0 ? 'They also shared a few books they\'ve enjoyed.' : ''}

${transcriptBlock}${coverageHint}${bookBlock}

═══════ HOW TO WRITE ═══════
${PLAIN_ENGLISH_RULES}
Never invent hyphenated phrases in scare-quotes ("friction-over-function," "blind-edit"). If a term needs scare-quotes, rewrite it.
No analyst voice ("Your multifaceted engagement with X reveals..."). Talk like a friend who's been paying attention.

Bad first_insight: "Your multifaceted engagement with both technical systems and emotive craft reveals a creative duality."
Good first_insight: "There's a thread between your 'I keep drilling down into the same algorithm' and your 'I just want the song to feel right' — both are you refusing to stop until it clicks."

═══════ THE JOB ═══════
Read deeply between the lines — not just summarise what they said, but notice what links up across the different things they talked about — stuff they probably haven't connected themselves yet.

Return a JSON object with these fields:

{
  "themes": ["...", "..."],
  // 4-6 recurring themes. Use short phrases (2-4 words), not single words.
  // Look for themes that connect ACROSS multiple responses, not just within one.

  "capabilities": ["...", "..."],
  // 3-5 skills or abilities evident from their responses.
  // Include both explicit skills they mentioned AND implicit ones
  // (e.g. if they described debugging a complex system, "systematic debugging" is a capability).

  "patterns": ["...", "..."],
  // 2-3 meta-patterns about HOW they think (not just what they think about).
  // e.g. "You gravitate toward problems where craft and logic intersect"

  "first_insight": "...",
  // THIS IS THE MOST IMPORTANT FIELD. 2-3 sentences.
  // Connect two DIFFERENT things they actually said${books && books.length > 0 ? ' (or one thing they said + one of their books)' : ''} in a way they probably haven't noticed themselves.
  // REQUIRED FORMAT: quote one short exact phrase they used (in double quotes), quote a second short exact phrase they used, and link them — "There's a thread between your [phrase 1] and your [phrase 2]: …".
  // Both quoted phrases MUST be verbatim from their transcript (use grounding_phrases above as your source). Do not paraphrase or invent.
  // The reader should feel "wow, I never connected those two things before."
  // Start with the most surprising connection. Don't warm up — go straight to the insight.

  "project_suggestions": [
    {
      "title": "...",
      // Catchy, 3-6 words. Should feel exciting, not corporate.

      "description": "...",
      // 1-2 sentences. Concrete and actionable — someone should be able to picture what this IS.

      "reasoning": "...",
      // 1-2 sentences explaining WHY this fits them specifically.
      // Reference their actual responses and/or books. Don't be generic.
      // The reader should think "that's so me."

      "is_cross_domain": true | false
      // Set true on EXACTLY ONE of the three — the one that combines their
      // cross_domain_curiosity slot with another slot (or, if cross_domain
      // was skipped, the one combining the two most distant slots). The
      // other two must be false. This is the "left-field pick" the UI
      // labels distinctly.
    }
  ]
  // Generate exactly 3 project suggestions.
  // Exactly ONE must carry is_cross_domain: true (see above).
  // Each should combine at least 2 different capabilities or interests from their responses.
  // Make them diverse: one practical/buildable, one creative/expressive, one ambitious/stretch.
  // They should feel personal and surprising — not obvious.
  // Each title should be a noun phrase or verb phrase, not a sentence. "Ambient Recipe Engine" not "Build an Ambient Recipe Engine". Think album title, not task description.
}

Be warm but not sycophantic. Be specific, not generic. Surprise them.`

    const result = await generateText(prompt, {
      maxTokens: 2048,
      temperature: 0.8,
      responseFormat: 'json',
    })

    const analysis = JSON.parse(result)

    // Normalise suggestions and enforce the "exactly one cross-domain" rule.
    // If the model forgot to flag any, pick the first; if it flagged several,
    // keep only the first. Keeps the UI's "left-field pick" label honest.
    const rawSuggestions = Array.isArray(analysis.project_suggestions)
      ? analysis.project_suggestions.slice(0, 3)
      : []
    const firstFlagged = rawSuggestions.findIndex((s: any) => s?.is_cross_domain === true)
    const crossDomainIdx = firstFlagged >= 0 ? firstFlagged : 0
    const suggestions = rawSuggestions.map((s: any, i: number) => ({
      title: typeof s?.title === 'string' ? s.title : '',
      description: typeof s?.description === 'string' ? s.description : '',
      reasoning: typeof s?.reasoning === 'string' ? s.reasoning : '',
      is_cross_domain: rawSuggestions.length > 0 && i === crossDomainIdx,
    }))

    const response = {
      capabilities: analysis.capabilities || [],
      themes: analysis.themes || [],
      patterns: analysis.patterns || [],
      first_insight: analysis.first_insight || 'Your thoughts are saved. Start a project to see how they connect.',
      project_suggestions: suggestions,
    }

    return res.status(200).json(response)
  } catch (error: any) {
    console.error('[utilities/analyze] Analysis error:', error.message)
    // Return minimal fallback so the user isn't stuck. `analysis_failed` lets
    // the client show a gentler "we're still catching up" message rather
    // than pretending this was a normal empty result.
    return res.status(200).json({
      capabilities: [],
      themes: [],
      patterns: [],
      first_insight: 'Your thoughts are saved. Start a project to see how they connect.',
      project_suggestions: [],
      analysis_failed: true,
    })
  }
}

// ── Onboarding Segment ─────────────────────────────────────────────────────
// The Live onboarding chat fires `turnComplete` after every back-and-forth.
// Previously we saved each user turn as its own foundational memory, which
// fragmented thoughts that spanned two or three turns. This endpoint replaces
// that: it reads the whole conversation once at the end and re-cuts it into
// coherent sections grouped by topic, so related turns stay together and
// stray asides don't get promoted to standalone notes.
async function handleOnboardingSegment(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Sign in to access your data' })
  const { coverage_grid } = req.body as {
    coverage_grid?: {
      turns: Array<{
        index: number
        question: string
        transcript: string
        target_slot: string | null
        skipped: boolean
      }>
    }
  }

  const turns = (coverage_grid?.turns || []).filter(
    t => !t.skipped && t.transcript && t.transcript.trim().length > 0,
  )

  if (turns.length === 0) {
    return res.status(200).json({ memories: [] })
  }

  const transcriptBlock = turns
    .map(t => `Interviewer: ${t.question}\nUser: ${t.transcript}`)
    .join('\n\n')

  const prompt = `A user just finished a voice onboarding chat. Below is the full transcript — treat it as one connected conversation, not a list of turns. Your job is to distil the whole conversation into a small set of thematic notes the user will read later.

Work in two passes:

Pass 1 — read the whole thing end to end. Note what the user actually cares about: the handful of genuine themes running through what they said. Ignore the interviewer's questions except as context. It's fine if a theme is built from fragments scattered across the chat, and fine if a single long answer touches several themes.

Pass 2 — write one note per theme. Draw on every relevant part of the conversation for that theme, wherever it appeared. Aim for 1–5 notes total; fewer is better if the conversation was tight. Drop throwaway replies ("yeah", "I don't know") unless they're part of a larger point.

Body — a note the user will read later, NOT a transcript:
- Rewrite in clean prose or tight bullets. Whatever reads naturally for the content.
- Remove filler ("um", "uh", "like", "you know", "sort of", "I mean"), false starts, repetitions, self-corrections, run-ons.
- Keep the user's own voice, vocabulary, and specifics. First person. Don't paraphrase into corporate-speak or add claims they didn't make.
- No "Interviewer:"/"User:" markers. No turn numbers. No meta commentary about the conversation itself.

Title — plain English, like a friend describing the note:
- 3–8 words. Sentence case. No quotes, no trailing punctuation, no colons.
- Describe the note the way the user would mention it in conversation, not a taxonomy label.
- Prefer everyday language over jargon. Good: "What I'm building right now", "Why I left my last job", "Books that shaped how I think". Bad: "Current professional endeavours", "Career transition rationale", "Formative literary influences".

Conversation:

${transcriptBlock}

Return JSON of the form:
{
  "memories": [
    { "title": "...", "body": "..." }
  ]
}`

  try {
    const result = await generateText(prompt, {
      maxTokens: 2048,
      temperature: 0.3,
      responseFormat: 'json',
    })
    const parsed = JSON.parse(result) as { memories?: Array<{ title?: unknown; body?: unknown }> }
    const memories = Array.isArray(parsed.memories)
      ? parsed.memories
          .map(m => ({
            title: typeof m?.title === 'string' ? m.title.trim() : '',
            body: typeof m?.body === 'string' ? m.body.trim() : '',
          }))
          .filter(m => m.body.length > 0)
      : []

    if (memories.length === 0) {
      return res.status(200).json({ memories: fallbackSingleMemory(turns) })
    }
    return res.status(200).json({ memories })
  } catch (error: any) {
    console.error('[utilities/onboarding-segment] segmentation failed:', error?.message)
    return res.status(200).json({ memories: fallbackSingleMemory(turns) })
  }
}

function fallbackSingleMemory(
  turns: Array<{ transcript: string }>,
): Array<{ title: string; body: string }> {
  const body = turns.map(t => t.transcript.trim()).filter(Boolean).join('\n\n')
  if (!body) return []
  return [{ title: 'Onboarding conversation', body }]
}

// ── Refine Idea ────────────────────────────────────────────────────────────
async function handleRefineIdea(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Sign in to access your data' })
  try {
    const { original, feedback, attempt, context } = req.body as {
      original: { title: string; description: string; reasoning: string }
      feedback: string
      attempt?: number
      context?: {
        themes?: string[]
        capabilities?: string[]
        transcripts?: string[]
        grounding_phrases?: string[]
      }
    }

    if (!original || !feedback) {
      return res.status(400).json({ error: 'original and feedback are required' })
    }

    // Grounded context keeps refinement rounds 2 and 3 anchored to what the
    // user actually said rather than drifting into generic themes.
    const transcripts = Array.isArray(context?.transcripts) ? context!.transcripts : []
    const phrases = Array.isArray(context?.grounding_phrases) ? context!.grounding_phrases : []
    const transcriptBlock = transcripts.length > 0
      ? `\n\nWhat they actually said during onboarding (use their own words when you can):\n${transcripts.map((t, i) => `${i + 1}. "${t}"`).join('\n')}`
      : ''
    const phraseBlock = phrases.length > 0
      ? `\n\nShort exact phrases to lean on (grounding):\n${phrases.slice(0, 10).map(p => `- "${p}"`).join('\n')}`
      : ''

    const prompt = `You're a friend helping me reshape a project idea I'm not quite sold on. Keep what worked, change what didn't, lean on words I actually said.

Original idea:
Title: ${original.title}
Description: ${original.description}
Why them: ${original.reasoning}

User feedback (attempt ${attempt || 1}): "${feedback}"

User's themes: ${(context?.themes || []).join(', ')}
User's capabilities: ${(context?.capabilities || []).join(', ')}${transcriptBlock}${phraseBlock}

${PLAIN_ENGLISH_RULES}
Never invent hyphenated phrases in scare-quotes. If a term needs scare-quotes, rewrite it.
No coach voice. No "this idea taps into your deep interest in X."

Bad: "A project that leverages your interest in woodwork to unlock fresh creative momentum."
Good: "Build the case for the Raspberry Pi synth. The woodwork class gave you the skill — use it."

Title is a noun or verb phrase. Think album title, not task description. "Ambient Recipe Engine" not "Build an Ambient Recipe Engine."

Reshape the idea around their feedback. Use their own words from the transcripts/phrases above where they fit. Don't fall back to generic themes.

Respond with JSON only:
{
  "title": "short noun or verb phrase",
  "description": "1-2 sentences. What it is, in plain English.",
  "reasoning": "why this fits them specifically — quote one short phrase they actually said if you can"
}`

    const response = await generateText(prompt, { responseFormat: 'json', temperature: 0.7 })
    const suggestion = JSON.parse(response)

    return res.status(200).json({ suggestion })
  } catch (error) {
    console.error('[utilities/refine-idea] Error:', error)
    return res.status(500).json({ error: 'Failed to refine idea' })
  }
}

// ── Onboarding chat — adaptive coverage planner ────────────────────────────

function handleOnboardingStart(_req: VercelRequest, res: VercelResponse) {
  try {
    const grid = newCoverageGrid()
    return res.status(200).json({ grid, anchor_question: ANCHOR_QUESTION })
  } catch (err: any) {
    console.error('[utilities/onboarding-start]', err?.message)
    return res.status(500).json({ error: 'Onboarding start failed' })
  }
}

function isOnboardingSkipTranscript(t: string | undefined | null): boolean {
  if (!t) return true
  const cleaned = t.trim().toLowerCase()
  if (cleaned.length === 0) return true
  if (/^(skip|pass|dunno|i don'?t know|no idea|nothing|idk)\.?$/.test(cleaned)) return true
  const words = cleaned.split(/\s+/).filter(w => w.length > 2)
  if (words.length < 3) return true
  return false
}

// ── Observe (Live API hybrid mode) ─────────────────────────────────────────
// The Live model runs the conversation; our planner runs in parallel after
// each turn just to update slot confidences so the coverage dots fill
// accurately and the reveal analysis has dense signal. We pass both the
// user's transcript AND the model's utterance, so the planner can see what
// was actually asked (since the model decides its own questions).

async function handleOnboardingObserve(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Sign in to access your data' })
  try {
    const { grid, user_transcript, model_utterance } = (req.body || {}) as {
      grid: CoverageGrid
      user_transcript: string
      model_utterance: string
    }

    if (!grid || !grid.slots || !Array.isArray(grid.turns)) {
      return res.status(400).json({ error: 'Invalid grid' })
    }

    const isSkipped = isOnboardingSkipTranscript(user_transcript)
    const transcript = isSkipped ? '' : (user_transcript || '').trim()
    const question = (model_utterance || '').trim() || '(question)'

    const slotCatalogue = Object.values(SLOT_CATALOGUE)
      .map(s => `- ${s.id}: ${s.what_we_want}`)
      .join('\n')

    const filledSummary = Object.values(grid.slots)
      .filter(s => s.confidence >= 0.6)
      .map(s => `- ${s.id}: ${s.grounding_phrases.slice(0, 3).join(' / ')}`)
      .join('\n') || '(none yet)'

    // Show the observer the last two turns of context. Without this, the
    // cross_domain_curiosity slot was chronically under-filled: the observer
    // couldn't judge whether the current turn was "far from" previous topics,
    // because it only saw the current turn in isolation.
    const recentTurnsBlock = grid.turns.slice(-2).length === 0
      ? '(this is the first real turn)'
      : grid.turns
          .slice(-2)
          .map(t => `Turn ${t.index} [${t.target_slot ?? '—'}]\n  Q: ${t.question}\n  A: ${t.transcript || '(skipped)'}`)
          .join('\n')

    // Cheap observe prompt — slot updates + named-entity extraction +
    // explicit project intents.
    const prompt = `You are observing an onboarding voice chat. Your job is to (1) update a coverage grid, (2) extract any concrete named things the user mentioned, and (3) catch any project the user explicitly said they want to make. No questions, no chat.

COVERAGE SLOTS:
${slotCatalogue}

CURRENTLY FILLED (confidence >= 0.6):
${filledSummary}

RECENT CONTEXT (so you can tell when the user has genuinely moved to a different domain):
${recentTurnsBlock}

LATEST TURN:
Assistant asked: "${question}"
User replied: "${transcript || '(empty / skipped)'}"

Return ONLY JSON:

{
  "slot_updates": {
    "<slot_id>": { "confidence": 0.0-1.0, "grounding_phrases": ["phrase from user"] }
  },
  "depth_signal": "high" | "medium" | "low",
  "captured_items": [
    { "type": "book" | "film" | "music" | "game" | "place" | "software" | "article" | "tech" | "event" | "quote", "name": "...", "raw_phrase": "..." }
  ],
  "captured_projects": [
    { "title": "...", "description": "...", "status": "idea" | "in_progress", "raw_phrase": "..." }
  ]
}

Rules for slot_updates:
- Only include slots whose confidence actually changed.
- grounding_phrases MUST be verbatim from the user's reply, or very near-verbatim (punctuation and capitalisation differences are fine; do not paraphrase, invent, or summarise).
- cross_domain_curiosity is ONLY filled if the user's reply is in a clearly different domain from RECENT CONTEXT above. Mere topic jumps within the same theme do not count.
- If the user's reply is empty / skipped, return slot_updates: {} and depth_signal: "low".
- depth_signal = "high" if the user said something rich and worth probing deeper; "low" if thin.

Rules for captured_items:
- ONLY include things the user named explicitly. Don't guess at titles/authors from vague allusions.
- "name" is the clean title (e.g. "Dune", "Half Moon Bay", "Neil Gaiman"). "raw_phrase" is how they said it.
- Skip generic mentions ("a book I read", "some film"). A specific proper noun must appear in the user's reply.
- Empty array is fine. Do not invent entries to pad the list.

Rules for captured_projects:
- A "project" is SOMETHING THE USER IS MAKING OR PLANS TO MAKE. A personal creative or constructive endeavour where THEY are the author/maker.
- Capture two kinds, distinguished by the "status" field:
  - status: "idea" — projects the user EXPLICITLY said they WANT to make, build, write, or start but haven't begun. "I'm thinking about making a wooden stool", "I want to write a memoir about my dad", "I've been wanting to start a podcast about urban foraging".
  - status: "in_progress" — projects the user EXPLICITLY said they're CURRENTLY making, building, writing, or running. "I'm working on my novel", "I've been building a treehouse", "I run a small Etsy shop selling pottery".
- HARD EXCLUSIONS — never capture these as projects:
  - Products, apps, services, tools, or platforms the user merely uses or subscribes to. Netflix, Claude Code, GitHub, Spotify, Figma, VS Code, Notion, ChatGPT, etc. are NOT projects — even if they say "I use X a lot" or "I want to try X". Route those to captured_items with type "software" or "tech" instead.
  - Passive interests ("I love woodworking"), generic ambitions ("I want to be more creative"), consumption habits ("I read a lot of sci-fi"), or work tasks assigned by someone else.
- "title" is a short noun-phrase project name in their voice ("Wooden stool", "Memoir about Dad", "The novel"). Not a sentence, not a product name.
- "description" is one sentence, ideally drawing on words they used. Concrete, not aspirational waffle.
- "raw_phrase" is the part of their reply that triggered the capture (must appear verbatim or near-verbatim in the transcript above). This is our anti-hallucination check.
- Empty array is fine — and is the default. Most turns won't contain a project. Only flag the obvious ones.`

    let raw: string
    try {
      raw = await generateText(prompt, {
        maxTokens: 700,
        temperature: 0.3,
        responseFormat: 'json',
        model: MODELS.DEFAULT_CHAT,
      })
    } catch (err: any) {
      console.error('[utilities/onboarding-observe] planner call failed:', err?.message)
      return res.status(200).json({
        grid,
        newly_filled_slots: [],
        stopping_hint: computeStoppingHint(grid, null),
      })
    }

    let parsed: any
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = { slot_updates: {}, depth_signal: 'medium' }
    }

    // Validate the observer's output before trusting it. The model
    // occasionally hallucinates a grounding_phrase that isn't in the user's
    // reply — drop any update whose phrases we can't verify, so the
    // coverage dots don't light up on fiction.
    const validatedUpdates: Record<string, { confidence: number; grounding_phrases: string[] }> = {}
    const haystack = transcript.toLowerCase()
    if (parsed.slot_updates && typeof parsed.slot_updates === 'object') {
      for (const [slotId, update] of Object.entries(parsed.slot_updates as Record<string, any>)) {
        if (!Object.prototype.hasOwnProperty.call(SLOT_CATALOGUE, slotId)) continue
        const confidence = typeof update?.confidence === 'number' ? Math.max(0, Math.min(1, update.confidence)) : 0
        const rawPhrases: string[] = Array.isArray(update?.grounding_phrases)
          ? update.grounding_phrases.filter((p: any) => typeof p === 'string')
          : []
        const phrases = rawPhrases
          .map(p => p.trim())
          .filter(p => p.length > 0)
          .filter(p => {
            // Accept if the phrase (or a 12-char substring of it) appears in
            // the transcript. This softens "exact substring" to verbatim-
            // or-near while still catching blatant paraphrases.
            const needle = p.toLowerCase()
            if (haystack.includes(needle)) return true
            if (needle.length >= 12 && haystack.includes(needle.slice(0, 12))) return true
            return false
          })
          .slice(0, 5)
        // Drop the whole update if the model claimed a confidence bump but
        // gave us no grounded phrases (the main anti-hallucination gate).
        if (confidence > 0 && phrases.length === 0 && transcript.length > 0) continue
        validatedUpdates[slotId] = { confidence, grounding_phrases: phrases }
      }
    }

    // Build a fake decision object and run through applyDecisionToGrid for
    // consistency with the non-hybrid path.
    const decision = {
      slot_updates: validatedUpdates,
      depth_signal: parsed.depth_signal || 'medium',
      next_move: 'deepen' as const,
      next_slot_target: null,
      next_question: null,
      reframe_mode: 'deepen' as const,
      reframe_text: '',
      should_stop: false,
    }

    const nextGrid = applyDecisionToGrid(grid, {
      question,
      transcript,
      target_slot: null, // Live decides its own targets
      skipped: isSkipped,
      decision,
    })

    const filled = newlyFilledSlots(grid, nextGrid)
    const stopping_hint = computeStoppingHint(nextGrid, decision.depth_signal)

    // Captured named entities — validate against the transcript so we don't
    // persist hallucinated items to the user's lists.
    const allowedTypes = new Set(['book', 'film', 'music', 'game', 'place', 'software', 'article', 'tech', 'event', 'quote'])
    const capturedItems: Array<{ type: string; name: string; raw_phrase: string }> = []
    if (Array.isArray(parsed.captured_items)) {
      for (const raw of parsed.captured_items as any[]) {
        if (!raw || typeof raw !== 'object') continue
        const type = typeof raw.type === 'string' ? raw.type.toLowerCase() : ''
        const name = typeof raw.name === 'string' ? raw.name.trim() : ''
        const rawPhrase = typeof raw.raw_phrase === 'string' ? raw.raw_phrase.trim() : ''
        if (!allowedTypes.has(type) || !name || name.length > 120) continue
        // At least one of the two strings must appear in the transcript
        // (case-insensitive) — otherwise the observer invented it.
        const haystackLc = haystack
        const nameLc = name.toLowerCase()
        const phraseLc = rawPhrase.toLowerCase()
        if (!haystackLc.includes(nameLc) && (!phraseLc || !haystackLc.includes(phraseLc))) continue
        capturedItems.push({ type, name, raw_phrase: rawPhrase || name })
      }
    }

    // Captured projects — both new ideas and in-progress work the user
    // mentioned. Same anti-hallucination gate: the raw_phrase must appear
    // in their reply or we drop the capture. Status splits the routing
    // downstream — "idea" lands in project_suggestions (carousel),
    // "in_progress" becomes a real Project (Projects pillar).
    const capturedProjects: Array<{
      title: string
      description: string
      status: 'idea' | 'in_progress'
      raw_phrase: string
    }> = []
    if (Array.isArray(parsed.captured_projects)) {
      for (const raw of parsed.captured_projects as any[]) {
        if (!raw || typeof raw !== 'object') continue
        const title = typeof raw.title === 'string' ? raw.title.trim() : ''
        const description = typeof raw.description === 'string' ? raw.description.trim() : ''
        const rawPhrase = typeof raw.raw_phrase === 'string' ? raw.raw_phrase.trim() : ''
        const status: 'idea' | 'in_progress' =
          raw.status === 'in_progress' ? 'in_progress' : 'idea'
        if (!title || title.length > 120) continue
        // Same near-verbatim check we use for slot grounding phrases.
        const needle = rawPhrase.toLowerCase()
        const phraseGrounded =
          needle.length > 0 &&
          (haystack.includes(needle) ||
            (needle.length >= 12 && haystack.includes(needle.slice(0, 12))))
        if (!phraseGrounded) continue
        capturedProjects.push({
          title,
          description: description.slice(0, 400),
          status,
          raw_phrase: rawPhrase,
        })
      }
    }

    return res.status(200).json({
      grid: stopping_hint.should_stop
        ? { ...nextGrid, completed_at: new Date().toISOString() }
        : nextGrid,
      newly_filled_slots: filled,
      stopping_hint,
      captured_items: capturedItems,
      captured_projects: capturedProjects,
    })
  } catch (err: any) {
    console.error('[utilities/onboarding-observe]', err?.message, err?.stack)
    return res.status(500).json({ error: 'Observe failed' })
  }
}

// ── Ephemeral Live API token ───────────────────────────────────────────────

async function handleOnboardingToken(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Sign in to access your data' })
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error('[utilities/onboarding-token] GEMINI_API_KEY missing')
      return res.status(500).json({ error: 'Server misconfigured' })
    }

    const client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { apiVersion: 'v1alpha' },
    })

    // 30-min total lifetime, 5-min handshake window. Single use.
    // No liveConnectConstraints — they enforce an exact match on the client's
    // connect config, which breaks when the client adds speechConfig, system
    // instructions, transcription configs, etc. (→ 401 on handshake). Token
    // is still tightly scoped via uses:1 + expireTime.
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    const newSessionExpireTime = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
        httpOptions: { apiVersion: 'v1alpha' },
      },
    })

    return res.status(200).json({
      token: token.name,
      model: MODELS.FLASH_LIVE,
      expiresAt: expireTime,
    })
  } catch (err: any) {
    console.error('[utilities/onboarding-token]', err?.message)
    return res.status(500).json({ error: 'Token mint failed' })
  }
}

// ── Session Brief ──────────────────────────────────────────────────────────
// AI project briefing — replaces the static "Next Action" card.

interface SessionBriefTask {
  id: string
  text: string
  done: boolean
  order: number
  task_type?: 'ignition' | 'core' | 'shutdown'
  completed_at?: string
  estimated_minutes?: number
}

interface SessionBrief {
  greeting: string
  phase: 'shaping' | 'building' | 'closing' | 'stale' | 'fresh'
  phaseLabel: string
  focusSuggestion: string
  proactiveQuestion: string
  knowledgeNudge: string | null
  momentum: 'rising' | 'steady' | 'fading' | 'cold'
  completedSinceLastVisit: string[]
  stats: {
    totalTasks: number
    completedTasks: number
    daysSinceActive: number
    progressPercent: number
  }
}

const SESSION_BRIEF_PHASE_LABELS: Record<SessionBrief['phase'], string> = {
  shaping: 'Shaping',
  building: 'Building',
  closing: 'Home Stretch',
  stale: 'Picking Back Up',
  fresh: 'Just Started',
}

function detectSessionBriefPhase(
  tasks: SessionBriefTask[],
  daysSinceActive: number,
  projectAge: number,
): SessionBrief['phase'] {
  const total = tasks.length
  const done = tasks.filter(t => t.done).length
  const progress = total > 0 ? done / total : 0
  // An empty list is the only "shaping" state now. A project used to be
  // called unshaped for having no finish line, which described most
  // ongoing crafts and made the app open by telling them so.
  if (total === 0) return 'shaping'
  if (daysSinceActive >= 14) return 'stale'
  if (projectAge <= 3) return 'fresh'
  if (progress >= 0.75 && total >= 3) return 'closing'
  return 'building'
}

function detectSessionBriefMomentum(
  daysSinceActive: number,
  recentCompletions: number,
): SessionBrief['momentum'] {
  if (daysSinceActive >= 14) return 'cold'
  if (daysSinceActive >= 7) return 'fading'
  if (recentCompletions >= 2 && daysSinceActive <= 2) return 'rising'
  return 'steady'
}

async function findSessionBriefKnowledgeNudge(
  projectTitle: string,
  projectDescription: string,
  userId: string,
  supabase: ReturnType<typeof getSupabaseClient>,
): Promise<string | null> {
  const searchText = `${projectTitle} ${projectDescription || ''}`
  let embedding: number[]
  try {
    embedding = await generateEmbedding(searchText)
  } catch {
    return null
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recentMemories } = await supabase
    .from('memories')
    .select('id, title, body, embedding, created_at')
    .eq('user_id', userId)
    .gte('created_at', sevenDaysAgo)
    .not('embedding', 'is', null)

  if (!recentMemories?.length) return null

  const matches = recentMemories
    .map(m => ({
      title: m.title || (m.body || '').slice(0, 60),
      score: cosineSimilarity(embedding, m.embedding as number[]),
      created_at: m.created_at,
    }))
    .filter(m => m.score > 0.42)
    .sort((a, b) => b.score - a.score)

  if (matches.length === 0) return null

  const best = matches[0]
  const daysAgo = Math.floor((Date.now() - new Date(best.created_at).getTime()) / (1000 * 60 * 60 * 24))
  const when = daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`
  return `You captured "${best.title}" ${when} — it connects here.`
}

async function handleSessionBrief(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Sign in to access your data' })

  const projectId = req.query.projectId as string
  if (!projectId) return res.status(400).json({ error: 'projectId is required' })

  const supabase = getSupabaseClient()
  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  if (error || !project) {
    return res.status(404).json({ error: 'Project not found' })
  }

  const tasks: SessionBriefTask[] = (project.metadata?.tasks as SessionBriefTask[]) || []
  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.done).length
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  const now = Date.now()
  const lastActive = project.last_active
    ? new Date(project.last_active).getTime()
    : new Date(project.created_at).getTime()
  const daysSinceActive = Math.floor((now - lastActive) / (1000 * 60 * 60 * 24))
  const projectAge = Math.floor((now - new Date(project.created_at).getTime()) / (1000 * 60 * 60 * 24))

  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
  const recentCompletions = tasks.filter(
    t => t.done && t.completed_at && new Date(t.completed_at).getTime() > sevenDaysAgo,
  )

  const phase = detectSessionBriefPhase(tasks, daysSinceActive, projectAge)
  const momentum = detectSessionBriefMomentum(daysSinceActive, recentCompletions.length)

  const nudgePromise = findSessionBriefKnowledgeNudge(
    project.title,
    project.description || '',
    userId,
    supabase,
  )

  const incompleteTasks = tasks.filter(t => !t.done).sort((a, b) => a.order - b.order)
  const recentCompletionTexts = recentCompletions.map(t => t.text)

  const taskSummary = incompleteTasks.length > 0
    ? `UPCOMING TASKS:\n${incompleteTasks.slice(0, 6).map((t, i) => `${i + 1}. ${t.text}${t.task_type ? ` [${t.task_type}]` : ''}`).join('\n')}`
    : 'No tasks defined yet.'

  const completionSummary = recentCompletionTexts.length > 0
    ? `RECENTLY COMPLETED (last 7 days):\n${recentCompletionTexts.map(t => `✓ ${t}`).join('\n')}`
    : ''

  const hasGoal = !!project.metadata?.end_goal
  const hasTasks = totalTasks > 0

  const prompt = `You are the finish-line coach for the project "${project.title}". Write the opening message someone sees when they open this project. Your job is to move them closer to DONE.

PROJECT: ${project.title}
${project.description ? `DESCRIPTION: ${project.description}` : ''}
${project.metadata?.motivation ? `WHY: ${project.metadata.motivation}` : ''}
${project.metadata?.end_goal ? `DONE LOOKS LIKE: ${project.metadata.end_goal}` : 'DONE: not stated — may be an ongoing thing, which is fine'}

PHASE: ${phase} (${SESSION_BRIEF_PHASE_LABELS[phase]})
MOMENTUM: ${momentum}
DAYS SINCE LAST VISIT: ${daysSinceActive}
PROGRESS: ${completedTasks}/${totalTasks} tasks (${progressPercent}%)

${taskSummary}
${completionSummary}

═══════════════════════════════════════════════════════════════════
STATE-SPECIFIC INSTRUCTIONS — follow exactly
═══════════════════════════════════════════════════════════════════

${!hasTasks ? `NOTHING ON THE LIST YET.
- greeting: Say that plainly in one line, and name what this project is, so the next line has something to hang off.
- focusSuggestion: Name the single most obvious first move, from what they've said about it.
- proactiveQuestion: "What's the first thing that has to exist for ${project.title}?"
Do NOT ask what done looks like. Plenty of real projects are ongoing and have no "done" — asking makes them invent one.
` : phase === 'stale' ? `THEY'VE BEEN AWAY FOR ${daysSinceActive} DAYS.
- greeting: Acknowledge the gap honestly and name the next step on the list, so picking it up is one decision, not two.
- focusSuggestion: One tiny concrete thing — not "get back into it" but e.g. "Open the file and read the last paragraph you wrote."
- proactiveQuestion: "What's actually blocking you from [specific next task]?"
` : phase === 'closing' ? `HOME STRETCH — ${progressPercent}% of the current list done.
- greeting: Name what's left on the list.
- focusSuggestion: Name the specific remaining task most likely to close this out.
- proactiveQuestion: "What's the last thing on this list you'd want out of the way?"
` : `BUILDING — steps in flight.
- greeting: Reference what they last did or the next step by name.
- focusSuggestion: Name the specific step to do this session.
- proactiveQuestion: ONE practical question. Examples: "Is [next task] actually the right next move, or are you avoiding [harder task]?" / "Does [next task] still need doing, or has it moved on?"
`}

Rules for ALL states:
${CHAT_TURN_RULES}
${PLAIN_ENGLISH_RULES}
- No filler. No "Great to see you", "Welcome back", "Let's dive in", "Let's explore".
- Short sentences. Say it straight. Second person ("you").
- Always reference specific steps by name. Never be vague.
- Never ask what done looks like${hasGoal ? '' : ' — this project may be an ongoing thing with no end, and that is fine'}.
- Don't stack questions with "and".

Return JSON only:
{
  "greeting": "your opening line",
  "focusSuggestion": "your one-sentence focus suggestion",
  "proactiveQuestion": "your one question"
}`

  const [aiRaw, knowledgeNudge] = await Promise.all([
    generateText(prompt, { temperature: 0.75, maxTokens: 200, responseFormat: 'json' }),
    nudgePromise,
  ])

  let greeting = ''
  let focusSuggestion = ''
  let proactiveQuestion = ''

  try {
    const parsed = JSON.parse(aiRaw)
    greeting = (parsed.greeting || '').trim()
    focusSuggestion = (parsed.focusSuggestion || '').trim()
    proactiveQuestion = (parsed.proactiveQuestion || '').trim()
  } catch {
    greeting = 'Ready to pick up where you left off.'
    focusSuggestion = incompleteTasks[0]?.text || 'Say what the first move is and it will plan from there.'
    proactiveQuestion = incompleteTasks[0]
      ? 'What would you work on if you had 30 minutes right now?'
      : `What's the first thing that has to exist for ${project.title}?`
  }

  const brief: SessionBrief = {
    greeting,
    phase,
    phaseLabel: SESSION_BRIEF_PHASE_LABELS[phase],
    focusSuggestion,
    proactiveQuestion,
    knowledgeNudge,
    momentum,
    completedSinceLastVisit: recentCompletionTexts,
    stats: {
      totalTasks,
      completedTasks,
      daysSinceActive,
      progressPercent,
    },
  }

  return res.json(brief)
}


// ── Project Ideas — homepage headline surface ─────────────────────────────
// Cron-driven generator that produces a weekly batch of 3 ranked project
// ideas synthesised from everything the user has captured. Homepage GET is
// a fast DB read; POST generate-project-ideas runs the full pipeline (~30s)
// and is callable by the user manually or by cron with the bearer token
// IDEA_ENGINE_SECRET. Feedback writes status changes for each idea.

async function handleProjectIdeasGet(req: VercelRequest, res: VercelResponse) {
  try {
    const userId = await getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Sign in to read your ideas' })

    const supabase = getSupabaseClient()
    const [activeRes, anyRes, projectsRes] = await Promise.all([
      supabase
        .from('project_ideas')
        .select('id, batch_id, rank, title, pitch, why_now, next_step, evidence, status, user_feedback, generated_at, acted_on_at, mode, pattern, confidence, shape')
        .eq('user_id', userId)
        .in('status', ['pending', 'saved', 'built'])
        .order('generated_at', { ascending: false })
        .order('rank', { ascending: true })
        .limit(15),
      supabase
        .from('project_ideas')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      // Active projects are Keep Going's job, not Ideas For You's.
      // Hide any cached idea whose evidence cites an active project so
      // older "Finish X" / "Polish X mix" ideas auto-disappear without
      // requiring the user to regenerate.
      supabase
        .from('projects')
        .select('id, title')
        .eq('user_id', userId)
        .in('status', ['active', 'upcoming']),
    ])

    if (activeRes.error) {
      console.error('[project-ideas] read failed:', activeRes.error)
      return res.status(500).json({ error: activeRes.error.message })
    }

    const rows = activeRes.data ?? []
    const latestBatchId = rows[0]?.batch_id ?? null
    const latest = latestBatchId ? rows.filter(r => r.batch_id === latestBatchId) : []

    // Suppress any idea whose evidence touches an active project. Keep
    // Going already surfaces those — re-advertising them as "ideas" is
    // duplication. Catches cached pre-fix ideas as well as anything new
    // that slipped past the generator's validator.
    //
    // Read mode is exempt from the cites-active-project check: Read uses
    // the WHOLE graveyard as evidence, including active projects, because
    // the pattern often shows up across all states. The generator already
    // drops "finish / ship X" titles in parseRead, and the title-mentions
    // guard below still applies.
    const activeProjectTitles = (projectsRes.data ?? [])
      .map((p: any) => (p.title as string | null) ?? '')
      .filter(t => t.trim().length > 0)
      .map(t => t.toLowerCase())
    const FINISH_RE = /^\s*(finish(ing)?|ship(ping)?|complete(\s+the)?|wrap\s*up|polish(\s+the)?|continue(\s+the)?)\b/i
    // EXTEND-on-active is now a first-class move for ALL modes (the user
    // asked for every project to be usable). So the old blanket "any
    // non-read idea citing / naming an active project is Keep Going
    // duplication" rule is gone. The ONE thing still forbidden, for every
    // mode, is "finish / ship / continue X" against an active project —
    // that's admin Keep Going already covers, not a new direction.
    const filtered = latest.filter((idea: any) => {
      const title = String(idea.title ?? '').toLowerCase()
      if (FINISH_RE.test(title) && activeProjectTitles.some(pt => title.includes(pt))) return false
      return true
    })

    return res.status(200).json({
      ideas: filtered,
      generated_at: filtered[0]?.generated_at ?? null,
      has_any: (anyRes.count ?? 0) > 0,
    })
  } catch (err) {
    console.error('[project-ideas] error:', err)
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
}

async function handleProjectIdeasFeedback(req: VercelRequest, res: VercelResponse) {
  try {
    const userId = await getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Sign in to give feedback' })

    const { id, status, feedback } = (req.body ?? {}) as {
      id?: string
      status?: 'saved' | 'rejected' | 'built' | 'pending'
      feedback?: string | null
    }
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'id required' })
    if (!status || !['saved', 'rejected', 'built', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'status must be one of saved|rejected|built|pending' })
    }

    const supabase = getSupabaseClient()
    const update: Record<string, unknown> = { status }
    // Stamp acted_on_at on first transition out of pending; never reset it
    // to null on revert (so analytics always know an idea was touched).
    if (status !== 'pending') update.acted_on_at = new Date().toISOString()
    if (typeof feedback === 'string') update.user_feedback = feedback.slice(0, 1000)
    else if (feedback === null) update.user_feedback = null

    const { error } = await supabase
      .from('project_ideas')
      .update(update)
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      console.error('[project-ideas-feedback] update failed:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[project-ideas-feedback] error:', err)
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
}

// Anti-spam cooldown. The two-stage Lite→Flash fast path is cheap so the
// 60s wall that used to exist (for the old expensive Pro path) is gone.
// 5 seconds is just enough to ignore accidental double-taps without
// frustrating dismiss-then-regenerate. Cron is exempt.
const GENERATION_COOLDOWN_MS = 5_000

// How long a cron-baked (or otherwise queued) pending idea may be served
// before the user button regenerates instead of re-serving it. Cron refreshes
// the queue daily, so a pending row older than this means cron has been
// silently producing nothing — without this guard the same idea gets served
// on every press for weeks. Falling through past this age self-heals the
// queue via the fast path even when cron stays silent.
const PENDING_STALE_MS = 3 * 24 * 60 * 60 * 1000

// Hard cap so a runaway paste can't blow past Gemini's input window. The
// default brief is ~1.6KB; this lets the user write a couple of pages
// before we refuse the save.
const MAX_IDEA_PROMPT_LEN = 8000

/** GET/POST handler for the user-editable "suggest a project" brief.
 *  GET returns { prompt, default, is_custom } — prompt is the user's
 *  override or null, default is the built-in fallback so the UI can
 *  pre-fill the textarea on first edit. POST takes { prompt: string|null }
 *  and stores / clears the override. */
async function handleIdeaPrompt(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Sign in to edit the brief' })
  const supabase = getSupabaseClient()

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('user_settings')
      .select('idea_prompt')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    const raw = data?.idea_prompt
    const prompt = typeof raw === 'string' && raw.trim().length > 0 ? raw : null
    return res.status(200).json({
      prompt,
      default: DEFAULT_IDEA_BRIEF,
      is_custom: prompt !== null,
    })
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    const body = (typeof req.body === 'object' && req.body) ? req.body as { prompt?: unknown } : {}
    const incoming = body.prompt
    // null OR empty/whitespace-only string both reset to default.
    let next: string | null
    if (incoming === null || incoming === undefined) {
      next = null
    } else if (typeof incoming !== 'string') {
      return res.status(400).json({ error: 'prompt must be a string or null' })
    } else if (incoming.trim().length === 0) {
      next = null
    } else if (incoming.length > MAX_IDEA_PROMPT_LEN) {
      return res.status(400).json({ error: `prompt must be ${MAX_IDEA_PROMPT_LEN} characters or fewer` })
    } else {
      next = incoming
    }
    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: userId, idea_prompt: next }, { onConflict: 'user_id' })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({
      prompt: next,
      default: DEFAULT_IDEA_BRIEF,
      is_custom: next !== null,
    })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleGenerateProjectIdeas(req: VercelRequest, res: VercelResponse) {
  const started = Date.now()
  try {
    // Detect the cron bearer FIRST so we don't run the Supabase auth path
    // on a token that obviously isn't a user JWT (which would log a
    // confusing "Failed to verify token" line every cron run).
    const auth = (req.headers['authorization'] || req.headers['Authorization' as 'authorization']) as string | undefined
    const cronSecret = process.env.IDEA_ENGINE_SECRET
    const isCronBearer = typeof auth === 'string' && !!cronSecret && auth === `Bearer ${cronSecret}`

    let userId: string | null = null
    let viaCron = false
    if (isCronBearer) {
      const cronUserId = process.env.IDEA_ENGINE_USER_ID
      if (!cronUserId) return res.status(500).json({ error: 'IDEA_ENGINE_USER_ID not configured' })
      userId = cronUserId
      viaCron = true
    } else {
      userId = await getUserId(req)
    }
    if (!userId) return res.status(401).json({ error: 'Sign in to generate ideas' })

    const supabase = getSupabaseClient()

    // Scope of the request. 'hour' is the low-commitment sibling of the
    // "suggest a project" button: ONE self-contained thing done start to
    // finish in a single hour. It's always generated fresh (no queue
    // short-circuit), stored 'superseded' so it displays once and never
    // gets re-served to a later "suggest a project" press, and it doesn't
    // touch the baked project queue. Cron never uses it.
    const rawScope = typeof req.body === 'object' && req.body && typeof (req.body as any).scope === 'string' ? (req.body as any).scope : null
    const scope: 'project' | 'hour' = rawScope === 'hour' ? 'hour' : 'project'

    // User-triggered short-circuit: if there's already a pending idea
    // sitting in the queue (cron-baked or otherwise), return it instantly
    // and skip the LLM call entirely. This is the new on-demand flow —
    // most user clicks should hit this path and feel instant. The hour
    // scope never short-circuits — the user asked for a fresh hour thing,
    // not whatever project happens to be queued.
    if (!viaCron && scope !== 'hour') {
      const { data: queued } = await supabase
        .from('project_ideas')
        .select('id, batch_id, rank, title, pitch, why_now, next_step, evidence, mode, pattern, confidence, shape, seed_pair, status, user_feedback, generated_at, acted_on_at')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('generated_at', { ascending: false })
        .order('rank', { ascending: true })
        .limit(3)
      if (queued && queued.length > 0) {
        // Staleness guard. A pending row only short-circuits while it's
        // fresh. If cron has been silently producing nothing (Read +
        // crossover both empty, no fallback), the newest pending could be
        // weeks old — re-serving it is exactly the "same idea for a month"
        // complaint. Past PENDING_STALE_MS we fall through and regenerate
        // via the fast path, which supersedes the stale row and bakes a
        // fresh one. This self-heals the queue without waiting on cron.
        const queuedAgeMs = Date.now() - new Date(queued[0].generated_at).getTime()
        if (queuedAgeMs <= PENDING_STALE_MS) {
          // Served from the pending queue — NOT regenerated. If a user
          // reports "same idea every press", this line proves it: a pending
          // row is short-circuiting generation. (Fallback rows are stored
          // 'superseded' now, so they no longer get stuck here.)
          console.log(`[generate-project-ideas] served from queue (no regen): "${queued[0].title}" generated_at=${queued[0].generated_at}`)
          return res.status(200).json({
            ideas: queued,
            batch_id: queued[0].batch_id,
            generated_at: queued[0].generated_at,
            via: 'queue',
            took_ms: Date.now() - started,
          })
        }
        console.log(`[generate-project-ideas] pending idea is stale (${Math.round(queuedAgeMs / 86_400_000)}d old) — regenerating instead of re-serving "${queued[0].title}"`)
      }
    }

    // Anti-spam cooldown — only fires on accidental rapid double-clicks
    // (< 5s apart). Two-stage fast path costs ~$0.003 per call so the
    // dollar pressure that justified a 60s cooldown is gone. The check
    // looks at the newest row of any status: if you click, dismiss, and
    // immediately click again you should get a fresh idea, not a 429.
    if (!viaCron) {
      const { data: recent } = await supabase
        .from('project_ideas')
        .select('generated_at')
        .eq('user_id', userId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (recent?.generated_at) {
        const ageMs = Date.now() - new Date(recent.generated_at).getTime()
        if (ageMs < GENERATION_COOLDOWN_MS) {
          return res.status(429).json({
            error: 'cooldown',
            retry_after_ms: GENERATION_COOLDOWN_MS - ageMs,
            message: 'One sec — give it a moment.',
          })
        }
      }
    }

    const tGatherStart = Date.now()
    const { gatherForIdeas } = await import('./_lib/project-ideas/gather.js')
    const gathered = await gatherForIdeas(supabase, userId)
    console.log(`[generate-project-ideas] gather: ${gathered.total_signal_count} signals (${gathered.memories.length}m + ${gathered.list_items.length}li + ${gathered.active_projects.length + gathered.dormant_projects.length}p + ${gathered.reading.length}r + ${gathered.highlights.length}h) in ${Date.now() - tGatherStart}ms; via=${viaCron ? 'cron' : 'user'}`)

    if (gathered.total_signal_count < 8) {
      console.log(`[generate-project-ideas] returning insufficient_data (${gathered.total_signal_count})`)
      return res.status(200).json({
        ideas: [],
        reason: 'insufficient_data',
        signal_count: gathered.total_signal_count,
        took_ms: Date.now() - started,
      })
    }

    const tLlmStart = Date.now()
    const { generateProjectIdeas } = await import('./_lib/project-ideas/generator.js')
    // User-triggered runs go through the FAST path: crossover-only on
    // Flash-Lite, ~5–10s. The cron path keeps the full pipeline (Read +
    // crossover, full Flash) — cron pre-bakes the wow ideas that user
    // clicks unlock instantly via the queue short-circuit above.
    //
    // Session feeling — when the user has tapped focused/scattered/restless
    // before re-rolling, pass it to the generator so the prompt knows what
    // kind of idea is right for right now (a focused user can take on
    // something demanding; a scattered user wants a small concrete next
    // move; a restless user wants something with a different texture).
    const rawFeeling = typeof req.body === 'object' && req.body && typeof (req.body as any).feeling === 'string' ? (req.body as any).feeling : null
    const feeling = (rawFeeling === 'focused' || rawFeeling === 'scattered' || rawFeeling === 'restless') ? rawFeeling : null

    // Custom editorial brief for the fast path — settable per-user from
    // the Settings page. NULL / empty → generator falls back to its
    // built-in default. Only the user path uses this; cron stays on the
    // strict locked-pair pipeline so longitudinal Read mode keeps its
    // full structure.
    let brief: string | null = null
    if (!viaCron) {
      const { data: prefs } = await supabase
        .from('user_settings')
        .select('idea_prompt')
        .eq('user_id', userId)
        .maybeSingle()
      const raw = prefs?.idea_prompt
      if (typeof raw === 'string' && raw.trim().length > 0) brief = raw.trim()
    }

    // force=true on BOTH paths now: the generator must never return empty.
    // Cron used to run with force=false ("silence is acceptable on cron"),
    // but a silent cron run inserts nothing, never supersedes the prior
    // pending idea, and that stale row then short-circuits every user press
    // — the "no new idea for a month" deadlock. force=true lets cron fall
    // back to permissive (then a template floor) so each run produces
    // something to refresh the queue. fast stays cron/user-specific.
    const result = await generateProjectIdeas(gathered, {
      force: true,
      fast: !viaCron,
      feeling,
      brief,
      scope,
    })
    console.log(`[generate-project-ideas] generation finished in ${Date.now() - tLlmStart}ms: ${result.ideas.length} ideas, reason=${result.reason ?? 'ok'}`)

    if (!result.ideas.length) {
      return res.status(200).json({
        ideas: [],
        reason: result.reason ?? 'no_ideas',
        attempts: result.attempts,
        signal_count: gathered.total_signal_count,
        took_ms: Date.now() - started,
      })
    }

    // Mark every prior pending idea from earlier batches as 'superseded'
    // — distinct from 'rejected' so the next prompt doesn't see a never-
    // -seen idea as "the user hated this." Saved / built ideas are left
    // intact. The hour scope skips this: an hour thing is a one-off and
    // must not wipe the baked project queue the user hasn't seen yet.
    if (scope !== 'hour') {
      await supabase
        .from('project_ideas')
        .update({ status: 'superseded' })
        .eq('user_id', userId)
        .eq('status', 'pending')
    }

    const batchId = randomUuid()
    const generated_at = new Date().toISOString()
    const rows = result.ideas.map(idea => ({
      user_id: userId,
      batch_id: batchId,
      rank: idea.rank,
      title: idea.title,
      pitch: idea.pitch,
      why_now: idea.why_now,
      next_step: idea.next_step,
      evidence: idea.evidence,
      // seed_pair is omitted (and stored as NULL) when the permissive
      // fallback fired — that path doesn't pick from a structured pair,
      // so the cooldown filter has nothing useful to track on those rows.
      seed_pair: idea.seed_pair ?? null,
      // Read rows carry mode='read' + a non-null pattern. Crossover and
      // permissive both store mode='crossover' (the column default) and
      // pattern=null. The UI branches on `mode` to render Read with the
      // pattern as the leading hero block.
      mode: idea.mode ?? 'crossover',
      pattern: idea.pattern ?? null,
      // Confidence (0–100) is the model's honest self-score on Read — the
      // home auto-surface threshold is 70. Crossover rows are NULL; the UI
      // doesn't gate them behind a threshold (they show via the button).
      confidence: idea.confidence ?? null,
      // Shape — Read mode self-tags which of the four Moment sub-shapes
      // fired. NULL on crossover, permissive fallback, and template rows.
      shape: idea.shape ?? null,
      // No-LLM template output is shown once but NOT left 'pending' — if
      // it were, the queue short-circuit would re-serve the same filler
      // on every press and the button would look permanently broken. As
      // 'superseded' it still displays now (returned below) but the next
      // press regenerates a fresh idea instead of returning this one.
      // Hour ideas are ALWAYS 'superseded' — they're one-off, ephemeral,
      // and must never sit in the pending queue where a "suggest a project"
      // press would short-circuit onto them.
      status: (scope === 'hour' || result.fallback ? 'superseded' : 'pending') as 'pending' | 'superseded',
      generated_at,
    }))

    const { data: inserted, error: insertErr } = await supabase
      .from('project_ideas')
      .insert(rows)
      .select('id, batch_id, rank, title, pitch, why_now, next_step, evidence, seed_pair, mode, pattern, shape, status, user_feedback, generated_at, acted_on_at')

    if (insertErr) {
      console.error('[generate-project-ideas] insert failed:', insertErr)
      return res.status(500).json({ error: insertErr.message })
    }

    // Outcome line: regenerated, LLM vs template, how long. A run of
    // fallback=true here (vs fallback=false) is the at-a-glance signal
    // that the model path is failing for this user.
    console.log(`[generate-project-ideas] regenerated via=${viaCron ? 'cron' : 'user'} fallback=${!!result.fallback} status=${rows[0]?.status} took=${Date.now() - started}ms "${rows[0]?.title}"`)

    return res.status(200).json({
      ideas: inserted ?? [],
      batch_id: batchId,
      generated_at,
      attempts: result.attempts,
      via: viaCron ? 'cron' : 'user',
      took_ms: Date.now() - started,
    })
  } catch (err) {
    console.error('[generate-project-ideas] error:', err)
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
}

function randomUuid(): string {
  // crypto.randomUUID is available on Node 19+; Vercel uses Node 20.
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (c?.randomUUID) return c.randomUUID()
  // Extremely defensive fallback — should not be reached in production.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0
    const v = ch === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// ─── Execution rebuild (SPEC.md) — folded in from sessions.ts/sparks.ts/  ──
// proposals.ts to stay under Vercel's 12-serverless-function cap. Bodies
// are unchanged from the original standalone files.

/** A deferred close-out older than this is left alone rather than asked about (SPEC.md). */
const DEFER_MAX_AGE_DAYS = 7
/** How long an unclosed session counts as "still going" rather than
 *  "abandoned". Longer than any real window, short enough that a session
 *  you walked away from is still asked about the same day. */
const RUNNING_GRACE_HOURS = 3

/**
 * A yes/no next to a timer would be the question-beside-two-buttons pattern
 * SPEC.md bans, so "did this move" comes from the close-out text itself via
 * a cheap capped-thinking call, not a button.
 */
async function classifyMoved(closeoutText: string): Promise<boolean> {
  const prompt = `Someone just finished a work session and said what happened.

"${closeoutText}"

Did they describe something changing -- progress, a decision, a thing made or fixed --
or did they describe not getting anywhere (stuck, distracted, nothing landed)?

${PLAIN_ENGLISH_RULES}

Respond with JSON only: { "moved": true | false }`

  try {
    const response = await generateText(prompt, { responseFormat: 'json', thinkingLevel: 'minimal' })
    const parsed = JSON.parse(response)
    return Boolean(parsed?.moved)
  } catch (e) {
    console.warn('[utilities/sessions] classifyMoved failed, defaulting to true:', e instanceof Error ? e.message : e)
    // A session that produced closeout text at all is more likely to have
    // moved than not -- default optimistic rather than silently discarding
    // it from the MVS measurement on a transient Gemini failure.
    return true
  }
}

async function handleExecutionSessions(req: VercelRequest, res: VercelResponse) {
  const userId = await getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const supabase = getSupabaseClient()
  const resource = req.query.resource as string

  // ─── START ──────────────────────────────────────────────────────────
  // ─── SHAPE-PROJECT (one dump in, a whole project out) ───────────────
  // ONE call for every creation path: title, what it is, labels, the
  // finish line IF they said one, and the first steps in order. It used
  // to be two calls with a gate between them -- extract, and then plan
  // the steps only when a finish line had been found -- which left every
  // open-ended project with an empty list and asked "what does done look
  // like?" at people who were describing an ongoing craft.
  if (resource === 'shape-project') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    const { dump, title: givenTitle } = req.body || {}
    if (typeof dump !== 'string' || !dump.trim()) {
      return res.status(400).json({ error: 'dump required' })
    }

    try {
      // Reuse the labels they already have so a new project joins an
      // existing group instead of minting a near-synonym nobody filters by.
      const { data: tagRows } = await supabase
        .from('projects')
        .select('metadata')
        .eq('user_id', userId)
        .limit(120)
      const existingTags = [...new Set(
        (tagRows || []).flatMap(r => (Array.isArray(r.metadata?.tags) ? r.metadata.tags : [])),
      )].filter((t): t is string => typeof t === 'string').slice(0, 30)

      const shaped = await shapeProjectFromDump(dump, existingTags)
      if (!shaped) return res.status(422).json({ error: "Couldn't make sense of that." })

      return res.status(200).json({
        title: (typeof givenTitle === 'string' && givenTitle.trim()) || shaped.title,
        end_goal: shaped.endGoal,
        summary: shaped.summary,
        tags: shaped.tags,
        tasks: toStoredTasks(shaped.steps),
        question: shaped.question,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not shape that project.'
      console.error('[utilities/shape-project] failed:', message)
      return res.status(500).json({ error: message })
    }
  }

  // ─── REPLAN (the spine again, on a project that already exists) ─────
  // Same engine as creation. A spine that's been ticked out, or one made
  // before the goal was written, needs redoing rather than patching by
  // hand -- and it must extend what's already agreed, not silently bin it.
  if (resource === 'replan') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    const { project_id } = req.body || {}
    if (!project_id) return res.status(400).json({ error: 'project_id required' })

    try {
      const { data: project, error: projErr } = await supabase
        .from('projects')
        .select('title, description, metadata, last_closeout_text')
        .eq('id', project_id).eq('user_id', userId).single()
      if (projErr || !project) return res.status(404).json({ error: 'project not found' })

      const { data: fragmentRows } = await supabase
        .from('fragments')
        .select('text')
        .eq('project_id', project_id).eq('user_id', userId)
        .order('created_at', { ascending: false }).limit(10)

      const metadata = project.metadata ?? {}
      const conversation: any[] = Array.isArray(metadata.conversation) ? metadata.conversation : []
      const said = [
        project.description,
        project.last_closeout_text,
        ...conversation.filter(t => t?.role === 'user' && typeof t.content === 'string').map(t => t.content),
        ...(fragmentRows || []).map(f => f.text),
      ].filter((t): t is string => typeof t === 'string' && t.trim().length > 0)

      const existingTasks: any[] = Array.isArray(metadata.tasks) ? metadata.tasks : []
      // Backwards from the finish line when the user gave one; forwards
      // from what the project is and where it got to when they didn't.
      // A project with no "done" is not a project that can't be planned.
      const steps = metadata.end_goal
        ? await generateTaskSpine({
            title: project.title,
            endGoal: metadata.end_goal,
            said,
            existingSteps: existingTasks.filter(t => !t?.done).map(t => t?.text).filter(Boolean),
          })
        : await generateFirstCutTasks({
            title: project.title,
            description: project.description || '',
            said,
          })

      if (steps.length === 0) {
        return res.status(200).json({ tasks: existingTasks, added: 0 })
      }

      // Finished work stays on the record: a re-plan replaces what's still
      // to do, never the history of what's been done.
      const doneTasks = existingTasks.filter(t => t?.done)
      const nextTasks = normalizeTaskOrder([...doneTasks, ...toStoredTasks(steps, new Date(), doneTasks.length)])
      await supabase.from('projects')
        .update({ metadata: { ...metadata, tasks: nextTasks, is_shaped: true } })
        .eq('id', project_id).eq('user_id', userId)

      return res.status(200).json({ tasks: nextTasks, added: steps.length })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not re-plan that project.'
      console.error('[utilities/replan] failed:', message)
      return res.status(500).json({ error: message })
    }
  }

  // ─── SHAPE (the two minutes of planning) ────────────────────────────
  // No session row yet -- this is what you're agreeing to before the
  // clock starts. Called once on arrival, then again for each "no, more
  // like this" the user says at it.
  if (resource === 'shape') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    const { project_id, window_minutes, instruction, current_items, remember } = req.body || {}
    if (!project_id) return res.status(400).json({ error: 'project_id required' })

    try {
      // "remember" is the user answering the app's own "I don't know
      // enough about this yet". Storing it as a fragment is the point:
      // the app had to ask because the corpus was thin, so the answer has
      // to make the corpus less thin, not just unblock this one session.
      if (typeof remember === 'string' && remember.trim()) {
        // Route the answer by what was asked. Filing every answer as a
        // generic note meant the app kept re-asking the same question:
        // the project's shape never actually improved, so the gap that
        // triggered the question was still there next session.
        const answer = remember.trim()
        const gapKind = typeof req.body?.gap_kind === 'string' ? req.body.gap_kind : null
        const slotName = typeof req.body?.slot_name === 'string' ? req.body.slot_name : null

        const { data: proj } = await supabase
          .from('projects')
          .select('metadata, slots')
          .eq('id', project_id).eq('user_id', userId).single()
        const metadata = proj?.metadata ?? {}

        if (gapKind === 'end_goal') {
          await supabase.from('projects').update({
            metadata: { ...metadata, end_goal: answer, end_goal_source: 'guide' },
          }).eq('id', project_id).eq('user_id', userId)
        } else if (gapKind === 'first_step' || gapKind === 'next_step') {
          const tasks = Array.isArray(metadata.tasks) ? metadata.tasks : []
          await supabase.from('projects').update({
            metadata: {
              ...metadata,
              tasks: [...tasks, {
                id: `t-${Date.now()}`,
                text: answer,
                done: false,
                created_at: new Date().toISOString(),
              }],
            },
          }).eq('id', project_id).eq('user_id', userId)
        } else if (gapKind === 'slot' && slotName) {
          const slots = Array.isArray(proj?.slots) ? proj.slots : []
          await supabase.from('projects').update({
            slots: slots.map((sl: any) => (sl?.name === slotName ? { ...sl, filled: true } : sl)),
          }).eq('id', project_id).eq('user_id', userId)
        }

        // Always keep the verbatim answer too: the routed field is the
        // structure, the fragment is what they actually said, and the
        // shaper cites the words rather than the field.
        const { error: fragErr } = await supabase.from('fragments').insert({
          user_id: userId,
          project_id,
          role: gapKind === 'slot' ? 'material' : 'reference',
          ...(gapKind === 'slot' && slotName ? { fills_slot: slotName } : {}),
          text: answer,
        })
        if (fragErr) console.error('[utilities/sessions] could not save the answer:', fragErr)
        return res.status(200).json({ ok: true })
      }

      const result = await shapeSession(
        supabase,
        userId,
        project_id,
        typeof window_minutes === 'number' ? window_minutes : null,
        typeof instruction === 'string' ? instruction : null,
        Array.isArray(current_items) ? current_items.filter((x: unknown) => typeof x === 'string') : undefined,
      )
      return res.status(200).json({
        items: result.items,
        done_looks_like: result.doneLooksLike,
        source: result.source,
        needs_input: result.needsInput,
        gap_kind: result.gap?.kind ?? null,
        slot_name: result.gap?.slotName ?? null,
        confidence: result.confidence,
        friction: result.friction,
        truncated_count: result.truncatedCount,
        planned: result.planned,
        unblocked: result.unblocked,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not shape the session.'
      console.error('[utilities/sessions] shape failed:', message)
      return res.status(500).json({ error: message })
    }
  }

  if (resource === 'start') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    const { project_id, window_minutes, source } = req.body || {}
    if (!project_id) return res.status(400).json({ error: 'project_id required' })

    const { data: project, error: projectErr } = await supabase
      .from('projects')
      .select('id, title, last_closeout_text, mvs_minutes, slots')
      .eq('id', project_id)
      .eq('user_id', userId)
      .single()

    if (projectErr || !project) return res.status(404).json({ error: 'project not found' })

    const { count: priorSessionCount } = await supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', project_id)
      .eq('user_id', userId)
      .not('ended_at', 'is', null)

    const slots: SlotInput[] = Array.isArray(project.slots)
      ? project.slots.map((s: any) => ({ name: s.name, filled: !!s.filled }))
      : []

    // The planning phase agreed a list; start with it rather than
    // re-deriving one behind the user's back. Derivation is only the
    // fallback for a caller that skipped planning entirely. Each item may
    // carry the real id of the open task it's grounded in -- kept through
    // to close time so a tick can mark that task done without depending on
    // the model's session-item wording matching the task's stored text.
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : []
    type AgreedItem = { text: string; taskId: string | null; partial: boolean }
    const agreedRaw: AgreedItem[] = rawItems
      .map((entry: unknown) => {
        if (typeof entry === 'string') return { text: entry, taskId: null, partial: false }
        if (entry && typeof entry === 'object' && typeof (entry as any).text === 'string') {
          const e = entry as any
          return { text: e.text, taskId: typeof e.taskId === 'string' ? e.taskId : null, partial: e.partial === true }
        }
        return null
      })
      .filter((x: AgreedItem | null): x is AgreedItem => !!x)
      .slice(0, 6)

    // An item with no grounded taskId (a reshape line citing what the user
    // just said) only becomes a real task on the project at CLOSE, and only
    // if it was actually ticked -- not the instant Start is tapped. A
    // "pending-" id marks it as provisional through the running session;
    // resource=close is what makes it real.
    const agreed: AgreedItem[] = agreedRaw.map(({ text, taskId, partial }, i) => (
      taskId ? { text, taskId, partial } : { text, taskId: `pending-${Date.now()}-${i}`, partial }
    ))

    const shapes: SessionShape[] = agreed.length > 0
      ? agreed.map(({ text, taskId, partial }) => ({ text, source: 'shaped' as const, partial, taskId }))
      : deriveSessionShapes({
          lastClosingText: project.last_closeout_text ?? null,
          slots,
          mvsMinutes: project.mvs_minutes ?? null,
          windowMinutes: typeof window_minutes === 'number' ? window_minutes : null,
        })

    const { data: session, error: insertErr } = await supabase
      .from('sessions')
      .insert({
        user_id: userId,
        project_id,
        window_minutes: window_minutes ?? null,
        items: shapes,
        source: source ?? 'live',
      })
      .select()
      .single()

    if (insertErr) {
      console.error('[utilities/sessions] start insert failed:', insertErr)
      return res.status(500).json({ error: insertErr.message })
    }

    return res.status(200).json({
      session,
      shapes,
      ask_mvs_seed: needsMvsSeed(project.mvs_minutes ?? null, priorSessionCount ?? 0),
    })
  }

  // ─── CLOSE ──────────────────────────────────────────────────────────
  if (resource === 'close') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    const { session_id, closeout_text, mvs_seed_minutes, done_items } = req.body || {}
    if (!session_id) return res.status(400).json({ error: 'session_id required' })

    const { data: session, error: sessionErr } = await supabase
      .from('sessions')
      .select('id, project_id, started_at, user_id, items, window_minutes')
      .eq('id', session_id)
      .eq('user_id', userId)
      .single()

    if (sessionErr || !session) return res.status(404).json({ error: 'session not found' })

    const endedAt = new Date()
    const startedAt = new Date(session.started_at)
    const durationMinutes = Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000))

    // Empty is a valid, free close: a session that got interrupted or went
    // nowhere shouldn't have to manufacture something to say just to exit.
    const text = typeof closeout_text === 'string' ? closeout_text.trim() : ''
    const moved = text.length > 0 ? await classifyMoved(text) : null

    // What actually got ticked off. Until now the ticks only pre-filled the
    // close-out box and were then thrown away — so "the tasks have been
    // checked off properly" was never true of the data, and the shaper had
    // no way to know what was already finished.
    //
    // Two code traces independently found the same failure: the shaper's
    // own prompt teaches it to paraphrase the task it's grounded in ("Fix
    // the transition out of track two" -> "Play track two from the top and
    // find where it breaks"), so matching ticked text against stored task
    // text silently missed almost every real completion. Each ticked item
    // now carries the real task id it was grounded in (threaded through
    // session-grounding.ts's citation check), and that id is what gets
    // matched -- text is kept only as a fallback for items with no id
    // (the ignition move, offline-derived shapes, anything typed by hand).
    type TickedItem = { text: string; taskId: string | null; partial: boolean }
    const ticked: TickedItem[] = Array.isArray(done_items)
      ? done_items
          .map((x: unknown) => {
            if (typeof x === 'string') return { text: x, taskId: null, partial: false }
            if (x && typeof x === 'object' && typeof (x as any).text === 'string') {
              return {
                text: (x as any).text,
                taskId: typeof (x as any).taskId === 'string' ? (x as any).taskId : null,
                partial: (x as any).partial === true,
              }
            }
            return null
          })
          .filter((x: TickedItem | null): x is TickedItem => !!x)
      : []
    const tickedTaskIds = new Set(ticked.map(t => t.taskId).filter((id): id is string => !!id))
    const tickedTextLower = new Set(ticked.map(t => t.text.toLowerCase().trim()))
    const sessionItems: any[] = Array.isArray(session.items) ? session.items : []
    const itemsWithOutcome = sessionItems.map((it: any) => {
      const itText = typeof it === 'string' ? it : it?.text
      const itTaskId = typeof it === 'object' ? it?.taskId : null
      const byText = tickedTextLower.has(String(itText).toLowerCase().trim())
      // Pieces of one step share its id, so only the text says which
      // piece was ticked.
      const done = it?.partial === true ? byText : ((itTaskId && tickedTaskIds.has(itTaskId)) || byText)
      return { ...it, done }
    })

    // A split step: the session showed pieces of ONE step. Ticking every
    // piece finishes the step; ticking some of them is progress on it,
    // recorded as such, never a false "done".
    const piecesByStep = new Map<string, { total: number; ticked: string[] }>()
    for (const it of sessionItems) {
      if (!it || typeof it !== 'object' || it.partial !== true || typeof it.taskId !== 'string') continue
      const entry = piecesByStep.get(it.taskId) ?? { total: 0, ticked: [] }
      entry.total++
      if (tickedTaskIds.has(it.taskId) && tickedTextLower.has(String(it.text).toLowerCase().trim())) entry.ticked.push(String(it.text))
      piecesByStep.set(it.taskId, entry)
    }

    const { error: updateErr } = await supabase
      .from('sessions')
      .update({
        ended_at: endedAt.toISOString(),
        duration_minutes: durationMinutes,
        closeout_text: text || null,
        moved,
        items: itemsWithOutcome,
      })
      .eq('id', session_id)
      .eq('user_id', userId)

    if (updateErr) {
      console.error('[utilities/sessions] close update failed:', updateErr)
      return res.status(500).json({ error: updateErr.message })
    }

    // ── Task-list reconciliation, all in one pass ──────────────────────
    // Every write below happens against ONE in-memory working copy, so the
    // project gets exactly one update() call rather than several racing
    // against each other within this same request.
    const { data: projRow } = await supabase
      .from('projects')
      .select('title, metadata')
      .eq('id', session.project_id).eq('user_id', userId).single()
    const currentMetadata = projRow?.metadata ?? {}
    let tasks: any[] = Array.isArray(currentMetadata?.tasks) ? [...currentMetadata.tasks] : []
    let tasksChanged = false
    const markedDoneTexts: string[] = []
    const createdTexts: string[] = []
    const progressNoted: string[] = []

    const markDoneById = (id: string) => {
      const idx = tasks.findIndex(t => t?.id === id && !t?.done)
      if (idx === -1) return
      // A finished step has no "where I got to" any more.
      const { progress_note: _n, progress_at: _a, ...rest } = tasks[idx]
      tasks[idx] = { ...rest, done: true, completed_at: endedAt.toISOString() }
      tasksChanged = true
      markedDoneTexts.push(String(tasks[idx].text))
    }
    const noteProgress = (id: string, note: string) => {
      const idx = tasks.findIndex(t => t?.id === id && !t?.done)
      if (idx === -1) return
      tasks[idx] = { ...tasks[idx], progress_note: note, progress_at: endedAt.toISOString() }
      tasksChanged = true
      progressNoted.push(`${tasks[idx].text} — ${note}`)
    }
    let seq = 0
    const newTask = (text: string, done: boolean, origin: string, source: string | null) => ({
      id: `t-${endedAt.getTime()}-${seq++}`,
      text,
      done,
      created_at: endedAt.toISOString(),
      ...(done ? { completed_at: endedAt.toISOString() } : {}),
      order: tasks.length,
      origin,
      source,
    })
    const createDoneTask = (text: string, origin: string, source: string | null) => {
      tasks.push(newTask(text, true, origin, source))
      tasksChanged = true
      markedDoneTexts.push(text)
    }

    // Ticked items: id match first (survives any paraphrasing), text match
    // as a fallback for items that were never grounded to a task at all. A
    // "pending-" id is a session line that was never written to the
    // project -- ticking it is what promotes it from provisional to real;
    // left unticked, it simply never existed. A partial item is a piece of
    // a step, handled below, never a tick on the whole step.
    for (const t of ticked) {
      if (!t.taskId || t.partial) continue
      if (t.taskId.startsWith('pending-')) {
        createDoneTask(t.text, 'session', null)
        continue
      }
      markDoneById(t.taskId)
    }
    for (const t of ticked) {
      if (t.taskId || t.partial) continue
      const idx = tasks.findIndex(x => !x.done && typeof x.text === 'string' && x.text.toLowerCase().trim() === t.text.toLowerCase().trim())
      if (idx !== -1) markDoneById(tasks[idx].id)
    }
    for (const [stepId, pieces] of piecesByStep) {
      if (pieces.ticked.length === 0) continue
      if (pieces.ticked.length >= pieces.total) markDoneById(stepId)
      else noteProgress(stepId, `did: ${pieces.ticked.map(p => p.replace(/[.!?]+$/, '')).join('; ')}`)
    }

    // Voice debrief: reconciled against the WHOLE open list, not just what
    // was on screen this session -- someone regularly does something
    // unplanned mid-session, and it should still land as real progress.
    // What they said comes after the ticks, so a spoken "got as far as X"
    // on a step overrides the mechanical "did: piece one" note.
    const nextAddedTexts: string[] = []
    if (text) {
      const openForDebrief: DebriefOpenTask[] = tasks
        .filter(t => !t.done && typeof t.id === 'string' && typeof t.text === 'string')
        .map(t => ({ id: t.id, text: t.text }))
      const debrief = await debriefSession(text, openForDebrief, projRow?.title || 'this project')
      debrief.doneTaskIds.forEach(markDoneById)
      debrief.newDone.forEach(t => createDoneTask(t, 'closeout', 'you said it at the end of a session'))
      debrief.progress.forEach(p => noteProgress(p.taskId, p.note))
      // What comes next is, by definition, the very next thing: it goes at
      // the front of the open list, not after the eight steps already there.
      if (debrief.next.length > 0) {
        const incoming = debrief.next.map(t => newTask(t, false, 'closeout', 'you said it at the end of a session'))
        tasks = insertAfterDone(tasks, incoming)
        tasksChanged = true
        debrief.next.forEach(t => { createdTexts.push(t); nextAddedTexts.push(t) })
      }
    }
    if (tasksChanged) tasks = normalizeTaskOrder(tasks)

    // A task that was in this session's plan, never ticked, and the
    // session ran its full window anyway -- real evidence the estimate
    // was too low, cheap to nudge without another model call.
    if (typeof session.window_minutes === 'number' && durationMinutes >= session.window_minutes) {
      const unfinishedTaskIds = new Set(
        itemsWithOutcome
          .filter((it: any) => !it.done && typeof it.taskId === 'string' && !String(it.taskId).startsWith('pending-'))
          .map((it: any) => it.taskId),
      )
      if (unfinishedTaskIds.size > 0) {
        tasks = tasks.map(t => {
          if (!unfinishedTaskIds.has(t.id) || !t.estimate_set || typeof t.estimated_minutes !== 'number') return t
          tasksChanged = true
          return { ...t, estimated_minutes: bumpEstimate(t.estimated_minutes) }
        })
      }
    }

    // Re-entry playback for next time, and MVS seeding/recompute.
    const projectUpdate: Record<string, unknown> = {}
    if (tasksChanged) projectUpdate.metadata = { ...currentMetadata, tasks }

    if (text) {
      projectUpdate.last_closeout_text = text
      projectUpdate.last_session_ended_at = endedAt.toISOString()
    }

    if (typeof mvs_seed_minutes === 'number' && mvs_seed_minutes > 0) {
      // One-time seed from the user's own estimate, asked only on session one.
      projectUpdate.mvs_minutes = Math.round(mvs_seed_minutes)
    } else {
      const { data: movedSessions } = await supabase
        .from('sessions')
        .select('duration_minutes')
        .eq('project_id', session.project_id)
        .eq('user_id', userId)
        .eq('moved', true)
        .not('duration_minutes', 'is', null)

      const measured = measuredMvs((movedSessions ?? []).map(s => s.duration_minutes as number))
      if (measured != null) projectUpdate.mvs_minutes = measured
    }

    if (Object.keys(projectUpdate).length > 0) {
      const { error: projErr } = await supabase
        .from('projects')
        .update(projectUpdate)
        .eq('id', session.project_id)
        .eq('user_id', userId)
      if (projErr) console.warn('[utilities/sessions] project re-entry update failed (non-fatal):', projErr.message)
    }

    // The last open step just got ticked. "All tasks done" and "the finish
    // line is reached" are different things -- one cheap call reads the
    // finish line against what's actually been made and says which, so
    // the receipt can offer one honest action instead of a guess.
    let finish: { reached: boolean; reason: string } | null = null
    const openLeft = tasks.filter(t => t && !t.done).length
    const endGoal = typeof currentMetadata?.end_goal === 'string' ? currentMetadata.end_goal.trim() : ''
    if (tasksChanged && openLeft === 0 && markedDoneTexts.length > 0) {
      if (endGoal) {
        const { data: closeoutRows } = await supabase
          .from('sessions')
          .select('closeout_text')
          .eq('project_id', session.project_id)
          .eq('user_id', userId)
          .not('closeout_text', 'is', null)
          .order('ended_at', { ascending: false })
          .limit(6)
        finish = await judgeFinishLine({
          title: projRow?.title || 'this project',
          endGoal,
          doneTasks: normalizeTaskOrder(tasks).filter(t => t?.done && typeof t.text === 'string').map(t => t.text),
          closeouts: (closeoutRows || []).map(r => r.closeout_text as string).filter(Boolean),
        })
      } else {
        // No stated finish line, so there is nothing to judge against --
        // but the list emptying is still worth saying, as a fact. The
        // next session plans the next steps either way.
        finish = { reached: false, reason: "That's everything on the list." }
      }
    }

    // A brief receipt of what actually happened to the task list -- shown
    // for a beat before "Logged." rather than a silent rewrite the user
    // only discovers weeks later.
    return res.status(200).json({
      ok: true,
      duration_minutes: durationMinutes,
      moved,
      marked_done: [...new Set(markedDoneTexts)],
      created: [...new Set(createdTexts)],
      next_added: nextAddedTexts,
      progress_noted: progressNoted,
      finish,
    })
  }

  // ─── PENDING CLOSE-OUT ──────────────────────────────────────────────
  if (resource === 'pending-closeout') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' })

    const cutoff = new Date(Date.now() - DEFER_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString()
    // A session that is still RUNNING also has ended_at NULL, so without
    // an upper bound this asked "where'd you get to?" about the session
    // the user had just started, on screen next to its own live timer.
    // Nothing under three hours old is abandoned; it's in progress.
    const stillRunning = new Date(Date.now() - RUNNING_GRACE_HOURS * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('sessions')
      .select('id, project_id, started_at, window_minutes, projects(title)')
      .eq('user_id', userId)
      .is('ended_at', null)
      .gte('started_at', cutoff)
      .lt('started_at', stillRunning)
      .order('started_at', { ascending: false })
      .limit(1)

    if (error) {
      console.error('[utilities/sessions] pending-closeout query failed:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ pending: data?.[0] ?? null })
  }

  // ─── RETROACTIVE LOGGING ────────────────────────────────────────────
  // Accepts either explicit {project_id, duration_minutes}, or free text
  // ("did two hours on the decks last night") which gets parsed into both
  // via retro-parser.ts. Free text is the real path from the mirror's
  // "anything missing?" prompt -- a hardcoded duration on whichever
  // project happens to be live would make the mirror lie in a different
  // way than the gap it's meant to fix.
  if (resource === 'log-retro') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    let { project_id, duration_minutes, closeout_text } = req.body || {}
    const freeText = typeof req.body?.text === 'string' ? req.body.text.trim() : ''

    if ((!project_id || !duration_minutes) && freeText) {
      const { parseRetroText } = await import('./_lib/retro-parser.js')
      const parsed = await parseRetroText(supabase, userId, freeText)
      if (!parsed) {
        return res.status(200).json({ ok: false, reason: 'could not tell which project or how long' })
      }
      project_id = parsed.projectId
      duration_minutes = parsed.durationMinutes
      closeout_text = closeout_text || freeText
    }

    if (!project_id || !duration_minutes) {
      return res.status(400).json({ error: 'project_id and duration_minutes, or text, required' })
    }

    const durationMinutes = Math.max(1, Math.round(Number(duration_minutes)))
    const startedAt = new Date(Date.now() - durationMinutes * 60000)
    const text = typeof closeout_text === 'string' ? closeout_text.trim() : ''
    const moved = text.length > 0 ? await classifyMoved(text) : null

    const { data: session, error: insertErr } = await supabase
      .from('sessions')
      .insert({
        user_id: userId,
        project_id,
        started_at: startedAt.toISOString(),
        ended_at: new Date().toISOString(),
        duration_minutes: durationMinutes,
        closeout_text: text || null,
        moved,
        source: 'retro',
      })
      .select()
      .single()

    if (insertErr) {
      console.error('[utilities/sessions] log-retro insert failed:', insertErr)
      return res.status(500).json({ error: insertErr.message })
    }

    return res.status(200).json({ session })
  }

  // ─── DECLARE LIVE ───────────────────────────────────────────────────
  if (resource === 'declare-live') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    const { project_id } = req.body || {}
    if (!project_id) return res.status(400).json({ error: 'project_id required' })

    // The single-live-project trigger (019-execution-sessions.sql) demotes
    // any previous live project atomically -- this update doesn't need to.
    // Demote the previous star/live in the same gesture, then promote --
    // is_priority and state move together (see projects.ts set-priority for
    // why these are one concept, not two).
    await supabase
      .from('projects')
      .update({ is_priority: false, state: 'on-deck' })
      .eq('user_id', userId)
      .eq('is_priority', true)
      .neq('id', project_id)

    const { data, error } = await supabase
      .from('projects')
      .update({ state: 'live', is_priority: true, up_next_position: null })
      .eq('id', project_id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('[utilities/sessions] declare-live failed:', error)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ project: data })
  }

  // ─── LIVE-PROJECT RE-ASK ────────────────────────────────────────────
  // Evidence-driven, not on a timer (SPEC.md): if the last 3 logged
  // sessions all landed on something other than the declared live
  // project, ask once whether that's the real live project now. An
  // accurate declaration is never interrupted -- this only fires when the
  // user's actual behaviour has quietly diverged from what they said.
  if (resource === 'live-reask') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' })

    const { data: liveProject } = await supabase
      .from('projects')
      .select('id')
      .eq('user_id', userId)
      .eq('state', 'live')
      .maybeSingle()

    if (!liveProject) return res.status(200).json({ suggestion: null })

    const { data: recentSessions } = await supabase
      .from('sessions')
      .select('project_id, projects(title)')
      .eq('user_id', userId)
      .not('project_id', 'is', null)
      .order('started_at', { ascending: false })
      .limit(3)

    if (!recentSessions || recentSessions.length < 3) return res.status(200).json({ suggestion: null })

    const allElsewhere = recentSessions.every(s => s.project_id !== liveProject.id)
    const sameOtherProject = new Set(recentSessions.map(s => s.project_id)).size === 1

    if (!allElsewhere || !sameOtherProject) return res.status(200).json({ suggestion: null })

    const other = recentSessions[0] as any
    return res.status(200).json({
      suggestion: { project_id: other.project_id, title: other.projects?.title ?? 'this' },
    })
  }

  // ─── DIFFERENT-THING QUOTA ──────────────────────────────────────────
  if (resource === 'different-thing-status') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' })

    const { monthStart } = await import('./_lib/mirror.js')
    const { isDifferentThingDoneThisMonth, shouldNudgeDifferentThing } = await import('./_lib/different-thing.js')
    const start = monthStart(new Date())

    const { data } = await supabase
      .from('sessions')
      .select('source, started_at')
      .eq('user_id', userId)
      .eq('source', 'different-thing')
      .gte('started_at', start.toISOString())
      .limit(1)

    const done = isDifferentThingDoneThisMonth(data ?? [], new Date())
    return res.status(200).json({ done, should_nudge: shouldNudgeDifferentThing(done) })
  }

  // ─── HARVEST ────────────────────────────────────────────────────────
  // Manual kill, for a project the user explicitly lets go of. Never
  // deletes anything -- fragments and memories stay put, per SPEC.md's
  // "death is harvest." The automatic, silent version (drift + no recent
  // capture) is drift-runner.ts, run weekly via handleExecutionProposals.
  if (resource === 'harvest') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    const { project_id } = req.body || {}
    if (!project_id) return res.status(400).json({ error: 'project_id required' })

    const { error } = await supabase
      .from('projects')
      .update({ state: 'harvested' })
      .eq('id', project_id)
      .eq('user_id', userId)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  // ─── MIRROR ─────────────────────────────────────────────────────────
  if (resource === 'mirror') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' })

    const { aggregateMonthlyMirror, monthStart } = await import('./_lib/mirror.js')
    const start = monthStart(new Date())

    const [{ data: sessionsData }, { data: projectsData }] = await Promise.all([
      supabase
        .from('sessions')
        .select('project_id, duration_minutes')
        .eq('user_id', userId)
        .gte('started_at', start.toISOString())
        .not('project_id', 'is', null),
      supabase.from('projects').select('id, title, state').eq('user_id', userId).neq('state', 'harvested'),
    ])

    const rows = aggregateMonthlyMirror(sessionsData ?? [], (projectsData ?? []) as any)
    return res.status(200).json({ month: start.toISOString().slice(0, 7), rows })
  }

  // ─── BOOK ───────────────────────────────────────────────────────────
  // "The book needs about two hours. When?" No calendar integration in
  // v1 -- this just remembers the date so it can open pre-loaded that day.
  if (resource === 'book') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    const { project_id, when } = req.body || {}
    if (!project_id || !when) return res.status(400).json({ error: 'project_id and when required' })

    const { error } = await supabase
      .from('projects')
      .update({ booked_session_at: when })
      .eq('id', project_id)
      .eq('user_id', userId)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(404).json({ error: `Unknown resource: ${resource}` })
}

async function handleExecutionSparks(req: VercelRequest, res: VercelResponse) {
  const resource = req.query.resource as string
  const supabase = getSupabaseClient()
  const HISTORY_WINDOW = 30

  // ─── BAKE (cron) ────────────────────────────────────────────────────
  if (resource === 'bake') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    const userId = getCronUserId(req)
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { data: historyRows } = await supabase
      .from('sparks')
      .select('type, answered_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(HISTORY_WINDOW)

    const history: SparkHistoryEntry[] = (historyRows ?? []).map(r => ({
      type: r.type,
      answered: r.answered_at != null,
    }))

    const type = pickNextSparkType(history)
    const baked = await generateSpark(supabase, userId, type)

    if (!baked) {
      console.log(`[utilities/sparks] bake: type=${type} produced silence`)
      return res.status(200).json({ baked: false, type })
    }

    const { error: insertErr } = await supabase.from('sparks').insert({
      user_id: userId,
      type: baked.type,
      project_id: baked.project_id,
      text: baked.text,
      expires_at: baked.expires_at,
    })
    if (insertErr) {
      console.error('[utilities/sparks] bake insert failed:', insertErr)
      return res.status(500).json({ error: insertErr.message })
    }

    return res.status(200).json({ baked: true, type: baked.type })
  }

  // ─── TODAY ──────────────────────────────────────────────────────────
  if (resource === 'today') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' })
    const userId = await getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { data, error } = await supabase
      .from('sparks')
      .select('id, type, text, project_id, shown_at, answered_at, expires_at, projects(title)')
      .eq('user_id', userId)
      .is('answered_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      console.error('[utilities/sparks] today query failed:', error)
      return res.status(500).json({ error: error.message })
    }

    const spark = data?.[0] ?? null
    if (spark && !spark.shown_at) {
      // Mark shown on first read, not on bake -- shown_at is "the user
      // actually saw this," which the mirror/attention-budget logic and
      // future analytics need distinct from when it was generated.
      await supabase.from('sparks').update({ shown_at: new Date().toISOString() }).eq('id', spark.id)
    }

    return res.status(200).json({ spark })
  }

  // ─── RESPOND ────────────────────────────────────────────────────────
  if (resource === 'respond') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    const userId = await getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { spark_id, response_text } = req.body || {}
    if (!spark_id || !response_text) return res.status(400).json({ error: 'spark_id and response_text required' })

    const uniqueId = `spark_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const { data: memory, error: memErr } = await supabase
      .from('memories')
      .insert({
        audiopen_id: uniqueId,
        title: 'Spark response',
        body: response_text,
        orig_transcript: response_text,
        tags: [],
        audiopen_created_at: new Date().toISOString(),
        processed: false,
        user_id: userId,
      })
      .select()
      .single()

    if (memErr) {
      console.error('[utilities/sparks] respond memory insert failed:', memErr)
      return res.status(500).json({ error: memErr.message })
    }

    const { error: updateErr } = await supabase
      .from('sparks')
      .update({ answered_at: new Date().toISOString(), response_memory_id: memory.id })
      .eq('id', spark_id)
      .eq('user_id', userId)

    if (updateErr) {
      console.error('[utilities/sparks] respond spark update failed:', updateErr)
      return res.status(500).json({ error: updateErr.message })
    }

    // Kick the normal capture pipeline (embed, triage, fragment-attach) on
    // the response, same as any other voicing -- fire-and-forget.
    try {
      const { processMemory } = await import('./_lib/process-memory.js')
      processMemory(memory.id).catch(() => {})
    } catch {
      // Module not available — ignore
    }

    return res.status(200).json({ ok: true })
  }

  return res.status(404).json({ error: `Unknown resource: ${resource}` })
}

async function handleExecutionProposals(req: VercelRequest, res: VercelResponse) {
  const resource = req.query.resource as string
  const supabase = getSupabaseClient()

  // ─── GENERATE MORPH (cron) ──────────────────────────────────────────
  if (resource === 'generate-morph') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    const userId = getCronUserId(req)
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { data: recentProposals } = await supabase
      .from('proposals')
      .select('created_at')
      .eq('user_id', userId)
      .eq('kind', 'morph')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    if (anyProjectMorphedToday((recentProposals ?? []).map(p => p.created_at))) {
      return res.status(200).json({ proposed: false, reason: 'already morphed a project today' })
    }

    const { data: projects } = await supabase
      .from('projects')
      .select('id, title, description, last_session_ended_at')
      .eq('user_id', userId)
      .neq('state', 'harvested')
      .limit(100)

    // The per-project 14-day cooldown has to be checked against when a
    // project was last MORPHED, not when it was last worked on. It used
    // to be passed last_session_ended_at instead -- session recency, a
    // different question -- which meant a project you're actively
    // feeding fresh captures into (exactly where a real insight would
    // land) could never be eligible, while an abandoned one always was.
    // Rather than add a schema column for this, the `proposals` table
    // already records it: the most recent 'morph' proposal per project.
    // Anything older than the cooldown window can't affect eligibility
    // either way (canMorphProject(null) is already true), so bounding the
    // query to it keeps this cheap regardless of how much morph history
    // accumulates.
    const { data: pastMorphs } = await supabase
      .from('proposals')
      .select('project_id, created_at')
      .eq('user_id', userId)
      .eq('kind', 'morph')
      .gte('created_at', new Date(Date.now() - MORPH_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(500)

    const lastMorphedByProject = new Map<string, string>()
    for (const row of pastMorphs ?? []) {
      if (row.project_id && !lastMorphedByProject.has(row.project_id)) {
        lastMorphedByProject.set(row.project_id, row.created_at)
      }
    }

    const eligible = (projects ?? []).filter(p => canMorphProject(lastMorphedByProject.get(p.id) ?? null))
    if (eligible.length === 0) {
      return res.status(200).json({ proposed: false, reason: 'no eligible projects (cooldown)' })
    }

    // Strongest evidence first: the project with the most recent fragments.
    const { data: fragmentCounts } = await supabase
      .from('fragments')
      .select('project_id')
      .eq('user_id', userId)
      .in('project_id', eligible.map(p => p.id))
      .order('created_at', { ascending: false })
      .limit(200)

    const countByProject = new Map<string, number>()
    for (const f of fragmentCounts ?? []) {
      countByProject.set(f.project_id, (countByProject.get(f.project_id) ?? 0) + 1)
    }
    const ranked = [...eligible].sort((a, b) => (countByProject.get(b.id) ?? 0) - (countByProject.get(a.id) ?? 0))
    const target = ranked[0]
    if (!target || (countByProject.get(target.id) ?? 0) === 0) {
      return res.status(200).json({ proposed: false, reason: 'no fragments to draw from' })
    }

    const candidate = await considerMorph(supabase, userId, target)
    if (!candidate) {
      return res.status(200).json({ proposed: false, reason: 'nothing real found, or citation failed' })
    }

    const { error: insertErr } = await supabase.from('proposals').insert({
      user_id: userId,
      kind: 'morph',
      project_id: candidate.projectId,
      proposed_text: candidate.proposedText,
      cited_fragment_ids: candidate.citedFragmentIds,
    })
    if (insertErr) {
      console.error('[utilities/proposals] generate-morph insert failed:', insertErr)
      return res.status(500).json({ error: insertErr.message })
    }

    return res.status(200).json({ proposed: true, project_id: candidate.projectId })
  }

  // ─── DRIFT DECAY (cron) ─────────────────────────────────────────────
  // High drift + silence -> let it go, quietly, no confirmation (SPEC.md).
  // Never touches the live project, and never deletes fragments/memories.
  if (resource === 'drift-decay') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    const userId = getCronUserId(req)
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const result = await runDriftDecay(supabase, userId)
    return res.status(200).json({ harvested: result.harvested.length, project_ids: result.harvested })
  }

  // ─── MINE JOINTS (cron) ─────────────────────────────────────────────
  if (resource === 'mine-joints') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    const userId = getCronUserId(req)
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const written = await mineJoints(supabase, userId)
    return res.status(200).json({ joints_written: written })
  }

  // ─── GENERATE COMPOSITE (cron) ──────────────────────────────────────
  if (resource === 'generate-composite') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    const userId = getCronUserId(req)
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { data: pendingComposite } = await supabase
      .from('proposals')
      .select('id')
      .eq('user_id', userId)
      .eq('kind', 'composite')
      .eq('status', 'pending')
      .limit(1)
    if (pendingComposite && pendingComposite.length > 0) {
      return res.status(200).json({ proposed: false, reason: 'a composite is already pending review' })
    }

    const stalledBase = await getStalledProjects(supabase, userId)
    if (stalledBase.length < 2) {
      return res.status(200).json({ proposed: false, reason: 'fewer than 2 stalled projects' })
    }
    // Real material to draw on, so the fusion idea can name something
    // concrete rather than the model guessing what either project has.
    const stalled = await attachFragments(supabase, userId, stalledBase)

    const { data: joints } = await supabase
      .from('joints')
      .select('id, text, occurrence_count')
      .eq('user_id', userId)
      .gte('occurrence_count', 2)
      .order('last_seen_at', { ascending: false })
      .limit(5)

    if (!joints || joints.length === 0) {
      return res.status(200).json({ proposed: false, reason: 'no recurring joints yet' })
    }

    for (const joint of joints) {
      const candidate = await proposeComposite(joint, stalled)
      if (!candidate) continue

      const { error: insertErr } = await supabase.from('proposals').insert({
        user_id: userId,
        kind: 'composite',
        project_id: candidate.projectIdA,
        project_id_2: candidate.projectIdB,
        joint_id: joint.id,
        proposed_text: candidate.proposedText,
        cited_fragment_ids: candidate.citedFragmentIds,
      })
      if (insertErr) {
        console.error('[utilities/proposals] generate-composite insert failed:', insertErr)
        return res.status(500).json({ error: insertErr.message })
      }
      return res.status(200).json({ proposed: true, joint_id: joint.id })
    }

    return res.status(200).json({ proposed: false, reason: 'no joint mapped to two stalled projects' })
  }

  // ─── PENDING ─────────────────────────────────────────────────────────
  if (resource === 'pending') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' })
    const userId = await getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { data, error } = await supabase
      .from('proposals')
      .select('id, kind, project_id, project_id_2, proposed_text, created_at')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ proposals: data ?? [] })
  }

  // ─── ACCEPT ─────────────────────────────────────────────────────────
  if (resource === 'accept') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    const userId = await getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { proposal_id } = req.body || {}
    if (!proposal_id) return res.status(400).json({ error: 'proposal_id required' })

    const { data: proposal, error: fetchErr } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', proposal_id)
      .eq('user_id', userId)
      .single()
    if (fetchErr || !proposal) return res.status(404).json({ error: 'proposal not found' })

    if (proposal.kind === 'morph') {
      const { error: updateErr } = await supabase
        .from('projects')
        .update({ description: proposal.proposed_text })
        .eq('id', proposal.project_id)
        .eq('user_id', userId)
      if (updateErr) return res.status(500).json({ error: updateErr.message })
    } else {
      // Composite: create the child project, inheriting fragments from
      // both parents so it starts specified rather than at zero (SPEC.md).
      const { data: child, error: createErr } = await supabase
        .from('projects')
        .insert({
          user_id: userId,
          title: proposal.proposed_text.slice(0, 80),
          description: proposal.proposed_text,
          status: 'upcoming',
          state: 'mull',
          parent_id: proposal.project_id,
        })
        .select()
        .single()
      if (createErr) return res.status(500).json({ error: createErr.message })

      const { data: parentFragments } = await supabase
        .from('fragments')
        .select('memory_id, role, fills_slot, text')
        .in('project_id', [proposal.project_id, proposal.project_id_2])
        .eq('user_id', userId)

      if (parentFragments && parentFragments.length > 0) {
        const inherited = parentFragments.map(f => ({
          user_id: userId,
          project_id: child.id,
          memory_id: f.memory_id,
          role: f.role,
          fills_slot: null, // slots are project-specific; the child defines its own
          text: f.text,
        }))
        await supabase.from('fragments').insert(inherited)
      }
    }

    const { error: resolveErr } = await supabase
      .from('proposals')
      .update({ status: 'accepted', resolved_at: new Date().toISOString() })
      .eq('id', proposal_id)
      .eq('user_id', userId)
    if (resolveErr) return res.status(500).json({ error: resolveErr.message })

    return res.status(200).json({ ok: true })
  }

  // ─── REJECT ─────────────────────────────────────────────────────────
  if (resource === 'reject') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' })
    const userId = await getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { proposal_id, reason } = req.body || {}
    if (!proposal_id) return res.status(400).json({ error: 'proposal_id required' })

    const { error: updateErr } = await supabase
      .from('proposals')
      .update({ status: 'rejected', resolved_at: new Date().toISOString() })
      .eq('id', proposal_id)
      .eq('user_id', userId)
    if (updateErr) return res.status(500).json({ error: updateErr.message })

    // "That's not it" is itself a capture (SPEC.md) -- a cheap voicing, not
    // a full memory-pipeline run, since it's feedback about a proposal
    // rather than new material to embed and fragment-match on its own.
    if (typeof reason === 'string' && reason.trim().length > 0) {
      const uniqueId = `rejection_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      await supabase.from('memories').insert({
        audiopen_id: uniqueId,
        title: 'Proposal rejected',
        body: reason.trim(),
        orig_transcript: reason.trim(),
        tags: [],
        audiopen_created_at: new Date().toISOString(),
        processed: true,
        user_id: userId,
      })
    }

    return res.status(200).json({ ok: true })
  }

  return res.status(404).json({ error: `Unknown resource: ${resource}` })
}
