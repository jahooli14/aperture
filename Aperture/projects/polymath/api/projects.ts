/**
 * Consolidated Projects API
 * Handles projects CRUD, daily queue, context, and suggestions
 */

import type { VercelRequest, VercelResponse} from '@vercel/node'
import { getSupabaseClient } from './lib/supabase'
import { getUserId } from './lib/auth'
import { z } from 'zod'

// Daily Queue Scoring Logic
interface UserContext {
  available_time: 'quick' | 'moderate' | 'deep'
  current_energy: 'low' | 'moderate' | 'high'
  available_context: string[]
}

interface ProjectScore {
  project_id: string
  project: any
  total_score: number
  category: 'hot_streak' | 'needs_attention' | 'fresh_energy' | 'available'
  match_reason: string
  breakdown: {
    momentum: number
    staleness: number
    freshness: number
    alignment: number
    unlock_bonus: number
  }
}

// Validation schema for rating suggestions
const RateRequestSchema = z.object({
  rating: z.number().int().min(-1).max(2),
  feedback: z.string().optional()
})

function daysBetween(date1: Date, date2: Date): number {
  const diff = date2.getTime() - date1.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function calculateMomentum(project: any): number {
  const lastActive = new Date(project.last_active)
  const now = new Date()
  const daysSinceActive = daysBetween(lastActive, now)

  if (daysSinceActive === 0) return 30
  if (daysSinceActive === 1) return 30
  if (daysSinceActive === 2) return 25
  if (daysSinceActive <= 7) return 15
  return 0
}

function calculateStaleness(project: any): number {
  const lastActive = new Date(project.last_active)
  const now = new Date()
  const daysSinceActive = daysBetween(lastActive, now)

  if (daysSinceActive >= 14 && daysSinceActive <= 30) return 25
  if (daysSinceActive >= 7 && daysSinceActive < 14) return 15
  if (daysSinceActive > 30 && daysSinceActive <= 60) return 10
  if (daysSinceActive > 60) return 0

  return 0
}

function calculateFreshness(project: any): number {
  const createdAt = new Date(project.created_at)
  const now = new Date()
  const age = daysBetween(createdAt, now)

  if (age <= 3) return 20
  if (age <= 7) return 15
  if (age <= 14) return 10
  return 0
}

function calculateAlignment(project: any, context: UserContext): number {
  let score = 0

  const projectEnergy = project.energy_level || 'moderate'
  if (projectEnergy === context.current_energy) {
    score += 10
  } else if (projectEnergy === 'low' && context.current_energy === 'moderate') {
    score += 5
  }

  const estimatedTime = project.estimated_next_step_time || 60
  const timeMatches = (
    (context.available_time === 'quick' && estimatedTime <= 30) ||
    (context.available_time === 'moderate' && estimatedTime <= 120) ||
    (context.available_time === 'deep' && estimatedTime > 60)
  )
  if (timeMatches) score += 5

  const requirements = project.context_requirements || []
  const requirementsMet = requirements.every((req: string) =>
    context.available_context.includes(req)
  )
  if (requirementsMet) score += 5

  return score
}

function calculateUnlockBonus(project: any): number {
  if (project.recently_unblocked) return 5
  const blockers = project.blockers || []
  if (blockers.length === 0 && project.had_blockers_before) return 3
  return 0
}

function scoreProject(project: any, context: UserContext): ProjectScore {
  const momentum = calculateMomentum(project)
  const staleness = calculateStaleness(project)
  const freshness = calculateFreshness(project)
  const alignment = calculateAlignment(project, context)
  const unlock_bonus = calculateUnlockBonus(project)

  const total_score = momentum + staleness + freshness + alignment + unlock_bonus

  return {
    project_id: project.id,
    project,
    total_score,
    category: 'available',
    match_reason: 'Good fit for today',
    breakdown: {
      momentum,
      staleness,
      freshness,
      alignment,
      unlock_bonus
    }
  }
}

function selectDailyQueue(scores: ProjectScore[]): ProjectScore[] {
  const queue: ProjectScore[] = []

  const hotStreak = scores
    .filter(s => s.breakdown.momentum >= 25)
    .sort((a, b) => b.breakdown.momentum - a.breakdown.momentum)[0]

  if (hotStreak) {
    const lastActive = new Date(hotStreak.project.last_active)
    const daysAgo = daysBetween(lastActive, new Date())
    hotStreak.category = 'hot_streak'
    hotStreak.match_reason = daysAgo === 0
      ? 'Worked on today - keep it going!'
      : `Worked on ${daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`} - keep momentum!`
    queue.push(hotStreak)
  }

  const needsAttention = scores
    .filter(s =>
      s.breakdown.staleness >= 15 &&
      !queue.find(q => q.project_id === s.project_id)
    )
    .sort((a, b) => b.breakdown.staleness - a.breakdown.staleness)[0]

  if (needsAttention && queue.length < 3) {
    const lastActive = new Date(needsAttention.project.last_active)
    const daysIdle = daysBetween(lastActive, new Date())
    needsAttention.category = 'needs_attention'
    needsAttention.match_reason = `${daysIdle} days idle - needs attention`
    queue.push(needsAttention)
  }

  const freshEnergy = scores
    .filter(s =>
      s.breakdown.freshness >= 10 &&
      !queue.find(q => q.project_id === s.project_id)
    )
    .sort((a, b) => b.breakdown.freshness - a.breakdown.freshness)[0]

  if (freshEnergy && queue.length < 3) {
    freshEnergy.category = 'fresh_energy'
    freshEnergy.match_reason = 'New project - explore the energy!'
    queue.push(freshEnergy)
  }

  while (queue.length < 3) {
    const next = scores
      .filter(s => !queue.find(q => q.project_id === s.project_id))
      .sort((a, b) => b.total_score - a.total_score)[0]

    if (!next) break

    next.category = 'available'
    next.match_reason = 'Good match for your context'
    queue.push(next)
  }

  return queue
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabaseClient()
  const userId = getUserId()
  const { resource } = req.query

  // PRIORITY ENDPOINT - Set project as priority (PATCH /api/projects/:id/priority)
  if (req.method === 'PATCH' && req.url?.includes('/priority')) {
    try {
      // Extract ID from URL path like /api/projects/abc-123/priority
      const match = req.url.match(/\/projects\/([^\/]+)\/priority/)
      if (!match) {
        return res.status(400).json({ error: 'Invalid priority endpoint format' })
      }

      const projectId = match[1]

      // Set this project as priority (database trigger will unset others)
      const { data, error } = await supabase
        .from('projects')
        .update({ is_priority: true, last_active: new Date().toISOString() })
        .eq('id', projectId)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        return res.status(500).json({ error: 'Failed to set priority', details: error.message })
      }

      if (!data) {
        return res.status(404).json({ error: 'Project not found' })
      }

      return res.status(200).json(data)
    } catch (error: any) {
      return res.status(500).json({
        error: 'Failed to set priority',
        details: error?.message || 'Unknown error'
      })
    }
  }

  // SET-PRIORITY RESOURCE - Atomically set one project as priority
  if (resource === 'set-priority') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
      const { project_id } = req.body

      if (!project_id) {
        return res.status(400).json({ error: 'project_id is required' })
      }

      // Verify project exists and belongs to user
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, title, is_priority')
        .eq('id', project_id)
        .eq('user_id', userId)
        .single()

      console.log('[set-priority] Project lookup result:', { project, projectError })

      if (projectError) {
        console.error('[set-priority] Project lookup error:', JSON.stringify(projectError, null, 2))
        return res.status(500).json({
          error: 'Database error during project lookup',
          details: projectError.message,
          code: projectError.code
        })
      }

      if (!project) {
        console.error('[set-priority] Project not found:', project_id)
        return res.status(404).json({ error: 'Project not found' })
      }

      console.log('[set-priority] Step 3: Clearing all priorities for user:', userId)
      // Atomic operation: clear all priorities, then set the one
      const { data: clearedData, error: clearError } = await supabase
        .from('projects')
        .update({ is_priority: false })
        .eq('user_id', userId)
        .select('id, title, is_priority')

      console.log('[set-priority] Clear result:', { clearedData, clearError })

      if (clearError) {
        console.error('[set-priority] Clear error FULL:', JSON.stringify(clearError, null, 2))
        return res.status(500).json({
          error: 'Failed to clear priorities',
          details: clearError.message,
          code: clearError.code,
          hint: clearError.hint
        })
      }

      console.log('[set-priority] Step 4: Setting priority on project:', project_id)
      // Step 2: Set priority on the specified project
      const { data: updatedProject, error: setError } = await supabase
        .from('projects')
        .update({ is_priority: true })
        .eq('id', project_id)
        .eq('user_id', userId)
        .select()
        .single()

      console.log('[set-priority] Set result:', { updatedProject, setError })

      if (setError) {
        console.error('[set-priority] Set error FULL:', JSON.stringify(setError, null, 2))
        return res.status(500).json({
          error: 'Failed to set priority',
          details: setError.message,
          code: setError.code,
          hint: setError.hint
        })
      }

      console.log('[set-priority] Step 5: Fetching all projects')
      // Return all projects so the client can refresh
      const { data: allProjects, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('[set-priority] Fetch error:', JSON.stringify(fetchError, null, 2))
        return res.status(500).json({
          error: 'Failed to fetch projects after update',
          details: fetchError.message
        })
      }

      console.log('[set-priority] SUCCESS! Returning', allProjects?.length, 'projects')
      return res.status(200).json({
        success: true,
        updated_project: updatedProject,
        projects: allProjects || []
      })
    } catch (error) {
      console.error('[set-priority] UNEXPECTED ERROR:', error)
      console.error('[set-priority] Error stack:', error instanceof Error ? error.stack : 'No stack')
      return res.status(500).json({
        error: 'Failed to set priority',
        details: error instanceof Error ? error.message : JSON.stringify(error)
      })
    }
  }

  // SUGGESTIONS RESOURCE (merged from suggestions.ts)
  if (resource === 'suggestions') {
    const action = req.query.action as string
    const id = req.query.id as string

    // GET: List suggestions
    if (req.method === 'GET') {
      return handleListSuggestions(req, res, supabase, userId)
    }

    // POST: Rate suggestion
    if (req.method === 'POST' && action === 'rate') {
      return handleRateSuggestion(req, res, id, supabase, userId)
    }

    // POST: Build project from suggestion
    if (req.method === 'POST' && action === 'build') {
      return handleBuildFromSuggestion(req, res, id, supabase, userId)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  }

  // CONTEXT RESOURCE
  if (resource === 'context') {
    if (req.method === 'GET') {
      try {
        const { data, error } = await supabase
          .from('user_daily_context')
          .select('*')
          .eq('user_id', userId)
          .single()

        if (error && error.code !== 'PGRST116') {
          console.error('[context] Query error:', error)
          return res.status(500).json({ error: error.message })
        }

        const context: UserContext = data || {
          available_time: 'moderate',
          current_energy: 'moderate',
          available_context: ['desk', 'computer']
        }

        return res.status(200).json({ context })
      } catch (error) {
        console.error('[context] Error:', error)
        return res.status(500).json({ error: 'Internal server error' })
      }
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      try {
        const { available_time, current_energy, available_context } = req.body

        if (available_time && !['quick', 'moderate', 'deep'].includes(available_time)) {
          return res.status(400).json({
            error: 'Invalid available_time. Must be: quick, moderate, or deep'
          })
        }

        if (current_energy && !['low', 'moderate', 'high'].includes(current_energy)) {
          return res.status(400).json({
            error: 'Invalid current_energy. Must be: low, moderate, or high'
          })
        }

        if (available_context && !Array.isArray(available_context)) {
          return res.status(400).json({
            error: 'Invalid available_context. Must be an array'
          })
        }

        const { data, error } = await supabase
          .from('user_daily_context')
          .upsert({
            user_id: userId,
            available_time: available_time || 'moderate',
            current_energy: current_energy || 'moderate',
            available_context: available_context || ['desk', 'computer'],
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (error) {
          console.error('[context] Upsert error:', error)
          return res.status(500).json({ error: error.message })
        }

        return res.status(200).json({ context: data })
      } catch (error) {
        console.error('[context] Error:', error)
        return res.status(500).json({ error: 'Internal server error' })
      }
    }

    return res.status(405).json({ error: 'Method not allowed' })
  }

  // DAILY QUEUE RESOURCE
  if (resource === 'daily-queue') {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
      const { data: contextData } = await supabase
        .from('user_daily_context')
        .select('*')
        .eq('user_id', userId)
        .single()

      const context: UserContext = contextData || {
        available_time: 'moderate',
        current_energy: 'moderate',
        available_context: ['desk', 'computer']
      }

      const { data: projects, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('last_active', { ascending: false })

      if (error) {
        console.error('[daily-queue] Query error:', error)
        return res.status(500).json({ error: error.message })
      }

      if (!projects || projects.length === 0) {
        return res.status(200).json({
          queue: [],
          context,
          total_projects: 0
        })
      }

      const scores = projects.map(project => scoreProject(project, context))
      const queue = selectDailyQueue(scores)

      return res.status(200).json({
        queue,
        context,
        total_projects: projects.length
      })
    } catch (error) {
      console.error('[daily-queue] Error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  // NOTES RESOURCE
  if (resource === 'notes') {
    if (req.method === 'POST') {
      try {
        const { project_id, bullets, note_type } = req.body

        if (!project_id || !bullets || !Array.isArray(bullets)) {
          return res.status(400).json({
            error: 'project_id and bullets array required'
          })
        }

        const { data, error } = await supabase
          .from('project_notes')
          .insert([{
            project_id,
            user_id: userId,
            bullets,
            created_at: new Date().toISOString()
          }])
          .select()
          .single()

        if (error) throw error

        // Update project last_active
        await supabase
          .from('projects')
          .update({ last_active: new Date().toISOString() })
          .eq('id', project_id)

        return res.status(201).json({
          success: true,
          note: { ...data, note_type }
        })
      } catch (error) {
        console.error('[notes] Failed to create note:', error)
        return res.status(500).json({ error: 'Failed to create note' })
      }
    }

    return res.status(405).json({ error: 'Method not allowed' })
  }

  // PROJECTS CRUD (default)
  if (req.method === 'GET') {
    try {
      const { id, include_notes } = req.query

      // Single project with notes
      if (id && typeof id === 'string') {
        const { data: project, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', id)
          .eq('user_id', userId)
          .single()

        if (projectError) throw projectError

        if (!project) {
          return res.status(404).json({ error: 'Project not found' })
        }

        // Fetch notes if requested
        let notes = []
        if (include_notes === 'true') {
          const { data: notesData, error: notesError } = await supabase
            .from('project_notes')
            .select('*')
            .eq('project_id', id)
            .order('created_at', { ascending: false })

          if (notesError) throw notesError
          notes = notesData || []
        }

        return res.status(200).json({
          success: true,
          project,
          notes
        })
      }

      // List all projects
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      return res.status(200).json({ projects: data || [] })
    } catch (error) {
      console.error('Failed to fetch projects:', error)
      return res.status(500).json({ error: 'Failed to fetch projects' })
    }
  }

  if (req.method === 'POST') {
    try {
      const projectData = {
        ...req.body,
        user_id: userId,
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('projects')
        .insert([projectData])
        .select()
        .single()

      if (error) {
        console.error('[projects] Insert error:', error)
        throw error
      }

      return res.status(201).json(data)
    } catch (error) {
      console.error('[projects] Failed to create project:', error)
      return res.status(500).json({
        error: 'Failed to create project',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    try {
      const { id, ...updates } = req.body

      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      return res.status(200).json(data)
    } catch (error) {
      console.error('Failed to update project:', error)
      return res.status(500).json({ error: 'Failed to update project' })
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.query

      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id)

      if (error) throw error

      return res.status(204).send('')
    } catch (error) {
      console.error('Failed to delete project:', error)
      return res.status(500).json({ error: 'Failed to delete project' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

/**
 * List suggestions (merged from suggestions.ts)
 */
async function handleListSuggestions(req: VercelRequest, res: VercelResponse, supabase: any, userId: string) {
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
 * Rate a suggestion (merged from suggestions.ts)
 */
async function handleRateSuggestion(req: VercelRequest, res: VercelResponse, id: string, supabase: any, userId: string) {
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
        await incrementCapabilityStrength(capabilityId, 0.05, supabase)
      }
    } else if (suggestion.capability_ids) {
      await penalizeCombination(suggestion.capability_ids, 0.1, supabase)
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
 * Build a project from suggestion (merged from suggestions.ts)
 */
async function handleBuildFromSuggestion(req: VercelRequest, res: VercelResponse, id: string, supabase: any, userId: string) {
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
      await incrementCapabilityStrength(capabilityId, 0.3, supabase)
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
 * Helper: Increment capability strength (merged from suggestions.ts)
 */
async function incrementCapabilityStrength(capabilityId: string, increment: number, supabase: any) {
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
 * Helper: Penalize capability combination (merged from suggestions.ts)
 */
async function penalizeCombination(capabilityIds: string[], penalty: number, supabase: any) {
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
