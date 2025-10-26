/**
 * Consolidated Projects API
 * Handles projects CRUD, daily queue, and context
 */

import type { VercelRequest, VercelResponse} from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const USER_ID = 'f2404e61-2010-46c8-8edd-b8a3e702f0fb'

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
  const { resource } = req.query

  // CONTEXT RESOURCE
  if (resource === 'context') {
    if (req.method === 'GET') {
      try {
        const { data, error } = await supabase
          .from('user_daily_context')
          .select('*')
          .eq('user_id', USER_ID)
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
            user_id: USER_ID,
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
        .eq('user_id', USER_ID)
        .single()

      const context: UserContext = contextData || {
        available_time: 'moderate',
        current_energy: 'moderate',
        available_context: ['desk', 'computer']
      }

      const { data: projects, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', USER_ID)
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

  // PROJECTS CRUD (default)
  if (req.method === 'GET') {
    try {
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
        user_id: USER_ID,
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
