import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './_lib/supabase.js'
import { getUserId } from './_lib/auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const userId = getUserId()

    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const supabase = getSupabaseClient()

    try {
        // GET /api/lists - Fetch all lists
        if (req.method === 'GET') {
            const { data: lists, error } = await supabase
                .from('lists')
                .select(`
          *,
          items:list_items(count)
        `)
                .eq('user_id', userId)
                .order('sort_order', { ascending: true })
                .order('created_at', { ascending: false })

            if (error) throw error

            const transformedLists = lists.map(list => ({
                ...list,
                item_count: list.items ? list.items[0]?.count : 0,
                items: undefined
            }))

            return res.status(200).json(transformedLists)
        }

        // POST /api/lists - Create a new list
        if (req.method === 'POST') {
            const { title, type, description, icon } = req.body

            const { data, error } = await supabase
                .from('lists')
                .insert({
                    user_id: userId,
                    title,
                    type: type || 'generic',
                    description,
                    icon
                })
                .select()
                .single()

            if (error) throw error

            return res.status(201).json(data)
        }

        // PATCH /api/lists - Update list or Reorder
        if (req.method === 'PATCH') {
            const { resource } = req.query

            // Handle Reorder
            if (resource === 'reorder') {
                const { listIds } = req.body
                if (!Array.isArray(listIds)) return res.status(400).json({ error: 'listIds array required' })

                // Update sort_order for each list concurrently
                await Promise.all(listIds.map((listId, index) =>
                    supabase
                        .from('lists')
                        .update({ sort_order: index })
                        .eq('id', listId)
                        .eq('user_id', userId)
                ))

                return res.status(200).json({ success: true })
            }

            // Standard Update (Title, etc)
            const { id, title, description, icon } = req.body
            if (!id) return res.status(400).json({ error: 'List ID required' })

            const { data, error } = await supabase
                .from('lists')
                .update({ title, description, icon })
                .eq('id', id)
                .eq('user_id', userId)
                .select()
                .single()

            if (error) throw error
            return res.status(200).json(data)
        }

        return res.status(405).json({ error: 'Method not allowed' })
    } catch (error: any) {
        console.error('[API Error] Lists:', error)
        return res.status(500).json({ error: error.message })
    }
}
