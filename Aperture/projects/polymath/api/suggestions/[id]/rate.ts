/**
 * Rate Suggestion API Endpoint
 * Copy to: projects/memory-os/api/suggestions/[id]/rate.ts
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { getSupabaseConfig, getUserId } from '../../../lib/env.js'
import { ValidationError, handleAPIError } from '../../../lib/error-handler.js'

const supabaseConfig = getSupabaseConfig()
const supabase = createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey)

// Request validation schema
const RateRequestSchema = z.object({
  rating: z.number().int().min(-1).max(2),
  feedback: z.string().optional()
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const { id } = req.query

    if (!id || typeof id !== 'string') {
      throw new ValidationError('Suggestion ID required')
    }

    // Validate request body
    const parseResult = RateRequestSchema.safeParse(req.body)
    if (!parseResult.success) {
      throw new ValidationError(
        'Invalid rating. Must be: -1 (meh), 1 (spark), or 2 (built)',
        parseResult.error.format()
      )
    }

    const { rating, feedback } = parseResult.data

    // Get user ID
    const userId = getUserId()

    // 1. Store rating
    const { data: ratingData, error: ratingError } = await supabase
      .from('suggestion_ratings')
      .insert({
        suggestion_id: id,
        user_id: userId,
        rating,
        feedback: feedback || null
      })
      .select()
      .single()

    if (ratingError) {
      console.error('[rate] Rating insert error:', ratingError)
      return res.status(500).json({ error: ratingError.message })
    }

    // 2. Update suggestion status
    // rating: -1 = meh, 1 = spark, 2 = built
    let newStatus: string
    if (rating === 2) {
      newStatus = 'built'
    } else if (rating === 1) {
      newStatus = 'spark'
    } else {
      newStatus = 'meh'
    }

    const { data: suggestion, error: updateError } = await supabase
      .from('project_suggestions')
      .update({ status: newStatus })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('[rate] Suggestion update error:', updateError)
      return res.status(500).json({ error: updateError.message })
    }

    // 3. Learn from rating (strengthen/penalize nodes)
    if (rating > 0) {
      // Positive rating - boost capability nodes
      for (const capabilityId of suggestion.capability_ids) {
        await incrementCapabilityStrength(capabilityId, 0.05)
      }
    } else {
      // Negative rating - penalize combination
      await penalizeCombination(suggestion.capability_ids, 0.1)
    }

    console.log(`[rate] Rated suggestion ${id}: ${rating} (${newStatus})`)

    return res.status(200).json({
      success: true,
      rating: ratingData,
      updated_suggestion: {
        id: suggestion.id,
        status: suggestion.status
      }
    })

  } catch (error) {
    return handleAPIError(error, res)
  }
}

/**
 * Increment capability strength
 */
async function incrementCapabilityStrength(capabilityId: string, increment: number) {
  // Get current strength
  const { data: capability } = await supabase
    .from('capabilities')
    .select('strength')
    .eq('id', capabilityId)
    .single()

  if (!capability) return

  const newStrength = capability.strength + increment

  // Update capabilities table
  await supabase
    .from('capabilities')
    .update({
      strength: newStrength,
      last_used: new Date().toISOString()
    })
    .eq('id', capabilityId)

  // Update node_strengths table
  await supabase
    .from('node_strengths')
    .upsert({
      node_type: 'capability',
      node_id: capabilityId,
      strength: newStrength,
      activity_count: 1,
      last_activity: new Date().toISOString()
    }, {
      onConflict: 'node_type,node_id',
      ignoreDuplicates: false
    })
}

/**
 * Penalize capability combination
 */
async function penalizeCombination(capabilityIds: string[], penalty: number) {
  const sortedIds = [...capabilityIds].sort()

  // Get current combination data
  const { data: combo } = await supabase
    .from('capability_combinations')
    .select('*')
    .eq('capability_ids', sortedIds)
    .single()

  if (!combo) return

  // Increment negative ratings and penalty score
  await supabase
    .from('capability_combinations')
    .update({
      times_rated_negative: combo.times_rated_negative + 1,
      penalty_score: combo.penalty_score + penalty
    })
    .eq('capability_ids', sortedIds)
}
