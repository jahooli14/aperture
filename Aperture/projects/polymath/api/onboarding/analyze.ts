/**
 * Onboarding Analysis API
 * Analyzes 5 onboarding responses to extract capabilities, themes, patterns
 * Returns first knowledge graph and insights
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { responses } = req.body

    if (!responses || responses.length !== 5) {
      return res.status(400).json({ error: 'Expected 5 responses' })
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
    // (We'll use them for gap-filling prompts later)
    const { data: { user } } = await supabase.auth.getUser(
      req.headers.authorization?.replace('Bearer ', '') || ''
    )

    if (user) {
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
    }

    return res.status(200).json(analysis)
  } catch (error) {
    console.error('Onboarding analysis error:', error)
    return res.status(500).json({ error: 'Analysis failed' })
  }
}

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
