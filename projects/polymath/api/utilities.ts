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
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
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
} from './_lib/onboarding/coverage.js'
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

  if (req.method === 'GET' && resource === 'session-brief') {
    return handleSessionBrief(req, res)
  }

  return res.status(404).json({ error: 'Not found' })
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

  "entities": {
    "people": [],
    "places": [],
    "topics": ["...", "..."],
    "skills": ["...", "..."]
  },

  "first_insight": "...",
  // THIS IS THE MOST IMPORTANT FIELD. 2-3 sentences.
  // Connect at least 2 of their responses${books && books.length > 0 ? ' AND reference one of their books' : ''} in a way they probably haven't noticed themselves.
  // Be SPECIFIC — quote or reference actual things they said. No generic platitudes.
  // The reader should feel "wow, I never connected those two things before."
  // Write in second person ("You mentioned..." / "There's an interesting thread between your...")
  // Start with the most surprising connection. Don't warm up — go straight to the insight. The reader should feel the connection before they understand it.

  "project_suggestions": [
    {
      "title": "...",
      // Catchy, 3-6 words. Should feel exciting, not corporate.

      "description": "...",
      // 1-2 sentences. Concrete and actionable — someone should be able to picture what this IS.

      "reasoning": "..."
      // 1-2 sentences explaining WHY this fits them specifically.
      // Reference their actual responses and/or books. Don't be generic.
      // The reader should think "that's so me."
    }
  ]
  // Generate exactly 3 project suggestions.
  // Each should combine at least 2 different capabilities or interests from their responses.
  // Make them diverse: one practical/buildable, one creative/expressive, one ambitious/stretch.
  // They should feel personal and surprising — not obvious.
  // Each title should be a noun phrase or verb phrase, not a sentence. "Ambient Recipe Engine" not "Build an Ambient Recipe Engine". Think album title, not task description.

  "graph_preview": { "nodes": [], "edges": [] }
  // Leave empty, not used.
}

Be warm but not sycophantic. Be specific, not generic. Surprise them.`

    const result = await generateText(prompt, {
      maxTokens: 2048,
      temperature: 0.8,
      responseFormat: 'json',
    })

    const analysis = JSON.parse(result)

    // Ensure required fields exist
    const response = {
      capabilities: analysis.capabilities || [],
      themes: analysis.themes || [],
      patterns: analysis.patterns || [],
      entities: analysis.entities || { people: [], places: [], topics: [], skills: [] },
      first_insight: analysis.first_insight || 'Your thoughts are saved. Start a project to see how they connect.',
      graph_preview: { nodes: [], edges: [] },
      project_suggestions: (analysis.project_suggestions || []).slice(0, 3),
    }

    return res.status(200).json(response)
  } catch (error: any) {
    console.error('[utilities/analyze] Analysis error:', error.message)
    // Return minimal fallback so the user isn't stuck
    return res.status(200).json({
      capabilities: [],
      themes: [],
      patterns: [],
      entities: { people: [], places: [], topics: [], skills: [] },
      first_insight: 'Your thoughts are saved. Start a project to see how they connect.',
      graph_preview: { nodes: [], edges: [] },
      project_suggestions: [],
    })
  }
}

// ── Refine Idea ────────────────────────────────────────────────────────────
async function handleRefineIdea(req: VercelRequest, res: VercelResponse) {
  try {
    const { original, feedback, attempt, context } = req.body

    if (!original || !feedback) {
      return res.status(400).json({ error: 'original and feedback are required' })
    }

    const prompt = `You are a creative catalyst AI helping someone find a project idea that resonates with them.

Original idea:
Title: ${original.title}
Description: ${original.description}
Why them: ${original.reasoning}

User feedback (attempt ${attempt || 1}): "${feedback}"

User's themes: ${(context?.themes || []).join(', ')}
User's capabilities: ${(context?.capabilities || []).join(', ')}

Reshape the idea based on their feedback. Keep what they liked, change what didn't resonate. Make it more specific to their context.

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

  const prompt = `You are a project coach for "${project.title}". Write the opening message someone sees when they open this project. Your job is to move them closer to finishing.

PROJECT: ${project.title}
${project.description ? `DESCRIPTION: ${project.description}` : ''}
${project.metadata?.motivation ? `WHY: ${project.metadata.motivation}` : ''}
${project.metadata?.end_goal ? `FINISH LINE: ${project.metadata.end_goal}` : ''}

PHASE: ${phase} (${SESSION_BRIEF_PHASE_LABELS[phase]})
MOMENTUM: ${momentum}
DAYS SINCE LAST VISIT: ${daysSinceActive}
PROGRESS: ${completedTasks}/${totalTasks} tasks (${progressPercent}%)

${taskSummary}
${completionSummary}

Write three things:

1. "greeting" — 1-2 sentences in plain everyday English. Like a friend checking in, not a productivity robot. Reference something concrete: what they last did, what's next, or how long it's been. Keep it warm but direct.
   - shaping: Point out what's missing (no goal? no tasks?) and nudge them to define it
   - building: Name the next task and tell them to do it
   - closing: Tell them how close they are and what's left
   - stale: Be honest about the gap, suggest one tiny thing they could do right now

2. "focusSuggestion" — One plain sentence. The ONE thing to do this session. Name the specific task. "Finish writing the outreach message" not "Continue working on communication tasks".

3. "proactiveQuestion" — ONE practical question that drives toward the finish line. Not philosophical. Not abstract. Think "have you actually messaged those 10 people yet?" not "how will you frame the request to ensure alignment with your vision?"
   - No end goal? → "What would the finished version of this actually look like?"
   - No tasks? → "What's the first real thing you need to do?"
   - Stuck? → "What's actually stopping you from doing [next task]?"
   - Building? → "Is [next task] actually the right next move, or are you avoiding something harder?"
   - Closing? → "What's the last thing standing between you and done?"
   ALWAYS reference specific tasks/goals by name. Never be vague.

Rules:
- Plain English. Write like a real person, not a coach or an AI. No buzzwords.
- No filler. No "Great to see you", "Welcome back", "Let's dive in".
- Short sentences. Say it straight.
- Always orient toward the finish line. Every message should make them think about getting this done.
- Second person ("you").

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
