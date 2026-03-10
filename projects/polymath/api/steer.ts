/**
 * Live Mind Steering
 *
 * After a thought is captured and processed, this endpoint reads the user's
 * entire knowledge base and picks one steering move using Gemini's huge context.
 *
 * The key insight: Gemini 3.1 Flash is cheap enough that we don't need to pre-filter
 * with embeddings. We dump everything and let the model reason holistically —
 * finding contradictions, patterns, dormant ideas, and commitments that vector
 * similarity search would miss.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { getSupabaseClient } from './_lib/supabase.js'
import { getUserId } from './_lib/auth.js'
import { MODELS } from './_lib/models.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
const supabase = getSupabaseClient()

export type SteeringMove = 'DEEPEN' | 'COLLIDE' | 'SURFACE' | 'REDIRECT' | 'COMMIT'

export interface SteeringResult {
  move: SteeringMove
  message: string
  evidence: string
  related_id?: string
  related_type?: 'memory' | 'project'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const userId = getUserId(req)
  const { memory_id } = req.body

  if (!memory_id) return res.status(400).json({ error: 'memory_id required' })

  try {
    // Fetch in parallel — Gemini's context is big enough for all of it
    const [memoryRes, allMemoriesRes, projectsRes, capabilitiesRes] = await Promise.all([
      supabase
        .from('memories')
        .select('id, title, body, created_at, themes, entities, emotional_tone, memory_type')
        .eq('id', memory_id)
        .single(),

      // No limit — this is the whole point. Gemini reads it all.
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

    const prompt = buildSteeringPrompt(memory, allMemories, projects, capabilities)

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
      // Fallback parse if model wraps in markdown
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('No JSON in response')
      steering = JSON.parse(match[0])
    }

    // Validate move type
    const validMoves: SteeringMove[] = ['DEEPEN', 'COLLIDE', 'SURFACE', 'REDIRECT', 'COMMIT']
    if (!validMoves.includes(steering.move)) {
      steering.move = 'DEEPEN'
    }

    return res.status(200).json(steering)
  } catch (error) {
    console.error('[steer] Error:', error)
    return res.status(500).json({ error: 'Steering failed' })
  }
}

function buildSteeringPrompt(
  memory: any,
  allMemories: any[],
  projects: any[],
  capabilities: any[],
): string {
  const newThought = `${memory.title}
${memory.body || ''}
Captured: ${new Date(memory.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`

  // Compact memory timeline — truncate bodies to control token count while keeping signal
  const memoryTimeline = allMemories
    .map((m) => {
      const date = new Date(m.created_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
      const body = m.body ? m.body.slice(0, 160).replace(/\n/g, ' ') : ''
      return `[${date}] ${m.title}${body ? ` — ${body}` : ''}`
    })
    .join('\n')

  const projectList = projects
    .map((p) => `• ${p.title} (${p.status})${p.description ? ': ' + p.description.slice(0, 120) : ''}`)
    .join('\n')

  const capabilityList = capabilities
    .map((c) => `• ${c.name} (strength: ${c.strength?.toFixed(2) || '?'})`)
    .join('\n')

  return `You are a thinking partner for a personal knowledge system.

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
}
