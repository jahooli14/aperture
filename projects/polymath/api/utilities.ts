/**
 * Utilities API - Consolidated endpoint for small utility functions
 *
 * Resources in one file (respecting 12-API cap):
 *   POST ?resource=upload-image             — Generate signed upload URL for images
 *   GET  ?resource=book-search&q=...        — Google Books auto-complete
 *   POST ?resource=analyze                  — Analyse onboarding transcripts → themes, insight, project suggestions
 *   POST ?resource=refine-idea              — Reshape an idea given voice feedback
 *   GET  ?resource=session-brief&projectId= — AI project briefing on open
 *   POST ?resource=onboarding-start         — Bootstrap a coverage grid for the contextual onboarding chat
 *   POST ?resource=onboarding-turn          — Run the planner for one onboarding turn
 *   POST ?resource=onboarding-observe       — Observe-only planner call (no next-question gen) for the Live API hybrid
 *   POST ?resource=onboarding-token         — Mint an ephemeral Live API token for the browser
 *   POST ?resource=onboarding-segment       — Re-read the full voice chat and cut it into coherent memory chunks
 *   POST ?resource=reset-onboarding         — Wipe all onboarding-origin artifacts so the user can redo it
 *   POST ?resource=self-model                — Find 3–5 converging voice notes + today's move (generate | argue)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenAI } from '@google/genai'
import { getSupabaseClient } from './_lib/supabase.js'
import { getUserId } from './_lib/auth.js'
import { generateText } from './_lib/gemini-chat.js'
import { generateEmbedding, cosineSimilarity } from './_lib/gemini-embeddings.js'
import {
  newCoverageGrid,
  runPlanner,
  applyDecisionToGrid,
  newlyFilledSlots,
  computeStoppingHint,
  ANCHOR_QUESTION,
  SLOT_CATALOGUE,
} from './_lib/onboarding/coverage.js'
import { MODELS } from './_lib/models.js'
import type { CoverageGrid, CoverageSlotId } from '../src/types'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const resource = req.query.resource as string

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

  if (req.method === 'POST' && resource === 'onboarding-turn') {
    return handleOnboardingTurn(req, res)
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

  if (req.method === 'POST' && resource === 'self-model') {
    return handleSelfModel(req, res)
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

    // 5. Project suggestions saved as "idea" from onboarding (the
    //    "Try Something New" carousel entries).
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

Your job is to read deeply between the lines — not just summarise what they said, but notice what links up across the different things they talked about — stuff they probably haven't connected themselves yet.

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

    const prompt = `You are a creative catalyst AI helping someone find a project idea that resonates with them.

Original idea:
Title: ${original.title}
Description: ${original.description}
Why them: ${original.reasoning}

User feedback (attempt ${attempt || 1}): "${feedback}"

User's themes: ${(context?.themes || []).join(', ')}
User's capabilities: ${(context?.capabilities || []).join(', ')}${transcriptBlock}${phraseBlock}

Reshape the idea based on their feedback. Keep what they liked, change what didn't resonate. Make it more specific to their context — reference their own words from the transcripts/phrases above where it fits, rather than generic themes.

Respond with JSON only:
{
  "title": "concise project title",
  "description": "1-2 sentences describing the project",
  "reasoning": "why this is uniquely suited to this person (1 sentence)"
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

async function handleOnboardingTurn(req: VercelRequest, res: VercelResponse) {
  try {
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

    const isSkipped = Boolean(skipped) || isOnboardingSkipTranscript(latest_transcript)
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
    const stopping_hint = computeStoppingHint(nextGrid, decision.depth_signal)
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
  } catch (err: any) {
    console.error('[utilities/onboarding-turn]', err?.message, err?.stack)
    return res.status(500).json({ error: 'Onboarding turn failed' })
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

async function handleOnboardingToken(_req: VercelRequest, res: VercelResponse) {
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
  hasGoal: boolean,
  hasMotivation: boolean,
): SessionBrief['phase'] {
  const total = tasks.length
  const done = tasks.filter(t => t.done).length
  const progress = total > 0 ? done / total : 0
  if (daysSinceActive >= 14) return 'stale'
  if (projectAge <= 3 || total === 0) return 'shaping'
  if (total <= 3 && !hasGoal && !hasMotivation) return 'shaping'
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

  const phase = detectSessionBriefPhase(
    tasks,
    daysSinceActive,
    projectAge,
    !!project.metadata?.end_goal,
    !!project.metadata?.motivation,
  )
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
${project.metadata?.end_goal ? `FINISH LINE: ${project.metadata.end_goal}` : 'FINISH LINE: NOT SET'}

PHASE: ${phase} (${SESSION_BRIEF_PHASE_LABELS[phase]})
MOMENTUM: ${momentum}
DAYS SINCE LAST VISIT: ${daysSinceActive}
PROGRESS: ${completedTasks}/${totalTasks} tasks (${progressPercent}%)

${taskSummary}
${completionSummary}

═══════════════════════════════════════════════════════════════════
STATE-SPECIFIC INSTRUCTIONS — follow exactly
═══════════════════════════════════════════════════════════════════

${!hasGoal ? `THIS PROJECT HAS NO FINISH LINE SET. That's the only thing that matters right now.
- greeting: Name the problem directly (2 sentences max). "${project.title} doesn't have a finish line yet — so we can't tell when it's done. Let's fix that first."
- focusSuggestion: "Define what 'done' looks like for ${project.title}."
- proactiveQuestion: A concrete, grounded question that pulls on what a finished version would look like. Choose the one that fits best:
    • "When you picture this finished — what are you actually looking at? A shipped site? A working prototype? A published piece?"
    • "Is this done when YOU can use it, or when someone else can?"
    • "What's the one artifact that'd let you happily close the tab on this?"
  Pick ONE question. Don't stack them.
` : !hasTasks ? `FINISH LINE IS SET BUT NO TASKS YET.
- greeting: Reference the finish line by name. "Finish line is '[goal]'. Nothing on the task list yet — first move?"
- focusSuggestion: Name the single most obvious first step given the finish line.
- proactiveQuestion: "What's the very first thing you need to do to get to '[finish line]'?"
` : phase === 'stale' ? `THEY'VE BEEN AWAY FOR ${daysSinceActive} DAYS.
- greeting: Acknowledge the gap honestly, reference the finish line, suggest the smallest thing they could do right now.
- focusSuggestion: One tiny concrete thing — not "get back into it" but e.g. "Open the file and read the last paragraph you wrote."
- proactiveQuestion: "What's actually blocking you from [specific next task]?"
` : phase === 'closing' ? `HOME STRETCH — ${progressPercent}% done.
- greeting: Tell them how close they are, name what's left.
- focusSuggestion: Name the specific remaining task most likely to close this out.
- proactiveQuestion: "What's the LAST thing standing between you and done?"
` : `BUILDING PHASE — tasks in flight toward a set finish line.
- greeting: Reference what they last did or the next obvious task by name.
- focusSuggestion: Name the specific task to do this session.
- proactiveQuestion: ONE practical question. Examples: "Is [next task] actually the right next move, or are you avoiding [harder task]?" / "Does [next task] still fit the finish line, or has that changed?"
`}

Rules for ALL states:
- Plain everyday English. Write like a real person. No buzzwords, no coaching speak, no "as an AI".
- No filler. No "Great to see you", "Welcome back", "Let's dive in", "Let's explore".
- Short sentences. Say it straight. Second person ("you").
- Always reference specific tasks or the finish line by name. Never be vague.
- Ask ONE question, not two. Don't stack questions with "and".

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
    focusSuggestion = incompleteTasks[0]?.text || 'Define what you want to build.'
    proactiveQuestion = !project.metadata?.end_goal
      ? 'What does done actually look like for this?'
      : 'What would you work on if you had 30 minutes right now?'
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

// ── Self-Model ─────────────────────────────────────────────────────────────
// POST ?resource=self-model
//   body: { mode: 'generate' }
//   body: { mode: 'argue', previous: SelfModel, critique: string }
//
// Wow moment: surface 3–5 things the user has captured across time — voice
// notes, list items, project ideas — that all land on the same underlying
// thing. The middle of the Venn. Then the one move that sits at the
// convergence point. Grounded in their own words (verbatim fragments), so
// the read can't be faked. Falls back to a single-signal mode when there
// isn't enough signal for a convergence.

type SignalKind = 'memory' | 'list_item' | 'project'

interface Quote {
  quote: string
  date: string
  source_id: string
  kind: SignalKind
  source_label?: string
}

interface Move {
  action: string
  why: string
  artefact: string
}

interface SelfModel {
  mode: 'convergence' | 'single'
  convergence?: { quotes: Quote[]; connection: string }
  single?: Quote
  move: Move
}

interface SelfModelSources {
  projects: number
  memories: number
  list_items: number
  signals_with_embedding: number
  convergence_size: number
}

const SELF_MODEL_WINDOW_DAYS = 180
const RECENT_WINDOW_DAYS = 30
const MIN_CLUSTER_DAYS_APART = 7
// Strict pass: things that clearly share a theme. Loose pass is a fallback
// so we don't silently drop to single-mode when the user genuinely has
// cross-surface signal that's just a shade below the strict threshold.
const MIN_NEIGHBOUR_SIMILARITY = 0.68
const LOOSE_NEIGHBOUR_SIMILARITY = 0.56
const MIN_CONVERGENCE_SIZE = 3
const MAX_CONVERGENCE_SIZE = 5

interface Signal {
  id: string
  kind: SignalKind
  text: string           // the body we can quote verbatim from
  title: string | null   // optional header for display / prompt context
  source_label: string   // short UI label ("voice note", "list item", "project 'X'")
  created_at: string
  effective_date: string // created_at for memories/lists; max(created, updated) for projects
  embedding: number[] | string
}

function signalKey(s: { id: string; kind: SignalKind } | { kind: SignalKind; source_id: string }): string {
  const id = 'source_id' in s ? s.source_id : s.id
  return `${s.kind}:${id}`
}

async function gatherSignals(
  supabase: ReturnType<typeof getSupabaseClient>,
  userId: string,
): Promise<Signal[]> {
  const since = new Date(Date.now() - SELF_MODEL_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const [memRes, listRes, projRes] = await Promise.all([
    supabase
      .from('memories')
      .select('id, title, body, created_at, embedding')
      .eq('user_id', userId)
      .gte('created_at', since)
      .not('body', 'is', null)
      .not('embedding', 'is', null)
      .order('created_at', { ascending: false })
      .limit(150),
    supabase
      .from('list_items')
      .select('id, content, metadata, status, created_at, embedding')
      .eq('user_id', userId)
      .gte('created_at', since)
      .not('embedding', 'is', null)
      .in('status', ['active', 'queued', 'completed'])
      .order('created_at', { ascending: false })
      .limit(120),
    supabase
      .from('projects')
      .select('id, title, description, status, created_at, updated_at, embedding')
      .eq('user_id', userId)
      .not('embedding', 'is', null)
      .in('status', ['active', 'upcoming', 'paused'])
      .order('updated_at', { ascending: false })
      .limit(40),
  ])

  const signals: Signal[] = []

  for (const m of (memRes.data ?? []) as Array<{
    id: string
    title: string | null
    body: string | null
    created_at: string
    embedding: number[] | string | null
  }>) {
    if (!m.embedding || !m.body || m.body.trim().length < 20) continue
    signals.push({
      id: m.id,
      kind: 'memory',
      text: m.body,
      title: m.title,
      source_label: 'voice note',
      created_at: m.created_at,
      effective_date: m.created_at,
      embedding: m.embedding,
    })
  }

  for (const li of (listRes.data ?? []) as Array<{
    id: string
    content: string | null
    metadata: Record<string, unknown> | null
    created_at: string
    embedding: number[] | string | null
  }>) {
    if (!li.embedding || !li.content || li.content.trim().length < 6) continue
    const listName = typeof li.metadata?.list_name === 'string' ? (li.metadata.list_name as string) : null
    signals.push({
      id: li.id,
      kind: 'list_item',
      text: li.content,
      title: null,
      source_label: listName ? `list · ${listName}` : 'list item',
      created_at: li.created_at,
      effective_date: li.created_at,
      embedding: li.embedding,
    })
  }

  for (const p of (projRes.data ?? []) as Array<{
    id: string
    title: string | null
    description: string | null
    created_at: string
    updated_at: string | null
    embedding: number[] | string | null
  }>) {
    if (!p.embedding) continue
    const text = (p.description && p.description.trim().length > 10) ? p.description : (p.title ?? '')
    if (!text || text.trim().length < 10) continue
    // Projects stay alive via description edits — use the most recent signal
    // of care so a freshly-refined idea doesn't read as "3 months ago".
    const effective = p.updated_at && new Date(p.updated_at).getTime() > new Date(p.created_at).getTime()
      ? p.updated_at
      : p.created_at
    signals.push({
      id: p.id,
      kind: 'project',
      text,
      title: p.title,
      source_label: p.title ? `project · ${p.title}` : 'project',
      created_at: p.created_at,
      effective_date: effective,
      embedding: p.embedding,
    })
  }

  return signals
}

// Small helper kept for prompt context — the move benefits from seeing the
// user's active projects even when projects are also in the signal pool.
async function gatherActiveProjects(
  supabase: ReturnType<typeof getSupabaseClient>,
  userId: string,
): Promise<Array<{ title: string; description: string | null }>> {
  const res = await supabase
    .from('projects')
    .select('title, description')
    .eq('user_id', userId)
    .in('status', ['active', 'upcoming'])
    .order('updated_at', { ascending: false })
    .limit(15)
  return (res.data ?? []) as Array<{ title: string; description: string | null }>
}

function daysAgo(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000)))
}

function truncateToWords(s: string, maxWords: number): string {
  const words = s.trim().split(/\s+/)
  if (words.length <= maxWords) return s.trim()
  return words.slice(0, maxWords).join(' ') + '…'
}

function formatProjects(projects: Array<{ title: string; description: string | null }>): string {
  return projects
    .slice(0, 15)
    .map(p => `- ${p.title}${p.description ? ` — ${String(p.description).slice(0, 320)}` : ''}`)
    .join('\n') || '(none)'
}

// Ambient signal outside the cluster — recent voice notes + list items the
// AI can use to spot crossovers even when a formal convergence wasn't found.
// Cluster members are excluded so we don't duplicate them back into context.
function formatRecentCaptures(signals: Signal[], excludeKeys: Set<string>): string {
  const captures = signals
    .filter(s => !excludeKeys.has(signalKey(s)))
    .filter(s => s.kind !== 'project') // projects are already listed separately
    .sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime())
    .slice(0, 6)
  if (captures.length === 0) return '(none)'
  return captures
    .map(s => {
      const label = s.kind === 'memory' ? 'voice note' : 'list item'
      return `- ${label} (${daysAgo(s.effective_date)}d ago): ${s.text.slice(0, 220).replace(/\s+/g, ' ').trim()}`
    })
    .join('\n')
}

// Pick the single signal to build a fallback card around. Most-recent-wins
// across all kinds — voice notes, list items, and projects all count as
// live signal. A refined project idea is real intent, not filler. We do
// require ≥20 chars so we don't land on a one-liner, and we honour
// excludeKeys so refresh actually moves the card.
//
// (The "don't paraphrase the pitch" protection for project signals lives
// in the prompt, not here — kind shouldn't gate selection.)
function pickSingleSignal(
  signals: Signal[],
  excludeKeys: Set<string>,
): Signal | null {
  const byRecency = (pool: Signal[]) =>
    [...pool].sort(
      (a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime(),
    )[0] ?? null

  const eligible = signals.filter(
    s => !excludeKeys.has(signalKey(s)) && s.text.trim().length >= 20,
  )
  const pick = byRecency(eligible)
  if (pick) return pick

  // Excludes starved us — relax, same length bar.
  return byRecency(signals.filter(s => s.text.trim().length >= 20))
}
// the Venn", pulling across voice notes, list items, and projects. Prefers
// time-spread (different weeks) and REQUIRES kind-diversity (cross-surface
// convergence is the wow; a clump of four list items is obvious to the
// user and lands flat). At least one signal must be recent OR an active
// project — a long-running preoccupation is a live signal even if the
// project row is old.
//
// `excludeKeys` lets refresh/argue skip the last-shown set and surface the
// next-best convergence, so tapping "wrong read" or "refresh" actually
// moves the card instead of re-serving the same cluster.
// `minSim` is the cosine floor — strict pass first; caller retries with a
// looser floor when the strict pass starves, so we don't collapse to single
// mode over a few hundredths of a point.
function findConvergence(
  signals: Signal[],
  excludeKeys: Set<string> = new Set(),
  minSim: number = MIN_NEIGHBOUR_SIMILARITY,
): Signal[] | null {
  const candidates = signals.filter(s =>
    s.embedding != null &&
    s.text.trim().length >= 10 &&
    !excludeKeys.has(signalKey(s)),
  )
  if (candidates.length < MIN_CONVERGENCE_SIZE) return null

  const now = Date.now()
  const recentCutoff = now - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000
  const minGapMs = MIN_CLUSTER_DAYS_APART * 24 * 60 * 60 * 1000

  // Anchors: anything recent OR any project (active/upcoming/paused filter is
  // already applied upstream, so projects in the pool represent live care).
  const anchors = candidates.filter(s =>
    new Date(s.effective_date).getTime() >= recentCutoff || s.kind === 'project',
  )
  if (anchors.length === 0) return null

  // Sort anchors: recent-first, then projects. Cap at 30 — cosine is cheap
  // but 30 anchors × 300 candidates is still negligible.
  anchors.sort((a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime())

  let best: { items: Signal[]; score: number } | null = null

  for (const anchor of anchors.slice(0, 30)) {
    const anchorEmbedding = anchor.embedding
    const neighbours: Array<{ signal: Signal; sim: number }> = []
    for (const other of candidates) {
      if (other.id === anchor.id && other.kind === anchor.kind) continue
      const sim = cosineSimilarity(anchorEmbedding, other.embedding)
      if (sim < minSim) continue
      neighbours.push({ signal: other, sim })
    }
    if (neighbours.length < MIN_CONVERGENCE_SIZE - 1) continue

    neighbours.sort((a, b) => b.sim - a.sim)
    const picked: Array<{ signal: Signal; sim: number }> = []
    const pickedTimes: number[] = [new Date(anchor.effective_date).getTime()]
    const kindsPicked = new Set<SignalKind>([anchor.kind])

    // Pass 1: prefer neighbours of different kinds AND time-spaced.
    // Pass 2: relax the kind preference.
    // Pass 3: relax time-spacing too.
    const tryPick = (preferDifferentKind: boolean, allowCloseInTime: boolean) => {
      for (const n of neighbours) {
        if (picked.length >= MAX_CONVERGENCE_SIZE - 1) break
        if (picked.some(p => p.signal.id === n.signal.id && p.signal.kind === n.signal.kind)) continue
        if (preferDifferentKind && kindsPicked.has(n.signal.kind) && kindsPicked.size === 1) continue
        const t = new Date(n.signal.effective_date).getTime()
        if (!allowCloseInTime && pickedTimes.some(pt => Math.abs(pt - t) < minGapMs)) continue
        picked.push(n)
        pickedTimes.push(t)
        kindsPicked.add(n.signal.kind)
      }
    }

    tryPick(true, false)
    if (picked.length < MIN_CONVERGENCE_SIZE - 1) tryPick(false, false)
    if (picked.length < MIN_CONVERGENCE_SIZE - 1) tryPick(false, true)
    if (picked.length < MIN_CONVERGENCE_SIZE - 1) continue

    const items = [anchor, ...picked.map(p => p.signal)]
    const kindCount = new Set(items.map(i => i.kind)).size
    // HARD requirement: cross-surface convergence only. Same-kind clumps
    // aren't the wow — they're a category. Skip if we didn't get ≥2 kinds.
    if (kindCount < 2) continue

    const avgSim = picked.reduce((s, p) => s + p.sim, 0) / picked.length
    const times = items.map(i => new Date(i.effective_date).getTime())
    const spanDays = (Math.max(...times) - Math.min(...times)) / (24 * 60 * 60 * 1000)
    const score = avgSim * Math.log(1 + spanDays / 7) * Math.log(1 + items.length) * (1 + 0.35 * (kindCount - 1))

    if (!best || score > best.score) best = { items, score }
  }

  if (!best) return null
  best.items.sort((a, b) => new Date(a.effective_date).getTime() - new Date(b.effective_date).getTime())
  return best.items
}

function describeSignal(s: Signal, index: number): string {
  const kindLabel = s.kind === 'memory' ? 'VOICE NOTE' : s.kind === 'list_item' ? 'LIST ITEM' : 'PROJECT'
  const header = `SIGNAL ${index + 1} — ${kindLabel}${s.title ? ` "${s.title}"` : ''} — ${daysAgo(s.effective_date)} days ago:`
  const body = s.text.slice(0, 600)
  return `${header}\n${body}`
}

// Phrases that consistently signal LLM boilerplate in this surface. Listed
// explicitly in the prompt so the model can't lean on them — they all sound
// smart and all read flat.
const FORBIDDEN_PHRASES = [
  'weaponize', 'geometry of', 'architecture of', 'language of', 'blueprint',
  'leverage', 'synergy', 'unlock', 'crystallise', 'crystallize',
  'clarify', 'clarifies', 'clarification',
  'identify', 'identifies', 'identifying', 'identification',
  'mapping', 'map out', 'roadmap',
  'core functionality', 'underlying', 'fundamental',
  'draft a framework', 'draft a strategy', 'draft a blueprint',
  'actionable', 'systematically', 'holistic', 'ecosystem',
]

function forbiddenList(): string {
  return FORBIDDEN_PHRASES.map(p => `"${p}"`).join(', ')
}

function buildConvergencePrompt(
  cluster: Signal[],
  projects: Array<{ title: string; description: string | null }>,
  ambientCaptures: string,
  critique?: { previous: SelfModel; critique: string },
  strictGrounding: boolean = false,
): string {
  const critiqueBlock = critique
    ? `\n\nLAST TIME YOU SUGGESTED: "${critique.previous.move.action}"
USER PUSHED BACK: "${critique.critique}"
Pick a different move that still honours the same convergence. Don't get defensive.`
    : ''

  const groundingBlock = strictGrounding
    ? `\n\nIMPORTANT — your last attempt drifted into generic language. The connection sentence MUST reuse at least two concrete words (nouns, specific verbs, project names) that appear in the quotes themselves. No elegant metaphors. No "the idea of a…". Name the actual thing using their actual words.`
    : ''

  const signalBlocks = cluster.map((s, i) => describeSignal(s, i)).join('\n\n')

  // Count distinct projects referenced in the cluster — if ≥2, demand a
  // named crossover, because that's the whole point of this surface.
  const projectNames = Array.from(new Set(
    cluster.filter(s => s.kind === 'project' && s.title).map(s => s.title as string),
  ))
  const crossoverBlock = projectNames.length >= 2
    ? `\n\nCROSSOVER — ${projectNames.length} of these signals come from different projects (${projectNames.map(n => `"${n}"`).join(', ')}). Your CONNECTION sentence MUST name at least two of these projects by name and say specifically what the crossover is — what can one project borrow from the other? That's the reveal.`
    : ''

  return `You're the user's second brain. They've been dropping voice notes, list items, and project ideas over weeks. ${cluster.length} of those captures share the same underlying thread — and the user hasn't noticed. Your job is to show them the thread using THEIR OWN WORDS, then hand them a real next move.

This is the app's reveal moment. It has to feel like being seen — not like reading a generic productivity tip. Specificity wins. Concrete nouns win. Pitch copy loses.

DO THREE THINGS:

1) Pull ONE QUOTE from each of the ${cluster.length} signals below — a verbatim fragment lifted directly from the text. NEVER paraphrase. NEVER invent. Copy exact words.
   - Voice notes: 6–20 word fragment of the body. Pick the line that lands.
   - List items: the whole item if short; otherwise a fragment.
   - Projects: 6–20 word fragment of the description. AVOID the pitch opener — find a specific line deeper in that reveals the actual angle, not the elevator pitch.
   Pick the fragment that makes the shared thread visible when read alongside the others.

2) Write the CONNECTION in ONE plain-English sentence (≤ 22 words). Name what all ${cluster.length} quotes share, using words the user actually uses in the quotes. No metaphors. Don't narrate ("you keep thinking about…", "you've been circling…"). Don't summarise the productivity theme. Name the specific thing — the specific user, the specific problem, the specific mechanism. If you can't name it specifically, you haven't found the real connection yet — try a different angle.

3) Pick the one MOVE for today — 30 to 90 minutes — that sits at the centre of this convergence. The most natural next step given that ${cluster.length} separate signals are saying the same thing. Plain verbs, plain nouns.
   - action: ≤ 16 words, imperative, starts with a verb, names a specific output. Not "list five…", not "identify the…", not "map the…". Make it the thing they'd actually do in a focused hour.
   - why: one sentence linking the move to the shared thread in the user's own language.
   - artefact: what's on their screen / in their hand when done (e.g. "a 30-second voice note", "a working prototype", "one email sent", "a 1-page brief", "a named list of 7 people"). Be concrete.

FORBIDDEN PHRASES (anywhere in your output — these are the boilerplate tells): ${forbiddenList()}. If you find yourself reaching for one of these, you're drifting into generic territory — try again with plainer words.

Output JSON only, with this EXACT shape (quotes array must have exactly ${cluster.length} items, in the same order as the signals below):
{ "quotes": [${cluster.map(() => '{ "quote": "…" }').join(', ')}], "connection": "…", "move": { "action": "…", "why": "…", "artefact": "…" } }

=== THE ${cluster.length} CONVERGING SIGNALS ===
${signalBlocks}

=== ACTIVE PROJECTS (context for the move) ===
${formatProjects(projects)}

=== RECENT AMBIENT CAPTURES (not in the cluster — use as flavour, don't quote from these) ===
${ambientCaptures}${crossoverBlock}${critiqueBlock}${groundingBlock}

Return the JSON now.`
}

function buildSinglePrompt(
  signal: Signal,
  projects: Array<{ title: string; description: string | null }>,
  ambientCaptures: string,
  critique?: { previous: SelfModel; critique: string },
): string {
  const critiqueBlock = critique
    ? `\n\nLAST TIME YOU SUGGESTED: "${critique.previous.move.action}"
USER PUSHED BACK: "${critique.critique}"
Pick a different move. Don't get defensive.`
    : ''

  const kindLabel = signal.kind === 'memory' ? 'voice note' : signal.kind === 'list_item' ? 'list item' : 'project idea'

  // Extra warning for project signals — project descriptions are pitch copy
  // and produce the flattest reads. Push the model hard toward a specific
  // angle instead of paraphrasing the pitch.
  const pitchWarning = signal.kind === 'project'
    ? `\n\nWARNING — this signal is a project description, which is the user's own pitch copy. If you paraphrase the pitch back at them, this card is worthless. Look for the one concrete, surprising angle inside the description. Ignore the generic "what it does" sentences. Find the specific mechanism, user, or constraint.`
    : ''

  // If there are active projects, nudge the model to find a crossover angle
  // even in single mode — it's the closest we can get to the "wow" without
  // a real convergence.
  const crossoverHint = projects.length >= 2
    ? `\n\nCROSSOVER HINT — if this ${kindLabel} has any bearing on one of the active projects listed, say so by name in your "why". The move is stronger when it visibly connects to what they're already building.`
    : ''

  return `You're the user's second brain. They captured this ${kindLabel} and you need to hand them today's next move — 30 to 90 minutes of focused work. There wasn't enough cross-surface signal to show a convergence this time, so this single card has to earn its keep: a specific, surprising read of what they actually said, and a move that isn't a generic productivity tip.

DO TWO THINGS:

1) Pull one QUOTE — a verbatim fragment (or the whole content if it's short) from the text below. NEVER paraphrase. Copy exact words. Pick the line that reveals the specific angle, not the opening summary.

2) Pick the one MOVE for today — 30 to 90 minutes — that pushes this specific thought forward. Plain English, imperative.
   - action: ≤ 16 words, starts with a verb, names a specific output. Not "list five…", not "identify the…", not "draft a framework for…". Make it the thing they'd actually do.
   - why: one sentence, connects to what they actually said in their own words.
   - artefact: what's on their screen / in their hand at the end — concrete noun.

FORBIDDEN PHRASES: ${forbiddenList()}. These are boilerplate tells. If you're reaching for them, the move isn't specific enough yet.

Output JSON only with this exact shape:
{ "single": { "quote": "…" }, "move": { "action": "…", "why": "…", "artefact": "…" } }

=== THE ${kindLabel.toUpperCase()} (${daysAgo(signal.effective_date)} days ago)${signal.title ? ` — "${signal.title}"` : ''} ===
${signal.text.slice(0, 1200)}

=== ACTIVE PROJECTS (context) ===
${formatProjects(projects)}

=== RECENT AMBIENT CAPTURES (flavour — don't quote from these) ===
${ambientCaptures}${pitchWarning}${crossoverHint}${critiqueBlock}

Return the JSON now.`
}

// Verify a quote really is a fragment of the signal's text. The wow depends
// on quotes being the user's own words, not a paraphrase. For very short
// items we relax to substring containment, and for longer ones we require a
// 4-word consecutive run (relaxed from 5 — voice transcripts are messy and
// 5-word windows over-rejected legitimate quotes where the model normalised
// punctuation or dropped a filler word).
function isVerbatim(quote: string, signal: Signal): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[''`"""]/g, "'").replace(/[^\w\s']/g, ' ').replace(/\s+/g, ' ').trim()
  const sourceText = (signal.title ? signal.title + ' ' : '') + signal.text
  const normSource = norm(sourceText)
  const normQuote = norm(quote)
  if (!normQuote) return false
  const quoteWords = normQuote.split(' ').filter(Boolean)
  if (quoteWords.length === 0) return false
  // Short items (list items, project titles) — require full substring.
  if (quoteWords.length < 4) return normSource.includes(normQuote)
  // Otherwise require a run of ≥4 consecutive quote words in the source.
  const windowSize = Math.min(4, quoteWords.length)
  for (let i = 0; i <= quoteWords.length - windowSize; i++) {
    const needle = quoteWords.slice(i, i + windowSize).join(' ')
    if (normSource.includes(needle)) return true
  }
  return false
}

// Stopwords we ignore when checking that the connection sentence is grounded
// in the user's own vocabulary. Tiny list — we only need to strip obvious
// function words; content words are what ground the read.
const CONTENT_STOPWORDS = new Set([
  'about', 'again', 'also', 'another', 'around', 'away', 'back', 'because',
  'been', 'being', 'before', 'could', 'done', 'down', 'even', 'every',
  'from', 'give', 'going', 'good', 'have', 'here', 'into', 'just', 'keep',
  'kind', 'know', 'like', 'little', 'look', 'made', 'make', 'many', 'more',
  'much', 'need', 'never', 'next', 'only', 'other', 'over', 'own', 'really',
  'same', 'said', 'seem', 'should', 'some', 'something', 'still', 'such',
  'take', 'than', 'that', 'them', 'then', 'there', 'these', 'they', 'thing',
  'things', 'think', 'this', 'those', 'thought', 'time', 'true', 'very',
  'want', 'well', 'were', 'what', 'when', 'where', 'which', 'while', 'will',
  'with', 'would', 'your', 'yours', 'youre', 'actually', 'maybe', 'probably',
  'always', 'around', 'sort', 'feel', 'feels',
])

function contentWords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !CONTENT_STOPWORDS.has(w))
}

// Does the connection sentence share ≥2 content words with the quote set?
// If not, the LLM has probably written an elegant generic framing instead of
// naming what the quotes actually share — so we reject and retry once with
// an explicit grounding instruction.
function connectionGrounded(connection: string, quotes: Quote[]): boolean {
  const quoteBags = quotes.map(q => new Set(contentWords(q.quote)))
  const connWords = new Set(contentWords(connection))
  let hits = 0
  for (const w of connWords) {
    const inHowMany = quoteBags.filter(bag => bag.has(w)).length
    if (inHowMany >= 1) hits++
    if (hits >= 2) return true
  }
  return false
}

function parseMove(obj: unknown): Move | null {
  if (!obj || typeof obj !== 'object') return null
  const m = obj as { action?: unknown; why?: unknown; artefact?: unknown }
  if (typeof m.action !== 'string' || m.action.trim().length === 0) return null
  return {
    action: String(m.action).trim(),
    why: String(m.why ?? '').trim(),
    artefact: String(m.artefact ?? '').trim(),
  }
}

function extractJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''))
  } catch {
    return null
  }
}

function quoteFromSignal(text: string, signal: Signal): Quote {
  return {
    quote: truncateToWords(text, 25),
    date: signal.effective_date,
    source_id: signal.id,
    kind: signal.kind,
    source_label: signal.source_label,
  }
}

// Lift a guaranteed-verbatim fragment from the signal itself. Used as a
// fallback when the model's chosen quote fails the verbatim check — better
// to substitute a real fragment of the user's own words than to nuke the
// whole convergence (the connection + move is what carries the wow).
function liftFragment(signal: Signal): string {
  const text = signal.text.trim().replace(/\s+/g, ' ')
  if (!text) return ''
  const sentenceMatch = text.match(/^[^.!?]+[.!?]?/)
  const first = (sentenceMatch ? sentenceMatch[0] : text).trim()
  return truncateToWords(first, 16)
}

function parseConvergenceModel(raw: string, cluster: Signal[]): SelfModel | null {
  const obj = extractJson(raw) as {
    quotes?: Array<{ quote?: unknown } | string>
    connection?: unknown
    move?: unknown
  } | null
  if (!obj || !Array.isArray(obj.quotes)) return null

  const quotes: Quote[] = []
  for (let i = 0; i < cluster.length; i++) {
    const rawItem = obj.quotes[i]
    const text =
      typeof rawItem === 'string'
        ? rawItem
        : rawItem && typeof rawItem === 'object' && typeof rawItem.quote === 'string'
          ? rawItem.quote
          : ''
    let trimmed = text.trim()
    if (!trimmed || !isVerbatim(trimmed, cluster[i])) {
      if (trimmed) console.warn('[self-model] non-verbatim quote, substituting from source:', trimmed.slice(0, 80))
      trimmed = liftFragment(cluster[i])
      if (!trimmed) return null
    }
    quotes.push(quoteFromSignal(trimmed, cluster[i]))
  }

  const connection = typeof obj.connection === 'string' ? obj.connection.trim() : ''
  const move = parseMove(obj.move)
  if (!connection || !move) return null

  return {
    mode: 'convergence',
    convergence: { quotes, connection },
    move,
  }
}

function parseSingleModel(raw: string, signal: Signal): SelfModel | null {
  const obj = extractJson(raw) as { single?: { quote?: unknown }; move?: unknown } | null
  if (!obj) return null
  let quote = typeof obj.single?.quote === 'string' ? obj.single.quote.trim() : ''
  const move = parseMove(obj.move)
  if (!move) return null
  if (!quote || !isVerbatim(quote, signal)) {
    if (quote) console.warn('[self-model] non-verbatim single quote, substituting from source:', quote.slice(0, 80))
    quote = liftFragment(signal)
    if (!quote) return null
  }
  return {
    mode: 'single',
    single: quoteFromSignal(quote, signal),
    move,
  }
}

async function handleSelfModel(req: VercelRequest, res: VercelResponse) {
  try {
    const userId = await getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Sign in to view your self-model' })

    const body = (req.body ?? {}) as {
      mode?: 'generate' | 'argue'
      previous?: SelfModel
      critique?: string
      exclude_ids?: string[]
    }
    const reqMode = body.mode ?? 'generate'
    const excludeKeys = new Set<string>(Array.isArray(body.exclude_ids) ? body.exclude_ids : [])

    const started = Date.now()
    const supabase = getSupabaseClient()
    const [signals, activeProjects] = await Promise.all([
      gatherSignals(supabase, userId),
      gatherActiveProjects(supabase, userId),
    ])

    // Try strict first (0.68 cosine); if that starves with excludes, try
    // strict without excludes; if THAT also starves, fall to a looser
    // similarity floor (0.56) so we don't silently collapse to single-mode
    // over a few hundredths of a similarity point.
    let cluster = findConvergence(signals, excludeKeys)
    let relaxedExcludes = false
    let relaxedSimilarity = false
    if (!cluster && excludeKeys.size > 0) {
      cluster = findConvergence(signals)
      if (cluster) relaxedExcludes = true
    }
    if (!cluster) {
      cluster = findConvergence(signals, excludeKeys, LOOSE_NEIGHBOUR_SIMILARITY)
      if (cluster) relaxedSimilarity = true
    }
    if (!cluster && excludeKeys.size > 0) {
      cluster = findConvergence(signals, new Set(), LOOSE_NEIGHBOUR_SIMILARITY)
      if (cluster) { relaxedExcludes = true; relaxedSimilarity = true }
    }

    const sources: SelfModelSources = {
      memories: signals.filter(s => s.kind === 'memory').length,
      list_items: signals.filter(s => s.kind === 'list_item').length,
      projects: signals.filter(s => s.kind === 'project').length,
      signals_with_embedding: signals.length,
      convergence_size: cluster?.length ?? 0,
    }

    if (signals.length === 0) {
      return res.status(200).json({
        sources,
        model: null,
        reason: 'not-enough-signal',
        took_ms: Date.now() - started,
      })
    }

    const critique =
      reqMode === 'argue' && body.previous && body.critique
        ? { previous: body.previous, critique: body.critique }
        : undefined

    let model: SelfModel | null = null

    // Cluster members are excluded from ambient context so we don't feed
    // the same text twice into the prompt.
    const clusterKeys = new Set(cluster ? cluster.map(signalKey) : [])
    const ambientCaptures = formatRecentCaptures(signals, clusterKeys)

    if (cluster) {
      const runConvergence = async (strict: boolean): Promise<SelfModel | null> => {
        const prompt = buildConvergencePrompt(cluster!, activeProjects, ambientCaptures, critique, strict)
        const raw = await generateText(prompt, {
          // Generous ceiling — with up to 5 quotes + connection + move, the
          // JSON can run long. Truncated output parse-fails and falls to
          // single-mode, which isn't the wow. Carry forward the lesson from
          // main's hardening (old self-model was truncating at 1400).
          maxTokens: 2400,
          temperature: strict ? 0.5 : 0.7,
          responseFormat: 'json',
          model: MODELS.FLASH_CHAT,
        })
        const parsed = parseConvergenceModel(raw, cluster!)
        if (!parsed) {
          console.warn(`[self-model] convergence parse failed (strict=${strict}); raw head:`, raw.slice(0, 400))
          return null
        }
        return parsed
      }

      model = await runConvergence(false)

      // If the first attempt didn't parse at all, retry once with the strict
      // prompt before dropping to single-signal mode. Convergence is the wow
      // of this surface — a single drift shouldn't cost us the cluster card.
      if (!model) model = await runConvergence(true)

      // If the connection sentence isn't grounded in the user's words, give
      // the LLM one more go with an explicit grounding instruction. Cheap
      // insurance — the connection is where the wow actually lands.
      if (model?.convergence && !connectionGrounded(model.convergence.connection, model.convergence.quotes)) {
        console.warn('[self-model] connection ungrounded; retrying with strict prompt. was:', model.convergence.connection)
        const retried = await runConvergence(true)
        if (retried?.convergence && connectionGrounded(retried.convergence.connection, retried.convergence.quotes)) {
          model = retried
        }
        // If the retry still drifts, ship the first attempt rather than
        // falling to single-mode — a slightly loose connection beats a
        // single-quote fallback when we have a real cluster.
      }
    }

    if (!model) {
      // Single-signal fallback — prefer voice notes > list items > projects
      // and honour excludeKeys so refresh actually moves the card. Project
      // descriptions read as boilerplate, so they're the last resort.
      const latest = pickSingleSignal(signals, excludeKeys)
      if (!latest) {
        return res.status(200).json({
          sources,
          model: null,
          reason: 'not-enough-signal',
          took_ms: Date.now() - started,
        })
      }
      // Rebuild ambient block excluding the chosen signal so we don't feed it
      // twice into the prompt.
      const singleAmbient = formatRecentCaptures(signals, new Set([signalKey(latest)]))
      const runSingle = async (temperature: number): Promise<SelfModel | null> => {
        const prompt = buildSinglePrompt(latest, activeProjects, singleAmbient, critique)
        const raw = await generateText(prompt, {
          // Visible JSON only needs ~150 tokens, but Gemini 3's dynamic
          // thinking tokens count toward maxOutputTokens — a 500–800 token
          // think on a complex prompt at the old 900 budget left ~100 for
          // the actual output, truncating the JSON and parse-failing. Match
          // convergence's headroom.
          maxTokens: 2000,
          temperature,
          responseFormat: 'json',
          model: MODELS.FLASH_CHAT,
        })
        const parsed = parseSingleModel(raw, latest)
        if (!parsed) console.warn(`[self-model] single parse failed (temp=${temperature}); raw head:`, raw.slice(0, 400))
        return parsed
      }
      model = await runSingle(0.7)
      // One retry at lower temperature — tightens JSON adherence when the
      // first attempt drifted into prose or returned an off-shape blob.
      if (!model) model = await runSingle(0.4)

      // Last-ditch demo safety: synthesise a card from the signal directly
      // rather than 502-ing the user. Quote is lifted verbatim from their
      // own text; move is a generic-but-honest "push this forward" prompt.
      // Ugly compared to a real read, but the demo never sees a red error.
      if (!model) {
        const fragment = liftFragment(latest)
        if (fragment) {
          console.warn('[self-model] both parse attempts failed; serving synthesised card')
          model = {
            mode: 'single',
            single: quoteFromSignal(fragment, latest),
            move: {
              action: 'Spend 30 focused minutes pushing this thought into a concrete next step',
              why: 'You captured this recently — the quickest way to learn if it matters is to act on it.',
              artefact: 'a written paragraph, voice note, or sketch capturing what you decided',
            },
          }
        }
      }
    }

    if (!model) {
      return res.status(502).json({ error: 'Model returned unparseable output' })
    }

    // Return the source_ids we used so the client can exclude them on the
    // next refresh / argue — guaranteeing the next card is a different
    // read rather than a re-served cluster.
    const usedSourceIds =
      model.mode === 'convergence' && model.convergence
        ? model.convergence.quotes.map(q => signalKey(q))
        : model.single
          ? [signalKey(model.single)]
          : []

    return res.status(200).json({
      sources,
      model,
      source_ids: usedSourceIds,
      relaxed_excludes: relaxedExcludes || undefined,
      relaxed_similarity: relaxedSimilarity || undefined,
      took_ms: Date.now() - started,
    })
  } catch (err) {
    console.error('[self-model] error', err)
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
}
