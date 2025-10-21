import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import type { AudiopenWebhook } from '../src/types'
import { getSupabaseConfig } from '../lib/env.js'
import { logger } from '../lib/logger.js'

const { url, serviceRoleKey } = getSupabaseConfig()
const supabase = createClient(url, serviceRoleKey)

/**
 * Webhook endpoint for Audiopen
 * Receives note data, stores raw, triggers background processing
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const webhook: AudiopenWebhook = req.body

    // Validate required fields
    if (!webhook.id || !webhook.title || !webhook.body || !webhook.date_created) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    logger.info({ webhook_id: webhook.id, title: webhook.title }, 'Received note')

    // Parse tags (comma-separated string to array)
    const tags = webhook.tags
      ? webhook.tags.split(',').map(t => t.trim()).filter(Boolean)
      : []

    // Store raw memory
    const { data: memory, error: insertError } = await supabase
      .from('memories')
      .insert({
        audiopen_id: webhook.id,
        title: webhook.title,
        body: webhook.body,
        orig_transcript: webhook.orig_transcript || null,
        tags,
        audiopen_created_at: webhook.date_created,
        processed: false,
      })
      .select()
      .single()

    if (insertError) {
      logger.error({ error: insertError }, 'Insert error')
      return res.status(500).json({ error: 'Failed to store memory' })
    }

    logger.info({ memory_id: memory.id }, 'Stored memory')

    // Trigger processing (inline for MVP - could be async queue later)
    // Import processMemory dynamically to avoid bundler issues
    const { processMemory } = await import('../lib/process-memory.js')

    // Process asynchronously (don't await - let it run in background)
    processMemory(memory.id).catch(err => {
      logger.error({ memory_id: memory.id, error: err }, 'Background processing error')
    })

    // Return success immediately
    return res.status(200).json({
      success: true,
      memory_id: memory.id,
      message: 'Memory captured, processing started'
    })

  } catch (error) {
    logger.error({ error }, 'Unexpected error')
    return res.status(500).json({ error: 'Internal server error' })
  }
}
