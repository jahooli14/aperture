/**
 * Multi-Perspective Next-Step Suggestions
 *
 * Spawns 5 parallel Gemini Flash Lite calls, each from a different "advisor" persona.
 * Each call is enriched with full knowledge-lake context: semantically similar memories,
 * articles from reading queue, related projects, and tracked capabilities.
 *
 * POST /api/suggestions/multi-perspective
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import { getUserId } from './_lib/auth.js'
import { cosineSimilarity } from './_lib/gemini-embeddings.js'

import { MODELS } from './_lib/models.js'
const MODEL_ID = MODELS.DEFAULT_CHAT

if (!process.env.GEMINI_API_KEY) {
  console.error('[MultiPerspective] GEMINI_API_KEY is not set')
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy-key')

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface PersonaConfig {
  id: string
  persona: string
  icon: string
  accentColor: string
  systemPrompt: string
}

const PERSONAS: PersonaConfig[] = [
  {
    id: 'executioner',
    persona: 'The Executioner',
    icon: '⚔️',
    accentColor: 'red',
    systemPrompt: `You are The Executioner — a brutal momentum coach who hates overthinking. Your one job: name the single action this person can complete in the next 30 minutes. Not a plan. Not a direction. An action with a concrete output.

Rules: Never suggest anything that takes >30 minutes. Never say "consider" or "think about". Only verbs: build, write, send, record, test, ship.

When knowledge lake context is provided, scan for the most immediately actionable thread — a specific note they wrote that's sitting unused, an article insight that maps directly to an open todo, a related project that solved a similar problem. Name it explicitly.`
  },
  {
    id: 'strategist',
    persona: 'The Strategist',
    icon: '🧭',
    accentColor: 'blue',
    systemPrompt: `You are The Strategist — a contrarian advisor who thinks in 10x leverage. Your job is to name what's being optimized for the wrong metric.

Zoom out. What's the end state? Does the current work path lead there? Scan the knowledge lake for recurring themes across notes, articles, and adjacent projects. If you see a pattern — the same idea appearing in 3 different places — that's signal. Name it. Tell them what the real bet is, not the current bet.

Be specific about what to stop doing as well as what to do.`
  },
  {
    id: 'devil',
    persona: "The Devil's Advocate",
    icon: '😈',
    accentColor: 'orange',
    systemPrompt: `You are The Devil's Advocate — you name the thing everyone in the room is avoiding. Your job is to identify the biggest risk, blocker, or self-deception in this project.

Interrogate the knowledge lake aggressively: Are there notes they wrote but never acted on? Articles they read but haven't applied? Related projects that stalled — and why? Find the avoidance pattern. Name it directly. Then give one specific thing they could do to confront it rather than keep circling it.

Be uncomfortable. Be constructive. Don't soften it.`
  },
  {
    id: 'creative',
    persona: 'The Creative',
    icon: '🎨',
    accentColor: 'pink',
    systemPrompt: `You are The Creative — a lateral thinker who finds solutions in the wrong section of the library. Your job is to propose the approach nobody's considered yet.

Mine the knowledge lake for cross-domain collision: an article from a totally different field, a memory from a different context, a project with an analogous challenge. Find where the metaphor lives. Propose a reframe, an analogy, or a shortcut that only becomes visible when you look sideways.

Be specific about which item from the corpus sparked the idea. One vivid, non-obvious suggestion. Make it feel like a revelation.`
  },
  {
    id: 'user',
    persona: 'The User',
    icon: '👤',
    accentColor: 'emerald',
    systemPrompt: `You are The User — the voice of the actual human this project serves. Your job is to cut through the builder's perspective and ask: "But what does this actually DO for someone?"

Scan the knowledge lake for notes or articles that mention real user needs, friction points, or outcomes. Find evidence that the current direction serves users — or doesn't. Ask the question the builder most needs to hear right now. Then name one thing that would make the output more obviously valuable to the person it's for.

Be empathetic but demanding. Comfort is not your job.`
  }
]

interface KnowledgeLakeContext {
  relatedMemories: Array<{ text: string; score: number; themes: string[] }>
  relatedArticles: Array<{ title: string; excerpt: string; score: number }>
  relatedProjects: Array<{ title: string; description: string; score: number }>
  capabilities: string[]
  topThemes: string[]
}

async function fetchKnowledgeLakeContext(
  projectId: string,
  userId: string
): Promise<KnowledgeLakeContext | null> {
  // Fetch project with its embedding
  const { data: project } = await supabase
    .from('projects')
    .select('id, title, embedding')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  if (!project?.embedding) {
    console.log('[MultiPerspective] No embedding for project, skipping knowledge lake fetch')
    return null
  }

  const embedding = project.embedding as number[]

  // Parallel search across the entire corpus
  const [memoriesRes, articlesRes, projectsRes, capabilitiesRes] = await Promise.all([
    supabase
      .from('memories')
      .select('id, title, body, themes, embedding')
      .eq('user_id', userId)
      .not('embedding', 'is', null)
      .limit(100),
    supabase
      .from('reading_queue')
      .select('id, title, excerpt, embedding')
      .eq('user_id', userId)
      .not('embedding', 'is', null)
      .limit(60),
    supabase
      .from('projects')
      .select('id, title, description, embedding')
      .eq('user_id', userId)
      .neq('id', projectId)
      .not('embedding', 'is', null)
      .limit(60),
    supabase
      .from('capabilities')
      .select('name, description')
      .eq('user_id', userId)
      .limit(20)
  ])

  // Score and rank memories
  const scoredMemories = (memoriesRes.data || [])
    .map(m => ({
      text: (m.title || m.body || '').slice(0, 120),
      score: cosineSimilarity(embedding, m.embedding as number[]),
      themes: (m.themes || []) as string[]
    }))
    .filter(m => m.score > 0.42)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)

  // Score and rank articles
  const scoredArticles = (articlesRes.data || [])
    .map(a => ({
      title: a.title || 'Untitled',
      excerpt: (a.excerpt || '').slice(0, 120),
      score: cosineSimilarity(embedding, a.embedding as number[])
    }))
    .filter(a => a.score > 0.42)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  // Score and rank related projects
  const scoredProjects = (projectsRes.data || [])
    .map(p => ({
      title: p.title || 'Untitled',
      description: (p.description || '').slice(0, 120),
      score: cosineSimilarity(embedding, p.embedding as number[])
    }))
    .filter(p => p.score > 0.42)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)

  // Collect and rank themes across related memories
  const allThemes = scoredMemories.flatMap(m => m.themes)
  const themeCounts = allThemes.reduce((acc, t) => {
    acc[t] = (acc[t] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  const topThemes = Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([t]) => t)

  return {
    relatedMemories: scoredMemories,
    relatedArticles: scoredArticles,
    relatedProjects: scoredProjects,
    capabilities: (capabilitiesRes.data || []).map(c => c.name).filter(Boolean),
    topThemes
  }
}

function buildProjectPrompt(
  persona: PersonaConfig,
  context: {
    projectTitle: string
    projectDescription: string
    recentActivity: string[]
    openTodos: string[]
    relatedMemories: string[]
    knowledgeLake: KnowledgeLakeContext | null
  }
): string {
  const { projectTitle, projectDescription, recentActivity, openTodos, relatedMemories, knowledgeLake } = context

  let knowledgeLakeSection = ''
  if (knowledgeLake) {
    const { relatedMemories: lakeMems, relatedArticles, relatedProjects, capabilities, topThemes } = knowledgeLake

    const memLines = lakeMems.length > 0
      ? lakeMems.map(m => `  - "${m.text}"${m.themes.length > 0 ? ` [${m.themes.slice(0, 3).join(', ')}]` : ''} (${Math.round(m.score * 100)}% match)`).join('\n')
      : '  (none found)'

    const articleLines = relatedArticles.length > 0
      ? relatedArticles.map(a => `  - "${a.title}"${a.excerpt ? `: ${a.excerpt}` : ''} (${Math.round(a.score * 100)}% match)`).join('\n')
      : '  (none found)'

    const projectLines = relatedProjects.length > 0
      ? relatedProjects.map(p => `  - "${p.title}"${p.description ? `: ${p.description}` : ''} (${Math.round(p.score * 100)}% match)`).join('\n')
      : '  (none found)'

    knowledgeLakeSection = `
KNOWLEDGE LAKE CONTEXT (from the user's full corpus):

Related notes & memories (${lakeMems.length} semantic matches):
${memLines}

Articles they've been reading (${relatedArticles.length} semantic matches):
${articleLines}

Related projects in their portfolio (${relatedProjects.length} matches):
${projectLines}

${capabilities.length > 0 ? `Tracked capabilities: ${capabilities.slice(0, 10).join(', ')}` : ''}
${topThemes.length > 0 ? `Recurring themes across their knowledge base: ${topThemes.join(', ')}` : ''}
`
  }

  const legacyMemories = relatedMemories.length > 0
    ? relatedMemories.map(m => `- ${m}`).join('\n')
    : ''

  return `${persona.systemPrompt}

---

PROJECT: ${projectTitle}
DESCRIPTION: ${projectDescription || 'No description provided'}

RECENT COMPLETED ACTIVITY:
${recentActivity.length > 0 ? recentActivity.map(a => `- ${a}`).join('\n') : '- No recent activity'}

CURRENT OPEN TODOS:
${openTodos.length > 0 ? openTodos.map(t => `- ${t}`).join('\n') : '- No open todos'}

${legacyMemories ? `ADDITIONAL CONTEXT:\n${legacyMemories}\n` : ''}${knowledgeLakeSection}
---

As ${persona.persona}, give ONE specific next-step suggestion for this project.
${knowledgeLake ? 'You MUST draw from the knowledge lake above. Reference at least one specific note, article, or project by name. Generic advice is failure.' : ''}

Respond with a JSON object in this exact format:
{
  "suggestion": "Your specific, actionable suggestion (2-3 sentences max). If you referenced knowledge lake items, name them directly in the suggestion.",
  "confidence": "high" or "medium",
  "sourcesCited": ["Title of memory or article you drew from", "..."]
}

"sourcesCited" should be an array of 0-3 titles from the knowledge lake context that most informed your suggestion. Empty array if no lake context available. Be specific to THIS project. Generic advice is failure.`
}

interface PerspectiveResult {
  persona: string
  icon: string
  accentColor: string
  suggestion: string
  confidence: 'high' | 'medium'
  sourcesCited: string[]
}

async function callPersona(
  persona: PersonaConfig,
  context: {
    projectTitle: string
    projectDescription: string
    recentActivity: string[]
    openTodos: string[]
    relatedMemories: string[]
    knowledgeLake: KnowledgeLakeContext | null
  }
): Promise<PerspectiveResult> {
  const model = genAI.getGenerativeModel({
    model: MODEL_ID,
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ]
  })

  const prompt = buildProjectPrompt(persona, context)

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 300,
      temperature: 0.85,
      responseMimeType: 'application/json'
    }
  })

  const text = result.response.text()
  let parsed: { suggestion: string; confidence: 'high' | 'medium'; sourcesCited?: string[] }

  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = {
      suggestion: text.trim().slice(0, 300),
      confidence: 'medium',
      sourcesCited: []
    }
  }

  return {
    persona: persona.persona,
    icon: persona.icon,
    accentColor: persona.accentColor,
    suggestion: parsed.suggestion || 'No suggestion generated',
    confidence: parsed.confidence === 'high' ? 'high' : 'medium',
    sourcesCited: Array.isArray(parsed.sourcesCited) ? parsed.sourcesCited.slice(0, 3) : []
  }
}

function synthesizePerspectives(perspectives: PerspectiveResult[]): string {
  const highConf = perspectives.filter(p => p.confidence === 'high')

  // Find if multiple personas cited overlapping sources
  const allCited = perspectives.flatMap(p => p.sourcesCited)
  const citeCounts = allCited.reduce((acc, s) => { acc[s] = (acc[s] || 0) + 1; return acc }, {} as Record<string, number>)
  const convergentSource = Object.entries(citeCounts).sort((a, b) => b[1] - a[1])[0]

  if (convergentSource && convergentSource[1] >= 2) {
    return `Multiple advisors independently surfaced "${convergentSource[0]}" — that's a signal. Whatever you do next, it runs through that.`
  }

  if (highConf.length >= 3) {
    const names = highConf.slice(0, 3).map(p => p.persona.replace('The ', ''))
    return `${names[0]}, ${names[1]}, and ${names[2]} all converge — rare council alignment. This is the move.`
  }

  if (highConf.length === 2) {
    const tension = perspectives.find(p => p.confidence === 'medium' && p.persona !== highConf[0].persona && p.persona !== highConf[1].persona)
    const tensionNote = tension ? ` Watch ${tension.persona}'s caution.` : ''
    return `${highConf[0].persona} and ${highConf[1].persona} agree — strong signal.${tensionNote}`
  }

  if (highConf.length === 1) {
    return `${highConf[0].persona} has the sharpest read here. The others hedge — trust the one who doesn't.`
  }

  // Count how many sources total were cited
  const totalSources = new Set(allCited).size
  if (totalSources > 0) {
    return `The council pulled from ${totalSources} items in your knowledge lake. No clear consensus — but the sources they surfaced are worth reviewing.`
  }

  return 'The council sees multiple valid paths. This is a judgment call — pick the perspective that matches where your energy actually is today.'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const userId = getUserId(req)
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'dummy-key') {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' })
  }

  const {
    projectId,
    projectTitle,
    projectDescription,
    recentActivity = [],
    openTodos = [],
    relatedMemories = []
  } = req.body

  if (!projectId || !projectTitle) {
    return res.status(400).json({ error: 'projectId and projectTitle are required' })
  }

  // Fetch full knowledge lake context in parallel with council assembly
  const [knowledgeLake] = await Promise.all([
    fetchKnowledgeLakeContext(String(projectId), String(userId)).catch(err => {
      console.error('[MultiPerspective] Knowledge lake fetch failed, continuing without it:', err)
      return null
    })
  ])

  const context = {
    projectTitle: String(projectTitle),
    projectDescription: String(projectDescription || ''),
    recentActivity: Array.isArray(recentActivity) ? recentActivity.slice(0, 5) : [],
    openTodos: Array.isArray(openTodos) ? openTodos.slice(0, 10) : [],
    relatedMemories: Array.isArray(relatedMemories) ? relatedMemories.slice(0, 5) : [],
    knowledgeLake
  }

  console.log(`[MultiPerspective] Assembling council for: ${projectTitle} | lake: ${knowledgeLake ? `${knowledgeLake.relatedMemories.length} mems, ${knowledgeLake.relatedArticles.length} articles, ${knowledgeLake.relatedProjects.length} projects` : 'none'}`)
  const startTime = Date.now()

  try {
    // Spawn all 5 persona calls in parallel
    const results = await Promise.allSettled(
      PERSONAS.map(persona => callPersona(persona, context))
    )

    const perspectives: PerspectiveResult[] = results.map((result, i) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        console.error(`[MultiPerspective] Persona ${PERSONAS[i].id} failed:`, result.reason)
        return {
          persona: PERSONAS[i].persona,
          icon: PERSONAS[i].icon,
          accentColor: PERSONAS[i].accentColor,
          suggestion: 'Unable to generate suggestion at this time.',
          confidence: 'medium' as const,
          sourcesCited: []
        }
      }
    })

    const synthesized = synthesizePerspectives(perspectives)
    const elapsed = Date.now() - startTime

    console.log(`[MultiPerspective] Generated ${perspectives.length} perspectives in ${elapsed}ms`)

    return res.status(200).json({
      perspectives,
      synthesized,
      generatedAt: Date.now(),
      elapsed,
      lakeContext: knowledgeLake ? {
        memoriesUsed: knowledgeLake.relatedMemories.length,
        articlesUsed: knowledgeLake.relatedArticles.length,
        projectsUsed: knowledgeLake.relatedProjects.length
      } : null
    })
  } catch (error: any) {
    console.error('[MultiPerspective] Fatal error:', error)
    return res.status(500).json({
      error: 'Failed to generate multi-perspective suggestions',
      details: error?.message
    })
  }
}
