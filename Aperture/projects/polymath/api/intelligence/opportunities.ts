/**
 * Creative Intelligence Engine API
 * Scans knowledge graph for project opportunities
 * Matches capabilities + frustrations + memories
 * Returns personalized project suggestions with "why you" reasoning
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

    // Get user's memories
    const { data: memories } = await supabase
      .from('memories')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (!memories || memories.length < 3) {
      return res.status(200).json({ opportunities: [] })
    }

    // Get user's projects (to check capability freshness and patterns)
    const { data: projects } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)

    // Extract capabilities from memories
    const capabilities = new Map<string, { count: number; lastMentioned: string; memories: string[] }>()
    const frustrations: string[] = []
    const interests: string[] = []

    memories.forEach(m => {
      // Simple extraction (in production, use better NLP)
      const text = `${m.title} ${m.body}`.toLowerCase()

      // Extract skills/capabilities
      const skillKeywords = ['learned', 'know', 'good at', 'skill', 'experienced in', 'built with']
      skillKeywords.forEach(keyword => {
        if (text.includes(keyword)) {
          // Extract context around keyword
          const context = text.substring(text.indexOf(keyword), text.indexOf(keyword) + 50)
          if (m.themes) {
            m.themes.forEach((theme: string) => {
              const existing = capabilities.get(theme) || { count: 0, lastMentioned: m.created_at, memories: [] }
              capabilities.set(theme, {
                count: existing.count + 1,
                lastMentioned: m.created_at,
                memories: [...existing.memories, m.id]
              })
            })
          }
        }
      })

      // Extract frustrations
      const frustrationKeywords = ['frustrated', 'annoying', 'wish', 'should exist', 'hate', 'broken', 'difficult']
      frustrationKeywords.forEach(keyword => {
        if (text.includes(keyword)) {
          frustrations.push(`${m.title}: ${m.body?.substring(0, 100)}`)
        }
      })

      // Extract interests
      if (m.themes) {
        m.themes.forEach((theme: string) => {
          if (!interests.includes(theme)) {
            interests.push(theme)
          }
        })
      }
    })

    // Build prompt for AI
    const capabilitiesText = Array.from(capabilities.entries())
      .map(([name, data]) => `- ${name} (mentioned ${data.count}x, last: ${new Date(data.lastMentioned).toLocaleDateString()})`)
      .join('\n')

    const frustrationsText = frustrations.slice(0, 10).join('\n')
    const interestsText = interests.slice(0, 10).join(', ')
    const projectsText = projects?.map(p => `- ${p.title} (${p.status}${p.abandoned_reason ? ', abandoned: ' + p.abandoned_reason : ''})`).join('\n') || 'No projects yet'

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

    const prompt = `You are a creative intelligence engine helping someone with a 9-5 job identify side project opportunities.

**Their capabilities:**
${capabilitiesText || 'None identified yet'}

**Their frustrations:**
${frustrationsText || 'None mentioned'}

**Their interests:**
${interestsText || 'None identified'}

**Their project history:**
${projectsText}

**Your goal:** Suggest 2-3 project opportunities that:
1. Match their actual skills (not aspirational)
2. Solve frustrations they've mentioned
3. Fit into side-hustle time constraints (10-20 hrs/week)
4. Have revenue potential if they've mentioned income/quitting 9-5
5. Play to their strengths (not weaknesses)

**Focus on:**
- Things they can FINISH (not multi-year projects)
- Using skills they already have (with maybe 1 new skill to learn)
- Solving their own frustrations (best product ideas)
- Side-hustle → full-time trajectory if applicable

For each opportunity, explain:
- **Why YOU specifically** (use their own words/context)
- **What capabilities you'll use** (from their list)
- **Why it might work** (small, focused, solvable)
- **Revenue potential** (if they've mentioned money/income)

Return JSON array (2-3 opportunities max):
[
  {
    "title": "Project Name",
    "description": "What it is (2-3 sentences)",
    "why_you": [
      "Specific reason #1 using their context",
      "Specific reason #2",
      "Specific reason #3"
    ],
    "capabilities_used": ["skill1", "skill2"],
    "memories_referenced": ["memory_id1", "memory_id2"],
    "revenue_potential": "$500-2000/mo as template/course" or null,
    "next_steps": [
      "Concrete step 1",
      "Concrete step 2",
      "Concrete step 3"
    ],
    "confidence": 0.85
  }
]

**Rules:**
- Only suggest if you have ACTUAL evidence from their memories
- Don't suggest generic "build an app" ideas
- Use their specific frustrations/interests
- Be realistic about time/scope (side project, not startup)
- If they've abandoned projects, suggest smaller scope`

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    // Parse JSON
    let opportunities
    try {
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/)
      opportunities = jsonMatch ? JSON.parse(jsonMatch[1]) : JSON.parse(responseText)
    } catch (e) {
      console.error('Failed to parse opportunities:', e)
      opportunities = []
    }

    // Add IDs and timestamps
    const opportunitiesWithMeta = opportunities.map((opp: any, i: number) => ({
      id: `opp-${Date.now()}-${i}`,
      ...opp,
      created_at: new Date().toISOString()
    }))

    return res.status(200).json({ opportunities: opportunitiesWithMeta })
  } catch (error) {
    console.error('Creative intelligence error:', error)
    return res.status(500).json({ error: 'Analysis failed' })
  }
}
