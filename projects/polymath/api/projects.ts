/**
 * Consolidated Projects API
 * Handles projects CRUD, daily queue, context, and suggestions
 */

import type { VercelRequest, VercelResponse} from '@vercel/node'
import { getSupabaseClient } from './lib/supabase.js'
import { getUserId } from './lib/auth.js'
import { z } from 'zod'
import { generateEmbedding, cosineSimilarity } from './lib/gemini-embeddings.js'

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

  // PRIORITY RESOURCE - Set project as priority (PATCH /api/projects?resource=priority&id={id})
  if (resource === 'priority' && req.method === 'PATCH') {
    try {
      // Frontend sends: PATCH projects/{id}/priority
      // apiClient converts to: PATCH /api/projects?resource=priority&id={id}
      const projectId = req.query.id as string

      if (!projectId) {
        return res.status(400).json({ error: 'Project ID required in query parameter' })
      }

      console.log('[priority] Setting priority for project:', projectId)

      // Set this project as priority
      const { data, error } = await supabase
        .from('projects')
        .update({ is_priority: true, last_active: new Date().toISOString() })
        .eq('id', projectId)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        console.error('[priority] Update error:', error)
        return res.status(500).json({ error: 'Failed to set priority', details: error.message })
      }

      if (!data) {
        console.error('[priority] Project not found:', projectId)
        return res.status(404).json({ error: 'Project not found' })
      }

      console.log('[priority] Successfully set priority')
      return res.status(200).json(data)
    } catch (error: any) {
      console.error('[priority] Unexpected error:', error)
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

  // BEDTIME IDEAS RESOURCE (merged from bedtime.ts)
  if (resource === 'bedtime') {
    const action = req.query.action as string

    // GET - Fetch today's prompts (or latest)
    if (req.method === 'GET') {
      return handleGetBedtimePrompts(req, res, supabase, userId)
    }

    // POST - Generate new prompts (manual trigger or catalyst prompts)
    if (req.method === 'POST') {
      // Catalyst prompts endpoint: POST with inputs array
      if (action === 'catalyst') {
        return handleGenerateCatalystPrompts(req, res, supabase, userId)
      }
      // Standard bedtime prompts
      return handleGenerateBedtimePrompts(req, res, supabase, userId)
    }

    // PATCH - Mark prompts as viewed
    if (req.method === 'PATCH') {
      return handleMarkBedtimeViewed(req, res, supabase, userId)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  }

  // KNOWLEDGE MAP RESOURCE
  if (resource === 'knowledge_map') {
    const action = req.query.action as string

    try {
      // GET: Load map state or generate initial map
      if (req.method === 'GET') {
        if (action === 'suggestions') {
          // Generate door suggestions
          const { data: mapState, error: fetchError } = await supabase
            .from('knowledge_map_state')
            .select('map_data')
            .eq('user_id', userId)
            .single()

          if (fetchError) {
            if (fetchError.code === '42P01') {
              return res.status(503).json({
                error: 'Database table knowledge_map_state does not exist',
                hint: 'Please run the migration: supabase/migrations/create_knowledge_map.sql'
              })
            }
            throw fetchError
          }

          if (!mapState) {
            return res.status(404).json({ error: 'Map not found' })
          }

          // Import and use the suggestions logic
          const { generateDoorSuggestions } = await import('./lib/map-suggestions.js')
          const doors = await generateDoorSuggestions(userId, mapState.map_data)
          return res.status(200).json({ doors })
        }

        // Default: Load existing map or generate initial
        const { data: existingMap, error: loadError } = await supabase
          .from('knowledge_map_state')
          .select('*')
          .eq('user_id', userId)
          .single()

        // Check for table not found error
        if (loadError && loadError.code === '42P01') {
          return res.status(503).json({
            error: 'Database table knowledge_map_state does not exist',
            hint: 'Please run the migration: supabase/migrations/create_knowledge_map.sql',
            migrationFile: 'supabase/migrations/create_knowledge_map.sql'
          })
        }

        if (existingMap) {
          return res.status(200).json({
            mapData: existingMap.map_data,
            version: existingMap.version
          })
        }

        // No map exists - generate initial
        const { generateInitialMap } = await import('./lib/map-generation.js')
        const initialMap = await generateInitialMap(userId)

        // Save it
        const { error: insertError } = await supabase
          .from('knowledge_map_state')
          .insert({
            user_id: userId,
            map_data: initialMap,
            version: 1
          })

        if (insertError) {
          if (insertError.code === '42P01') {
            return res.status(503).json({
              error: 'Database table knowledge_map_state does not exist',
              hint: 'Please run the migration: supabase/migrations/create_knowledge_map.sql'
            })
          }
          throw insertError
        }

        return res.status(200).json({
          mapData: initialMap,
          version: 1,
          generated: true
        })
      }
    } catch (error) {
      console.error('[knowledge_map] Error:', error)
      return res.status(500).json({
        error: 'Knowledge map operation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // POST: Save map state
    if (req.method === 'POST') {
      const { mapData } = req.body

      const { error } = await supabase
        .from('knowledge_map_state')
        .upsert({
          user_id: userId,
          map_data: mapData,
          version: mapData.version,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })

      if (error) throw error

      return res.status(200).json({ success: true })
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
      const { id, include_notes, filter } = req.query

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

      // List all projects with optional status filtering
      let query = supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      // Apply status filter if provided
      if (filter && filter !== 'all') {
        if (filter === 'upcoming') {
          query = query.eq('status', 'upcoming')
        } else if (filter === 'active') {
          query = query.eq('status', 'active')
        } else if (filter === 'dormant') {
          query = query.in('status', ['dormant', 'on-hold', 'maintaining'])
        } else if (filter === 'completed') {
          query = query.eq('status', 'completed')
        }
      }

      const { data, error } = await query

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
        type: req.body.type || 'hobby', // Default to hobby if not provided
        user_id: userId,
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
      }

      const { data: project, error } = await supabase
        .from('projects')
        .insert([projectData])
        .select()
        .single()

      if (error) {
        console.error('[projects] Insert error:', error)

        // Check for constraint violation on type
        if (error.message?.includes('projects_type_check') || error.code === '23514') {
          return res.status(400).json({
            error: 'Invalid project type',
            details: `Type must be one of: 'creative', 'technical', or 'learning'. Received: '${projectData.type}'`,
            suggestion: 'Valid types: creative (artistic/hobby), technical (coding/building), learning (educational)'
          })
        }

        throw error
      }

      // Generate embedding and auto-suggest connections asynchronously (don't block response)
      // Return project immediately, then process connections in background
      const embeddingPromise = generateProjectEmbeddingAndConnect(project.id, project.title, project.description, userId)
        .catch(err => console.error('[projects] Async embedding/connection error:', err))

      return res.status(201).json({
        ...project,
        _meta: {
          processing_connections: true,
          message: 'AI is finding related items in the background'
        }
      })
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
      const projectId = req.query.id as string

      if (!projectId) {
        return res.status(400).json({ error: 'Project ID required in query parameter' })
      }

      // Remove id from updates if present in body
      const { id: _bodyId, ...updates } = req.body

      console.log('[PATCH] Updating project:', projectId, 'with data:', updates)

      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        console.error('[PATCH] Supabase error:', error)
        return res.status(500).json({
          error: 'Failed to update project',
          details: error.message,
          code: error.code
        })
      }

      if (!data) {
        return res.status(404).json({ error: 'Project not found' })
      }

      console.log('[PATCH] Successfully updated project')
      return res.status(200).json(data)
    } catch (error) {
      console.error('[PATCH] Unexpected error:', error)
      return res.status(500).json({
        error: 'Failed to update project',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
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

      return res.status(204).end()
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
    console.log('[rate] Rating suggestion:', id, 'Body:', req.body)

    const parseResult = RateRequestSchema.safeParse(req.body)
    if (!parseResult.success) {
      console.error('[rate] Validation failed:', parseResult.error)
      return res.status(400).json({
        error: 'Invalid rating. Must be: -1 (meh), 1 (spark), or 2 (built)',
        details: parseResult.error
      })
    }

    const { rating, feedback } = parseResult.data
    console.log('[rate] Parsed rating:', rating, 'feedback:', feedback)

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
      console.error('[rate] Rating insert error:', ratingError)
      return res.status(500).json({ error: ratingError.message, details: ratingError })
    }

    console.log('[rate] Rating stored:', ratingData)

    // Update suggestion status
    // Map ratings to database-allowed statuses: pending, rated, built, dismissed, saved
    let newStatus: string
    if (rating === 2) {
      newStatus = 'built'  // User wants to build this
    } else if (rating === 1) {
      newStatus = 'rated'  // User likes it (spark)
    } else {
      newStatus = 'dismissed'  // User doesn't want it (meh)
    }
    console.log('[rate] Setting status to:', newStatus)

    const { data: suggestion, error: updateError } = await supabase
      .from('project_suggestions')
      .update({ status: newStatus })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('[rate] Suggestion update error:', updateError)
      return res.status(500).json({ error: updateError.message, details: updateError })
    }

    console.log('[rate] Suggestion updated:', suggestion)

    // Learn from rating
    try {
      if (rating > 0) {
        console.log('[rate] Incrementing capability strengths for positive rating')
        for (const capabilityId of suggestion.capability_ids || []) {
          await incrementCapabilityStrength(capabilityId, 0.05, supabase)
        }
      } else if (suggestion.capability_ids && suggestion.capability_ids.length > 0) {
        console.log('[rate] Penalizing combination for negative rating')
        await penalizeCombination(suggestion.capability_ids, 0.1, supabase)
      }
    } catch (learningError) {
      console.error('[rate] Learning error (non-fatal):', learningError)
      // Don't fail the request if learning fails
    }

    console.log('[rate] Successfully rated suggestion')
    return res.status(200).json({
      success: true,
      rating: ratingData,
      updated_suggestion: {
        id: suggestion.id,
        status: suggestion.status
      }
    })

  } catch (error) {
    console.error('[rate] Unexpected error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
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
    const projectType = metadata.type || (hasCapabilities ? 'side-project' : 'hobby')

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
 * Generate embedding for a project and auto-suggest/create connections
 * Runs asynchronously after project creation
 */
async function generateProjectEmbeddingAndConnect(
  projectId: string,
  title: string,
  description: string | null,
  userId: string
) {
  const supabase = getSupabaseClient()

  try {
    console.log(`[projects] Generating embedding for project ${projectId}`)

    // Generate embedding from title + description
    const content = `${title}\n\n${description || ''}`
    const embedding = await generateEmbedding(content)

    // Store embedding in database
    const { error: updateError } = await supabase
      .from('projects')
      .update({ embedding })
      .eq('id', projectId)

    if (updateError) {
      console.error('[projects] Failed to store embedding:', updateError)
      return
    }

    console.log(`[projects] Embedding stored, finding connections...`)

    // Find related items across all types
    const candidates = await findRelatedItemsForProject(projectId, userId, embedding, content)

    console.log(`[projects] Found ${candidates.length} potential connections`)

    // Auto-link >85%, suggest 55-85% (consistent with memories and articles)
    const autoLinked = []
    const suggestions = []

    for (const candidate of candidates) {
      if (candidate.similarity > 0.85) {
        // Auto-create connection (with deduplication)
        const created = await createConnection(
          'project',
          projectId,
          candidate.type,
          candidate.id,
          'relates_to',
          'ai',
          `${Math.round(candidate.similarity * 100)}% semantic match`
        )
        if (created) {
          autoLinked.push(candidate)
        }
      } else if (candidate.similarity > 0.55) {
        // Store as suggestion
        suggestions.push(candidate)
      }
    }

    console.log(`[projects] Auto-linked ${autoLinked.length}, suggested ${suggestions.length}`)

    // Store suggestions in database
    if (suggestions.length > 0) {
      const suggestionInserts = suggestions.map(s => ({
        from_item_type: 'project',
        from_item_id: projectId,
        to_item_type: s.type,
        to_item_id: s.id,
        reasoning: `${Math.round(s.similarity * 100)}% semantic similarity`,
        confidence: s.similarity,
        user_id: userId,
        status: 'pending'
      }))

      await supabase
        .from('connection_suggestions')
        .insert(suggestionInserts)
    }

  } catch (error) {
    console.error('[projects] Embedding/connection generation failed:', error)
  }
}

/**
 * Find related items for a project using vector similarity
 */
async function findRelatedItemsForProject(
  projectId: string,
  userId: string,
  projectEmbedding: number[],
  projectContent: string
): Promise<Array<{ type: 'project' | 'thought' | 'article'; id: string; title: string; similarity: number }>> {
  const supabase = getSupabaseClient()
  const candidates: Array<{ type: 'project' | 'thought' | 'article'; id: string; title: string; similarity: number }> = []

  // Search other projects
  const { data: projects } = await supabase
    .from('projects')
    .select('id, title, description, embedding')
    .eq('user_id', userId)
    .neq('id', projectId)
    .not('embedding', 'is', null)
    .limit(50)

  if (projects) {
    for (const p of projects) {
      if (p.embedding) {
        const similarity = cosineSimilarity(projectEmbedding, p.embedding)
        // Lowered threshold from 0.7 to 0.55 for consistency across all item types
        if (similarity > 0.55) {
          candidates.push({ type: 'project', id: p.id, title: p.title, similarity })
        }
      }
    }
  }

  // Search thoughts/memories
  const { data: thoughts } = await supabase
    .from('memories')
    .select('id, title, body, embedding')
    .eq('user_id', userId)
    .not('embedding', 'is', null)
    .limit(50)

  if (thoughts) {
    for (const t of thoughts) {
      if (t.embedding) {
        const similarity = cosineSimilarity(projectEmbedding, t.embedding)
        // Lowered threshold from 0.7 to 0.55 for consistency across all item types
        if (similarity > 0.55) {
          candidates.push({ type: 'thought', id: t.id, title: t.title || t.body?.slice(0, 50) + '...', similarity })
        }
      }
    }
  }

  // Search articles (stored in reading_queue table)
  const { data: articles } = await supabase
    .from('reading_queue')
    .select('id, title, excerpt, embedding')
    .eq('user_id', userId)
    .not('embedding', 'is', null)
    .limit(50)

  if (articles) {
    for (const a of articles) {
      if (a.embedding) {
        const similarity = cosineSimilarity(projectEmbedding, a.embedding)
        // Lowered threshold from 0.7 to 0.55 for consistency across all item types
        if (similarity > 0.55) {
          candidates.push({ type: 'article', id: a.id, title: a.title, similarity })
        }
      }
    }
  }

  // Sort by similarity descending
  return candidates.sort((a, b) => b.similarity - a.similarity).slice(0, 10)
}

/**
 * Create a connection between two items (with deduplication)
 */
async function createConnection(
  sourceType: string,
  sourceId: string,
  targetType: string,
  targetId: string,
  connectionType: string,
  createdBy: string,
  reasoning?: string
): Promise<boolean> {
  const supabase = getSupabaseClient()

  // Check if connection already exists (either direction)
  const { data: existing } = await supabase
    .from('connections')
    .select('id')
    .or(`and(source_type.eq.${sourceType},source_id.eq.${sourceId},target_type.eq.${targetType},target_id.eq.${targetId}),and(source_type.eq.${targetType},source_id.eq.${targetId},target_type.eq.${sourceType},target_id.eq.${sourceId})`)
    .maybeSingle()

  if (existing) {
    console.log('[projects] Connection already exists, skipping duplicate')
    return false
  }

  const { error } = await supabase
    .from('connections')
    .insert({
      source_type: sourceType,
      source_id: sourceId,
      target_type: targetType,
      target_id: targetId,
      connection_type: connectionType,
      created_by: createdBy,
      ai_reasoning: reasoning
    })

  if (error) {
    console.error('[projects] Failed to create connection:', error)
    return false
  }

  return true
}

/**
 * Bedtime Prompts Handlers (merged from bedtime.ts)
 */
async function handleGetBedtimePrompts(req: VercelRequest, res: VercelResponse, supabase: any, userId: string) {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data, error } = await supabase
      .from('bedtime_prompts')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false })

    if (error) throw error

    // If no prompts today, check if it's past 9:30pm
    if (!data || data.length === 0) {
      const now = new Date()
      const hour = now.getHours()
      const minute = now.getMinutes()

      // If it's past 9:30pm, generate new prompts
      if (hour >= 21 && minute >= 30) {
        const { generateBedtimePrompts } = await import('../lib/bedtime-ideas.js')
        const prompts = await generateBedtimePrompts(userId)
        return res.status(200).json({
          prompts,
          generated: true,
          message: "Tonight's prompts are ready"
        })
      }

      // Otherwise return empty (too early)
      return res.status(200).json({
        prompts: [],
        generated: false,
        message: `Prompts available at 9:30pm (in ${21 - hour} hours)`
      })
    }

    return res.status(200).json({
      prompts: data,
      generated: false
    })
  } catch (error) {
    console.error('[bedtime] Error:', error)
    return res.status(500).json({
      error: 'Failed to fetch bedtime prompts',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleGenerateBedtimePrompts(req: VercelRequest, res: VercelResponse, supabase: any, userId: string) {
  try {
    const { generateBedtimePrompts } = await import('../lib/bedtime-ideas.js')
    const prompts = await generateBedtimePrompts(userId)
    return res.status(201).json({
      prompts,
      generated: true,
      message: `Generated ${prompts.length} bedtime prompts`
    })
  } catch (error) {
    console.error('[bedtime] Error:', error)
    return res.status(500).json({
      error: 'Failed to generate bedtime prompts',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleGenerateCatalystPrompts(req: VercelRequest, res: VercelResponse, supabase: any, userId: string) {
  try {
    const { inputs } = req.body

    // Validate inputs
    if (!inputs || !Array.isArray(inputs)) {
      return res.status(400).json({
        error: 'Invalid request',
        details: 'Request body must include "inputs" array with 2-3 items'
      })
    }

    if (inputs.length < 2 || inputs.length > 3) {
      return res.status(400).json({
        error: 'Invalid inputs',
        details: 'Catalyst prompts require 2-3 inputs (project, article, or thought)'
      })
    }

    // Validate each input
    for (const input of inputs) {
      if (!input.title || !input.type || !input.id) {
        return res.status(400).json({
          error: 'Invalid input format',
          details: 'Each input must have: title (string), type (project|article|thought), id (string)'
        })
      }
      if (!['project', 'article', 'thought'].includes(input.type)) {
        return res.status(400).json({
          error: 'Invalid input type',
          details: 'Input type must be one of: project, article, thought'
        })
      }
    }

    const { generateCatalystPrompts } = await import('../lib/bedtime-ideas.js')
    const prompts = await generateCatalystPrompts(inputs, userId)

    return res.status(201).json({
      prompts,
      generated: true,
      message: `Generated ${prompts.length} catalyst prompts from ${inputs.length} inputs`,
      inputs
    })
  } catch (error) {
    console.error('[catalyst] Error:', error)
    return res.status(500).json({
      error: 'Failed to generate catalyst prompts',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleMarkBedtimeViewed(req: VercelRequest, res: VercelResponse, supabase: any, userId: string) {
  try {
    const { ids, id, rating, resulted_in_breakthrough } = req.body

    // Handle bulk "mark as viewed" (legacy support)
    if (ids && Array.isArray(ids)) {
      const { error } = await supabase
        .from('bedtime_prompts')
        .update({
          viewed: true,
          viewed_at: new Date().toISOString()
        })
        .in('id', ids)
        .eq('user_id', userId)

      if (error) throw error

      return res.status(200).json({ success: true, updated: ids.length })
    }

    // Handle single prompt update (rating or breakthrough)
    if (!id) {
      return res.status(400).json({ error: 'id or ids required' })
    }

    const updates: any = {}

    if (rating !== undefined) {
      if (typeof rating !== 'number' || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'rating must be a number between 1 and 5' })
      }
      updates.rating = rating
    }

    if (resulted_in_breakthrough !== undefined) {
      if (typeof resulted_in_breakthrough !== 'boolean') {
        return res.status(400).json({ error: 'resulted_in_breakthrough must be a boolean' })
      }
      updates.resulted_in_breakthrough = resulted_in_breakthrough
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No updates provided' })
    }

    const { error } = await supabase
      .from('bedtime_prompts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw error

    return res.status(200).json({ success: true, updated: updates })
  } catch (error) {
    console.error('[bedtime] Error:', error)
    return res.status(500).json({
      error: 'Failed to update bedtime prompt',
      details: error instanceof Error ? error.message : 'Unknown error'
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
  try {
    console.log('[penalize] Penalizing combination:', capabilityIds)
    const sortedIds = [...capabilityIds].sort()

    const { data: combo, error: fetchError } = await supabase
      .from('capability_combinations')
      .select('*')
      .eq('capability_ids', sortedIds)
      .maybeSingle()

    if (fetchError) {
      console.error('[penalize] Error fetching combo:', fetchError)
      throw fetchError
    }

    if (!combo) {
      console.log('[penalize] No combo found for:', sortedIds)
      return
    }

    console.log('[penalize] Found combo:', combo)
    const { error: updateError } = await supabase
      .from('capability_combinations')
      .update({
        times_rated_negative: combo.times_rated_negative + 1,
        penalty_score: combo.penalty_score + penalty
      })
      .eq('capability_ids', sortedIds)

    if (updateError) {
      console.error('[penalize] Error updating combo:', updateError)
      throw updateError
    }

    console.log('[penalize] Successfully penalized combination')
  } catch (error) {
    console.error('[penalize] Unexpected error:', error)
    throw error
  }
}
