/**
 * Daily Actionable Queue API
 * Returns max 3 projects scored for today's context
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

  if (daysSinceActive === 0) return 30 // Worked on today
  if (daysSinceActive === 1) return 30 // Worked on yesterday
  if (daysSinceActive === 2) return 25 // Day before yesterday
  if (daysSinceActive <= 7) return 15 // Within last week
  return 0 // No momentum
}

function calculateStaleness(project: any): number {
  const lastActive = new Date(project.last_active)
  const now = new Date()
  const daysSinceActive = daysBetween(lastActive, now)

  // Sweet spot: stale enough to need attention, not dead
  if (daysSinceActive >= 14 && daysSinceActive <= 30) return 25
  if (daysSinceActive >= 7 && daysSinceActive < 14) return 15

  // Too stale = probably dead, lower priority
  if (daysSinceActive > 30 && daysSinceActive <= 60) return 10
  if (daysSinceActive > 60) return 0 // Likely abandoned

  return 0 // Recent projects don't get staleness bonus
}

function calculateFreshness(project: any): number {
  const createdAt = new Date(project.created_at)
  const now = new Date()
  const age = daysBetween(createdAt, now)

  if (age <= 3) return 20 // Brand new
  if (age <= 7) return 15 // Still fresh
  if (age <= 14) return 10 // Fading novelty
  return 0 // Not new anymore
}

function calculateAlignment(project: any, context: UserContext): number {
  let score = 0

  // Energy match (most important)
  const projectEnergy = project.energy_level || 'moderate'
  if (projectEnergy === context.current_energy) {
    score += 10
  } else if (projectEnergy === 'low' && context.current_energy === 'moderate') {
    score += 5 // Low energy projects ok when moderate
  }

  // Time match
  const estimatedTime = project.estimated_next_step_time || 60 // default 1hr
  const timeMatches = (
    (context.available_time === 'quick' && estimatedTime <= 30) ||
    (context.available_time === 'moderate' && estimatedTime <= 120) ||
    (context.available_time === 'deep' && estimatedTime > 60)
  )
  if (timeMatches) score += 5

  // Context match (location, tools)
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

  // 1. Hot Streak (highest momentum score)
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

  // 2. Needs Attention (highest staleness score, not in queue yet)
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

  // 3. Fresh Energy (highest freshness score, not in queue yet)
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

  // 4. Fill remaining slots with highest total score (if queue < 3)
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
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    // Get user ID
    const userId = process.env.USER_ID || 'default-user'

    // Fetch user context (or use defaults)
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

    // Fetch all active projects
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

    // Score all projects
    const scores = projects.map(project => scoreProject(project, context))

    // Select daily queue (max 3)
    const queue = selectDailyQueue(scores)

    console.log(`[daily-queue] Generated queue with ${queue.length} projects for user ${userId}`)

    return res.status(200).json({
      queue,
      context,
      total_projects: projects.length
    })

  } catch (error) {
    console.error('[daily-queue] Unexpected error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
