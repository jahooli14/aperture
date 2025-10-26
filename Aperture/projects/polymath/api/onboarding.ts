/**
 * Consolidated Onboarding API
 * Handles onboarding analysis and gap-filling prompts
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const USER_ID = 'f2404e61-2010-46c8-8edd-b8a3e702f0fb'

// Helper to extract lists from text
function extractList(text: string, key: string): string[] {
  const regex = new RegExp(`${key}[:\s]+([^\n]+)`, 'i')
  const match = text.match(regex)
  if (!match) return []
  return match[1]
    .split(',')
    .map(s => s.trim().replace(/["\[\]]/g, ''))
    .filter(Boolean)
}

/**
 * ANALYZE - Onboarding Analysis
 * Analyzes 5 onboarding responses to extract capabilities, themes, patterns
 */
async function analyzeOnboarding(req: VercelRequest) {
  const { responses } = req.body

  if (!responses || responses.length !== 5) {
    throw new Error('Expected 5 responses')
  }

  // Combine all responses for analysis
  const combinedText = responses
    .map((r: any, i: number) => `Q${i + 1}: ${r.transcript}`)
    .join('\n\n')

  // Use Gemini to extract capabilities, themes, patterns
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

  const prompt = `Analyze these onboarding responses from a creative person with a 9-5 job who wants to build side projects and potentially go full-time creative.

${combinedText}

Extract:
1. **Capabilities**: Concrete skills mentioned (e.g., React, design, photography)
2. **Themes**: Areas of interest (e.g., Web Development, Creative Tools, Productivity)
3. **Patterns**: Behavioral patterns, especially around project abandonment or 9-5 → creative transition
4. **Entities**: People, places, topics mentioned
5. **First Insight**: One powerful observation that would make them say "whoa, this app gets me"

Focus on:
- 9-5 to full-time creative transition signals
- Project abandonment patterns
- Time/energy constraints
- Revenue/income mentions
- Skills they want to use more

Return JSON:
{
  "capabilities": ["skill1", "skill2"],
  "themes": ["theme1", "theme2"],
  "patterns": ["pattern description"],
  "entities": {
    "people": [],
    "places": [],
    "topics": []
  },
  "first_insight": "Powerful observation that shows understanding",
  "graph_preview": {
    "nodes": [
      {"id": "1", "label": "Capability Name", "type": "capability"},
      {"id": "2", "label": "Theme Name", "type": "theme"}
    ],
    "edges": [
      {"from": "1", "to": "2", "label": "used in"}
    ]
  }
}`

  const result = await model.generateContent(prompt)
  const responseText = result.response.text()

  // Parse JSON from response (extract from markdown if needed)
  let analysis
  try {
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/)
    analysis = jsonMatch
      ? JSON.parse(jsonMatch[1])
      : JSON.parse(responseText)
  } catch (e) {
    // Fallback parsing
    analysis = {
      capabilities: extractList(responseText, 'capabilities'),
      themes: extractList(responseText, 'themes'),
      patterns: extractList(responseText, 'patterns'),
      entities: { people: [], places: [], topics: [] },
      first_insight: 'I notice patterns in how you approach creative work. Let\'s explore this together.',
      graph_preview: {
        nodes: [
          { id: '1', label: 'Your Skills', type: 'capability' },
          { id: '2', label: 'Your Interests', type: 'theme' }
        ],
        edges: [{ from: '1', to: '2', label: 'connects to' }]
      }
    }
  }

  // Store the onboarding responses in the database for future analysis
  // Store as a special "onboarding" memory
  await supabase.from('memories').insert({
    audiopen_id: `onboarding-${Date.now()}`,
    title: 'Onboarding Responses',
    body: combinedText,
    orig_transcript: combinedText,
    tags: ['onboarding'],
    audiopen_created_at: new Date().toISOString(),
    processed: true,
    themes: analysis.themes,
    entities: analysis.entities
  })

  return analysis
}

/**
 * GAP-ANALYSIS - Gap-Filling Prompts
 * Detects missing valuable context in knowledge graph
 */
async function getGapAnalysis() {
  // Get all user's memories
  const { data: memories } = await supabase
    .from('memories')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (!memories || memories.length === 0) {
    return { prompts: [] }
  }

  // Get user's projects
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', USER_ID)

  // Analyze what's missing
  const memorySummary = memories.map(m => `- ${m.title}: ${m.body?.substring(0, 100)}`).join('\n')
  const projectSummary = projects?.map(p => `- ${p.title} (${p.status})`).join('\n') || 'No projects yet'

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

  const prompt = `You are analyzing a creative person's knowledge graph to identify VALUABLE missing context.

**Their memories:**
${memorySummary}

**Their projects:**
${projectSummary}

**Your goal:** Generate 2-3 high-value follow-up questions that would unlock insights they can't see without this missing context.

**Focus areas:**
1. 9-5 to full-time creative transition (if they mention job/work)
   - "You mentioned quitting your 9-5 twice - what would make that financially possible?"
   - "How many hours per week do you currently spend on side projects?"

2. Project abandonment patterns (if they mention unfinished projects)
   - "You said you quit at deployment - what specifically makes deployment hard?"
   - "What would need to be true for you to finish [project]?"

3. Revenue/income (if they mention selling/monetizing)
   - "What's your monthly income goal from creative work?"
   - "Have you made any money from past projects? How much?"

4. Skill gaps (if they mention wanting to learn something)
   - "You mentioned learning [skill] - is this for a specific project or general interest?"
   - "What's blocking you from getting better at [skill]?"

5. Time/energy (if they mention constraints)
   - "When do you have the most energy for creative work?"
   - "What would you do with 10 extra hours per week?"

**Rules:**
- Only ask if it would unlock meaningful insights (not just curiosity)
- Make questions specific to their context (use their words)
- Focus on actionable gaps (not philosophical)
- Prioritize 9-5 transition if signals present
- Max 3 questions

Return JSON array:
[
  {
    "prompt_text": "The question to ask",
    "reasoning": "Why this matters (one sentence)",
    "category": "transition|skill|project|general",
    "priority": 1-10
  }
]`

  const result = await model.generateContent(prompt)
  const responseText = result.response.text()

  // Parse JSON
  let prompts
  try {
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/)
    prompts = jsonMatch ? JSON.parse(jsonMatch[1]) : JSON.parse(responseText)
  } catch (e) {
    prompts = []
  }

  // Add IDs and timestamps
  const promptsWithMeta = prompts.map((p: any, i: number) => ({
    id: `gap-${Date.now()}-${i}`,
    ...p,
    created_at: new Date().toISOString()
  }))

  return { prompts: promptsWithMeta }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { resource } = req.query

  // ANALYZE - Onboarding Analysis
  if (resource === 'analyze') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
      const analysis = await analyzeOnboarding(req)
      return res.status(200).json(analysis)
    } catch (error) {
      console.error('[onboarding] Analysis error:', error)
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Analysis failed' })
    }
  }

  // GAP-ANALYSIS - Gap-Filling Prompts
  if (resource === 'gap-analysis') {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
      const result = await getGapAnalysis()
      return res.status(200).json(result)
    } catch (error) {
      console.error('[onboarding] Gap analysis error:', error)
      return res.status(500).json({ error: 'Analysis failed' })
    }
  }

  return res.status(400).json({ error: 'Invalid resource. Use ?resource=analyze or ?resource=gap-analysis' })
}
