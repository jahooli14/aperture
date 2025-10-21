/**
 * Projects API Endpoint
 * Copy to: projects/memory-os/api/projects.ts
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // GET /api/projects - List all projects
    if (req.method === 'GET') {
      const { status, type, limit = 50, offset = 0 } = req.query

      let query = supabase
        .from('projects')
        .select('*', { count: 'exact' })
        .order('last_active', { ascending: false })

      // Apply filters
      if (status) query = query.eq('status', status)
      if (type) query = query.eq('type', type)

      // Pagination
      query = query.range(Number(offset), Number(offset) + Number(limit) - 1)

      const { data, error, count } = await query

      if (error) {
        console.error('[projects] Query error:', error)
        return res.status(500).json({ error: error.message })
      }

      return res.status(200).json({
        projects: data,
        total: count || 0
      })
    }

    // POST /api/projects - Create new project
    if (req.method === 'POST') {
      const { title, description, type, status = 'active', metadata = {} } = req.body

      // Validation
      if (!title || !type) {
        return res.status(400).json({
          error: 'Missing required fields: title, type'
        })
      }

      if (!['personal', 'technical', 'meta'].includes(type)) {
        return res.status(400).json({
          error: 'Invalid type. Must be: personal, technical, or meta'
        })
      }

      // Get user ID (from auth or default)
      const userId = process.env.USER_ID || 'default-user'

      const { data, error } = await supabase
        .from('projects')
        .insert({
          user_id: userId,
          title,
          description,
          type,
          status,
          metadata,
          last_active: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error('[projects] Insert error:', error)
        return res.status(500).json({ error: error.message })
      }

      console.log(`[projects] Created project: ${data.id} - "${data.title}"`)

      return res.status(201).json({ project: data })
    }

    // Method not allowed
    return res.status(405).json({ error: 'Method not allowed' })

  } catch (error) {
    console.error('[projects] Unexpected error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
