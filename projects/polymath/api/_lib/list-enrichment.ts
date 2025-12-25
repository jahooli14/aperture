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
        const prompt = `Provide enrichment metadata for this ${category}:

"${content}"

Return JSON with these exact fields:
- subtitle: One descriptive line (e.g., "Director: Name" for films, "Author: Name" for books)
- tags: Array of exactly 3 relevant tags
- specs: Object with 2-3 key details (e.g., {"Year": "2010", "Runtime": "148min"} for films)

Return ONLY valid JSON, no markdown, no explanation.

Example format:
{"subtitle": "Director: Christopher Nolan", "tags": ["Sci-Fi", "Thriller", "Complex"], "specs": {"Year": "2010", "Runtime": "148min"}}`

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
        if (!metadata.subtitle || !metadata.tags || !metadata.specs) {
            console.warn('[Enrichment] Missing required fields:', metadata)
            console.warn('[Enrichment] Expected: subtitle, tags, specs')
        }

        // Ensure tags is an array
        if (!Array.isArray(metadata.tags)) {
            console.warn('[Enrichment] Tags is not an array, converting')
            metadata.tags = []
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
