/**
 * Gap-Filling Prompts API
 * Detects missing valuable context in knowledge graph
 * Generates personalized follow-up questions
 * Focus: 9-5 → full-time creative transition
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { data: { user } } = await supabase.auth.getUser(
      req.headers.authorization?.replace('Bearer ', '') || ''
    )

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Get all user's memories
    const { data: memories } = await supabase
      .from('memories')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (!memories || memories.length === 0) {
      return res.status(200).json({ prompts: [] })
    }

    // Get user's projects
    const { data: projects } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)

    // Analyze what's missing
    const memorySummary = memories.map(m => `- ${m.title}: ${m.body?.substring(0, 100)}`).join('\n')
    const projectSummary = projects?.map(p => `- ${p.title} (${p.status})`).join('\n') || 'No projects yet'

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

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

    return res.status(200).json({ prompts: promptsWithMeta })
  } catch (error) {
    console.error('Gap analysis error:', error)
    return res.status(500).json({ error: 'Analysis failed' })
  }
}
