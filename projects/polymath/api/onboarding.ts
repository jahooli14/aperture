import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './_lib/supabase.js'
import { getUserId } from './_lib/auth.js'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { resource } = req.query
    const userId = getUserId(req)
    const supabase = getSupabaseClient()

    if (resource === 'analyze' && req.method === 'POST') {
        try {
            const { responses } = req.body

            if (!responses || !Array.isArray(responses)) {
                return res.status(400).json({ error: 'Responses array required' })
            }

            console.log(`[Onboarding] Analyzing ${responses.length} responses for user ${userId}`)

            const combinedText = responses.map(r => `Question ${r.question_number}: ${r.transcript}`).join('\n\n')

            const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' })
            const prompt = `Analyze these foundational onboarding thoughts and identify the user's initial interests, capabilities, and mental patterns.
      
      THOUGHTS:
      ${combinedText}
      
      Return JSON:
      {
        "capabilities": ["skill1", "skill2"],
        "themes": ["theme1", "theme2"],
        "patterns": ["Frequent mention of X", "Focus on Y"],
        "entities": {
          "people": [],
          "places": [],
          "topics": [],
          "skills": []
        },
        "first_insight": "A summary of what we've learned about them",
        "graph_preview": {
          "nodes": [
             {"id": "1", "label": "Topic A", "type": "theme"},
             {"id": "2", "label": "Skill B", "type": "capability"}
          ]
        }
      }`

            const result = await model.generateContent(prompt)
            const responseText = result.response.text()
            const jsonMatch = responseText.match(/\{[\s\S]*\}/)
            const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText)

            return res.status(200).json(analysis)
        } catch (error) {
            console.error('[Onboarding] Analysis failed:', error)
            return res.status(500).json({ error: 'Failed to analyze responses' })
        }
    }

    return res.status(400).json({ error: 'Invalid resource or method' })
}
