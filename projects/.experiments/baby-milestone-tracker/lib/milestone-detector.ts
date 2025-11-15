/**
 * Milestone Detection
 *
 * AI-powered detection of developmental milestones in voice memories
 * using Gemini with structured prompts
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import {
  MILESTONE_LIBRARY,
  MILESTONE_DOMAINS,
  type Milestone,
  findMilestonesByText
} from './milestone-taxonomy.js'
import { logger } from './logger.js'

export interface DetectedMilestone {
  milestone_id: string
  milestone_name: string
  domain: string
  confidence: number // 0-1
  evidence: string // Quote from memory showing this milestone
  estimated_age_months?: number
  is_new: boolean // First time this milestone appears
}

export interface MilestoneDetectionResult {
  milestones: DetectedMilestone[]
  child_age_estimate?: number // Estimated child age in months
  developmental_themes: string[]
}

/**
 * Detect milestones in memory content using AI
 */
export async function detectMilestones(
  title: string,
  body: string,
  apiKey: string,
  previousMilestones: string[] = [] // IDs of already detected milestones
): Promise<MilestoneDetectionResult> {
  logger.info('Detecting milestones in memory')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' })

  // Build context from milestone library
  const milestoneContext = MILESTONE_LIBRARY.map(m => ({
    id: m.id,
    name: m.name,
    domain: m.domain,
    age_range: `${m.typical_age_months.min}-${m.typical_age_months.max} months`,
    indicators: m.indicators
  }))

  const prompt = `You are a developmental milestone detection expert. Analyze this parent's voice note about their child.

**Voice Note:**
Title: ${title}
Body: ${body}

**Your Task:**
1. Identify developmental milestones mentioned or implied
2. Extract evidence (direct quotes) showing each milestone
3. Estimate child's age in months (if mentioned or inferable)
4. Identify developmental themes

**Milestone Library:**
${JSON.stringify(milestoneContext, null, 2)}

**Previously Detected Milestones (don't repeat):**
${previousMilestones.length > 0 ? previousMilestones.join(', ') : 'None'}

**Instructions:**
- Only detect milestones with clear evidence in the text
- Mark confidence as HIGH (0.9+) for explicit mentions, MEDIUM (0.6-0.8) for strong implications, LOW (0.4-0.5) for weak signals
- Extract exact quotes as evidence
- Mark "is_new: true" if this is the first time this milestone appears (not in previous list)
- Estimate age based on context clues (if parent mentions age, birthday, or references timeline)
- Identify themes: physical development, language growth, emotional changes, etc.

**Return JSON:**
{
  "milestones": [
    {
      "milestone_id": "string (from library)",
      "milestone_name": "string",
      "domain": "string",
      "confidence": number,
      "evidence": "direct quote from text",
      "is_new": boolean
    }
  ],
  "child_age_estimate": number or null,
  "developmental_themes": ["theme1", "theme2"]
}

**Examples:**
- "She rolled over today for the first time!" → first_roll, confidence 0.95
- "He's getting better at walking" → walking_independently (if already walking) or first_steps (if just starting), confidence 0.7-0.8
- "Said 'mama' clear as day!" → first_word, confidence 0.95

Return ONLY the JSON, no other text.`

  try {
    const result = await model.generateContent(prompt)
    const response = result.response.text().trim()

    // Parse JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response as JSON')
    }

    const parsed = JSON.parse(jsonMatch[0])

    // Validate and enrich results
    const detectedMilestones: DetectedMilestone[] = []

    for (const detected of parsed.milestones || []) {
      const milestone = MILESTONE_LIBRARY.find(m => m.id === detected.milestone_id)
      if (!milestone) {
        logger.warn({ milestone_id: detected.milestone_id }, 'Unknown milestone ID from AI')
        continue
      }

      detectedMilestones.push({
        milestone_id: detected.milestone_id,
        milestone_name: milestone.name,
        domain: milestone.domain,
        confidence: detected.confidence,
        evidence: detected.evidence,
        estimated_age_months: parsed.child_age_estimate || undefined,
        is_new: detected.is_new
      })
    }

    logger.info({
      detected_count: detectedMilestones.length,
      age_estimate: parsed.child_age_estimate
    }, 'Milestone detection complete')

    return {
      milestones: detectedMilestones,
      child_age_estimate: parsed.child_age_estimate || undefined,
      developmental_themes: parsed.developmental_themes || []
    }

  } catch (error) {
    logger.error({ error }, 'Milestone detection failed')
    throw error
  }
}

/**
 * Simple text-based milestone detection (fast, no AI)
 * Used as fallback or for quick checks
 */
export function detectMilestonesSimple(text: string): Milestone[] {
  return findMilestonesByText(text)
}

/**
 * Get developmental insights from milestone progression
 */
export function analyzeMilestoneProgression(
  milestones: Array<{ milestone_id: string; detected_at: string }>
): {
  domains_active: string[]
  progression_velocity: 'slower' | 'typical' | 'faster'
  next_expected_milestones: string[]
} {
  // Group by domain
  const domainCounts = new Map<string, number>()
  for (const { milestone_id } of milestones) {
    const milestone = MILESTONE_LIBRARY.find(m => m.id === milestone_id)
    if (milestone) {
      domainCounts.set(milestone.domain, (domainCounts.get(milestone.domain) || 0) + 1)
    }
  }

  // Find active domains (2+ milestones)
  const domains_active = Array.from(domainCounts.entries())
    .filter(([_, count]) => count >= 2)
    .map(([domain, _]) => domain)

  // Calculate velocity (simplified - could be more sophisticated)
  const avgAgeMonths = milestones.length > 0
    ? milestones.reduce((sum, m) => {
        const milestone = MILESTONE_LIBRARY.find(ml => ml.id === m.milestone_id)
        return sum + (milestone?.typical_age_months.min || 0)
      }, 0) / milestones.length
    : 0

  const chronologicalSpan = milestones.length > 0
    ? (new Date().getTime() - new Date(milestones[0].detected_at).getTime()) / (1000 * 60 * 60 * 24 * 30)
    : 0

  const progression_velocity = avgAgeMonths > chronologicalSpan * 1.2
    ? 'faster'
    : avgAgeMonths < chronologicalSpan * 0.8
    ? 'slower'
    : 'typical'

  // Suggest next milestones based on detected ones
  const detectedIds = new Set(milestones.map(m => m.milestone_id))
  const latestMilestone = milestones[milestones.length - 1]
  const latestMilestoneData = MILESTONE_LIBRARY.find(m => m.id === latestMilestone?.milestone_id)

  const next_expected_milestones = latestMilestoneData
    ? MILESTONE_LIBRARY
        .filter(m =>
          m.domain === latestMilestoneData.domain &&
          !detectedIds.has(m.id) &&
          m.typical_age_months.min >= latestMilestoneData.typical_age_months.max
        )
        .slice(0, 3)
        .map(m => m.id)
    : []

  return {
    domains_active,
    progression_velocity,
    next_expected_milestones
  }
}
