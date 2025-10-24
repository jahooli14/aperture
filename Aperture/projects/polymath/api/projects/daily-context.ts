/**
 * User Daily Context API
 * Store/retrieve user's current context for queue matching
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const userId = process.env.USER_ID || 'default-user'

    // GET - Retrieve user context
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('user_daily_context')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        console.error('[daily-context] Query error:', error)
        return res.status(500).json({ error: error.message })
      }

      // Return defaults if not found
      const context: UserContext = data || {
        available_time: 'moderate',
        current_energy: 'moderate',
        available_context: ['desk', 'computer']
      }

      return res.status(200).json({ context })
    }

    // POST/PUT - Update user context
    if (req.method === 'POST' || req.method === 'PUT') {
      const { available_time, current_energy, available_context } = req.body

      // Validation
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

      // Upsert context
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
        console.error('[daily-context] Upsert error:', error)
        return res.status(500).json({ error: error.message })
      }

      console.log(`[daily-context] Updated context for user ${userId}`)

      return res.status(200).json({ context: data })
    }

    // Method not allowed
    return res.status(405).json({ error: 'Method not allowed' })

  } catch (error) {
    console.error('[daily-context] Unexpected error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
