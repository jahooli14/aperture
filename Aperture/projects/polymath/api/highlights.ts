/**
 * Article Highlights API
 * Create, update, and delete highlights
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // POST - Create highlight
  if (req.method === 'POST') {
    try {
      const { article_id, highlight_text, start_position, end_position, color, notes } = req.body

      if (!article_id || !highlight_text) {
        return res.status(400).json({ error: 'article_id and highlight_text required' })
      }

      const highlightData = {
        article_id,
        highlight_text,
        start_position: start_position || null,
        end_position: end_position || null,
        color: color || 'yellow',
        notes: notes || null,
        created_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('article_highlights')
        .insert([highlightData])
        .select()
        .single()

      if (error) throw error

      return res.status(201).json({
        success: true,
        highlight: data
      })
    } catch (error) {
      console.error('[API] Create highlight error:', error)
      return res.status(500).json({ error: 'Failed to create highlight' })
    }
  }

  // PATCH - Update highlight (add notes or change color)
  if (req.method === 'PATCH') {
    try {
      const { id, notes, color } = req.body

      if (!id) {
        return res.status(400).json({ error: 'Highlight ID required' })
      }

      const updates: any = {}
      if (notes !== undefined) updates.notes = notes
      if (color !== undefined) updates.color = color

      const { data, error } = await supabase
        .from('article_highlights')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      return res.status(200).json({
        success: true,
        highlight: data
      })
    } catch (error) {
      console.error('[API] Update highlight error:', error)
      return res.status(500).json({ error: 'Failed to update highlight' })
    }
  }

  // DELETE - Remove highlight
  if (req.method === 'DELETE') {
    try {
      const { id } = req.query

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Highlight ID required' })
      }

      const { error } = await supabase
        .from('article_highlights')
        .delete()
        .eq('id', id)

      if (error) throw error

      return res.status(204).send('')
    } catch (error) {
      console.error('[API] Delete highlight error:', error)
      return res.status(500).json({ error: 'Failed to delete highlight' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
