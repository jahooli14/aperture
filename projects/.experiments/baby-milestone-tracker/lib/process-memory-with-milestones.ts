/**
 * Enhanced Memory Processing with Milestone Detection
 *
 * Extends base memory processing to detect and store developmental milestones
 */

import { createClient } from '@supabase/supabase-js'
import { processMemory } from './process-memory.js'
import { detectMilestones, analyzeMilestoneProgression } from './milestone-detector.js'
import { getSupabaseConfig, getGeminiConfig } from './env.js'
import { logger } from './logger.js'
import type { DetectedMilestone } from './milestone-detector'

const { url, serviceRoleKey } = getSupabaseConfig()
const supabase = createClient(url, serviceRoleKey)
const { apiKey } = getGeminiConfig()

/**
 * Process memory with milestone detection
 * This is called after base memory processing
 */
export async function processMemoryWithMilestones(
  memoryId: string,
  userId: string
): Promise<void> {
  logger.info({ memory_id: memoryId }, 'Processing memory with milestone detection')

  try {
    // 1. First run base memory processing (entities, themes, embedding)
    await processMemory(memoryId)

    // 2. Get the processed memory
    const { data: memory, error: fetchError } = await supabase
      .from('memories')
      .select('*')
      .eq('id', memoryId)
      .single()

    if (fetchError || !memory) {
      throw new Error(`Failed to fetch memory: ${fetchError?.message}`)
    }

    // 3. Check if memory is about child development (from themes)
    const isChildDevelopment =
      memory.themes?.includes('child_development') ||
      memory.themes?.includes('parenting') ||
      memory.entities?.topics?.some((t: string) =>
        ['development', 'milestone', 'growth', 'baby', 'toddler'].some(keyword =>
          t.toLowerCase().includes(keyword)
        )
      )

    if (!isChildDevelopment) {
      logger.debug({ memory_id: memoryId }, 'Not a child development memory, skipping milestone detection')
      return
    }

    logger.info({ memory_id: memoryId }, 'Child development memory detected, running milestone detection')

    // 4. Get previously detected milestones for this user
    const { data: existingMilestones } = await supabase
      .from('child_milestones')
      .select('milestone_id')
      .eq('user_id', userId)

    const previousMilestoneIds = existingMilestones?.map(m => m.milestone_id) || []

    // 5. Detect milestones in this memory
    const detectionResult = await detectMilestones(
      memory.title,
      memory.body,
      apiKey,
      previousMilestoneIds
    )

    if (detectionResult.milestones.length === 0) {
      logger.info({ memory_id: memoryId }, 'No milestones detected')
      return
    }

    logger.info(
      { memory_id: memoryId, count: detectionResult.milestones.length },
      'Milestones detected'
    )

    // 6. Store detected milestones
    const milestonesToStore = detectionResult.milestones.map(m => ({
      user_id: userId,
      memory_id: memoryId,
      milestone_id: m.milestone_id,
      milestone_name: m.milestone_name,
      domain: m.domain,
      confidence: m.confidence,
      evidence: m.evidence,
      is_new: m.is_new,
      detected_at: new Date().toISOString(),
      child_age_months: detectionResult.child_age_estimate || null,
    }))

    const { error: insertError } = await supabase
      .from('child_milestones')
      .insert(milestonesToStore)

    if (insertError) {
      logger.error({ error: insertError }, 'Failed to store milestones')
      throw insertError
    }

    // 7. Update memory with milestone metadata
    await supabase
      .from('memories')
      .update({
        metadata: {
          ...memory.metadata,
          has_milestones: true,
          milestone_count: detectionResult.milestones.length,
          child_age_estimate: detectionResult.child_age_estimate,
          developmental_themes: detectionResult.developmental_themes
        }
      })
      .eq('id', memoryId)

    logger.info(
      {
        memory_id: memoryId,
        milestones_stored: detectionResult.milestones.length,
        new_milestones: detectionResult.milestones.filter(m => m.is_new).length
      },
      'Milestone processing complete'
    )

  } catch (error) {
    logger.error({ memory_id: memoryId, error }, 'Milestone processing failed')
    // Don't throw - milestone detection is optional, base memory still processed
  }
}

/**
 * Get milestone timeline for a user
 */
export async function getMilestoneTimeline(userId: string): Promise<{
  milestones: Array<{
    id: string
    milestone_name: string
    domain: string
    detected_at: string
    evidence: string
    memory_title: string
    child_age_months: number | null
  }>
  insights: {
    total_milestones: number
    domains_active: string[]
    progression_velocity: 'slower' | 'typical' | 'faster'
    next_expected_milestones: string[]
  }
}> {
  // Get all milestones with memory details
  const { data: milestones, error } = await supabase
    .from('child_milestones')
    .select(`
      id,
      milestone_id,
      milestone_name,
      domain,
      detected_at,
      evidence,
      child_age_months,
      memory:memories (
        title
      )
    `)
    .eq('user_id', userId)
    .order('detected_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch milestones: ${error.message}`)
  }

  if (!milestones || milestones.length === 0) {
    return {
      milestones: [],
      insights: {
        total_milestones: 0,
        domains_active: [],
        progression_velocity: 'typical',
        next_expected_milestones: []
      }
    }
  }

  // Format for response
  const formattedMilestones = milestones.map(m => ({
    id: m.id,
    milestone_name: m.milestone_name,
    domain: m.domain,
    detected_at: m.detected_at,
    evidence: m.evidence,
    memory_title: m.memory?.title || 'Unknown',
    child_age_months: m.child_age_months
  }))

  // Analyze progression
  const progression = analyzeMilestoneProgression(
    milestones.map(m => ({
      milestone_id: m.milestone_id,
      detected_at: m.detected_at
    }))
  )

  return {
    milestones: formattedMilestones,
    insights: {
      total_milestones: milestones.length,
      ...progression
    }
  }
}
