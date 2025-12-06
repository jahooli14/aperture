/**
 * Bedtime Idea Suggester
 * Bridges collected material (reading, thoughts) → creative projects
 * Leverages hypnagogic state to synthesize inputs into actionable outputs
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { getSupabaseClient } from './supabase.js'

const supabase = getSupabaseClient()
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export interface MorningBriefing {
  greeting: string
  focus_project: { id: string, title: string, next_step: string, unblocker?: string } | null
  quick_win: { id: string, title: string } | null
  forgotten_gem: { type: 'article'|'thought', title: string, snippet: string, relevance: string } | null
}

export interface BedtimePrompt {
  prompt: string
  type: 'connection' | 'divergent' | 'revisit' | 'transform'
  relatedIds: string[] // Memory/project/article IDs that inspired this
  metaphor?: string // Optional poetic framing for enhanced contemplation
  format?: 'question' | 'statement' | 'visualization' | 'scenario' | 'incubation' // Prompt variety
}

export async function generateBreakPrompts(userId: string): Promise<BedtimePrompt[]> {
  console.log(`[Bedtime] Generating break prompts for user ${userId}`)
  
  const activeProjects = await getActiveProjects(userId)
  const capabilities = await getCapabilities(userId)

  const topCapabilities = capabilities.slice(0, 5).map((c: any) => `${c.name}`).join(', ')
  const projectContext = activeProjects.slice(0, 3).map((p: any) => `"${p.title}"`).join(', ')

  const prompt = `You are an Oblique Strategist. The user is taking a short break from work.
  They need a "Logic Breaker" to reset their context.
  
  **USER CONTEXT:**
  - Active Projects: ${projectContext || 'None'}
  - Capabilities: ${topCapabilities || 'General Creator'}
  
  **STRATEGY:**
  Generate 1-2 prompts using these techniques:
  1. **Oblique Strategy**: Use randomness or paradox. "Honor thy error as a hidden intention."
  2. **Inversion**: "What if you did the opposite?"
  3. **Scale Shift**: "View this from 10,000 feet."
  
  Return JSON array:
  [
    {
      "prompt": "...",
      "type": "transform",
      "metaphor": "..."
    }
  ]`

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const jsonMatch = text.match(/[\[][\s\S]*[\]]/)
    const prompts = jsonMatch ? JSON.parse(jsonMatch[0]) : []
    
    return prompts.map((p: any) => ({
      ...p,
      relatedIds: [],
      format: 'statement'
    }))
  } catch (e) {
    console.error('Failed to generate break prompts', e)
    return [{
      prompt: "Look closely at the most embarrassing detail and amplify it.",
      type: "transform",
      relatedIds: []
    }]
  }
}

/**
 * Generate Catalyst prompts from 2-3 specific inputs
 */
export async function generateCatalystPrompts(
  inputs: Array<{ title: string; type: 'project' | 'article' | 'thought'; id: string }>, 
  userId: string
): Promise<BedtimePrompt[]> {
  console.log(`[Bedtime] Generating catalyst prompts for user ${userId} with ${inputs.length} inputs`)
  return generateCatalystPromptsWithAI(inputs, userId)
}

export async function generateBedtimePrompts(userId: string): Promise<BedtimePrompt[]> {
  console.log(`[Bedtime] Generating bedtime prompts for user ${userId}`)

  // 1. Gather the full spectrum: Input → Processing → Output
  const recentArticles = await getRecentArticles(userId, 14) // Last 2 weeks of reading
  const recentMemories = await getRecentMemories(userId, 7) // Last week of thoughts
  const activeProjects = await getActiveProjects(userId) // Current outputs
  const currentInterests = await getCurrentInterests(userId)
  const oldInsights = await getOldInsights(userId, 90) // 14-90 days old
  const capabilities = await getCapabilities(userId) // Capabilities for synesthetic metaphors

  // 2. Get past prompt performance for personalization
  const performance = await getPromptPerformance(userId)

  // 3. Analyze gaps
  const hasRichInput = recentArticles.length > 0 || recentMemories.length > 5
  const hasBlockedProjects = activeProjects.some(p => p.status === 'active' && !p.last_active)
  const hasNoProjects = activeProjects.length === 0

  // 4. Generate prompts optimized for input → output synthesis
  const prompts = await generatePromptsWithAI(
    recentArticles,
    recentMemories,
    activeProjects,
    currentInterests,
    oldInsights,
    capabilities,
    { hasRichInput, hasBlockedProjects, hasNoProjects },
    performance
  )

  // 5. Store prompts for later viewing
  await storePrompts(userId, prompts)

  return prompts
}

async function getCapabilities(userId: string) {
  const { data } = await supabase
    .from('capabilities')
    .select('name, description, strength')
    .eq('user_id', userId)
    .order('strength', { ascending: false })
    .limit(10)
  return data || []
}

async function getRecentArticles(userId: string, days: number) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const { data } = await supabase
    .from('reading_queue')
    .select('id, title, summary, url, tags, completed_at, created_at')
    .eq('user_id', userId)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false })
    .limit(15)

  return data || []
}

async function getRecentMemories(userId: string, days: number) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const { data: recentData } = await supabase
    .from('memories')
    .select('id, title, body, entities, themes, tags, created_at, embedding')
    .eq('user_id', userId)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false })
    .limit(10)

  if (!recentData || recentData.length === 0) return []

  // Extract common themes from recent memories
  const allThemes = recentData
    .flatMap(m => m.themes || [])
    .filter(Boolean)

  const themeCounts = allThemes.reduce((acc: Record<string, number>, theme: string) => {
    acc[theme] = (acc[theme] || 0) + 1
    return acc
  }, {})

  const consequentialThemes = Object.entries(themeCounts)
    .filter(([_, count]) => (count as number) >= 2)
    .map(([theme]) => theme)

  // If we have consequential themes, find related memories via vector search
  if (consequentialThemes.length > 0 && recentData[0].embedding) {
    const { data: relatedData } = await supabase.rpc('match_memories', {
      query_embedding: recentData[0].embedding,
      match_threshold: 0.7,
      match_count: 5,
      filter_user_id: userId
    })

    if (relatedData) {
      const allMemories = [...recentData, ...relatedData]
      const unique = Array.from(
        new Map(allMemories.map(m => [m.id, m])).values()
      )
      return unique.slice(0, 15)
    }
  }

  return recentData
}

async function getActiveProjects(userId: string) {
  const { data } = await supabase
    .from('projects')
    .select('id, title, description, status, type, metadata, last_active')
    .eq('user_id', userId)
    .in('status', ['active', 'dormant', 'upcoming', 'completed'])
    .order('last_active', { ascending: false })
    .limit(10)

  return data || []
}

async function getCurrentInterests(userId: string) {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data } = await supabase
    .from('entities')
    .select('name, type, memory_id')
    .eq('type', 'topic')
    .gte('created_at', thirtyDaysAgo.toISOString())

  if (!data) return []

  const counts = data.reduce((acc: Record<string, number>, e: any) => {
    acc[e.name] = (acc[e.name] || 0) + 1
    return acc
  }, {})

  return Object.entries(counts)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([name, count]) => ({ name, mentions: count }))
}

async function getOldInsights(userId: string, daysAgo: number) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysAgo) // 90 days ago
  const recent = new Date()
  recent.setDate(recent.getDate() - 14) // 14 days ago

  const { data } = await supabase
    .from('memories')
    .select('id, title, body, themes')
    .eq('user_id', userId)
    .eq('memory_type', 'insight')
    .lte('created_at', recent.toISOString()) // Older than 14 days
    .gte('created_at', cutoff.toISOString()) // But within 90 days
    .order('created_at', { ascending: false })
    .limit(5)

  return data || []
}

async function generateCatalystPromptsWithAI(
  inputs: Array<{ title: string; type: 'project' | 'article' | 'thought'; id: string } >,
  userId: string
): Promise<BedtimePrompt[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  if (!inputs || inputs.length === 0) {
    throw new Error('At least one input required')
  }

  const inputsList = inputs
    .map(input => `${input.type.toUpperCase()}: "${input.title}"`) // Corrected escape for quote
    .join('\n') // Corrected escape for newline

  const prompt = `You are an insight engineer. Generate 2-4 prompts that trigger genuine realizations from these specific inputs.

**INPUTS:**
${inputsList}

**YOUR JOB:** Find the non-obvious insight hiding in the intersection of these items.

Return JSON array:
[
  {
    "prompt": "...",
    "type": "connection",
    "format": "visualization"
  }
]`

  const result = await model.generateContent(prompt)
  const text = result.response.text()

  const jsonMatch = text.match(/[\[][\s\S]*[\]]/) // Corrected escape for regex
  if (!jsonMatch) {
    console.error('[Bedtime] Failed to parse catalyst prompts JSON:', text)
    throw new Error('Failed to parse catalyst prompts')
  }

  const parsed = JSON.parse(jsonMatch[0])
  return parsed.map((p: any) => ({
    prompt: p.prompt,
    type: p.type || 'connection',
    format: p.format || 'visualization',
    relatedIds: inputs.map(i => i.id),
    metaphor: undefined
  }))
}

async function generatePromptsWithAI(
  recentArticles: any[],
  recentMemories: any[],
  activeProjects: any[],
  currentInterests: any[],
  oldInsights: any[],
  capabilities: any[],
  context: {
    hasRichInput: boolean
    hasBlockedProjects: boolean
    hasNoProjects: boolean
  },
  performance?: any
): Promise<BedtimePrompt[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const allThemes = recentMemories
    .flatMap(m => m.themes || [])
    .filter(Boolean)

  const themeCounts = allThemes.reduce((acc: Record<string, number>, theme: string) => {
    acc[theme] = (acc[theme] || 0) + 1
    return acc
  }, {})

  const consequentialThemes = Object.entries(themeCounts)
    .filter(([_, count]) => (count as number) >= 2)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([theme, count]) => `${theme} (appears ${count}x)`)

  const topArticles = recentArticles.slice(0, 5).map(a => ({
    title: a.title,
    summary: a.summary?.substring(0, 200) || 'No summary',
    tags: a.tags?.slice(0, 3) || []
  }))

  const topMemories = recentMemories.slice(0, 8).map(m => ({
    title: m.title,
    body: m.body?.substring(0, 200),
    themes: m.themes?.slice(0, 3) || []
  }))

  const topCapabilities = capabilities.map(c => `${c.name}: ${c.description}`)

  const projectContext = activeProjects.length > 0
    ? activeProjects.map((p: any) => {
      const motivation = p.metadata?.motivation ? `\n  MOTIVATION (The "Why"): ${p.metadata.motivation}` : '';
      return `- [${p.status.toUpperCase()}] "${p.title}": ${p.description || 'No description'}${motivation}`;
    }).join('\n')
    : 'No active projects.'

  const prompt = `You are the "Entropic Engine," a digital pharmacopoeia designed to induce hypnagogic creativity.
The user is about to sleep (N1 state). Your goal is to generate "Bedtime Prompts" that bypass rigid logic and trigger deep semantic restructuring.

**USER CONTEXT:**
- Recent Reading: ${topArticles.map(a => `"${a.title}"`).join(', ') || 'None'}
- Recent Thoughts: ${topMemories.map(m => `"${m.title}"`).join(', ') || 'None'}
- Capabilities (Verbs/Tools): ${topCapabilities.join(', ') || 'None'}
- Active Projects:
${projectContext}

**THE PHARMACOPOEIA (STRATEGIES):**
Select strategies based on the inputs to generate 3-4 prompts.

1. **Perspective Shift (The "Overview Effect" - LSD/DMT)**
   - *Goal:* Break out of the "weeds".
   - *Techniques:* Temporal Zoom (project 1000 years future/past), Scale Inversion (cellular/galactic), Alien Anthropologist.
   - *Example:* "Imagine your [Project] is a ruin discovered 1000 years from now. What one function is still working?"

2. **Synesthetic Cross-Pollination (The "Melting" - Psilocybin)**
   - *Goal:* Transfer capability/insight across domains using sensory metaphors.
   - *Techniques:* Modal Transposition (sound/texture), Texture Mapping, Biological Metaphor.
   - *Example:* "If the friction in [Project] had a sound frequency, what would it be? Can you hum a counter-frequency?"
   - *Instruction:* Use the user's 'Capabilities' as the source of the metaphor.

3. **The Logic Breaker (The "Koan" - Zen/DMT)**
   - *Goal:* Exhaust executive control (Beta waves) to allow associative flow (Theta).
   - *Techniques:* Inversion, Paradox, Oblique Strategy.
   - *Example:* "What would happen if you tried to make [Project] fail in the most beautiful way possible?"

4. **Emotional Integration (The "Catharsis" - MDMA)**
   - *Goal:* Connect intellectual work with emotional drives/shadow.
   - *Techniques:* Shadow Work, Ancestral Resonance, Surrender.
   - *Example:* "Which of your projects is currently asking for your love, and which is asking for your fear?"

**OUTPUT INSTRUCTIONS:**
- Generate 3-4 distinct prompts using different strategies.
- Keep prompts short, poetic, and hypnotic.
- **Metaphor**: Provide a short, abstract metaphor or visualization aid for each.
- **Type**: Must be one of: 'connection', 'divergent', 'revisit', 'transform'.

Return JSON array:
[
  {
    "prompt": "...",
    "type": "transform",
    "metaphor": "A melting clock draping over a branch...",
    "strategy": "Synesthesia",
    "relatedIds": ["..."]
  }
]`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const jsonMatch = text.match(/[\[][\s\S]*[\]]/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : []
  } catch (e) {
    console.error('Failed to generate bedtime prompts', e)
    return []
  }
}

async function storePrompts(userId: string, prompts: BedtimePrompt[]) {
  // Placeholder
  return
}

async function getPromptPerformance(userId: string) {
  return {}
}

export async function generateMorningBriefing(userId: string): Promise<MorningBriefing> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  
  const projects = await getActiveProjects(userId)
  const projectContext = projects.map((p: any) => `${p.title} (${p.status})`).join(', ')

  const prompt = `Generate a morning briefing for a creator.
  Projects: ${projectContext}
  
  Return JSON matching this structure:
  {
    "greeting": "Good morning...",
    "focus_project": { "id": "...", "title": "...", "next_step": "...", "unblocker": "..." },
    "quick_win": { "id": "...", "title": "..." },
    "forgotten_gem": null
  }`
  
  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const jsonMatch = text.match(/\{[\s\S]*\}/) // Corrected escape for regex
    if (!jsonMatch) throw new Error('Invalid JSON')
    
    const data = JSON.parse(jsonMatch[0])
    return data
  } catch (e) {
    return {
      greeting: "Good morning!",
      focus_project: projects[0] ? { 
        id: projects[0].id, 
        title: projects[0].title, 
        next_step: "Review current status", 
        unblocker: "Break it down" 
      } : null,
      quick_win: null,
      forgotten_gem: null
    }
  }
}