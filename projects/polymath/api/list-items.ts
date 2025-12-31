
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './_lib/supabase.js'
import { getUserId } from './_lib/auth.js'
import { enrichListItem } from './_lib/list-enrichment.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const userId = getUserId()
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const supabase = getSupabaseClient()
    const { listId, id, resource } = req.query

    try {
        // GET /api/list-items - Fetch items for a list
        if (req.method === 'GET' && listId) {
            const { data, error } = await supabase
                .from('list_items')
                .select('*')
                .eq('list_id', listId)
                .eq('user_id', userId)
                .order('sort_order', { ascending: true })
                .order('created_at', { ascending: false })

            if (error) throw error
            return res.status(200).json(data)
        }

        // POST /api/list-items - Create new item
        if (req.method === 'POST') {
            const { content } = req.body
            const targetListId = typeof listId === 'string' ? listId : req.body.list_id

            if (!targetListId || !content) {
                return res.status(400).json({ error: 'listId and content required' })
            }

            // 1. Insert Item
            const { data: item, error } = await supabase
                .from('list_items')
                .insert({
                    user_id: userId,
                    list_id: targetListId,
                    content,
                    status: 'pending',
                    enrichment_status: 'pending'
                })
                .select()
                .single()

            if (error) throw error

            // 2. Enrich (Await to ensure it runs in serverless environment)
            // This might add 1-3s latency but ensures data quality
            try {
                const metadata = await enrichListItem(userId, targetListId, item.id, content)
                // Return enriched item
                return res.status(201).json({ ...item, metadata, enrichment_status: 'complete' })
            } catch (enrichError) {
                console.error('Enrichment failed (non-fatal):', enrichError)
                // Return unenriched item
                return res.status(201).json(item)
            }
        }

        // PATCH /api/list-items - Update item or Reorder
        if (req.method === 'PATCH') {
            // Handle Reorder
            if (resource === 'reorder' && listId) {
                const { itemIds } = req.body
                if (!Array.isArray(itemIds)) return res.status(400).json({ error: 'itemIds array required' })

                // Update sort_order for each item
                // We do this concurrently for speed
                await Promise.all(itemIds.map((itemId, index) =>
                    supabase
                        .from('list_items')
                        .update({ sort_order: index })
                        .eq('id', itemId)
                        .eq('user_id', userId)
                ))

                return res.status(200).json({ success: true })
            }

            // Handle Item Update
            const itemId = typeof id === 'string' ? id : req.body.id
            if (!itemId) return res.status(400).json({ error: 'Item ID required' })

            const updates: any = {}
            if (req.body.status) updates.status = req.body.status
            if (req.body.content) updates.content = req.body.content

            const { data, error } = await supabase
                .from('list_items')
                .update(updates)
                .eq('id', itemId)
                .eq('user_id', userId)
                .select()
                .single()

            if (error) throw error
            return res.status(200).json(data)
        }

        // DELETE /api/list-items - Delete item
        if (req.method === 'DELETE') {
            const itemId = typeof id === 'string' ? id : req.body.id
            if (!itemId) return res.status(400).json({ error: 'Item ID required' })

            const { error } = await supabase
                .from('list_items')
                .delete()
                .eq('id', itemId)
                .eq('user_id', userId)

            if (error) throw error
            return res.status(200).json({ success: true })
        }

        return res.status(405).json({ error: 'Method not allowed' })

    } catch (error: any) {
        console.error('[API Error] List Items:', error)
        return res.status(500).json({ error: error.message })
    }
}
