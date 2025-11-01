/**
 * Consolidated Suggestions API Endpoint
 *
 * Routes:
 * GET /api/suggestions - List project suggestions
 * POST /api/suggestions?action=rate&id=123 - Rate a suggestion
 * POST /api/suggestions?action=build&id=123 - Build a project from suggestion
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './lib/supabase'
import { getUserId } from './lib/auth'
import { z } from 'zod'

)


// Request validation schema for rating
const RateRequestSchema = z.object({
  rating: z.number().int().min(-1).max(2),
  feedback: z.string().optional()
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabaseClient()
  const userId = getUserId()
  const action = req.query.action as string
  const id = req.query.id as string

  // Route based on method and action
  if (req.method === 'GET') {
    return handleList(req, res)
  } else if (req.method === 'POST' && action === 'rate') {
    return handleRate(req, res, id)
  } else if (req.method === 'POST' && action === 'build') {
    return handleBuild(req, res, id)
  } else {
    return res.status(405).json({ error: 'Method not allowed' })
  }
}

/**
 * List suggestions
 */
async function handleList(req: VercelRequest, res: VercelResponse) {
  try {
    // Query parameters
    const {
      status = 'pending',
      limit = '20',
      offset = '0',
      include_rated = 'false'
    } = req.query

    let query = supabase
      .from('project_suggestions')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('total_points', { ascending: false })

    // Filter by status
    if (status !== 'all') {
      if (include_rated === 'true') {
        // Show pending + rated suggestions
        query = query.in('status', ['pending', 'spark', 'meh', 'saved'])
      } else {
        // Only show pending
        query = query.eq('status', status)
      }
    }

    // Pagination
    query = query.range(
      Number(offset),
      Number(offset) + Number(limit) - 1
    )

    const { data, error, count } = await query

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    // Enrich suggestions with capability names
    const enrichedSuggestions = await Promise.all(
      (data || []).map(async (suggestion) => {
        if (suggestion.capability_ids && suggestion.capability_ids.length > 0) {
          const { data: capabilities } = await supabase
            .from('capabilities')
            .select('id, name')
            .in('id', suggestion.capability_ids)

          return {
            ...suggestion,
            capabilities: capabilities || []
          }
        }
        return {
          ...suggestion,
          capabilities: []
        }
      })
    )

    return res.status(200).json({
      suggestions: enrichedSuggestions,
      total: count || 0,
      limit: Number(limit),
      offset: Number(offset)
    })

  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Rate a suggestion
 */
async function handleRate(req: VercelRequest, res: VercelResponse, id: string) {
  if (!id) {
    return res.status(400).json({ error: 'Suggestion ID required' })
  }

  try {
    const parseResult = RateRequestSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid rating. Must be: -1 (meh), 1 (spark), or 2 (built)'
      })
    }

    const { rating, feedback } = parseResult.data

    // Store rating
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
      return res.status(500).json({ error: ratingError.message })
    }

    // Update suggestion status
    let newStatus = rating === 2 ? 'built' : rating === 1 ? 'spark' : 'meh'

    const { data: suggestion, error: updateError } = await supabase
      .from('project_suggestions')
      .update({ status: newStatus })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      return res.status(500).json({ error: updateError.message })
    }

    // Learn from rating
    if (rating > 0) {
      for (const capabilityId of suggestion.capability_ids || []) {
        await incrementCapabilityStrength(capabilityId, 0.05)
      }
    } else if (suggestion.capability_ids) {
      await penalizeCombination(suggestion.capability_ids, 0.1)
    }

    return res.status(200).json({
      success: true,
      rating: ratingData,
      updated_suggestion: {
        id: suggestion.id,
        status: suggestion.status
      }
    })

  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Build a project from suggestion
 */
async function handleBuild(req: VercelRequest, res: VercelResponse, id: string) {
  if (!id) {
    return res.status(400).json({ error: 'Suggestion ID required' })
  }

  const { project_title, project_description, metadata = {} } = req.body

  try {
    // Get suggestion
    const { data: suggestion, error: fetchError } = await supabase
      .from('project_suggestions')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Suggestion not found' })
      }
      return res.status(500).json({ error: fetchError.message })
    }

    const hasCapabilities = suggestion.capability_ids && suggestion.capability_ids.length > 0
    const projectType = metadata.type || (hasCapabilities ? 'technical' : 'creative')

    // Create project
    const { data: project, error: createError } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        title: project_title || suggestion.title,
        description: project_description || suggestion.description,
        type: projectType,
        status: 'active',
        last_active: new Date().toISOString(),
        metadata: {
          ...metadata,
          from_suggestion: id,
          capabilities: suggestion.capability_ids,
          original_points: suggestion.total_points
        }
      })
      .select()
      .single()

    if (createError) {
      return res.status(500).json({ error: createError.message })
    }

    // Update suggestion
    await supabase
      .from('project_suggestions')
      .update({
        status: 'built',
        built_project_id: project.id
      })
      .eq('id', id)

    // Add automatic +2 rating
    await supabase
      .from('suggestion_ratings')
      .insert({
        suggestion_id: id,
        user_id: userId,
        rating: 2,
        feedback: 'Built this project!'
      })

    // Boost capability strengths significantly
    for (const capabilityId of suggestion.capability_ids || []) {
      await incrementCapabilityStrength(capabilityId, 0.3)
    }

    // Create project node strength entry
    await supabase
      .from('node_strengths')
      .insert({
        node_type: 'project',
        node_id: project.id,
        strength: 1.5,
        activity_count: 1,
        last_activity: new Date().toISOString()
      })

    return res.status(201).json({
      success: true,
      project,
      suggestion: {
        id: suggestion.id,
        status: 'built',
        built_project_id: project.id
      }
    })

  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Helper: Increment capability strength
 */
async function incrementCapabilityStrength(capabilityId: string, increment: number) {
  const { data: capability } = await supabase
    .from('capabilities')
    .select('strength')
    .eq('id', capabilityId)
    .single()

  if (!capability) return

  const newStrength = capability.strength + increment

  await supabase
    .from('capabilities')
    .update({
      strength: newStrength,
      last_used: new Date().toISOString()
    })
    .eq('id', capabilityId)

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
 * Helper: Penalize capability combination
 */
async function penalizeCombination(capabilityIds: string[], penalty: number) {
  const sortedIds = [...capabilityIds].sort()

  const { data: combo } = await supabase
    .from('capability_combinations')
    .select('*')
    .eq('capability_ids', sortedIds)
    .single()

  if (!combo) return

  await supabase
    .from('capability_combinations')
    .update({
      times_rated_negative: combo.times_rated_negative + 1,
      penalty_score: combo.penalty_score + penalty
    })
    .eq('capability_ids', sortedIds)
}
