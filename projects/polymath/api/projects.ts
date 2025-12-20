/**
 * Consolidated Projects API
 * Handles projects CRUD, daily queue, context, and suggestions
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './_lib/supabase.js'
import { getUserId } from './_lib/auth.js'
import { z } from 'zod'
import { generateEmbedding, cosineSimilarity } from './_lib/gemini-embeddings.js'
import { generateText } from './_lib/gemini-chat.js'
import { generateBedtimePrompts, generateCatalystPrompts, generateBreakPrompts } from './_lib/bedtime-ideas.js'
import { extractCapabilities } from './_lib/capabilities-extraction.js'
import { analyzeTaskEnergy } from './_lib/task-energy-analyzer.js'
import { identifyRottingProjects, generateZebraReport, buryProject, resurrectProject } from './_lib/project-maintenance.js'

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

  let total_score = momentum + staleness + freshness + alignment + unlock_bonus
  let match_reason = 'Good fit for today'
  let category: ProjectScore['category'] = 'available'

  // Anti-Rot Logic
  const lastActive = new Date(project.last_active)
  const daysIdle = daysBetween(lastActive, new Date())
  const hasTasks = project.metadata?.tasks && project.metadata.tasks.length > 0

  if (daysIdle > 14) {
    category = 'needs_attention'
    total_score += 50 // Force to top
    if (hasTasks) {
      match_reason = "Dormant. Commit to just ONE task today."
    } else {
      match_reason = "Stuck? Let's break this down into steps."
    }
  } else if (daysIdle > 7) {
    category = 'needs_attention'
    total_score += 20
    match_reason = "Losing momentum. Do a quick 5 min task."
  } else if (momentum > 20) {
    category = 'hot_streak'
    match_reason = "You're on a roll! Keep it going."
  } else if (freshness > 15) {
    category = 'fresh_energy'
    match_reason = "New project energy. Capitalize on it."
  }

  return {
    project_id: project.id,
    project,
    total_score,
    category,
    match_reason,
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
  // Sort by score (Anti-Rot logic boosts dormant projects to top)
  const sorted = [...scores].sort((a, b) => b.total_score - a.total_score)

  // Take top 3 unique projects
  return sorted.slice(0, 3)
}

async function internalHandler(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabaseClient()
  const userId = getUserId()
  const { resource } = req.query

  // DEFAULT RESOURCE (Projects CRUD)
  if (!resource) {
    // GET /api/projects - List all or Get One
    if (req.method === 'GET') {
      const { id } = req.query

      if (id) {
        const { data: project, error } = await supabase
          .from('projects')
          .select('*')
          .eq('user_id', userId)
          .eq('id', id)
          .single()

        if (error) return res.status(404).json({ error: 'Project not found' })
        return res.status(200).json({ project })
      }

      const { data: projects, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('last_active', { ascending: false })

      if (error) return res.status(500).json({ error: 'Failed to fetch projects' })
      return res.status(200).json({ projects })
    }
  }

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

    // DELETE: Clear all pending suggestions
    if (req.method === 'DELETE' && action === 'clear') {
      try {
        console.log('[suggestions] Clearing pending suggestions for user:', userId)
        const { count, error } = await supabase
          .from('project_suggestions')
          .delete({ count: 'exact' })
          .eq('user_id', userId)
          .eq('status', 'pending')

        if (error) throw error

        return res.status(200).json({ success: true, count })
      } catch (error) {
        return res.status(500).json({ error: 'Failed to clear suggestions' })
      }
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

  // BREAK PROMPTS RESOURCE (Daytime Drift)
  if (resource === 'break') {
    if (req.method === 'GET') {
      try {
        const prompts = await generateBreakPrompts(userId)
        return res.status(200).json({ prompts, generated: true })
      } catch (error) {
        console.error('[break] Error:', error)
        return res.status(500).json({ error: 'Failed to generate break prompts' })
      }
    }
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // NEXT STEPS RESOURCE (AI Suggestions)
  if (resource === 'next-steps') {
    const id = req.query.id as string
    const action = req.query.action as string

    if (!id && req.method !== 'PATCH') {
      return res.status(400).json({ error: 'Project ID required' })
    }

    // GET: Fetch suggestions (auto-generate if stale/missing)
    if (req.method === 'GET') {
      return handleGetNextSteps(req, res, supabase, userId, id)
    }

    // POST: Force regenerate
    if (req.method === 'POST' && action === 'regenerate') {
      return handleGenerateNextSteps(req, res, supabase, userId, id)
    }

    // PATCH: Update status
    if (req.method === 'PATCH') {
      return handleUpdateNextStepStatus(req, res, supabase, userId)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  }

  // KNOWLEDGE MAP RESOURCE - DEPRECATED
  if (resource === 'knowledge_map') {
    return res.status(410).json({ error: 'Knowledge Map feature has been deprecated.' })
  }

  // CAPABILITIES RESOURCE
  if (resource === 'capabilities') {
    const action = req.query.action as string
    const id = req.query.id as string

    if (req.method === 'GET') {
      try {
        const { data, error } = await supabase
          .from('capabilities')
          .select('*')
          .order('strength', { ascending: false })

        if (error) throw error
        return res.status(200).json(data)
      } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch capabilities' })
      }
    }

    if (req.method === 'POST') {
      if (action === 'extract') {
        try {
          console.log('[capabilities] Starting extraction for user:', userId)
          const caps = await extractCapabilities(userId)
          console.log('[capabilities] Extraction complete, found:', caps.length, 'capabilities')
          return res.status(200).json({ success: true, extracted: caps })
        } catch (error) {
          console.error('[capabilities] Extraction error:', error instanceof Error ? error.message : String(error))
          console.error('[capabilities] Error stack:', error instanceof Error ? error.stack : 'No stack')
          return res.status(500).json({
            error: 'Extraction failed',
            details: error instanceof Error ? error.message : String(error)
          })
        }
      }
    }

    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'ID required' })
      try {
        const { error } = await supabase
          .from('capabilities')
          .delete()
          .eq('id', id)

        if (error) throw error
        return res.status(200).json({ success: true })
      } catch (error) {
        return res.status(500).json({ error: 'Delete failed' })
      }
    }

    return res.status(405).json({ error: 'Method not allowed' })
  }

  // REAPER RESOURCE (for managing rotting projects)
  if (resource === 'reaper') {
    const action = req.query.action as string
    const id = req.query.id as string

    // GET: Get rotting projects or generate eulogy
    if (req.method === 'GET') {
      if (action === 'rotting') {
        try {
          const rottingProjects = await identifyRottingProjects(userId)
          return res.status(200).json(rottingProjects)
        } catch (error) {
          console.error('[reaper] Failed to get rotting projects:', error)
          return res.status(500).json({ error: 'Failed to get rotting projects' })
        }
      } else if (action === 'eulogy') {
        if (!id) return res.status(400).json({ error: 'Project ID required' })
        try {
          // Fetch project details for eulogy generation
          const { data: project, error: fetchError } = await supabase
            .from('projects')
            .select('title, description')
            .eq('id', id)
            .eq('user_id', userId)
            .single()

          if (fetchError) throw fetchError
          if (!project) return res.status(404).json({ error: 'Project not found' })

          const zebraReport = await generateZebraReport(project)
          return res.status(200).json({ eulogy: zebraReport }) // Keep key as 'eulogy' or change to 'zebraReport' if frontend is updated. 
          // Actually, I'll keep the key as 'eulogy' for backward compatibility unless I find the frontend.
        } catch (error) {
          console.error('[reaper] Failed to generate eulogy:', error)
          return res.status(500).json({ error: 'Failed to generate eulogy' })
        }
      }
    }

    // POST: Bury or Resurrect a project
    if (req.method === 'POST') {
      if (!id) return res.status(400).json({ error: 'Project ID required' })
      if (action === 'bury') {
        try {
          await buryProject(id, userId)
          return res.status(200).json({ success: true, message: 'Project buried' })
        } catch (error) {
          console.error('[reaper] Failed to bury project:', error)
          return res.status(500).json({ error: 'Failed to bury project' })
        }
      } else if (action === 'resurrect') {
        try {
          await resurrectProject(id, userId)
          return res.status(200).json({ success: true, message: 'Project resurrected' })
        } catch (error) {
          console.error('[reaper] Failed to resurrect project:', error)
          return res.status(500).json({ error: 'Failed to resurrect project' })
        }
      }
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

      // First, fetch the project to get its current state
      const { data: existingProject, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', userId)
        .single()

      if (fetchError) {
        console.error('[PATCH] Failed to fetch project:', fetchError)
        return res.status(500).json({
          error: 'Failed to fetch project',
          details: fetchError.message
        })
      }

      if (!existingProject) {
        return res.status(404).json({ error: 'Project not found' })
      }

      // If metadata with tasks is being updated, analyze new tasks
      if (updates.metadata?.tasks) {
        const newTasks = (updates.metadata.tasks || []) as any[]
        const existingTasks = (existingProject.metadata?.tasks || []) as any[]

        // Find newly added tasks (those not in the existing tasks)
        const addedTasks = newTasks.filter(
          newTask => !existingTasks.some(existingTask => existingTask.id === newTask.id)
        )

        if (addedTasks.length > 0) {
          console.log('[PATCH] Analyzing', addedTasks.length, 'new tasks for energy levels')

          // Analyze each new task in parallel
          const analyzedTasks = await Promise.all(
            addedTasks.map(async (task) => {
              try {
                const analysis = await analyzeTaskEnergy(
                  task.text,
                  existingProject.title,
                  existingProject.description
                )
                return {
                  ...task,
                  energy_level: analysis.energy_level,
                  energy_reasoning: analysis.reasoning
                }
              } catch (error) {
                console.error('[PATCH] Failed to analyze task:', task.text, error)
                return task // Return unmodified if analysis fails
              }
            })
          )

          // Replace the new tasks with analyzed versions
          const updatedNewTasks = newTasks.map(task => {
            const analyzed = analyzedTasks.find(t => t.id === task.id)
            return analyzed || task
          })

          updates.metadata.tasks = updatedNewTasks
          console.log('[PATCH] Task analysis complete, updated tasks with energy levels')
        }
      }

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
      (data || []).map(async (suggestion: any) => {
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

    let data = []
    try {
      const result = await supabase
        .from('bedtime_prompts')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false })

      if (result.error) throw result.error
      data = result.data
    } catch (dbError: any) {
      console.warn('[bedtime] Failed to fetch prompts (table might be missing):', dbError.message)
      // Fallback to generation if table is missing (generation handles storage, might also fail but we'll see)
      // Actually, if table missing, generation storage will also fail.
      // Return empty for now to prevent crash
      return res.status(200).json({
        prompts: [],
        generated: false,
        message: 'Feature unavailable (migration pending)'
      })
    }

    // If no prompts today, check if it's past 9:30pm
    if (!data || data.length === 0) {
      const now = new Date()
      const hour = now.getHours()
      const minute = now.getMinutes()

      // If it's past 9:30pm, generate new prompts
      if (hour >= 21 && minute >= 30) {
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
        details: 'Request body must include "inputs" array'
      })
    }

    if (inputs.length === 0) {
      return res.status(400).json({
        error: 'Invalid inputs',
        details: 'At least one input required'
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

    const prompts = await generateCatalystPrompts(inputs, userId)

    return res.status(201).json({
      prompts,
      generated: true,
      message: `Generated ${prompts.length} catalyst prompts`,
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
/**
 * Next Steps Handlers
 */
async function handleGetNextSteps(req: VercelRequest, res: VercelResponse, supabase: any, userId: string, projectId: string) {
  try {
    // 1. Check for existing pending suggestions
    const { data: existing, error } = await supabase
      .from('project_next_steps')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(3)

    if (error) throw error

    // 2. Check freshness (e.g., 24 hours)
    const isFresh = existing && existing.length > 0 &&
      (new Date().getTime() - new Date(existing[0].created_at).getTime()) < (24 * 60 * 60 * 1000)

    if (isFresh) {
      return res.status(200).json({ suggestions: existing, generated: false })
    }

    // 3. Generate if stale or missing
    console.log('[next-steps] Suggestions stale or missing, generating new ones...')
    const suggestions = await generateNextSteps(projectId, userId, supabase)

    return res.status(200).json({ suggestions, generated: true })

  } catch (error) {
    console.error('[next-steps] Error:', error)
    return res.status(500).json({ error: 'Failed to fetch next steps' })
  }
}

async function handleGenerateNextSteps(req: VercelRequest, res: VercelResponse, supabase: any, userId: string, projectId: string) {
  try {
    const suggestions = await generateNextSteps(projectId, userId, supabase)
    return res.status(200).json({ suggestions, generated: true })
  } catch (error) {
    console.error('[next-steps] Generation error:', error)
    return res.status(500).json({ error: 'Failed to generate next steps' })
  }
}

async function handleUpdateNextStepStatus(req: VercelRequest, res: VercelResponse, supabase: any, userId: string) {
  try {
    const { id, status } = req.body
    if (!id || !status) return res.status(400).json({ error: 'id and status required' })

    const { data, error } = await supabase
      .from('project_next_steps')
      .update({ status })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error

    return res.status(200).json({ success: true, suggestion: data })
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update status' })
  }
}

async function generateNextSteps(projectId: string, userId: string, supabase: any) {
  // 1. Fetch project context
  const { data: project } = await supabase
    .from('projects')
    .select('title, description, metadata')
    .eq('id', projectId)
    .single()

  if (!project) throw new Error('Project not found')

  const tasks = (project.metadata?.tasks || []) as any[]
  const lastTasks = tasks.slice(-3).map(t => `- ${t.text} (${t.done ? 'Done' : 'Pending'})`).join('\n')

  // 2. Prompt Gemini
  const prompt = `You are a pragmatic project manager. Suggest 3 concrete, actionable next steps for this project.
    
Project: ${project.title}
Description: ${project.description || 'No description'}

Recent Activity:
${lastTasks || 'No tasks yet'}

Output strictly as a JSON array of strings. Keep each task under 10 words. Start with a verb.
Example: ["Draft initial outline", "Research competitor pricing", "Email stakeholders"]`

  const response = await generateText(prompt, { responseFormat: 'json', temperature: 0.4 })
  const suggestedTasks = JSON.parse(response)

  if (!Array.isArray(suggestedTasks)) throw new Error('Invalid AI response format')

  // 3. Store in DB
  const inserts = suggestedTasks.map(task => ({
    project_id: projectId,
    user_id: userId,
    suggested_task: task,
    status: 'pending'
  }))

  // Clear old pending ones first (optional, but keeps it clean)
  await supabase
    .from('project_next_steps')
    .update({ status: 'dismissed' })
    .eq('project_id', projectId)
    .eq('status', 'pending')

  const { data, error } = await supabase
    .from('project_next_steps')
    .insert(inserts)
    .select()

  if (error) throw error
  return data
}


// Error handling wrapper
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return await internalHandler(req, res)
  } catch (error: any) {
    console.error('[API Error] Unhandled exception:', error)
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
      stack: error.stack
    })
  }
}
