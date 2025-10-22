import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseConfig } from '../lib/env.js'
import { logger } from '../lib/logger.js'
import { getMilestoneTimeline } from '../lib/process-memory-with-milestones.js'

const { url, serviceRoleKey } = getSupabaseConfig()
const supabase = createClient(url, serviceRoleKey)

/**
 * API Endpoint: /api/milestones
 *
 * GET - Retrieve milestone timeline and insights
 * Query params:
 *   - child_name (optional): Filter by child name
 *   - domain (optional): Filter by developmental domain
 *   - limit (optional): Number of results (default: 50)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Get user ID from query param (in production, get from auth)
    const userId = req.query.user_id as string
    const childName = req.query.child_name as string | undefined
    const domain = req.query.domain as string | undefined
    const limit = parseInt(req.query.limit as string) || 50

    if (!userId) {
      return res.status(400).json({ error: 'user_id required' })
    }

    logger.info({ user_id: userId, domain, child_name: childName }, 'Fetching milestones')

    // Get complete milestone timeline with insights
    const timeline = await getMilestoneTimeline(userId)

    // Filter by child name if provided
    let filteredMilestones = timeline.milestones
    if (childName) {
      const { data: childProfile } = await supabase
        .from('child_profiles')
        .select('id')
        .eq('user_id', userId)
        .eq('name', childName)
        .single()

      if (!childProfile) {
        return res.status(404).json({ error: 'Child profile not found' })
      }

      // Filter milestones by child (requires child_name field in child_milestones)
      const { data: childMilestones } = await supabase
        .from('child_milestones')
        .select('*')
        .eq('user_id', userId)
        .eq('child_name', childName)

      const childMilestoneIds = new Set(childMilestones?.map(m => m.id) || [])
      filteredMilestones = filteredMilestones.filter(m => childMilestoneIds.has(m.id))
    }

    // Filter by domain if provided
    if (domain) {
      filteredMilestones = filteredMilestones.filter(m => m.domain === domain)
    }

    // Apply limit
    filteredMilestones = filteredMilestones.slice(0, limit)

    // Get recent insights (last 30 days)
    const { data: insights, error: insightsError } = await supabase
      .from('milestone_insights')
      .select('*')
      .eq('user_id', userId)
      .eq('dismissed', false)
      .gte('generated_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('generated_at', { ascending: false })
      .limit(5)

    if (insightsError) {
      logger.warn({ error: insightsError }, 'Failed to fetch insights')
    }

    return res.status(200).json({
      milestones: filteredMilestones,
      insights: timeline.insights,
      recent_insights: insights || [],
      total_count: timeline.milestones.length
    })

  } catch (error) {
    logger.error({ error }, 'Error fetching milestones')
    return res.status(500).json({
      error: 'Failed to fetch milestones',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
