import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './_lib/supabase.js'
import { getUserId } from './_lib/auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = getUserId()
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const supabase = getSupabaseClient()

  try {
    // ─── GET /api/todos ────────────────────────────────────────
    if (req.method === 'GET') {
      const { include_done, area_id, since } = req.query

      let query = supabase
        .from('todos')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })

      if (!include_done || include_done === 'false') {
        // Default: only active todos + recently completed (last 24h) for optimistic UI
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        query = query.or(`done.eq.false,completed_at.gte.${yesterday.toISOString()}`)
      }

      if (area_id) query = query.eq('area_id', area_id as string)
      if (since) query = query.gte('updated_at', since as string)

      const { data, error } = await query
      if (error) throw error

      return res.status(200).json(data ?? [])
    }

    // ─── GET /api/todos?areas=true ────────────────────────────
    if (req.method === 'GET' && req.query.areas === 'true') {
      const { data, error } = await supabase
        .from('todo_areas')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return res.status(200).json(data ?? [])
    }

    // ─── POST /api/todos ───────────────────────────────────────
    if (req.method === 'POST') {
      const {
        text, notes, scheduled_date, scheduled_time, deadline_date,
        area_id, project_id, tags, priority,
        estimated_minutes, source_memory_id, sort_order
      } = req.body

      if (!text?.trim()) return res.status(400).json({ error: 'text is required' })

      const { data, error } = await supabase
        .from('todos')
        .insert({
          user_id: userId,
          text: text.trim(),
          notes: notes ?? null,
          scheduled_date: scheduled_date ?? null,
          scheduled_time: scheduled_time ?? null,
          deadline_date: deadline_date ?? null,
          area_id: area_id ?? null,
          project_id: project_id ?? null,
          tags: tags ?? [],
          priority: priority ?? 0,
          estimated_minutes: estimated_minutes ?? null,
          source_memory_id: source_memory_id ?? null,
          sort_order: sort_order ?? 0,
          done: false,
        })
        .select()
        .single()

      if (error) throw error
      return res.status(201).json(data)
    }

    // ─── PATCH /api/todos ──────────────────────────────────────
    if (req.method === 'PATCH') {
      const { id, ...updates } = req.body
      if (!id) return res.status(400).json({ error: 'id is required' })

      // Protect: users can only edit their own todos
      const { data: existing } = await supabase
        .from('todos')
        .select('id')
        .eq('id', id)
        .eq('user_id', userId)
        .single()

      if (!existing) return res.status(404).json({ error: 'Todo not found' })

      // If completing, stamp completed_at
      if (updates.done === true && !updates.completed_at) {
        updates.completed_at = new Date().toISOString()
      }
      // If un-completing, clear completed_at
      if (updates.done === false) {
        updates.completed_at = null
      }

      const { data, error } = await supabase
        .from('todos')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error
      return res.status(200).json(data)
    }

    // ─── DELETE /api/todos ─────────────────────────────────────
    if (req.method === 'DELETE') {
      const { id, hard } = req.query
      if (!id) return res.status(400).json({ error: 'id is required' })

      if (hard === 'true') {
        // Hard delete (for clearing logbook etc.)
        const { error } = await supabase
          .from('todos')
          .delete()
          .eq('id', id as string)
          .eq('user_id', userId)
        if (error) throw error
      } else {
        // Soft delete (default - recoverable)
        const { error } = await supabase
          .from('todos')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id as string)
          .eq('user_id', userId)
        if (error) throw error
      }

      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('[todos] Error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
