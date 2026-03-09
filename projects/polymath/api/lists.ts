import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './_lib/supabase.js'
import { getUserId } from './_lib/auth.js'
import { enrichListItem } from './_lib/list-enrichment.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Route list-item operations when scope=items
    if (req.query.scope === 'items') {
        return handleListItems(req, res)
    }
    const userId = getUserId()

    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const supabase = getSupabaseClient()

    try {
        // GET /api/lists - Fetch all lists with cover images
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

            // Fetch cover images for all lists in parallel
            const listsWithCovers = await Promise.all(lists.map(async (list) => {
                let coverImage = null

                // For quote lists, get shortest phrase
                if (list.type === 'quote') {
                    const { data: items } = await supabase
                        .from('list_items')
                        .select('content')
                        .eq('list_id', list.id)
                        .eq('user_id', userId)
                        .order('created_at', { ascending: false })
                        .limit(50)

                    if (items && items.length > 0) {
                        const shortestPhrase = items.reduce((shortest, item) =>
                            !shortest || item.content.length < shortest.content.length ? item : shortest
                        )
                        coverImage = shortestPhrase.content
                    }
                } else {
                    // For other lists, get first item with an image
                    const { data: items } = await supabase
                        .from('list_items')
                        .select('metadata')
                        .eq('list_id', list.id)
                        .eq('user_id', userId)
                        .not('metadata->image', 'is', null)
                        .order('created_at', { ascending: false })
                        .limit(1)

                    if (items && items.length > 0 && items[0].metadata?.image) {
                        // Upgrade http:// → https:// for existing rows stored before this fix
                        coverImage = items[0].metadata.image.replace(/^http:\/\//, 'https://')
                    }
                }

                return {
                    ...list,
                    item_count: list.items ? list.items[0]?.count : 0,
                    cover_image: coverImage,
                    items: undefined
                }
            }))

            return res.status(200).json(listsWithCovers)
        }

        // POST /api/lists - Create a new list
        if (req.method === 'POST') {
            const { title, type, description, icon } = req.body

            // Get min sort_order to insert at the beginning
            const { data: minSortData } = await supabase
                .from('lists')
                .select('sort_order')
                .eq('user_id', userId)
                .order('sort_order', { ascending: true })
                .limit(1)

            const minSort = minSortData && minSortData[0]?.sort_order !== undefined
                ? minSortData[0].sort_order
                : 1

            const { data, error } = await supabase
                .from('lists')
                .insert({
                    user_id: userId,
                    title,
                    type: type || 'generic',
                    description,
                    icon,
                    sort_order: minSort - 1
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

        // DELETE /api/lists - Delete a list
        if (req.method === 'DELETE') {
            const { id } = req.query
            if (!id || typeof id !== 'string') return res.status(400).json({ error: 'List ID required' })

            const { error } = await supabase
                .from('lists')
                .delete()
                .eq('id', id)
                .eq('user_id', userId)

            if (error) throw error
            return res.status(200).json({ success: true })
        }

        return res.status(405).json({ error: 'Method not allowed' })
    } catch (error: any) {
        console.error('[API Error] Lists:', error)
        return res.status(500).json({ error: error.message })
    }
}

async function handleListItems(req: VercelRequest, res: VercelResponse) {
    const userId = getUserId()
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const supabase = getSupabaseClient()
    const { listId, id, resource } = req.query

    try {
        if (req.method === 'GET' && listId) {
            const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined

            let query = supabase
                .from('list_items')
                .select('*')
                .eq('list_id', listId)
                .eq('user_id', userId)
                .order('sort_order', { ascending: true })
                .order('created_at', { ascending: false })

            if (limit) query = query.limit(limit)

            const { data, error } = await query
            if (error) throw error
            return res.status(200).json(data)
        }

        if (req.method === 'POST') {
            const { content } = req.body
            const targetListId = typeof listId === 'string' ? listId : req.body.list_id

            if (!targetListId || !content) {
                return res.status(400).json({ error: 'listId and content required' })
            }

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

            try {
                const metadata = await enrichListItem(userId, targetListId, item.id, content)
                return res.status(201).json({ ...item, metadata, enrichment_status: 'completed' })
            } catch {
                return res.status(201).json(item)
            }
        }

        if (req.method === 'PATCH') {
            if (resource === 'reorder' && listId) {
                const { itemIds } = req.body
                if (!Array.isArray(itemIds)) return res.status(400).json({ error: 'itemIds array required' })

                await Promise.all(itemIds.map((itemId, index) =>
                    supabase
                        .from('list_items')
                        .update({ sort_order: index })
                        .eq('id', itemId)
                        .eq('user_id', userId)
                ))

                return res.status(200).json({ success: true })
            }

            const itemId = typeof id === 'string' ? id : req.body.id
            if (!itemId) return res.status(400).json({ error: 'Item ID required' })

            const updates: Record<string, unknown> = {}
            if (req.body.status) updates.status = req.body.status
            if (req.body.content) updates.content = req.body.content
            if (req.body.metadata) updates.metadata = req.body.metadata

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
    } catch (error: unknown) {
        console.error('[API Error] List Items:', error)
        return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' })
    }
}
