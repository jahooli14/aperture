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
    systemPrompt: `You are The Executioner — a brutally practical momentum coach. Your job is to identify the ONE concrete action this person can complete in the next 30 minutes to keep their project moving. You care about speed, shipping, and avoiding overthinking. You're direct, energetic, and push for immediate action. Never suggest things that take longer than 30 minutes. Focus on execution, not planning. When knowledge lake context is provided, look for the most immediately actionable thread — a specific note they wrote, an article insight they can apply right now.`
  },
  {
    id: 'strategist',
    persona: 'The Strategist',
    icon: '🧭',
    accentColor: 'blue',
    systemPrompt: `You are The Strategist — a high-level advisor who thinks in terms of leverage and long-term goals. Your job is to identify the highest-leverage action given what the person wants to achieve. Zoom out, consider the end goal, ask "does this move the needle?". Cut through busy work. When you see patterns across their knowledge lake — recurring themes in their notes, related reading, adjacent projects — use those to identify what the real strategic bet is. Think like a McKinsey consultant who has read their entire notebook.`
  },
  {
    id: 'devil',
    persona: "The Devil's Advocate",
    icon: '😈',
    accentColor: 'orange',
    systemPrompt: `You are The Devil's Advocate — a fearless truth-teller who identifies what's being avoided. Name the uncomfortable truth: the biggest risk, blocker, or thing being procrastinated. Look at their knowledge lake for evidence of avoidance patterns — are there related notes they wrote but never acted on? Articles they read but haven't applied? Adjacent projects that stalled for similar reasons? Call it out. Be direct but constructive.`
  },
  {
    id: 'creative',
    persona: 'The Creative',
    icon: '🎨',
    accentColor: 'pink',
    systemPrompt: `You are The Creative — an unconventional thinker who sees lateral possibilities. Suggest an approach that hasn't been considered: a reframe, an analogy from another domain, a shortcut, a totally different angle. Mine the knowledge lake for cross-domain inspiration — an article from a different field, a memory from a different context, a recurring theme that suggests a metaphor. Your suggestions should be genuinely useful, just non-obvious. Think like a designer or artist who has absorbed everything they've ever read.`
  },
  {
    id: 'user',
    persona: 'The User',
    icon: '👤',
    accentColor: 'emerald',
    systemPrompt: `You are The User — a human-centered empathy advocate representing the end user or stakeholder's perspective. What does the person this project is for actually need right now? What outcome matters to them? When reviewing knowledge lake context, look for notes or articles that mention user needs, frustrations, or outcomes. Cut through technical details and ask: "Is this actually solving the right problem?" Think like a UX researcher who has read their field notes.`
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
${knowledgeLake ? 'You have access to the user\'s full knowledge lake above — use it. Reference specific notes, articles, or related projects where relevant to make your suggestion feel tailored, not generic.' : ''}

Respond with a JSON object in this exact format:
{
  "suggestion": "Your specific, actionable suggestion here (2-3 sentences max)",
  "confidence": "high" or "medium"
}

Be specific to THIS project. Do not give generic advice. Your suggestion should feel tailored and insightful.`
}

interface PerspectiveResult {
  persona: string
  icon: string
  accentColor: string
  suggestion: string
  confidence: 'high' | 'medium'
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
  let parsed: { suggestion: string; confidence: 'high' | 'medium' }

  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = {
      suggestion: text.trim().slice(0, 300),
      confidence: 'medium'
    }
  }

  return {
    persona: persona.persona,
    icon: persona.icon,
    accentColor: persona.accentColor,
    suggestion: parsed.suggestion || 'No suggestion generated',
    confidence: parsed.confidence === 'high' ? 'high' : 'medium'
  }
}

function synthesizePerspectives(perspectives: PerspectiveResult[]): string {
  const highConf = perspectives.filter(p => p.confidence === 'high')

  if (highConf.length >= 3) {
    const names = highConf.slice(0, 3).map(p => p.persona)
    return `${names[0]}, ${names[1]}, and ${names[2]} all converge — this is a clear signal. Act now.`
  }

  if (highConf.length === 2) {
    return `${highConf[0].persona} and ${highConf[1].persona} point in the same direction — take action now.`
  }

  if (highConf.length === 1) {
    return `${highConf[0].persona} has the highest-confidence read on this. Their perspective cuts to the core.`
  }

  // All medium — look for thematic convergence in suggestions
  return 'The council sees multiple valid paths. Pick the perspective that resonates most with where you are today.'
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
          confidence: 'medium' as const
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
