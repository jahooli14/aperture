/**
 * Bedtime Ideas API
 * Generate and retrieve trippy prompts for creative subconscious thinking
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getUserId } from './lib/auth.js'
import { getSupabaseClient } from './lib/supabase.js'
import { generateBedtimePrompts } from '../lib/bedtime-ideas.js'

const supabase = getSupabaseClient()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = getUserId()

  try {
    // GET - Fetch today's prompts (or latest)
    if (req.method === 'GET') {
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
    }

    // POST - Generate new prompts (manual trigger)
    if (req.method === 'POST') {
      const prompts = await generateBedtimePrompts(userId)
      return res.status(201).json({
        prompts,
        generated: true,
        message: `Generated ${prompts.length} bedtime prompts`
      })
    }

    // PATCH - Mark prompts as viewed
    if (req.method === 'PATCH') {
      const { ids } = req.body

      if (!ids || !Array.isArray(ids)) {
        return res.status(400).json({ error: 'ids array required' })
      }

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

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('[bedtime] Error:', error)
    return res.status(500).json({
      error: 'Failed to process bedtime prompts',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
