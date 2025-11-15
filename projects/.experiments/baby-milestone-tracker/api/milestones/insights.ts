import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getSupabaseConfig, getGeminiConfig } from '../../lib/env.js'
import { logger } from '../../lib/logger.js'
import { analyzeMilestoneProgression } from '../../lib/milestone-detector.js'
import { MILESTONE_LIBRARY, MILESTONE_DOMAINS } from '../../lib/milestone-taxonomy.js'

const { url, serviceRoleKey } = getSupabaseConfig()
const supabase = createClient(url, serviceRoleKey)
const { apiKey } = getGeminiConfig()
const genAI = new GoogleGenerativeAI(apiKey)

/**
 * API Endpoint: /api/milestones/insights
 *
 * POST - Generate developmental insights from milestone data
 * Body:
 *   - user_id: UUID
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { user_id } = req.body

    if (!user_id) {
      return res.status(400).json({ error: 'user_id required' })
    }

    logger.info({ user_id }, 'Generating milestone insights')

    // 1. Get all user's milestones
    const { data: milestones, error: fetchError } = await supabase
      .from('child_milestones')
      .select('*')
      .eq('user_id', user_id)
      .order('detected_at', { ascending: true })

    if (fetchError || !milestones) {
      throw new Error(`Failed to fetch milestones: ${fetchError?.message}`)
    }

    if (milestones.length === 0) {
      return res.status(200).json({
        success: true,
        insights: [],
        message: 'No milestones to analyze yet'
      })
    }

    // 2. Analyze progression
    const progression = analyzeMilestoneProgression(
      milestones.map(m => ({
        milestone_id: m.milestone_id,
        detected_at: m.detected_at
      }))
    )

    // 3. Generate AI insights
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' })

    // Group milestones by domain for context
    const milestonesByDomain = milestones.reduce((acc, m) => {
      if (!acc[m.domain]) acc[m.domain] = []
      acc[m.domain].push(m)
      return acc
    }, {} as Record<string, typeof milestones>)

    const prompt = `You are a developmental psychology expert analyzing a child's milestone progression.

**Milestones Detected:**
${JSON.stringify(milestones.map(m => ({
  name: m.milestone_name,
  domain: m.domain,
  date: m.detected_at,
  age_months: m.child_age_months,
  evidence: m.evidence
})), null, 2)}

**Progression Analysis:**
- Active domains: ${progression.domains_active.join(', ')}
- Velocity: ${progression.progression_velocity}
- Next expected: ${progression.next_expected_milestones.join(', ')}

**Your Task:**
Generate 3-5 meaningful, encouraging insights for the parent:

1. **Pattern Insights**: Identify interesting patterns or clusters in development
2. **Achievement Highlights**: Celebrate major milestones and progress
3. **Progression Insights**: Note velocity, domain balance, or developmental trajectory
4. **Suggestions**: Gentle, helpful suggestions for supporting next developmental stages

**Tone:**
- Encouraging and positive
- Specific to their child's actual milestones
- Evidence-based but warm
- Not prescriptive or anxiety-inducing
- Celebrate uniqueness while noting typical patterns

**Return JSON:**
{
  "insights": [
    {
      "type": "pattern" | "achievement" | "progression" | "suggestion",
      "title": "Brief, compelling title (max 8 words)",
      "description": "2-3 sentences with specific details and encouragement",
      "milestone_ids": ["array of related milestone_ids"],
      "confidence": 0.8
    }
  ]
}

**Examples:**

**Pattern Insight:**
{
  "type": "pattern",
  "title": "Strong Physical Development Momentum",
  "description": "Your little one has hit 4 major motor milestones in just 6 weeks! This clustering of physical achievements (sitting, crawling, pulling up) shows beautiful coordination development. Their body and brain are working together wonderfully.",
  "milestone_ids": ["sitting_independently", "crawling", "standing_supported"],
  "confidence": 0.9
}

**Achievement Highlight:**
{
  "type": "achievement",
  "title": "Communication Breakthrough!",
  "description": "The first word is such a magical moment! From your note: 'Said mama clear as day!' This milestone marks the beginning of a whole new way to connect. Every word from here will build their confidence as a communicator.",
  "milestone_ids": ["first_word"],
  "confidence": 0.95
}

Return ONLY the JSON, no other text.`

    const result = await model.generateContent(prompt)
    const response = result.response.text().trim()

    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    // 4. Store insights in database
    const insightsToStore = parsed.insights.map((insight: any) => ({
      user_id,
      insight_type: insight.type,
      title: insight.title,
      description: insight.description,
      milestone_ids: insight.milestone_ids,
      domains_active: progression.domains_active,
      confidence: insight.confidence,
      generated_at: new Date().toISOString()
    }))

    const { data: storedInsights, error: insertError } = await supabase
      .from('milestone_insights')
      .insert(insightsToStore)
      .select()

    if (insertError) {
      logger.error({ error: insertError }, 'Failed to store insights')
      throw insertError
    }

    logger.info(
      { user_id, insights_generated: storedInsights.length },
      'Insights generated successfully'
    )

    return res.status(200).json({
      success: true,
      insights: storedInsights,
      progression_summary: progression
    })

  } catch (error) {
    logger.error({ error }, 'Insight generation failed')
    return res.status(500).json({
      error: 'Failed to generate insights',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
