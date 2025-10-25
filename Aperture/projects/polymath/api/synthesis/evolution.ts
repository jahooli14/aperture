/**
 * Cross-Pollination Synthesis API
 * Multi-memory synthesis showing evolution of thinking
 * Project abandonment pattern detection
 * Memory collision detection
 * Capability evolution tracking
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

    // Get memories and projects
    const { data: memories } = await supabase
      .from('memories')
      .select('*')
      .order('created_at', { ascending: true })

    const { data: projects } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)

    if (!memories || memories.length < 10) {
      return res.status(200).json({
        insights: [],
        message: 'Need more data to detect evolution patterns'
      })
    }

    const insights = []

    // 1. Memory Evolution Detection
    // Group memories by topic and detect stance evolution
    const topicGroups = new Map<string, any[]>()
    memories.forEach(m => {
      if (m.themes) {
        m.themes.forEach((theme: string) => {
          const existing = topicGroups.get(theme) || []
          topicGroups.set(theme, [...existing, m])
        })
      }
    })

    // Find topics with multiple memories over time
    for (const [topic, mems] of topicGroups.entries()) {
      if (mems.length >= 3) {
        // Ask AI to analyze evolution
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

        const memoryTexts = mems
          .map((m, i) => `[${new Date(m.created_at).toLocaleDateString()}] ${m.title}: ${m.body?.substring(0, 200)}`)
          .join('\n\n')

        const evolutionPrompt = `Analyze how this person's thinking evolved on the topic "${topic}":

${memoryTexts}

Detect:
1. **Evolution type**: growth (learning/maturing), contradiction (changed mind), or refinement (same view, more nuanced)
2. **Key shifts**: When did their thinking change? What triggered it?
3. **Summary**: One sentence capturing the evolution

Return JSON:
{
  "evolution_type": "growth|contradiction|refinement",
  "summary": "Their thinking evolved from X to Y because Z",
  "timeline": [
    {"date": "2024-01-15", "stance": "Initial view", "quote": "exact quote from memory"},
    {"date": "2024-03-20", "stance": "Shifted view", "quote": "exact quote"}
  ]
}`

        try {
          const result = await model.generateContent(evolutionPrompt)
          const responseText = result.response.text()
          const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/)
          const evolution = jsonMatch ? JSON.parse(jsonMatch[1]) : JSON.parse(responseText)

          insights.push({
            type: 'evolution',
            title: `How Your Thinking Evolved: ${topic}`,
            description: evolution.summary,
            data: {
              topic,
              ...evolution,
              memory_ids: mems.map(m => m.id)
            },
            actionable: false
          })
        } catch (e) {
          // Skip if parsing fails
        }
      }
    }

    // 2. Project Abandonment Pattern Detection
    const abandonedProjects = projects?.filter(p => p.status === 'abandoned' || p.abandoned_reason) || []

    if (abandonedProjects.length >= 2) {
      const abandonmentReasons = abandonedProjects
        .map(p => `- ${p.title}: ${p.abandoned_reason || 'No reason given'}`)
        .join('\n')

      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

      const patternPrompt = `Analyze project abandonment patterns:

${abandonmentReasons}

Detect:
1. **Common pattern**: What's the recurring theme? (e.g., "quits at deployment", "loses interest after MVP", "abandons when it gets hard")
2. **Recommendation**: Specific, actionable advice to break this pattern

Return JSON:
{
  "pattern_type": "abandonment",
  "description": "You tend to quit when [specific trigger]",
  "recommendation": "Try [specific strategy] next time"
}`

      try {
        const result = await model.generateContent(patternPrompt)
        const responseText = result.response.text()
        const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/)
        const pattern = jsonMatch ? JSON.parse(jsonMatch[1]) : JSON.parse(responseText)

        insights.push({
          type: 'pattern',
          title: 'Your Project Abandonment Pattern',
          description: pattern.description,
          data: {
            ...pattern,
            projects_affected: abandonedProjects.map(p => p.id)
          },
          actionable: true,
          action: pattern.recommendation
        })
      } catch (e) {
        // Skip if parsing fails
      }
    }

    // 3. Memory Collision Detection (contradictions)
    // Look for memories with opposite emotional tones on same topic
    for (const [topic, mems] of topicGroups.entries()) {
      if (mems.length >= 2) {
        const tones = mems.map(m => m.emotional_tone).filter(Boolean)
        const hasPositive = tones.some(t => t.toLowerCase().includes('excit') || t.toLowerCase().includes('happy'))
        const hasNegative = tones.some(t => t.toLowerCase().includes('frustrat') || t.toLowerCase().includes('concern'))

        if (hasPositive && hasNegative) {
          const positiveMem = mems.find(m => m.emotional_tone?.toLowerCase().includes('excit') || m.emotional_tone?.toLowerCase().includes('happy'))
          const negativeMem = mems.find(m => m.emotional_tone?.toLowerCase().includes('frustrat') || m.emotional_tone?.toLowerCase().includes('concern'))

          if (positiveMem && negativeMem) {
            insights.push({
              type: 'collision',
              title: `Contradictory Feelings: ${topic}`,
              description: `Your view on ${topic} has contradictory emotions`,
              data: {
                topic,
                timeline: [
                  {
                    date: positiveMem.created_at,
                    memory_id: positiveMem.id,
                    stance: positiveMem.emotional_tone,
                    quote: positiveMem.body?.substring(0, 100)
                  },
                  {
                    date: negativeMem.created_at,
                    memory_id: negativeMem.id,
                    stance: negativeMem.emotional_tone,
                    quote: negativeMem.body?.substring(0, 100)
                  }
                ],
                evolution_type: 'contradiction'
              },
              actionable: true,
              action: `Explore what changed between ${new Date(positiveMem.created_at).toLocaleDateString()} and ${new Date(negativeMem.created_at).toLocaleDateString()}`
            })
          }
        }
      }
    }

    // 4. Capability Evolution (terminology shifts)
    // Detect when someone goes from "learning X" to "built Y with X"
    const capabilityEvolution = []
    for (const [topic, mems] of topicGroups.entries()) {
      const earlyMems = mems.slice(0, Math.ceil(mems.length / 2))
      const lateMems = mems.slice(Math.ceil(mems.length / 2))

      const earlyText = earlyMems.map(m => m.body).join(' ').toLowerCase()
      const lateText = lateMems.map(m => m.body).join(' ').toLowerCase()

      const wasLearning = earlyText.includes('learning') || earlyText.includes('trying to')
      const isBuilding = lateText.includes('built') || lateText.includes('shipped') || lateText.includes('finished')

      if (wasLearning && isBuilding) {
        capabilityEvolution.push({
          capability: topic,
          from: 'learning',
          to: 'applying',
          evidence: `First mentioned learning, now actively building with it`
        })
      }
    }

    if (capabilityEvolution.length > 0) {
      insights.push({
        type: 'evolution',
        title: 'Your Skills Are Maturing',
        description: `${capabilityEvolution.length} skills went from learning → building`,
        data: { evolutions: capabilityEvolution },
        actionable: false
      })
    }

    return res.status(200).json({ insights })
  } catch (error) {
    console.error('Synthesis evolution error:', error)
    return res.status(500).json({ error: 'Analysis failed' })
  }
}
