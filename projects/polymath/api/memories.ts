import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './_lib/supabase.js'
import { getUserId } from './_lib/auth.js'
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import formidable from 'formidable'
import type { File as FormidableFile } from 'formidable'
import fs from 'fs'
import { generateEmbedding, cosineSimilarity } from './_lib/gemini-embeddings.js'
import { processMemory } from './_lib/process-memory.js'
import { generateText } from './_lib/gemini-chat.js'
import { generateInsights, getCachedInsights } from './_lib/insights-generator.js'
import { generateCognitiveReplay } from './_lib/cognitive-replay.js'
import { MODELS } from './_lib/models.js'
import { CaptureMemoryBody, CaptureTitleResponse, validate, tryValidate } from './_lib/schemas.js'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// ─── Types merged from insight.ts and steer.ts ────────────────────────────
export interface InsightResult {
  insight: string
  suggested_action?: {
    type: 'create_todo' | 'open_project'
    text: string
    id?: string
  }
}

export type SteeringMove = 'DEEPEN' | 'COLLIDE' | 'SURFACE' | 'REDIRECT' | 'COMMIT'

export interface SteeringResult {
  move: SteeringMove
  message: string
  evidence: string
  related_id?: string
  related_type?: 'memory' | 'project'
}

// Disable default body parser for multipart/form-data (transcription endpoint)
export const config = {
  api: {
    bodyParser: false,
  },
}

interface SearchResult {
  type: 'memory' | 'project' | 'article'
  id: string
  title: string
  body?: string
  description?: string
  url?: string
  score: number
  created_at: string
  entities?: any
  tags?: string[]
}

interface Memory {
  id: string
  audiopen_id: string
  title: string
  body: string
  orig_transcript: string | null
  tags: string[]
  audiopen_created_at: string
  processed: boolean
  processed_at: string | null
  created_at: string
  embedding?: number[]
  emotional_tone?: string
  themes?: string[]
  review_count?: number
  last_reviewed_at?: string
  entities?: any
  shouldReview?: boolean
  priority?: number
}

interface MemoryPrompt {
  id: string
  prompt_text: string
  prompt_description?: string
  text?: string // Legacy fallback
  is_required: boolean
  priority_order: number
  status?: string
  response?: any
}

interface UserPromptStatus {
  id: string
  user_id: string
  prompt_id: string
  status: string
  response_id: string | null
  completed_at: string | null
  created_at: string
}

/**
 * Unified Memories API
 * GET /api/memories - List all memories
 * GET /api/memories?q=xxx - Universal search across memories, projects, and articles
 * GET /api/memories?resurfacing=true - Get memories to resurface (spaced repetition)
 * GET /api/memories?themes=true - Get theme clusters
 * GET /api/memories?prompts=true - Get memory prompts with status
 * GET /api/memories?bridges=true&id=xxx - Get bridges for memory
 * POST /api/memories - Mark memory as reviewed (requires id in body)
 * POST /api/memories?capture=true - Voice capture with transcript parsing (requires transcript in body)
 * POST /api/memories?action=transcribe - Transcribe audio file (merged from transcribe.ts)
 * POST /api/memories?action=process - Background memory processing (merged from process.ts)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabaseClient()

  try {
    const { resurfacing, bridges, themes, prompts, id, capture, submit_response, auto_credit, q, action, seeds } = req.query

    // POST: Media analysis (audio transcription or image description)
    // Allow without auth — transcription is stateless
    if (req.method === 'POST' && (action === 'transcribe' || action === 'analyze-media')) {
      return await handleMediaAnalysis(req, res)
    }

    // POST: Background processing (merged from process.ts)
    // Allow without auth — triggered by server-side processing
    if (req.method === 'POST' && action === 'process') {
      if (!req.body && req.headers['content-type']?.includes('application/json')) {
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        req.body = JSON.parse(Buffer.concat(chunks).toString())
      }
      return await handleProcess(req, res)
    }

    // ── Auth required for all remaining endpoints ──
    const userId = await getUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'Sign in to access your data' })
    }

    // POST: Submit foundational thought response
    if (req.method === 'POST' && submit_response === 'true') {
      if (!req.body && req.headers['content-type']?.includes('application/json')) {
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        req.body = JSON.parse(Buffer.concat(chunks).toString())
      }
      return await handleSubmitResponse(req, res, supabase, userId)
    }

    // POST: Auto-credit foundational prompts from onboarding analysis
    if (req.method === 'POST' && auto_credit === 'true') {
      if (!req.body && req.headers['content-type']?.includes('application/json')) {
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        req.body = JSON.parse(Buffer.concat(chunks).toString())
      }
      return await handleAutoCredit(req, res, supabase, userId)
    }

    // POST: Voice capture (supports both capture=true and action=capture)
    if (req.method === 'POST' && (capture === 'true' || action === 'capture')) {
      if (!req.body && req.headers['content-type']?.includes('application/json')) {
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        req.body = JSON.parse(Buffer.concat(chunks).toString())
      }
      return await handleCapture(req, res, supabase, userId)
    }

    // POST: Steering (merged from steer.ts)
    if (req.method === 'POST' && action === 'steer') {
      if (!userId) return res.status(401).json({ error: 'Unauthorized' })
      if (!req.body && req.headers['content-type']?.includes('application/json')) {
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        req.body = JSON.parse(Buffer.concat(chunks).toString())
      }
      return await handleSteer(req, res, supabase, userId)
    }

    // POST: Mark memory as reviewed
    if (req.method === 'POST') {
      if (!req.body && req.headers['content-type']?.includes('application/json')) {
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        req.body = JSON.parse(Buffer.concat(chunks).toString())
      }
      const memoryId = req.body?.id || id
      return await handleReview(memoryId as string, res, supabase)
    }

    // PATCH: Update memory (content/metadata)
    if (req.method === 'PATCH') {
      // Since bodyParser: false is set for formidable, we must parse JSON manually if it's a JSON request
      if (!req.body && req.headers['content-type']?.includes('application/json')) {
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        req.body = JSON.parse(Buffer.concat(chunks).toString())
      }

      const memoryId = req.body?.id || id
      return await handleUpdate(memoryId as string, req, res, supabase)
    }

    // GET: Similar memory search (by memory ID)
    if (req.method === 'GET' && req.query.similar) {
      return await handleSimilarSearch(req.query.similar as string, supabase, userId, res)
    }

    // GET: Search (merged from search.ts)
    if (req.method === 'GET' && q) {
      const context = req.query.context as string | undefined
      const semantic = req.query.semantic === 'true'
      return await handleSearch(q as string, supabase, userId, res, context, semantic)
    }

    // GET: Memory prompts
    if (req.method === 'GET' && prompts === 'true') {
      return await handlePrompts(req, res, supabase, userId)
    }

    // GET: Theme clusters
    if (req.method === 'GET' && themes === 'true') {
      return await handleThemes(res, supabase)
    }

    // GET: Voice seeds — contextual thinking prompts before capture
    if (req.method === 'GET' && seeds === 'true') {
      return await handleSeeds(req, res, supabase, userId)
    }

    // GET: Bridges for memory
    if (req.method === 'GET' && bridges === 'true') {
      return await handleBridges(id as string | undefined, res, supabase)
    }

    // GET: Resurfacing queue
    if (req.method === 'GET' && resurfacing === 'true') {
      const parsedLimit = Number(req.query.limit)
      const limitNum = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 5
      return await handleResurfacing(res, supabase, limitNum)
    }

    // GET: Insight (merged from insight.ts)
    if (req.method === 'GET' && action === 'insight') {
      if (!userId) return res.status(401).json({ error: 'Unauthorized' })
      return await handleInsight(req, res, supabase, userId)
    }

    // POST /api/memories?action=replay → generate cognitive replay for a time window
    if (req.method === 'POST' && action === 'replay') {
      if (!userId) return res.status(401).json({ error: 'Unauthorized' })
      try {
        const { start_date, end_date } = req.body || {}
        if (!start_date || !end_date) {
          return res.status(400).json({ error: 'start_date and end_date required' })
        }
        const replay = await generateCognitiveReplay(userId, start_date, end_date)
        return res.status(200).json(replay)
      } catch (error) {
        console.error('[memories:replay] Error:', error)
        return res.status(500).json({ error: 'Replay generation failed' })
      }
    }

    // GET /api/memories?action=evolution  → return cached synthesis insights + shadow_project
    // POST /api/memories?action=evolution → force-regenerate from all user data
    if (action === 'evolution') {
      if (!userId) return res.status(401).json({ error: 'Unauthorized' })
      try {
        if (req.method === 'GET') {
          const cached = await getCachedInsights(userId)
          return res.status(200).json({
            insights: cached.insights,
            shadow_project: cached.shadow_project,
            generated_at: cached.generated_at,
          })
        }
        if (req.method === 'POST') {
          const all = await generateInsights(userId)
          const shadow_project = all.find(i => i.type === 'shadow_project') ?? null
          const insights = all.filter(i => i.type !== 'shadow_project')
          return res.status(200).json({
            insights,
            shadow_project,
            generated_at: new Date().toISOString(),
          })
        }
        return res.status(405).json({ error: 'Method not allowed' })
      } catch (error) {
        console.error('[memories:evolution] Error:', error)
        return res.status(500).json({ error: 'Analysis failed', insights: [], shadow_project: null })
      }
    }

    // GET: Single memory by ID
    if (req.method === 'GET' && id && !bridges) {
      const { data, error } = await supabase
        .from('memories')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single()

      if (error) {
        return res.status(404).json({ error: 'Memory not found' })
      }

      return res.status(200).json({ memory: data })
    }

    // GET: List all memories (default)
    if (req.method === 'GET') {
      const { data: memories, error } = await supabase
        .from('memories')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('[memories] GET error:', error)
        return res.status(500).json({
          error: 'Failed to fetch memories',
          details: error.message
        })
      }

      return res.status(200).json({ memories })
    }

    // DELETE: Delete memory
    if (req.method === 'DELETE') {
      const memoryId = req.body?.id || id
      return await handleDelete(memoryId as string, res, supabase)
    }

    return res.status(405).json({ error: 'Method not allowed' })

  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// ─── Insight handler (merged from insight.ts) ─────────────────────────────
async function handleInsight(req: VercelRequest, res: VercelResponse, supabase: ReturnType<typeof getSupabaseClient>, userId: string) {
  const { id, type } = req.query
  if (!id || !type) return res.status(400).json({ error: 'id and type required' })

  try {
    const insights: string[] = []
    let suggestedAction: InsightResult['suggested_action'] = undefined

    const { count: connectionCount } = await supabase
      .from('connections')
      .select('*', { count: 'exact', head: true })
      .or(`source_id.eq.${id},target_id.eq.${id}`)

    if (connectionCount && connectionCount > 0) {
      insights.push(`Connected to ${connectionCount} other item${connectionCount !== 1 ? 's' : ''}`)
    }

    if (type === 'thought') {
      const { data: linkedTodos } = await supabase
        .from('todos')
        .select('text, done')
        .eq('source_memory_id', id as string)
        .is('deleted_at', null)
        .limit(3)

      if (linkedTodos && linkedTodos.length > 0) {
        const active = linkedTodos.filter(t => !t.done)
        if (active.length > 0) {
          insights.push(`Has ${active.length} linked todo${active.length !== 1 ? 's' : ''}: "${active[0].text}"`)
        } else {
          insights.push(`All ${linkedTodos.length} linked todo${linkedTodos.length !== 1 ? 's' : ''} completed`)
        }
      } else {
        suggestedAction = { type: 'create_todo', text: 'Create a todo from this thought' }
      }

      const { data: memory } = await supabase
        .from('memories')
        .select('themes, created_at')
        .eq('id', id as string)
        .single()

      if (memory?.themes && memory.themes.length > 0) {
        const primaryTheme = memory.themes[0]
        const { count: themeCount } = await supabase
          .from('memories')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .contains('themes', [primaryTheme])

        if (themeCount && themeCount > 2) {
          insights.push(`"${primaryTheme}" appears in ${themeCount} of your thoughts`)
        }
      }

      const { data: relatedProjects } = await supabase
        .from('connections')
        .select('target_id, target_type, source_id, source_type')
        .or(`source_id.eq.${id},target_id.eq.${id}`)
        .in('source_type', ['project'])
        .limit(1)

      const { data: reverseProjects } = await supabase
        .from('connections')
        .select('target_id, source_id, target_type, source_type')
        .or(`source_id.eq.${id},target_id.eq.${id}`)
        .in('target_type', ['project'])
        .limit(1)

      const projectConn = relatedProjects?.[0] || reverseProjects?.[0]
      if (projectConn) {
        const projectId = projectConn.source_type === 'project' ? projectConn.source_id : projectConn.target_id
        const { data: project } = await supabase
          .from('projects')
          .select('title')
          .eq('id', projectId)
          .single()

        if (project) {
          insights.push(`Related to project "${project.title}"`)
          if (!suggestedAction) {
            suggestedAction = { type: 'open_project', text: `Open ${project.title}`, id: projectId }
          }
        }
      }
    }

    const insight = insights.length > 0
      ? insights.join(' · ')
      : 'No connections yet — this thought is still finding its place'

    if (insights.length === 0 && !suggestedAction) {
      suggestedAction = { type: 'create_todo', text: 'Turn this into an action' }
    }

    return res.status(200).json({ insight, suggested_action: suggestedAction })
  } catch (error) {
    console.error('[insight] Error:', error)
    return res.status(500).json({ error: 'Failed to generate insight' })
  }
}

// ─── Steer handler (merged from steer.ts) ────────────────────────────────
async function handleSteer(req: VercelRequest, res: VercelResponse, supabase: ReturnType<typeof getSupabaseClient>, userId: string) {
  const { memory_id } = req.body
  if (!memory_id) return res.status(400).json({ error: 'memory_id required' })

  try {
    const [memoryRes, allMemoriesRes, projectsRes, capabilitiesRes] = await Promise.all([
      supabase
        .from('memories')
        .select('id, title, body, created_at, themes, entities, emotional_tone, memory_type')
        .eq('id', memory_id)
        .single(),
      supabase
        .from('memories')
        .select('id, title, body, created_at, memory_type')
        .eq('user_id', userId)
        .neq('id', memory_id)
        .order('created_at', { ascending: false })
        .limit(400),
      supabase
        .from('projects')
        .select('id, title, description, status, metadata')
        .eq('user_id', userId)
        .in('status', ['active', 'upcoming', 'dormant']),
      supabase
        .from('capabilities')
        .select('name, strength, description')
        .eq('user_id', userId)
        .order('strength', { ascending: false })
        .limit(15),
    ])

    if (memoryRes.error || !memoryRes.data) {
      return res.status(404).json({ error: 'Memory not found' })
    }

    const memory = memoryRes.data
    const allMemories = allMemoriesRes.data || []
    const projects = projectsRes.data || []
    const capabilities = capabilitiesRes.data || []

    const newThought = `${memory.title}\n${memory.body || ''}\nCaptured: ${new Date(memory.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`

    const memoryTimeline = allMemories
      .map((m: any) => {
        const date = new Date(m.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        const body = m.body ? m.body.slice(0, 160).replace(/\n/g, ' ') : ''
        return `[${date}] ${m.title}${body ? ` — ${body}` : ''}`
      })
      .join('\n')

    const projectList = projects
      .map((p: any) => `• ${p.title} (${p.status})${p.description ? ': ' + p.description.slice(0, 120) : ''}`)
      .join('\n')

    const capabilityList = capabilities
      .map((c: any) => `• ${c.name} (strength: ${c.strength?.toFixed(2) || '?'})`)
      .join('\n')

    const prompt = `You are a thinking partner. Someone just captured a new thought.

A new thought just arrived. Analyse it against the user's complete knowledge base and return ONE steering move that will push their thinking forward RIGHT NOW.

=== NEW THOUGHT ===
${newThought}

=== KNOWLEDGE BASE — ${allMemories.length} memories (newest first) ===
${memoryTimeline || '(no prior memories)'}

=== PROJECTS ===
${projectList || '(none)'}

=== TOP CAPABILITIES ===
${capabilityList || '(none)'}

=== STEERING MOVES ===
Choose exactly one:
- DEEPEN: They've circled this theme before — there's an obvious next question they haven't asked
- COLLIDE: This thought directly contradicts or creates productive tension with something prior
- SURFACE: This connects to a dormant project or forgotten idea they should revisit
- REDIRECT: There's a recurring pattern or avoidance in the knowledge base this thought reveals
- COMMIT: They have accumulated enough material on this — it's time to build or decide

=== RULES ===
- The message MUST reference their specific content (names, projects, dates), not generic advice
- Maximum 20 words for message
- Never start with "You", "I", or "Consider"
- If you can see a contradiction or pattern, name it directly — don't soften it
- related_id should be the memory or project ID most relevant to this steering move (optional)

Return ONLY valid JSON, no markdown:
{
  "move": "DEEPEN" | "COLLIDE" | "SURFACE" | "REDIRECT" | "COMMIT",
  "message": "One sharp, specific sentence (max 20 words)",
  "evidence": "What in the knowledge base triggered this (max 30 words)",
  "related_id": "optional memory or project id",
  "related_type": "memory" | "project" | null
}`

    const model = genAI.getGenerativeModel({
      model: MODELS.DEFAULT_CHAT,
      generationConfig: { responseMimeType: 'application/json' },
    })

    const result = await model.generateContent(prompt)
    const text = result.response.text()

    let steering: SteeringResult
    try {
      steering = JSON.parse(text)
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('No JSON in response')
      steering = JSON.parse(match[0])
    }

    const validMoves: SteeringMove[] = ['DEEPEN', 'COLLIDE', 'SURFACE', 'REDIRECT', 'COMMIT']
    if (!validMoves.includes(steering.move)) steering.move = 'DEEPEN'

    return res.status(200).json(steering)
  } catch (error) {
    console.error('[steer] Error:', error)
    return res.status(500).json({ error: 'Steering failed' })
  }
}

/* UNUSED - kept for reference
 * Attempt to repair incomplete JSON from Gemini
 * Handles cases like: {"title": "something
 */
/* function repairIncompleteJSON(jsonStr: string): string {
  let repaired = jsonStr.trim()

  // Count braces to see if incomplete
  const openBraces = (repaired.match(/\{/g) || []).length
  const closeBraces = (repaired.match(/\}/g) || []).length

  // If missing closing brace
  if (openBraces > closeBraces) {
    // Check if last field value is incomplete (missing closing quote)
    if (repaired.match(/"[^"]*$/)) {
      repaired += '"'  // Close the string
    }

    // Add missing bullets field if it's missing
    if (!repaired.includes('"bullets"')) {
      // Extract the title if possible
      const titleMatch = repaired.match(/"title"\s*:\s*"([^"]*)"/)
      if (titleMatch) {
        // Create a simple bullet from the title
        repaired = repaired.replace(/"title"\s*:\s*"([^"]*)"[^}]*$/,
          `"title": "${titleMatch[1]}", "bullets": ["${titleMatch[1]}"]`)
      } else {
        // Fallback: add empty bullets
        if (!repaired.endsWith(',')) {
          repaired += ','
        }
        repaired += ' "bullets": ["Quick thought"]'
      }
    }

    // Add missing closing braces
    for (let i = 0; i < (openBraces - closeBraces); i++) {
      repaired += '}'
    }
  }

  return repaired
} */

/**
 * Handle voice capture - uses raw transcript, then full AI processing enriches it
 */
async function handleCapture(req: VercelRequest, res: VercelResponse, supabase: any, userId: string) {
  const startTime = Date.now()

  let validatedBody
  try {
    validatedBody = validate(CaptureMemoryBody, req.body, 'capture')
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'invalid body' })
  }
  const { transcript, body, title: providedTitle, source_reference, tags, memory_type, image_urls, checklist_items } = validatedBody

  // Accept both 'transcript' (voice) and 'body' (manual text) field names
  const text = transcript || body

  if (!text && !checklist_items) {
    return res.status(400).json({ error: 'transcript, body, or checklist_items field required' })
  }

  // Checklist-only note: no body/transcript needed, skip AI processing
  if (!text && checklist_items) {
    try {
      const now = new Date().toISOString()
      const uniqueId = `checklist_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      const noteTitle = providedTitle || 'Checklist'
      const newMemory: any = {
        audiopen_id: uniqueId,
        title: noteTitle,
        body: '',
        orig_transcript: null,
        tags: tags && Array.isArray(tags) ? tags : [],
        audiopen_created_at: now,
        memory_type: memory_type || 'quick-note',
        image_urls: null,
        checklist_items,
        entities: null,
        themes: null,
        emotional_tone: null,
        source_reference: source_reference || null,
        embedding: null,
        processed: true,
        processed_at: now,
        error: null,
      }
      if (userId) newMemory.user_id = userId

      const { data: memory, error: insertError } = await supabase
        .from('memories')
        .insert(newMemory)
        .select()
        .single()

      if (insertError) throw insertError
      return res.status(200).json({ success: true, memory })
    } catch (error) {
      console.error('[handleCapture] Checklist insert error:', error)
      return res.status(500).json({ error: 'Failed to create checklist note' })
    }
  }

  // The two branches above covered checklist-only + missing-input cases, so
  // `text` is a non-empty string from here on. Narrow for TS.
  if (!text) {
    return res.status(400).json({ error: 'transcript or body required' })
  }

  console.log('[handleCapture] Starting capture processing', { hasProvidedTitle: !!providedTitle })

  // Detect input type: voice sends transcript field, manual text sends body field
  const isVoice = !!transcript
  const isManualEntry = !isVoice

  let parsedTitle = ''
  let parsedBullets: string[] = [text]

  // Helper function to check if title is too similar to original text (verbatim)
  // Only rejects titles that are a literal substring of the transcript's opening words
  const isVerbatimTitle = (title: string, originalText: string): boolean => {
    const normalizeText = (str: string) => str.toLowerCase().replace(/[^\w\s]/g, '').trim()
    const normalizedTitle = normalizeText(title)
    const normalizedOriginal = normalizeText(originalText)

    // Check if title literally appears in sequence at the start of the transcript
    // e.g. title "I was just thinking about" inside "i was just thinking about snakes..."
    const firstWords = normalizedOriginal.split(/\s+/).slice(0, 20).join(' ')
    const titleAsString = normalizedTitle.split(/\s+/).join(' ')

    if (firstWords.includes(titleAsString) && titleAsString.split(/\s+/).length >= 2) {
      return true
    }

    return false
  }

  // Fallback title when Gemini fails entirely - avoids first words
  const createFallbackTitle = (text: string): string => {
    const words = text.split(/\s+/).filter(w => w.length > 0)
    if (words.length <= 6) return text.trim()

    // Try the last sentence - voice notes often end with the key point
    const sentences = text.split(/[.!?]/).map(s => s.trim()).filter(s => s.length > 10)
    if (sentences.length > 1) {
      const lastSentence = sentences[sentences.length - 1]
      const lastWords = lastSentence.split(/\s+/)
      if (lastWords.length >= 3 && lastWords.length <= 10) {
        return lastSentence
      }
    }

    // Take words from the middle third of the text (avoids first-word problem)
    const midStart = Math.floor(words.length * 0.3)
    const midEnd = Math.min(midStart + 7, words.length)
    return words.slice(midStart, midEnd).join(' ')
  }

  // Run AI title + bullet generation for both voice and manual text entries
  try {
      console.log('[handleCapture] Starting Gemini title generation...')

      // Validate API key
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured')
      }

      // Configure Gemini with Structured Outputs (JSON Schema)
      const model = genAI.getGenerativeModel({
        model: MODELS.DEFAULT_CHAT, // Auto-updates to latest Flash version
        generationConfig: {
          temperature: 0.7, // Reduced for more consistent results
          maxOutputTokens: 500,
          responseMimeType: 'application/json',
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              title: { type: SchemaType.STRING, description: "A concise, descriptive summary title (4-8 words max)" },
              bullets: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING },
                description: "2-4 bullet points capturing key ideas in first person"
              }
            },
            required: ["title", "bullets"]
          }
        }
      })

      const prompt = `You are an expert at creating concise, descriptive titles from voice transcriptions. Your task is to SUMMARIZE the content, NOT copy it verbatim.

🚨 CRITICAL RULE: The title MUST be a creative SUMMARY that captures the ESSENCE. NEVER use the exact words from the beginning of the transcript.

Voice transcription to summarize:
"${text}"

📋 INSTRUCTIONS:
1. Read the ENTIRE transcription to understand the main point
2. Identify the core concept, question, or insight
3. Create a NEW descriptive title using DIFFERENT words
4. Keep it brief (4-8 words maximum)
5. Make it informative and specific

✅ GOOD EXAMPLES (creative summaries):
- Input: "I was just thinking about how when you look at a snake it's really hard to tell where the body ends and the tail begins, like is there even a clear boundary"
  Output: "Snake body-tail boundary question"

- Input: "So I've been trying to understand React hooks and I think the key thing is that they let you use state in functional components which is really cool"
  Output: "React hooks enable functional component state"

- Input: "Need to remember to call mom tomorrow about the family reunion next month"
  Output: "Call mom about family reunion"

- Input: "That presentation on the new marketing strategy was really insightful, especially the part about customer segmentation"
  Output: "Marketing strategy customer segmentation insights"

- Input: "Been wondering if we should refactor the authentication system to use JWT tokens instead of sessions"
  Output: "Authentication refactor JWT vs sessions"

❌ WRONG (verbatim copying - DO NOT DO THIS):
- "I was just thinking about how when you look at a snake"
- "So I've been trying to understand React hooks"
- "Need to remember to call mom tomorrow"
- "That presentation on the new marketing strategy"

🎯 YOUR TASK:
Create a JSON response with:
1. "title": A creative 4-8 word summary (NOT the first words of the input!)
2. "bullets": 2-4 key points in first-person voice

Remember: BE CREATIVE. SUMMARIZE. DO NOT COPY THE BEGINNING OF THE TEXT.`

      console.log('[handleCapture] Calling Gemini for title summarization...')

      const result = await model.generateContent(prompt)
      const response = result.response
      const jsonText = response.text()

      console.log('[handleCapture] Gemini raw response:', jsonText)

      try {
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
        const raw = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(jsonText)
        const parsed = tryValidate(CaptureTitleResponse, raw, 'handleCapture:gemini-title')

        if (parsed) {
          if (isVerbatimTitle(parsed.title, text)) {
            console.warn('[handleCapture] ⚠️ Gemini returned verbatim title, rejecting:', parsed.title)
            parsedTitle = (isManualEntry && providedTitle) ? providedTitle : createFallbackTitle(text)
          } else {
            parsedTitle = (isManualEntry && providedTitle) ? providedTitle : parsed.title
            parsedBullets = parsed.bullets
            console.log('[handleCapture] ✅ Successfully generated summary title:', parsedTitle)
          }
        } else {
          parsedTitle = (isManualEntry && providedTitle) ? providedTitle : createFallbackTitle(text)
        }
      } catch (parseError) {
        console.error('[handleCapture] Failed to parse Gemini JSON response:', parseError)
        console.error('[handleCapture] Raw response was:', jsonText)
        parsedTitle = (isManualEntry && providedTitle) ? providedTitle : createFallbackTitle(text)
      }

    } catch (geminiError) {
      console.error('[handleCapture] Gemini API error:', geminiError)
      console.error('[handleCapture] Error details:', geminiError instanceof Error ? geminiError.message : String(geminiError))
      parsedTitle = (isManualEntry && providedTitle) ? providedTitle : createFallbackTitle(text)
    }

  // Final safety check: ensure we have a title
  if (!parsedTitle || parsedTitle.trim() === '') {
    console.warn('[handleCapture] No title generated, using fallback')
    parsedTitle = (isManualEntry && providedTitle) ? providedTitle : createFallbackTitle(text)
  }

  console.log('[handleCapture] Final title:', parsedTitle)

  // Always create memory with raw transcript
  try {
    const now = new Date().toISOString()
    // Voice → raw transcript (light cleanup happens in background processMemory)
    // Text → original body preserved exactly as typed (AI only generates the title)
    const memoryBody = text

    // Generate unique ID with timestamp + random component to prevent collisions on retry
    const uniqueId = isManualEntry
      ? `manual_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      : `voice_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // Use provided tags, otherwise empty array (AI will generate contextual tags during processing)
    const memoryTags = tags && Array.isArray(tags) && tags.length > 0
      ? tags
      : []

    const newMemory = {
      audiopen_id: uniqueId,
      title: parsedTitle,
      body: memoryBody,
      orig_transcript: isManualEntry ? null : text,
      tags: memoryTags,
      audiopen_created_at: now,
      memory_type: memory_type || null,
      image_urls: image_urls || null,
      checklist_items: checklist_items || null,
      entities: null,
      themes: null,
      emotional_tone: null,
      source_reference: source_reference || null,
      embedding: null,
      processed: false, // Will be fully processed in background
      processed_at: null,
      error: null,
      user_id: undefined as string | undefined
    }

    // Add user_id if available to ensure RLS visibility
    if (userId) {
      newMemory.user_id = userId
    }

    const { data: memory, error: insertError } = await supabase
      .from('memories')
      .insert(newMemory)
      .select()
      .single()

    if (insertError) {
      console.error('[handleCapture] Database insert error:', insertError)
      throw insertError
    }

    console.log(`[handleCapture] Memory created in ${Date.now() - startTime}ms, returning immediately`)

    // Return the memory immediately so the client can display it without waiting
    // AI processing (tags, summary, linking, embeddings) runs in the background
    // and is picked up by the cron job if it doesn't complete here
    res.status(201).json({
      success: true,
      memory,
      message: 'Voice note saved!'
    })

    // Non-blocking: kick off processing after response is sent
    // In Vercel Node.js runtime the function continues running after res.json()
    // The cron will retry any memories that aren't processed
    processMemory(memory.id)
      .then(() => console.log(`[handleCapture] ✅ Background processing complete for ${memory.id}`))
      .catch(err => console.error(`[handleCapture] Background processing failed for ${memory.id}:`, err))
    return

  } catch (error) {
    console.error('[handleCapture] Error:', error)
    return res.status(500).json({
      error: 'Failed to capture thought',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Mark memory as reviewed
 */
async function handleReview(memoryId: string, res: VercelResponse, supabase: any) {
  if (!memoryId) {
    return res.status(400).json({ error: 'Memory ID required' })
  }

  try {
    // First, get current review count
    const { data: existing } = await supabase
      .from('memories')
      .select('review_count')
      .eq('id', memoryId)
      .single()

    // Update review metadata
    const { data: memory, error } = await supabase
      .from('memories')
      .update({
        last_reviewed_at: new Date().toISOString(),
        review_count: (existing?.review_count || 0) + 1
      })
      .eq('id', memoryId)
      .select()
      .single()

    if (error) {
      return res.status(500).json({ error: 'Failed to mark as reviewed' })
    }

    return res.status(200).json({
      success: true,
      memory
    })
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Delete memory and its related data
 */
async function handleDelete(memoryId: string, res: VercelResponse, supabase: any) {
  if (!memoryId) {
    return res.status(400).json({ error: 'Memory ID required' })
  }

  try {
    console.log('[memories] Deleting memory:', memoryId)

    // 1. Delete bridges
    const { error: bridgeError } = await supabase
      .from('bridges')
      .delete()
      .or(`memory_a.eq.${memoryId},memory_b.eq.${memoryId}`)

    if (bridgeError) console.warn('[memories] Bridge delete warning:', bridgeError)

    // 2. Clear references in user_prompt_status
    const { error: promptError } = await supabase
      .from('user_prompt_status')
      .update({ response_id: null, status: 'pending' })
      .eq('response_id', memoryId)

    if (promptError) console.warn('[memories] Prompt status update warning:', promptError)

    // 3. Delete memory
    const { error, count } = await supabase
      .from('memories')
      .delete({ count: 'exact' })
      .eq('id', memoryId)

    if (error) throw error

    return res.status(200).json({
      success: true,
      message: 'Memory deleted successfully',
      deleted_count: count
    })
  } catch (error) {
    console.error('[memories] Delete failed:', error)
    return res.status(500).json({
      error: 'Failed to delete memory',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Get bridges for memory
 */
async function handleBridges(memoryId: string | undefined, res: VercelResponse, supabase: any) {
  try {
    if (memoryId) {
      // Get bridges for specific memory
      const { data: bridges, error } = await supabase
        .from('bridges')
        .select(`
          *,
          memory_a:memories!bridges_memory_a_fkey(id, title, created_at),
          memory_b:memories!bridges_memory_b_fkey(id, title, created_at)
        `)
        .or(`memory_a.eq.${memoryId},memory_b.eq.${memoryId}`)
        .order('strength', { ascending: false })

      if (error) {
        return res.status(500).json({ error: 'Failed to fetch bridges' })
      }

      return res.status(200).json({ bridges })
    }

    // Get all bridges
    const { data: bridges, error } = await supabase
      .from('bridges')
      .select(`
        *,
        memory_a:memories!bridges_memory_a_fkey(id, title, created_at),
        memory_b:memories!bridges_memory_b_fkey(id, title, created_at)
      `)
      .order('strength', { ascending: false })
      .limit(100)

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch bridges' })
    }

    return res.status(200).json({ bridges })
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Resurfacing algorithm: Spaced repetition
 */
async function handleResurfacing(res: VercelResponse, supabase: any, limit = 5) {
  try {
    // Get all memories with metadata
    const { data: memories, error } = await supabase
      .from('memories')
      .select(`
        *,
        entities:entities(count)
      `)
      .eq('processed', true)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Calculate which memories should be resurfaced
    const now = new Date()
    const resurfacingCandidates = memories
      .map((memory: Memory) => {
        const createdAt = new Date(memory.created_at)
        const lastReviewed = memory.last_reviewed_at
          ? new Date(memory.last_reviewed_at)
          : createdAt

        const daysSinceReview = Math.floor(
          (now.getTime() - lastReviewed.getTime()) / (1000 * 60 * 60 * 24)
        )

        // Spaced repetition intervals
        const intervals = [1, 3, 7, 14, 30, 60, 90]
        const reviewCount = memory.review_count || 0
        const targetInterval = intervals[Math.min(reviewCount, intervals.length - 1)]

        // Should resurface if days since review >= target interval
        const shouldReview = daysSinceReview >= targetInterval

        // Priority score: entity count + recency factor
        const entityCount = memory.entities?.[0]?.count || 0
        const recencyFactor = Math.max(0, 1 - (daysSinceReview / 365))
        const priority = entityCount * 0.5 + recencyFactor * 0.5

        return {
          ...memory,
          shouldReview,
          daysSinceReview,
          targetInterval,
          priority
        }
      })
      .filter((m: Memory) => m.shouldReview)
      .sort((a: Memory, b: Memory) => (b.priority || 0) - (a.priority || 0))
      .slice(0, limit)

    return res.status(200).json({
      memories: resurfacingCandidates,
      count: resurfacingCandidates.length
    })

  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch resurfacing memories' })
  }
}

/**
 * Theme clustering: Group memories by AI-extracted themes
 */
async function handleThemes(res: VercelResponse, supabase: any) {
  try {
    const { data: memories, error: memoriesError } = await supabase
      .from('memories')
      .select('*')
      .order('created_at', { ascending: false })

    if (memoriesError) throw memoriesError

    if (!memories || memories.length === 0) {
      return res.status(200).json({
        clusters: [],
        total_memories: 0,
        uncategorized_count: 0
      })
    }

    // Extract all unique themes across all memories
    const themeMap = new Map<string, any[]>()
    let uncategorizedCount = 0

    memories.forEach((memory: Memory) => {
      const themes = memory.themes || []

      if (themes.length === 0) {
        uncategorizedCount++
        return
      }

      themes.forEach((theme: string) => {
        if (!themeMap.has(theme)) {
          themeMap.set(theme, [])
        }
        themeMap.get(theme)!.push(memory)
      })
    })

    // Define theme metadata (icon, color)
    const themeMetadata: Record<string, { icon: string; color: string }> = {
      'design': { icon: '🎨', color: '#EC4899' },
      'career': { icon: '💼', color: '#3B82F6' },
      'learning': { icon: '🧠', color: '#8B5CF6' },
      'projects': { icon: '⚡', color: '#F59E0B' },
      'life': { icon: '🏡', color: '#10B981' },
      'ideas': { icon: '💡', color: '#F59E0B' },
      'tech': { icon: '💻', color: '#6366F1' },
      'health': { icon: '🏃', color: '#EF4444' },
      'relationships': { icon: '❤️', color: '#EC4899' },
      'finance': { icon: '💰', color: '#10B981' },
      'travel': { icon: '✈️', color: '#06B6D4' },
      'food': { icon: '🍜', color: '#F97316' },
      'books': { icon: '📚', color: '#8B5CF6' },
      'music': { icon: '🎵', color: '#EC4899' },
      'art': { icon: '🖼️', color: '#F59E0B' },
      'writing': { icon: '✍️', color: '#6366F1' },
      'business': { icon: '📊', color: '#3B82F6' },
      'productivity': { icon: '⚡', color: '#10B981' },
      'mindfulness': { icon: '🧘', color: '#8B5CF6' },
      'creativity': { icon: '🌟', color: '#F59E0B' }
    }

    // Build clusters
    const clusters = Array.from(themeMap.entries())
      .map(([themeName, themeMemories]) => {
        const metadata = themeMetadata[themeName.toLowerCase()] || {
          icon: '📝',
          color: '#6B7280'
        }

        // Extract sample keywords from memory titles/tags
        const keywords = new Set<string>()
        themeMemories.slice(0, 10).forEach(memory => {
          if (memory.tags) {
            memory.tags.forEach((tag: string) => keywords.add(tag))
          }
          if (memory.title) {
            memory.title
              .toLowerCase()
              .split(/\s+/)
              .filter((word: string) => word.length > 4)
              .slice(0, 2)
              .forEach((word: string) => keywords.add(word))
          }
        })

        return {
          id: themeName.toLowerCase().replace(/\s+/g, '-'),
          name: themeName.charAt(0).toUpperCase() + themeName.slice(1),
          icon: metadata.icon,
          color: metadata.color,
          memory_count: themeMemories.length,
          sample_keywords: Array.from(keywords).slice(0, 5),
          memories: themeMemories
        }
      })
      .sort((a, b) => b.memory_count - a.memory_count)
      .slice(0, 12)

    return res.status(200).json({
      clusters,
      total_memories: memories.length,
      uncategorized_count: uncategorizedCount
    })

  } catch (error) {
    return res.status(500).json({
      error: 'Failed to cluster themes',
      clusters: [],
      total_memories: 0,
      uncategorized_count: 0
    })
  }
}

/**
 * Auto-credit foundational prompts from onboarding analysis.
 * Maps AI-extracted themes, capabilities, and entities to required prompts,
 * marks them all as completed, and generates 2-3 follow-up suggestions.
 */
async function handleAutoCredit(req: VercelRequest, res: VercelResponse, supabase: any, userId: string) {
  try {
    const { analysis, transcripts } = req.body as {
      analysis: {
        themes?: string[]
        capabilities?: string[]
        patterns?: string[]
        entities?: { people?: string[]; places?: string[]; topics?: string[]; skills?: string[] }
        first_insight?: string
      }
      transcripts: string[]
    }

    if (!analysis || !transcripts || transcripts.length === 0) {
      return res.status(400).json({ error: 'analysis and transcripts required' })
    }

    // Fetch all required prompts
    const { data: requiredPrompts, error: promptsError } = await supabase
      .from('memory_prompts')
      .select('*')
      .eq('is_required', true)
      .order('priority_order', { ascending: true })

    if (promptsError || !requiredPrompts?.length) {
      return res.status(500).json({ error: 'Failed to fetch required prompts' })
    }

    // Check which are already completed
    const { data: existingStatuses } = await supabase
      .from('user_prompt_status')
      .select('prompt_id, status')
      .eq('user_id', userId)

    const completedIds = new Set(
      (existingStatuses || [])
        .filter((s: any) => s.status === 'completed')
        .map((s: any) => s.prompt_id)
    )

    // Map analysis data to prompt responses
    const { themes = [], capabilities = [], patterns = [], entities = {} } = analysis
    const { people = [], places = [], topics = [], skills = [] } = entities
    const allTranscript = transcripts.join(' ')

    // Build bullets for each required prompt from the analysis
    const promptBullets: Record<string, string[]> = {}

    for (const prompt of requiredPrompts) {
      const key = prompt.prompt_text.toLowerCase()

      if (key.includes('life overview')) {
        promptBullets[prompt.id] = [
          ...(patterns.length > 0 ? [patterns[0]] : []),
          ...(themes.length > 0 ? [`Key themes: ${themes.slice(0, 3).join(', ')}`] : []),
          analysis.first_insight || `Drawn to ${topics.slice(0, 2).join(' and ') || 'varied interests'}`,
        ].filter(Boolean).slice(0, 5)
      } else if (key.includes('current situation')) {
        promptBullets[prompt.id] = [
          `Currently exploring: ${topics.slice(0, 3).join(', ') || themes[0] || 'new ideas'}`,
          ...(capabilities.length > 0 ? [`Active skills: ${capabilities.slice(0, 2).join(', ')}`] : []),
          `Interests span ${themes.slice(0, 3).join(', ') || 'multiple areas'}`,
        ].filter(Boolean).slice(0, 5)
      } else if (key.includes('values') || key.includes('strengths')) {
        promptBullets[prompt.id] = [
          ...capabilities.slice(0, 3).map(c => `Strength: ${c}`),
          ...(patterns.length > 1 ? [patterns[1]] : []),
        ].filter(Boolean).slice(0, 5)
      } else if (key.includes('partner') || key.includes('close relationship')) {
        promptBullets[prompt.id] = people.length > 0
          ? people.slice(0, 3).map(p => `Mentioned: ${p}`)
          : ['Captured from voice onboarding — details to be enriched']
      } else if (key.includes('family')) {
        promptBullets[prompt.id] = people.length > 1
          ? people.slice(0, 3).map(p => `Family member: ${p}`)
          : ['Captured from voice onboarding — details to be enriched']
      } else if (key.includes('friends')) {
        promptBullets[prompt.id] = people.length > 2
          ? people.slice(1, 4).map(p => `Close friend: ${p}`)
          : ['Captured from voice onboarding — details to be enriched']
      } else if (key.includes('career')) {
        promptBullets[prompt.id] = [
          ...skills.slice(0, 2).map(s => `Skill: ${s}`),
          ...(capabilities.length > 0 ? [`Capability: ${capabilities[0]}`] : []),
        ].filter(Boolean).slice(0, 5)
      } else if (key.includes('current work')) {
        promptBullets[prompt.id] = [
          ...(topics.length > 0 ? [`Working on: ${topics.slice(0, 2).join(', ')}`] : []),
          ...(skills.length > 0 ? [`Using: ${skills.slice(0, 2).join(', ')}`] : []),
          ...(capabilities.length > 1 ? [`Strength: ${capabilities[1]}`] : []),
        ].filter(Boolean).slice(0, 5)
      } else if (key.includes('hobbies') || key.includes('passions')) {
        promptBullets[prompt.id] = [
          ...topics.slice(0, 3).map(t => `Interest: ${t}`),
          ...(themes.length > 2 ? [`Theme: ${themes[2]}`] : []),
        ].filter(Boolean).slice(0, 5)
      } else if (key.includes('goals') || key.includes('aspirations')) {
        promptBullets[prompt.id] = [
          ...(themes.length > 0 ? [`Driven by: ${themes[0]}`] : []),
          ...(patterns.length > 0 ? [patterns[0]] : []),
          ...(capabilities.length > 0 ? [`Leveraging: ${capabilities.slice(0, 2).join(', ')}`] : []),
        ].filter(Boolean).slice(0, 5)
      }
    }

    // Insert responses and mark as completed for prompts not already done
    let credited = 0
    for (const prompt of requiredPrompts) {
      if (completedIds.has(prompt.id)) continue

      const bullets = promptBullets[prompt.id]
      if (!bullets || bullets.length === 0) continue

      // Ensure minimum 3 bullets
      while (bullets.length < 3) {
        bullets.push('Captured from voice onboarding')
      }

      // Create memory response
      const { data: response, error: responseError } = await supabase
        .from('memory_responses')
        .insert([{
          user_id: userId,
          prompt_id: prompt.id,
          bullets,
          is_template: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (responseError) {
        console.error(`[autoCredit] Failed to insert response for ${prompt.prompt_text}:`, responseError)
        continue
      }

      // Mark as completed
      await supabase
        .from('user_prompt_status')
        .upsert({
          user_id: userId,
          prompt_id: prompt.id,
          status: 'completed',
          response_id: response.id,
          completed_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        }, { onConflict: 'user_id,prompt_id' })

      credited++
    }

    // Generate 2-3 follow-up suggestions based on onboarding content
    try {
      const prompt = `Based on this person's onboarding, suggest 2-3 follow-up questions that would deepen the app's understanding of them. These should feel natural and curious, not like a form.

Their themes: ${themes.join(', ')}
Their capabilities: ${capabilities.join(', ')}
Their patterns: ${patterns.join(', ')}
Topics mentioned: ${topics.join(', ')}
People mentioned: ${people.join(', ')}

Generate questions that:
1. Dig into something specific they mentioned
2. Explore an emotional or personal angle
3. Connect two different things they talked about

Return JSON: {"suggestions":[{"promptText":"...","description":"..."}]}
Return 2-3 suggestions. Keep them conversational and specific.`

      const text = await generateText(prompt, {
        maxTokens: 800,
        temperature: 0.7,
        responseFormat: 'json'
      })

      if (text) {
        const parsed = JSON.parse(text)
        for (const suggestion of (parsed.suggestions || []).slice(0, 3)) {
          const { data: newPrompt } = await supabase
            .from('memory_prompts')
            .insert({
              prompt_text: suggestion.promptText,
              prompt_description: suggestion.description || '',
              category: 'ai_suggested',
              is_required: false
            })
            .select()
            .single()

          if (newPrompt) {
            await supabase
              .from('user_prompt_status')
              .insert({
                user_id: userId,
                prompt_id: newPrompt.id,
                status: 'suggested',
                suggested_at: new Date().toISOString()
              })
          }
        }
      }
    } catch (e) {
      console.warn('[autoCredit] Follow-up suggestion generation failed, continuing:', e)
    }

    return res.status(200).json({ success: true, credited })
  } catch (error) {
    console.error('[autoCredit] Error:', error)
    return res.status(500).json({ error: 'Failed to auto-credit prompts' })
  }
}

/**
 * Handle memory prompts request (consolidated from memory-prompts.ts)
 */
async function handlePrompts(req: VercelRequest, res: VercelResponse, supabase: any, userId: string) {
  try {
    // Fetch all prompts
    const { data: prompts, error: promptsError } = await supabase
      .from('memory_prompts')
      .select('*')
      .order('priority_order', { ascending: true })

    if (promptsError) {
      return res.status(500).json({ error: 'Failed to fetch prompts' })
    }

    // If no user, return prompts with pending status
    if (!userId) {
      const required = prompts.filter((p: MemoryPrompt) => p.is_required)
      const optional = prompts.filter((p: MemoryPrompt) => !p.is_required)

      return res.status(200).json({
        required: required.map((p: MemoryPrompt) => ({ ...p, status: 'pending' })),
        suggested: [],
        optional: optional.map((p: MemoryPrompt) => ({ ...p, status: 'pending' })),
        progress: {
          completed_required: 0,
          total_required: required.length,
          completed_total: 0,
          total_prompts: prompts.length,
          completion_percentage: 0,
          has_unlocked_projects: false
        }
      })
    }

    // Fetch user's prompt statuses
    const { data: userStatuses, error: statusError } = await supabase
      .from('user_prompt_status')
      .select(`
        *,
        response:memory_responses(*)
      `)
      .eq('user_id', userId)

    if (statusError) {
      console.error('[handlePrompts] Failed to fetch user prompt status:', statusError)
    }

    // Create status map
    const statusMap = new Map(
      (userStatuses || []).map((s: UserPromptStatus) => [s.prompt_id, s])
    )

    // Enrich prompts with status
    const enrichedPrompts = prompts.map((prompt: MemoryPrompt) => {
      const userStatus = statusMap.get(prompt.id) as any
      return {
        ...prompt,
        status: userStatus?.status || 'pending',
        response: userStatus?.response || undefined
      }
    })

    // Categorize prompts
    const required = enrichedPrompts.filter((p: MemoryPrompt) => p.is_required)
    const optional = enrichedPrompts.filter((p: MemoryPrompt) => !p.is_required && p.status !== 'suggested')
    const suggested = enrichedPrompts.filter((p: MemoryPrompt) => p.status === 'suggested')

    // Calculate progress
    const completedRequired = required.filter((p: MemoryPrompt) => p.status === 'completed').length
    const completedTotal = enrichedPrompts.filter((p: MemoryPrompt) => p.status === 'completed').length
    const totalRequired = required.length
    const completionPercentage = totalRequired > 0
      ? Math.round((completedRequired / totalRequired) * 100)
      : 0

    return res.status(200).json({
      required,
      suggested,
      optional,
      progress: {
        completed_required: completedRequired,
        total_required: totalRequired,
        completed_total: completedTotal,
        total_prompts: prompts.length,
        completion_percentage: completionPercentage,
        has_unlocked_projects: completedRequired >= totalRequired
      }
    })

  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function handleSubmitResponse(req: VercelRequest, res: VercelResponse, supabase: any, userId: string) {
  try {
    const { prompt_id, custom_title, bullets } = req.body

    if (!bullets || !Array.isArray(bullets) || bullets.length === 0) {
      return res.status(400).json({ error: 'Bullets array required' })
    }

    // Create memory response
    const { data: response, error: responseError } = await supabase
      .from('memory_responses')
      .insert([{
        user_id: userId,
        prompt_id: prompt_id || null,
        custom_title: custom_title || null,
        bullets,
        is_template: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (responseError) throw responseError

    // Update user prompt status to completed
    if (prompt_id) {
      const { error: statusError } = await supabase
        .from('user_prompt_status')
        .upsert({
          user_id: userId,
          prompt_id,
          status: 'completed',
          response_id: response.id,
          completed_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,prompt_id'
        })

      if (statusError) {
        console.error('[handleSubmitResponse] Failed to update user prompt status:', statusError)
      }
    }

    // Calculate updated progress
    const { data: prompts } = await supabase
      .from('memory_prompts')
      .select('id, is_required')

    const { data: statuses } = await supabase
      .from('user_prompt_status')
      .select('*')
      .eq('user_id', userId)

    const required = prompts?.filter((p: MemoryPrompt) => p.is_required) || []
    const completedRequired = statuses?.filter((s: UserPromptStatus) =>
      s.status === 'completed' &&
      required.some((p: MemoryPrompt) => p.id === s.prompt_id)
    ).length || 0

    return res.status(200).json({
      success: true,
      response,
      progress: {
        completed_required: completedRequired,
        total_required: required.length,
        completed_total: statuses?.filter((s: UserPromptStatus) => s.status === 'completed').length || 0,
        total_prompts: prompts?.length || 0,
        completion_percentage: required.length > 0
          ? Math.round((completedRequired / required.length) * 100)
          : 0,
        has_unlocked_projects: completedRequired >= required.length
      }
    })

  } catch (error) {
    return res.status(500).json({ error: 'Failed to submit response' })
  }
}

/**
 * Handle "find similar" search - given a memory ID, find semantically similar items
 */
async function handleSimilarSearch(memoryId: string, supabase: any, userId: string, res: VercelResponse) {
  try {
    // Fetch the source memory's embedding
    const { data: source, error: sourceError } = await supabase
      .from('memories')
      .select('id, title, embedding')
      .eq('id', memoryId)
      .single()

    if (sourceError || !source) {
      return res.status(404).json({ error: 'Memory not found' })
    }

    if (!source.embedding) {
      return res.status(200).json({
        source_title: source.title,
        results: [],
        message: 'This memory has no embedding yet. It may still be processing.'
      })
    }

    const embeddingStr = `[${(Array.isArray(source.embedding) ? source.embedding : JSON.parse(source.embedding)).join(',')}]`

    // Vector search using RPC functions
    const [memoriesRpc, projectsRpc, articlesRpc] = await Promise.all([
      supabase.rpc('match_memories', {
        query_embedding: embeddingStr,
        filter_user_id: userId || null,
        match_threshold: 0.4,
        match_count: 20
      }),
      supabase.rpc('match_projects', {
        query_embedding: embeddingStr,
        filter_user_id: userId || null,
        match_threshold: 0.4,
        match_count: 10
      }),
      supabase.rpc('match_reading', {
        query_embedding: embeddingStr,
        filter_user_id: userId || null,
        match_threshold: 0.4,
        match_count: 10
      })
    ])

    const results: SearchResult[] = [
      ...(memoriesRpc.data || [])
        .filter((m: any) => m.id !== source.id)
        .map((m: any) => ({
          type: 'memory' as const,
          id: m.id,
          title: m.title,
          body: m.body,
          score: m.similarity * 100,
          created_at: m.created_at || '',
        })),
      ...(projectsRpc.data || []).map((p: any) => ({
        type: 'project' as const,
        id: p.id,
        title: p.title,
        description: p.description,
        score: p.similarity * 100,
        created_at: p.created_at || '',
      })),
      ...(articlesRpc.data || []).map((a: any) => ({
        type: 'article' as const,
        id: a.id,
        title: a.title || 'Untitled',
        body: a.excerpt,
        url: a.url,
        score: a.similarity * 100,
        created_at: a.created_at || '',
      }))
    ].sort((a, b) => b.score - a.score)

    return res.status(200).json({
      source_title: source.title,
      results,
      total: results.length,
      breakdown: {
        memories: (memoriesRpc.data || []).filter((m: any) => m.id !== source.id).length,
        projects: (projectsRpc.data || []).length,
        articles: (articlesRpc.data || []).length
      }
    })

  } catch (error) {
    console.error('[handleSimilarSearch] Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Universal search handler (merged from search.ts)
 * Searches across memories, projects, and articles
 */
async function handleSearch(query: string, supabase: any, userId: string, res: VercelResponse, context?: string, semantic?: boolean) {
  try {
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter "q" is required' })
    }

    const searchTerm = query.toLowerCase().trim()

    if (searchTerm.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' })
    }

    // Generate embedding if context is provided OR semantic mode is enabled
    let embedding: number[] | undefined
    if (context) {
      try {
        embedding = await generateEmbedding(context)
      } catch (e) {
        console.error('[handleSearch] Failed to generate embedding from context:', e)
      }
    } else if (semantic) {
      try {
        embedding = await generateEmbedding(query)
      } catch (e) {
        console.error('[handleSearch] Failed to generate embedding for semantic search:', e)
      }
    }

    // If semantic mode with embedding, use vector search via RPC functions
    if (semantic && embedding) {
      const embeddingStr = `[${embedding.join(',')}]`

      const [memoriesRpc, projectsRpc, articlesRpc] = await Promise.all([
        supabase.rpc('match_memories', {
          query_embedding: embeddingStr,
          filter_user_id: userId || null,
          match_threshold: 0.3,
          match_count: 20
        }),
        supabase.rpc('match_projects', {
          query_embedding: embeddingStr,
          filter_user_id: userId || null,
          match_threshold: 0.3,
          match_count: 20
        }),
        supabase.rpc('match_reading', {
          query_embedding: embeddingStr,
          filter_user_id: userId || null,
          match_threshold: 0.3,
          match_count: 20
        })
      ])

      const memoriesResults: SearchResult[] = (memoriesRpc.data || []).map((m: any) => ({
        type: 'memory',
        id: m.id,
        title: m.title,
        body: m.body,
        score: m.similarity * 100,
        created_at: m.created_at || '',
      }))

      const projectsResults: SearchResult[] = (projectsRpc.data || []).map((p: any) => ({
        type: 'project',
        id: p.id,
        title: p.title,
        description: p.description,
        score: p.similarity * 100,
        created_at: p.created_at || '',
      }))

      const articlesResults: SearchResult[] = (articlesRpc.data || []).map((a: any) => ({
        type: 'article',
        id: a.id,
        title: a.title || 'Untitled',
        body: a.excerpt,
        url: a.url,
        score: a.similarity * 100,
        created_at: a.created_at || '',
      }))

      const allResults = [...memoriesResults, ...projectsResults, ...articlesResults]
        .sort((a, b) => b.score - a.score)

      return res.status(200).json({
        query: searchTerm,
        semantic: true,
        total: allResults.length,
        results: allResults,
        breakdown: {
          memories: memoriesResults.length,
          projects: projectsResults.length,
          articles: articlesResults.length
        }
      })
    }

    // Fallback: text-based search (with optional embedding boost)
    const [memoriesResults, projectsResults, articlesResults] = await Promise.all([
      searchMemories(searchTerm, supabase, userId, embedding),
      searchProjects(searchTerm, supabase, userId, embedding),
      searchArticles(searchTerm, supabase, userId, embedding)
    ])

    // Combine and sort results by score
    const allResults: SearchResult[] = [
      ...memoriesResults,
      ...projectsResults,
      ...articlesResults
    ].sort((a, b) => b.score - a.score)

    return res.status(200).json({
      query: searchTerm,
      semantic: false,
      total: allResults.length,
      results: allResults,
      breakdown: {
        memories: memoriesResults.length,
        projects: projectsResults.length,
        articles: articlesResults.length
      }
    })

  } catch (error) {
    console.error('[handleSearch] Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

/**
 * Search memories using text search on title and body
 */
async function searchMemories(query: string, supabase: any, userId: string, embedding?: number[]): Promise<SearchResult[]> {
  try {
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .or(`title.ilike.%${query}%,body.ilike.%${query}%`)
      .limit(20)

    if (error) {
      console.error('[searchMemories] Database error:', error)
      return []
    }

    return (data || []).map((memory: Memory) => {
      let score = calculateTextScore(query, memory.title, memory.body)

      // Boost score if vector similarity matches
      if (embedding && memory.embedding) {
        const similarity = cosineSimilarity(embedding, memory.embedding)
        score += similarity * 100 // Add up to 100 points for perfect vector match
      }

      return {
        type: 'memory',
        id: memory.id,
        title: memory.title,
        body: memory.body,
        score,
        created_at: memory.created_at,
        entities: memory.entities,
        tags: memory.tags
      }
    })
  } catch (error) {
    console.error('[searchMemories] Unexpected error:', error)
    return []
  }
}

interface ProjectItem {
  id: string
  title: string
  description: string
  created_at: string
  tags: string[]
  embedding?: number[]
}

/**
 * Search projects using text search on title and description
 */
async function searchProjects(query: string, supabase: any, userId: string, embedding?: number[]): Promise<SearchResult[]> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(20)

    if (error) {
      console.error('[searchProjects] Database error:', error)
      return []
    }

    return (data || []).map((project: ProjectItem) => {
      let score = calculateTextScore(query, project.title, project.description)

      if (embedding && project.embedding) {
        const similarity = cosineSimilarity(embedding, project.embedding)
        score += similarity * 100
      }

      return {
        type: 'project',
        id: project.id,
        title: project.title,
        description: project.description,
        score,
        created_at: project.created_at,
        tags: project.tags
      }
    })
  } catch (error) {
    console.error('[searchProjects] Unexpected error:', error)
    return []
  }
}

interface ArticleItem {
  id: string
  title: string
  excerpt: string
  url: string
  created_at: string
  tags: string[]
  embedding?: number[]
}

/**
 * Search articles using text search on title, excerpt, and content
 */
async function searchArticles(query: string, supabase: any, userId: string, embedding?: number[]): Promise<SearchResult[]> {
  try {
    const { data, error } = await supabase
      .from('reading_queue')
      .select('*')
      .or(`title.ilike.%${query}%,excerpt.ilike.%${query}%`)
      .limit(20)

    if (error) {
      console.error('[searchArticles] Database error:', error)
      return []
    }

    return (data || []).map((article: ArticleItem) => {
      let score = calculateTextScore(query, article.title, article.excerpt)

      if (embedding && article.embedding) {
        const similarity = cosineSimilarity(embedding, article.embedding)
        score += similarity * 100
      }

      return {
        type: 'article',
        id: article.id,
        title: article.title || 'Untitled',
        body: article.excerpt,
        url: article.url,
        score,
        created_at: article.created_at,
        tags: article.tags
      }
    })
  } catch (error) {
    console.error('[searchArticles] Unexpected error:', error)
    return []
  }
}

/**
 * Calculate relevance score based on text matching
 * Higher score = better match
 */
function calculateTextScore(query: string, ...fields: (string | null | undefined)[]): number {
  let score = 0
  const queryLower = query.toLowerCase()

  for (const field of fields) {
    if (!field) continue

    const fieldLower = field.toLowerCase()

    // Exact match in title = highest score
    if (fields[0] && fieldLower === queryLower) {
      score += 100
    }

    // Query appears at start = high score
    if (fieldLower.startsWith(queryLower)) {
      score += 50
    }

    // Query appears as whole word = medium score
    const words = fieldLower.split(/\s+/)
    if (words.includes(queryLower)) {
      score += 30
    }

    // Query appears anywhere = base score
    if (fieldLower.includes(queryLower)) {
      score += 10
    }

    // Count occurrences
    const occurrences = (fieldLower.match(new RegExp(queryLower, 'g')) || []).length
    score += occurrences * 5
  }

  return score
}

/**
 * Handle background processing (merged from process.ts)
 * Processes a memory with AI extraction (entities, themes, embeddings)
 */
async function handleProcess(req: VercelRequest, res: VercelResponse) {
  const { memory_id } = req.body

  if (!memory_id) {
    return res.status(400).json({ error: 'memory_id required' })
  }

  try {
    await processMemory(memory_id)

    return res.status(200).json({
      success: true,
      message: 'Memory processed successfully'
    })
  } catch (error) {
    console.error('[handleProcess] Processing failed:', { memory_id, error })
    return res.status(500).json({
      error: 'Processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Update memory content and metadata
 */
async function handleUpdate(memoryId: string, req: VercelRequest, res: VercelResponse, supabase: any) {
  if (!memoryId) {
    return res.status(400).json({ error: 'Memory ID required' })
  }

  const { title, body, tags, memory_type, image_urls, is_pinned, checklist_items } = req.body

  try {
    // Pin/unpin is a lightweight metadata update — no reprocessing needed
    if (is_pinned !== undefined && title === undefined && body === undefined && checklist_items === undefined) {
      const { data: memory, error } = await supabase
        .from('memories')
        .update({ is_pinned })
        .eq('id', memoryId)
        .select()
        .single()

      if (error) {
        console.error('[handleUpdate] Pin update error:', error)
        return res.status(500).json({ error: 'Failed to update pin state', details: error.message })
      }

      return res.status(200).json({ success: true, memory })
    }

    // Checklist-only update — no reprocessing needed
    if (checklist_items !== undefined && title === undefined && body === undefined) {
      const { data: memory, error } = await supabase
        .from('memories')
        .update({ checklist_items })
        .eq('id', memoryId)
        .select()
        .single()

      if (error) {
        console.error('[handleUpdate] Checklist update error:', error)
        return res.status(500).json({ error: 'Failed to update checklist', details: error.message })
      }

      return res.status(200).json({ success: true, memory })
    }

    const updateData: any = {
      processed: false, // Trigger reprocessing
      processed_at: null
    }

    if (title !== undefined) updateData.title = title
    if (body !== undefined) updateData.body = body
    if (tags !== undefined) updateData.tags = tags
    if (memory_type !== undefined) updateData.memory_type = memory_type
    if (image_urls !== undefined) updateData.image_urls = image_urls
    if (is_pinned !== undefined) updateData.is_pinned = is_pinned
    if (checklist_items !== undefined) updateData.checklist_items = checklist_items

    const { data: memory, error } = await supabase
      .from('memories')
      .update(updateData)
      .eq('id', memoryId)
      .select()
      .single()

    if (error) {
      console.error('[handleUpdate] Database error:', error)
      return res.status(500).json({ error: 'Failed to update memory', details: error.message })
    }

    // Trigger background processing to regenerate embeddings/entities
    // We import dynamically to avoid circular dependencies if any, but static import is available at top
    try {
      // Fire and forget processing
      processMemory(memoryId).catch(err =>
        console.error('[handleUpdate] Background processing failed:', err)
      )
    } catch (e) {
      console.error('[handleUpdate] Failed to trigger processing:', e)
    }

    return res.status(200).json({
      success: true,
      memory
    })
  } catch (error) {
    console.error('[handleUpdate] Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function handleMediaAnalysis(req: VercelRequest, res: VercelResponse) {
  try {
    // Parse multipart form data
    const form = formidable({
      maxFileSize: 25 * 1024 * 1024, // 25MB max
    })

    const { files } = await new Promise<{ files: formidable.Files }>((resolve, reject) => {
      form.parse(req as any, (err, fields, files) => {
        if (err) reject(err)
        else resolve({ files })
      })
    })

    // Check for various file keys (audio, image, file)
    const uploadedFile = files.audio || files.image || files.file
    const rawFile = Array.isArray(uploadedFile) ? uploadedFile[0] : uploadedFile

    if (!rawFile) {
      return res.status(400).json({ error: 'No file provided (expected audio, image, or file)' })
    }

    const file = rawFile as FormidableFile
    const mimeType = file.mimetype || 'application/octet-stream'
    const isImage = mimeType.startsWith('image/')
    // Assume audio for raw blobs if uncertain, unless it's clearly an image
    const isAudio = !isImage

    console.log('[media-analysis] File received:', {
      originalFilename: file.originalFilename,
      mimetype: mimeType,
      size: file.size,
      type: isImage ? 'IMAGE' : 'AUDIO'
    })

    // Read file as base64
    const fileData = fs.readFileSync(file.filepath)
    const base64Data = fileData.toString('base64')

    // Use Gemini 3 Flash
    const model = genAI.getGenerativeModel({ model: MODELS.DEFAULT_CHAT })

    let prompt = ''
    if (isImage) {
      prompt = 'Describe this image in detail for a personal knowledge base. Capture text, key objects, diagram structures, and the overall context. If it is a whiteboard sketch, explain the concepts drawn. Return plain text.'
    } else {
      prompt = 'Listen to this audio recording and transcribe exactly what is said. Return only the transcribed text, with no additional commentary or formatting.'
    }

    console.log('[media-analysis] Sending to Gemini...')

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Data
        }
      },
      prompt
    ])

    const response = await result.response
    const text = response.text().trim()

    console.log('[media-analysis] Gemini response length:', text.length)

    // Clean up temp file
    fs.unlinkSync(file.filepath)

    if (!text) {
      throw new Error('Empty response from Gemini')
    }

    return res.status(200).json({
      success: true,
      text: text,
      type: isImage ? 'image_description' : 'transcription'
    })

  } catch (error) {
    console.error('[handleMediaAnalysis] Error:', error)
    return res.status(500).json({
      error: 'Media analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Voice Seeds — generate 3 contextual thinking prompts before capture.
 * Solves the blank-page problem by surfacing what the knowledge graph already
 * knows is worth thinking about. Fails silently; seeds are an enhancement only.
 *
 * GET /api/memories?seeds=true
 */
async function handleSeeds(
  req: VercelRequest,
  res: VercelResponse,
  supabase: any,
  userId: string
) {
  try {
    const [memoriesResult, articlesResult, projectsResult] = await Promise.all([
      supabase
        .from('memories')
        .select('title, themes, emotional_tone, created_at')
        .eq('user_id', userId)
        .eq('processed', true)
        .order('created_at', { ascending: false })
        .limit(6),
      supabase
        .from('reading_queue')
        .select('title, created_at')
        .eq('user_id', userId)
        .in('status', ['read', 'reading'])
        .order('created_at', { ascending: false })
        .limit(4),
      supabase
        .from('projects')
        .select('title, description, last_active')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('last_active', { ascending: true })
        .limit(5),
    ])

    const memories = memoriesResult.data || []
    const articles = articlesResult.data || []
    const projects = projectsResult.data || []

    if (memories.length < 2 && articles.length < 2) {
      return res.json({ seeds: [] })
    }

    const now = Date.now()
    const context = [
      memories.length > 0 &&
        `RECENT THOUGHTS:\n${memories
          .slice(0, 5)
          .map(
            (m: any) =>
              `- "${m.title}"${m.emotional_tone ? ` [${m.emotional_tone}]` : ''}${
                m.themes?.length ? ` — ${m.themes.slice(0, 2).join(', ')}` : ''
              }`
          )
          .join('\n')}`,
      articles.length > 0 &&
        `RECENTLY READ:\n${articles
          .slice(0, 3)
          .map((a: any) => `- "${a.title}"`)
          .join('\n')}`,
      projects.length > 0 &&
        `ACTIVE PROJECTS (least-touched first):\n${projects
          .map((p: any) => {
            const daysAgo = Math.floor(
              (now - new Date(p.last_active || now).getTime()) / 86_400_000
            )
            const staleness = daysAgo > 7 ? ` [${daysAgo}d untouched]` : ''
            return `- "${p.title}"${staleness}: ${(p.description || '').slice(0, 70)}`
          })
          .join('\n')}`,
    ]
      .filter(Boolean)
      .join('\n\n')

    const prompt = `You are a thinking partner generating short, sharp prompts to make someone think. They use this app to capture thoughts and work on projects.

THEIR RECENT ACTIVITY:
${context}

Generate exactly 3 short, sharp thinking prompts. These should feel like the app noticed something the user hasn't said yet.

RULES:
- Each must reference SPECIFIC titles, themes, or project names from the data above — no generic prompts
- Phrased as questions or provocations (not instructions)
- Max 12 words each — shorter is better
- seed type "bridge": connects two items in their recent activity
- seed type "pressure": presses on something they keep circling
- seed type "neglect": about a project or topic they haven't touched lately

Return ONLY this JSON, no markdown:
{"seeds":[{"id":"s1","text":"...","type":"bridge"},{"id":"s2","text":"...","type":"pressure"},{"id":"s3","text":"...","type":"neglect"}]}`

    const raw = await generateText(prompt, {
      maxTokens: 250,
      temperature: 0.9,
      responseFormat: 'json',
    })

    const parsed = JSON.parse(raw)
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60')
    return res.json(parsed)
  } catch (err) {
    console.error('[handleSeeds] Error:', err)
    return res.json({ seeds: [] })
  }
}
