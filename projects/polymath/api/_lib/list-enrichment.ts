/**
 * AI List Enrichment Agent
 * Uses Gemini to fetch and structure metadata for list items based on their category.
 */

import { generateText } from './gemini-chat.js'
import { getSupabaseClient } from './supabase.js'

export async function enrichListItem(userId: string, listId: string, itemId: string, content: string, listType?: string) {
    console.log(`[Enrichment] Starting for item: ${content}`)
    console.log(`[Enrichment] Environment check:`, {
        hasGeminiKey: !!process.env.GEMINI_API_KEY,
        keyLength: process.env.GEMINI_API_KEY?.length || 0,
        keyPrefix: process.env.GEMINI_API_KEY?.substring(0, 10) || 'NOT_SET'
    })

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
- RETURN ONLY RAW VALID JSON. 
- DO NOT use markdown code blocks (no backticks).
- DO NOT include any preamble or conversational text.
- THE RESPONSE MUST START WITH { AND END WITH }.

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
            temperature: 0.0, // Maximum stability
            maxTokens: 1500 // Increased for rich metadata
        })
        console.log(`[Enrichment] Gemini Raw Response for "${content}":`, response.slice(0, 100))

        // Robust JSON extraction - handle markdown code blocks
        let jsonStr = response.trim()

        // Remove markdown code blocks if present
        jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/,'')

        // Extract JSON object
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
            throw new Error(`No valid JSON found in response: ${response.slice(0, 200)}`)
        }
        jsonStr = jsonMatch[0]

        const metadata = JSON.parse(jsonStr)

        // Validate required fields
        if (!metadata.image || !metadata.subtitle || !metadata.tags || !metadata.link) {
            console.warn('[Enrichment] Missing required fields:', metadata)
        }

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
        console.error('[Enrichment] Error details:', {
            name: error?.name,
            message: error?.message,
            stack: error?.stack?.split('\n').slice(0, 3).join('\n')
        })

        // Set to failed so we don't keep spinner forever
        try {
            const supabase = getSupabaseClient()
            await supabase
                .from('list_items')
                .update({
                    enrichment_status: 'failed',
                    // Save error to metadata for debugging
                    metadata: {
                        error: error.message || 'Unknown error',
                        errorType: error.name,
                        timestamp: new Date().toISOString()
                    }
                })
                .eq('id', itemId)
                .eq('user_id', userId)
        } catch (dbErr) {
            console.error('[Enrichment] Total failure - could not even update status:', dbErr)
        }
        throw error // Re-throw to surface in API logs
    }
}
