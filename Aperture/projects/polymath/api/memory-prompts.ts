import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface MemoryPrompt {
  id: string
  prompt_text: string
  prompt_description: string | null
  category: string
  priority_order: number | null
  is_required: boolean
  created_at: string
}

interface MemoryPromptWithStatus extends MemoryPrompt {
  status?: 'pending' | 'completed' | 'dismissed' | 'suggested'
  response?: any
}

/**
 * Memory Prompts API
 * GET /api/memory-prompts - List all prompts with user status (requires x-user-id header)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const userId = req.headers['x-user-id'] as string | undefined

    // Fetch all prompts
    const { data: prompts, error: promptsError } = await supabase
      .from('memory_prompts')
      .select('*')
      .order('priority_order', { ascending: true })

    if (promptsError) {
      console.error('[api/memory-prompts] Fetch error:', promptsError)
      return res.status(500).json({ error: 'Failed to fetch prompts' })
    }

    // If no user, return prompts with pending status
    if (!userId) {
      const required = prompts.filter(p => p.is_required)
      const optional = prompts.filter(p => !p.is_required)

      return res.status(200).json({
        required: required.map(p => ({ ...p, status: 'pending' })),
        suggested: [],
        optional: optional.map(p => ({ ...p, status: 'pending' })),
        progress: {
          completed_required: 0,
          total_required: required.length,
          completed_total: 0,
          total_prompts: prompts.length,
          completion_percentage: 0,
          has_unlocked_projects: false
        }
      })
    }

    // Fetch user's prompt statuses
    const { data: userStatuses, error: statusError } = await supabase
      .from('user_prompt_status')
      .select(`
        *,
        response:memory_responses(*)
      `)
      .eq('user_id', userId)

    if (statusError) {
      console.error('[api/memory-prompts] Status fetch error:', statusError)
    }

    // Create status map
    const statusMap = new Map(
      (userStatuses || []).map(s => [s.prompt_id, s])
    )

    // Enrich prompts with status
    const enrichedPrompts: MemoryPromptWithStatus[] = prompts.map(prompt => {
      const userStatus = statusMap.get(prompt.id)
      return {
        ...prompt,
        status: userStatus?.status || 'pending',
        response: userStatus?.response || undefined
      }
    })

    // Categorize prompts
    const required = enrichedPrompts.filter(p => p.is_required)
    const optional = enrichedPrompts.filter(p => !p.is_required && p.status !== 'suggested')
    const suggested = enrichedPrompts.filter(p => p.status === 'suggested')

    // Calculate progress
    const completedRequired = required.filter(p => p.status === 'completed').length
    const completedTotal = enrichedPrompts.filter(p => p.status === 'completed').length
    const totalRequired = required.length
    const completionPercentage = totalRequired > 0
      ? Math.round((completedRequired / totalRequired) * 100)
      : 0

    return res.status(200).json({
      required,
      suggested,
      optional,
      progress: {
        completed_required: completedRequired,
        total_required: totalRequired,
        completed_total: completedTotal,
        total_prompts: prompts.length,
        completion_percentage: completionPercentage,
        has_unlocked_projects: completedRequired >= totalRequired
      }
    })

  } catch (error) {
    console.error('[api/memory-prompts] Unexpected error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
