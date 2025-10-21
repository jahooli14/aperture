/**
 * Single Project API Endpoint
 * Copy to: projects/memory-os/api/projects/[id].ts
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Project ID required' })
  }

  try {
    // GET /api/projects/:id - Get single project
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Project not found' })
        }
        console.error('[projects/:id] Query error:', error)
        return res.status(500).json({ error: error.message })
      }

      return res.status(200).json({ project: data })
    }

    // PATCH /api/projects/:id - Update project
    if (req.method === 'PATCH') {
      const updates = req.body

      // Don't allow changing user_id or id
      delete updates.user_id
      delete updates.id

      // Update updated_at
      updates.updated_at = new Date().toISOString()

      // If status changed to active, update last_active
      if (updates.status === 'active') {
        updates.last_active = new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Project not found' })
        }
        console.error('[projects/:id] Update error:', error)
        return res.status(500).json({ error: error.message })
      }

      console.log(`[projects/:id] Updated project: ${id}`)

      return res.status(200).json({ project: data })
    }

    // DELETE /api/projects/:id - Delete project
    if (req.method === 'DELETE') {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('[projects/:id] Delete error:', error)
        return res.status(500).json({ error: error.message })
      }

      console.log(`[projects/:id] Deleted project: ${id}`)

      return res.status(200).json({
        success: true,
        message: 'Project deleted'
      })
    }

    // Method not allowed
    return res.status(405).json({ error: 'Method not allowed' })

  } catch (error) {
    console.error('[projects/:id] Unexpected error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
