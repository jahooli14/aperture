import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './_lib/supabase.js'
import { getUserId } from './_lib/auth.js'
import { enrichListItem } from './_lib/list-enrichment.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Route list-item operations when scope=items
    if (req.query.scope === 'items') {
        return handleListItems(req, res)
    }
    const userId = await getUserId(req)

    if (!userId) return res.status(401).json({ error: 'Sign in to access your data' })

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
            const { title, type, description, icon, settings } = req.body
            const resolvedType = type || 'generic'

            // Derive default status_enabled from type unless caller overrides
            const LIST_STATUS_DEFAULTS: Record<string, boolean> = {
                film: true, book: true, article: true, music: true, game: true,
                place: true, event: true, software: true, tech: true,
                quote: false, generic: false,
            }
            const defaultSettings = {
                status_enabled: LIST_STATUS_DEFAULTS[resolvedType] ?? true,
                ...settings,
            }

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
                    type: resolvedType,
                    description,
                    icon,
                    settings: defaultSettings,
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

            // Standard Update (Title, settings, etc)
            const { id, title, description, icon, settings } = req.body
            if (!id) return res.status(400).json({ error: 'List ID required' })

            const updates: Record<string, unknown> = {}
            if (title !== undefined) updates.title = title
            if (description !== undefined) updates.description = description
            if (icon !== undefined) updates.icon = icon
            if (settings !== undefined) updates.settings = settings

            const { data, error } = await supabase
                .from('lists')
                .update(updates)
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
    const userId = await getUserId(req)
    if (!userId) return res.status(401).json({ error: 'Sign in to access your data' })

    const supabase = getSupabaseClient()
    const { listId, id, resource } = req.query

    try {
        // GET /api/lists?scope=items&resource=favourites
        // Returns items with user_rating >= 4 across all the user's lists,
        // joined with the parent list's type + title so the client can group
        // and label without extra round-trips.
        if (req.method === 'GET' && resource === 'favourites') {
            const minRating = req.query.min ? parseInt(req.query.min as string) : 4
            const { data, error } = await supabase
                .from('list_items')
                .select('*, list:lists!inner(id, title, type)')
                .eq('user_id', userId)
                .gte('user_rating', minRating)
                .order('user_rating', { ascending: false })
                .order('updated_at', { ascending: false })
            if (error) throw error
            return res.status(200).json(data)
        }

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
            const { content, metadata: initialMetadata } = req.body
            const targetListId = typeof listId === 'string' ? listId : req.body.list_id

            if (!targetListId || !content) {
                return res.status(400).json({ error: 'listId and content required' })
            }

            const insertRow: Record<string, unknown> = {
                user_id: userId,
                list_id: targetListId,
                content,
                status: 'pending',
                enrichment_status: 'pending',
            }
            if (initialMetadata && typeof initialMetadata === 'object') {
                insertRow.metadata = initialMetadata
            }

            const { data: item, error } = await supabase
                .from('list_items')
                .insert(insertRow)
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
