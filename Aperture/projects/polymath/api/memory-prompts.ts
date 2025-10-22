import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { MemoryPromptsResponse } from '../src/types'

/**
 * GET /api/memory-prompts
 *
 * Returns all memory prompts with user's completion status
 * Categories: required (10), suggested (AI follow-ups), optional (30)
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // TODO: Get user ID from auth
  const userId = req.headers['x-user-id'] as string

  try {
    // Check env vars
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(`Missing env vars: URL=${!!process.env.SUPABASE_URL}, KEY=${!!process.env.SUPABASE_SERVICE_ROLE_KEY}`)
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Fetch all prompts
    const { data: prompts, error: promptsError} = await supabase
      .from('memory_prompts')
      .select('*')
      .order('priority_order', { ascending: true, nullsFirst: false })

    if (promptsError) throw promptsError

    // If no user ID, just return prompts without status
    if (!userId) {
      const required = prompts?.filter(p => p.is_required).map(p => ({
        ...p,
        status: 'pending' as const,
        response: null
      })) || []

      const optional = prompts?.filter(p => !p.is_required).map(p => ({
        ...p,
        status: 'pending' as const,
        response: null
      })) || []

      return res.status(200).json({
        required,
        suggested: [],
        optional,
        progress: {
          completed_required: 0,
          total_required: required.length,
          completed_total: 0,
          total_prompts: prompts?.length || 0,
          completion_percentage: 0,
          has_unlocked_projects: false
        }
      })
    }

    // Fetch user's status for each prompt
    const { data: statuses, error: statusesError } = await supabase
      .from('user_prompt_status')
      .select(`
        *,
        memory_responses (
          id,
          bullets,
          created_at,
          custom_title
        )
      `)
      .eq('user_id', userId)

    if (statusesError) throw statusesError

    // Initialize status for required prompts if not exists
    const requiredPrompts = prompts?.filter(p => p.is_required) || []
    for (const prompt of requiredPrompts) {
      const hasStatus = statuses?.some(s => s.prompt_id === prompt.id)
      if (!hasStatus) {
        await supabase
          .from('user_prompt_status')
          .insert({
            user_id: userId,
            prompt_id: prompt.id,
            status: 'pending'
          })
      }
    }

    // Fetch updated statuses
    const { data: updatedStatuses } = await supabase
      .from('user_prompt_status')
      .select(`
        *,
        memory_responses (
          id,
          bullets,
          created_at,
          custom_title
        )
      `)
      .eq('user_id', userId)

    // Get progress (calculate manually instead of RPC for now)
    const requiredStatuses = updatedStatuses?.filter(s => {
      const prompt = prompts?.find(p => p.id === s.prompt_id)
      return prompt?.is_required
    }) || []

    const completedRequired = requiredStatuses.filter(s => s.status === 'completed').length
    const totalRequired = prompts?.filter(p => p.is_required).length || 10
    const completedTotal = updatedStatuses?.filter(s => s.status === 'completed').length || 0
    const totalPrompts = prompts?.length || 40
    const completionPercentage = totalRequired > 0 ? (completedRequired / totalRequired) * 100 : 0
    const hasUnlocked = completedRequired >= 10

    const progressData = {
      completed_required: completedRequired,
      total_required: totalRequired,
      completed_total: completedTotal,
      total_prompts: totalPrompts,
      completion_percentage: completionPercentage
    }

    // Merge prompts with status
    const statusMap = new Map(
      updatedStatuses?.map(s => [s.prompt_id, s]) || []
    )

    const enrichedPrompts = prompts?.map(p => ({
      ...p,
      status: statusMap.get(p.id)?.status || 'pending',
      response: statusMap.get(p.id)?.memory_responses
    })) || []

    // Categorize
    const required = enrichedPrompts.filter(p => p.is_required)
    const suggested = enrichedPrompts.filter(
      p => p.category === 'ai_suggested' && statusMap.get(p.id)?.status === 'suggested'
    )
    const optional = enrichedPrompts.filter(
      p => !p.is_required && p.category !== 'ai_suggested'
    )

    const response: MemoryPromptsResponse = {
      required,
      suggested,
      optional,
      progress: {
        completed_required: progressData.completed_required,
        total_required: progressData.total_required,
        completed_total: progressData.completed_total,
        total_prompts: progressData.total_prompts,
        completion_percentage: progressData.completion_percentage,
        has_unlocked_projects: hasUnlocked
      }
    }

    return res.status(200).json(response)
  } catch (error) {
    console.error('[memory-prompts] ERROR:', JSON.stringify(error, null, 2))
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    return res.status(500).json({
      error: errorMessage,
      stack: errorStack,
      raw_error: error,
      env_check: {
        has_url: !!process.env.SUPABASE_URL,
        has_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      }
    })
  }
}
