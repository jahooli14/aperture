import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { CreateMemoryResponseInput, SubmitMemoryResponse } from '../src/types'
import { validateBullets } from '../lib/validate-bullets'
import { generateEmbedding } from '../lib/embeddings'
import { detectGaps } from '../lib/gap-detection'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/memory-responses
 *
 * Submit memory response (3+ bullets)
 * - Validates quality with AI
 * - Generates embedding
 * - Updates prompt status
 * - Runs gap detection
 * - Returns updated progress
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const userId = req.headers['x-user-id'] as string
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const input: CreateMemoryResponseInput = req.body
    const { prompt_id, custom_title, bullets } = input

    // Validate bullets
    if (!bullets || bullets.length < 3) {
      return res.status(400).json({ error: 'Minimum 3 bullets required' })
    }

    // Get prompt text for validation
    let promptText = custom_title || 'Untitled'
    if (prompt_id) {
      const { data: prompt } = await supabase
        .from('memory_prompts')
        .select('prompt_text')
        .eq('id', prompt_id)
        .single()

      promptText = prompt?.prompt_text || promptText
    }

    // AI quality check
    const validation = await validateBullets(promptText, bullets)
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message })
    }

    // Generate embedding
    const embeddingText = bullets.join(' ')
    const embedding = await generateEmbedding(embeddingText)

    // Insert response
    const { data: response, error: insertError } = await supabase
      .from('memory_responses')
      .insert({
        user_id: userId,
        prompt_id: prompt_id || null,
        custom_title: custom_title || null,
        bullets,
        is_template: !!prompt_id,
        embedding
      })
      .select()
      .single()

    if (insertError) throw insertError

    // Update prompt status
    if (prompt_id) {
      await supabase
        .from('user_prompt_status')
        .upsert({
          user_id: userId,
          prompt_id,
          status: 'completed',
          response_id: response.id,
          completed_at: new Date().toISOString()
        })
    }

    // Run gap detection
    const gapAnalysis = await detectGaps(userId, response.id)

    // Get updated progress
    const { data: progressData } = await supabase
      .rpc('get_memory_progress', { p_user_id: userId })
      .single()

    const { data: hasUnlocked } = await supabase
      .rpc('has_unlocked_projects', { p_user_id: userId })
      .single()

    const result: SubmitMemoryResponse = {
      response,
      gap_analysis: gapAnalysis.followUpPrompts.length > 0 ? gapAnalysis : undefined,
      progress: {
        completed_required: (progressData as any)?.completed_required || 0,
        total_required: (progressData as any)?.total_required || 10,
        completed_total: (progressData as any)?.completed_total || 0,
        total_prompts: (progressData as any)?.total_prompts || 40,
        completion_percentage: (progressData as any)?.completion_percentage || 0,
        has_unlocked_projects: (hasUnlocked as any) || false
      }
    }

    return res.status(200).json(result)
  } catch (error) {
    console.error('Error submitting memory response:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
