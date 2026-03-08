/**
 * Multi-Perspective Next-Step Suggestions
 *
 * Spawns 5 parallel Gemini Flash Lite calls, each from a different "advisor" persona.
 * Cost per session: ~$0.000056 (essentially free).
 *
 * POST /api/suggestions/multi-perspective
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { getUserId } from './_lib/auth.js'

// Use the same model as the rest of the app — already proven to work
// gemini-2.0-flash-lite is $0.075/1M input, $0.30/1M output; 1M context window
import { MODELS } from './_lib/models.js'
const MODEL_ID = MODELS.DEFAULT_CHAT

if (!process.env.GEMINI_API_KEY) {
  console.error('[MultiPerspective] GEMINI_API_KEY is not set')
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy-key')

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
    systemPrompt: `You are The Executioner — a brutally practical momentum coach. Your job is to identify the ONE concrete action this person can complete in the next 30 minutes to keep their project moving. You care about speed, shipping, and avoiding overthinking. You're direct, energetic, and push for immediate action. Never suggest things that take longer than 30 minutes. Focus on execution, not planning.`
  },
  {
    id: 'strategist',
    persona: 'The Strategist',
    icon: '🧭',
    accentColor: 'blue',
    systemPrompt: `You are The Strategist — a high-level advisor who thinks in terms of leverage and long-term goals. Your job is to identify the highest-leverage action given what the person wants to achieve. You zoom out, consider the end goal, and ask "does this move the needle?". You cut through busy work and find the most important thing. You think like a McKinsey consultant.`
  },
  {
    id: 'devil',
    persona: "The Devil's Advocate",
    icon: '😈',
    accentColor: 'orange',
    systemPrompt: `You are The Devil's Advocate — a fearless truth-teller who identifies what's being avoided. Your job is to name the uncomfortable truth: what is the biggest risk, blocker, or thing being procrastinated? You ask hard questions. You don't sugarcoat. You care about exposing hidden problems before they become crises. Be direct but constructive.`
  },
  {
    id: 'creative',
    persona: 'The Creative',
    icon: '🎨',
    accentColor: 'pink',
    systemPrompt: `You are The Creative — an unconventional thinker who sees lateral possibilities. Your job is to suggest an approach that hasn't been considered: a reframe, an analogy from another domain, a shortcut, or a totally different angle. You delight in unexpected solutions. You're not random — your suggestions should be genuinely useful, just non-obvious. Think like a designer or artist would approach the problem.`
  },
  {
    id: 'user',
    persona: 'The User',
    icon: '👤',
    accentColor: 'emerald',
    systemPrompt: `You are The User — a human-centered empathy advocate. Your job is to represent the end user or stakeholder's perspective. What does the person this project is for actually need right now? What outcome matters to them? You cut through technical details and ask: "Is this actually solving the right problem?". Think like a UX researcher or customer success manager.`
  }
]

function buildProjectPrompt(
  persona: PersonaConfig,
  context: {
    projectTitle: string
    projectDescription: string
    recentActivity: string[]
    openTodos: string[]
    relatedMemories: string[]
  }
): string {
  const { projectTitle, projectDescription, recentActivity, openTodos, relatedMemories } = context

  return `${persona.systemPrompt}

---

PROJECT: ${projectTitle}
DESCRIPTION: ${projectDescription || 'No description provided'}

RECENT COMPLETED ACTIVITY:
${recentActivity.length > 0 ? recentActivity.map(a => `- ${a}`).join('\n') : '- No recent activity'}

CURRENT OPEN TODOS:
${openTodos.length > 0 ? openTodos.map(t => `- ${t}`).join('\n') : '- No open todos'}

RELATED THOUGHTS/MEMORIES:
${relatedMemories.length > 0 ? relatedMemories.map(m => `- ${m}`).join('\n') : '- No related memories'}

---

As ${persona.persona}, give ONE specific next-step suggestion for this project.

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
      maxOutputTokens: 256,
      temperature: 0.8,
      responseMimeType: 'application/json'
    }
  })

  const text = result.response.text()
  let parsed: { suggestion: string; confidence: 'high' | 'medium' }

  try {
    parsed = JSON.parse(text)
  } catch {
    // Fallback if JSON parse fails
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
  // Find perspectives with high confidence
  const highConf = perspectives.filter(p => p.confidence === 'high')
  const featured = highConf.length >= 2 ? highConf.slice(0, 2) : perspectives.slice(0, 2)

  if (featured.length === 2) {
    return `${featured[0].persona} and ${featured[1].persona} point in the same direction — take action now.`
  }
  if (featured.length === 1) {
    return `${featured[0].persona} has the highest-confidence suggestion for your next move.`
  }
  return 'Your council of advisors has weighed in — pick the perspective that resonates most.'
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

  const context = {
    projectTitle: String(projectTitle),
    projectDescription: String(projectDescription || ''),
    recentActivity: Array.isArray(recentActivity) ? recentActivity.slice(0, 5) : [],
    openTodos: Array.isArray(openTodos) ? openTodos.slice(0, 10) : [],
    relatedMemories: Array.isArray(relatedMemories) ? relatedMemories.slice(0, 5) : []
  }

  console.log(`[MultiPerspective] Generating 5 perspectives for project: ${projectTitle}`)
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
      elapsed
    })
  } catch (error: any) {
    console.error('[MultiPerspective] Fatal error:', error)
    return res.status(500).json({
      error: 'Failed to generate multi-perspective suggestions',
      details: error?.message
    })
  }
}
