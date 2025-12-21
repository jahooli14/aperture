/**
 * AI List Enrichment Agent
 * Uses Gemini to fetch and structure metadata for list items based on their category.
 */

import { generateText } from './gemini-chat.js'
import { getSupabaseClient } from './supabase.js'

export async function enrichListItem(userId: string, listId: string, itemId: string, content: string, listType?: string) {
    console.log(`[Enrichment] Starting for item: ${content}`)

    try {
        const supabase = getSupabaseClient()

        // 1. Resolve List Type if not provided
        let category = listType
        if (!category) {
            const { data: list } = await supabase
                .from('lists')
                .select('type')
                .eq('id', listId)
                .single()
            category = list?.type || 'generic'
        }

        // 2. Build prompt for Gemini
        const prompt = `You are a high-end data enrichment agent for "Aperture", a premium personal hub.
Target Item: "${content}"
List Category: "${category}"

Your goal is to provide rich, structured metadata that makes this item look beautiful in a gallery or list view.

FIELDS TO PROVIDE:
1. image: A direct, public, high-quality URL for a representative image (poster, book cover, product photo, landmark). Search for stable URLs from media databases.
2. subtitle: A single descriptive line (e.g. "Director: Christopher Nolan", "Author: Milan Kundera", "Location: Kyoto, Japan").
3. tags: Exactly 3 highly relevant tags (e.g. ["Sci-Fi", "Classic", "Must-Watch"]).
4. link: A high-authority URL for more info (IMDb, Goodreads, Wikipedia, Official Site).
5. specs: A small JSON object of key attributes specific to this category (e.g. {"Year": "1984", "Runtime": "112m"} or {"Price": "$25", "Rating": "4.8"}).

RULES:
- Be precise. If it's a book, find the author. If it's a film, find the director.
- RETURN ONLY VALID JSON. No preamble.

RESPONSE FORMAT:
{
  "image": "https://...",
  "subtitle": "...",
  "tags": ["...", "...", "..."],
  "link": "https://...",
  "specs": { ... }
}`

        const response = await generateText(prompt, {
            responseFormat: 'json',
            temperature: 0.3 // Keep it factual
        })

        const cleanResponse = response.replace(/^```json\s*/, '').replace(/\s*```$/, '')
        const metadata = JSON.parse(cleanResponse)

        // 3. Update the item in Supabase
        const { error } = await supabase
            .from('list_items')
            .update({
                metadata,
                enrichment_status: 'complete'
            })
            .eq('id', itemId)
            .eq('user_id', userId)

        if (error) throw error
        console.log(`[Enrichment] Successfully enriched: ${content}`)
        return metadata

    } catch (error: any) {
        console.error(`[Enrichment] Failed for ${content}:`, error)

        // Set to failed so we don't keep spinner forever
        try {
            const supabase = getSupabaseClient()
            await supabase
                .from('list_items')
                .update({
                    enrichment_status: 'failed',
                    // Save error to metadata for debugging
                    metadata: { error: error.message || 'Unknown error' }
                })
                .eq('id', itemId)
                .eq('user_id', userId)
        } catch (dbErr) {
            console.error('[Enrichment] Total failure - could not even update status:', dbErr)
        }
        return null
    }
}
