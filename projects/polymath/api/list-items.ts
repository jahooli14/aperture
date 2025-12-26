import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabaseClient } from './_lib/supabase.js'
import { getUserId } from './_lib/auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const userId = getUserId()

    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const supabase = getSupabaseClient()
    const { listId, id } = req.query

    // DELETE only needs item id, not listId
    if (req.method === 'DELETE') {
        if (!id || typeof id !== 'string') {
            return res.status(400).json({ error: 'Item ID is required' })
        }

        try {
            const { error } = await supabase
                .from('list_items')
                .delete()
                .eq('id', id)
                .eq('user_id', userId)

            if (error) throw error
            return res.status(204).end()
        } catch (error: unknown) {
            console.error('[API Error] Delete List Item:', error)
            return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' })
        }
    }

    // GET and POST require listId
    if (!listId || typeof listId !== 'string') {
        return res.status(400).json({ error: 'listId query parameter required' })
    }

    try {
        // GET /api/list-items?listId=...
        if (req.method === 'GET') {
            const { data, error } = await supabase
                .from('list_items')
                .select('*')
                .eq('list_id', listId)
                .eq('user_id', userId)
                .order('created_at', { ascending: false })

            if (error) throw error
            return res.status(200).json(data)
        }

        // POST /api/list-items?listId=... (Body: { content })
        if (req.method === 'POST') {
            const { content } = req.body

            if (!content) return res.status(400).json({ error: 'Content is required' })

            // 1. Insert Item
            const { data, error } = await supabase
                .from('list_items')
                .insert({
                    user_id: userId,
                    list_id: listId,
                    content,
                    status: 'pending',
                    enrichment_status: 'pending'
                })
                .select()
                .single()

            if (error) throw error

            // 2. Trigger enrichment (Must await in Vercel/Lambda environment)
            // We await it to ensure the process finishes before the lambda freezes.
            // Gemini Flash is fast enough (~500ms) to not excessively delay the response.
            try {
                const { enrichListItem } = await import('./_lib/list-enrichment.js')
                const metadata = await enrichListItem(userId, listId as string, data.id, content)

                // If successful, attach to response for instant UI update
                if (metadata) {
                    data.metadata = metadata
                    data.enrichment_status = 'complete'
                } else {
                    // enrichListItem returns null on failure (DB already updated to 'failed')
                    data.enrichment_status = 'failed'
                }
            } catch (err) {
                console.error('[API] Enrichment failed:', err)
                // Enrichment failed - let the client know so UI shows "Analysis Failed" immediately
                data.enrichment_status = 'failed'
            }

            return res.status(201).json(data)
        }

        return res.status(405).json({ error: 'Method not allowed' })
    } catch (error: any) {
        console.error('[API Error] List Items:', error)
        return res.status(500).json({ error: error.message })
    }
}
