/**
 * Knowledge Map API
 * Generates and returns the semantic knowledge map
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getUserId } from './lib/auth.js'
import { generateKnowledgeMap } from './lib/map-generation.js'
import { generateDoorSuggestions } from './lib/map-suggestions.js'
import { getSupabaseClient } from './lib/supabase.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Get user ID from session
    const userId = await getUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const supabase = getSupabaseClient()

    if (req.method === 'GET') {
      // Check if we have a cached map
      const { data: existingMap, error: fetchError } = await supabase
        .from('knowledge_maps')
        .select('*')
        .eq('user_id', userId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .single()

      // If map exists and is recent (< 1 hour old), return it
      if (existingMap && !fetchError) {
        const mapAge = Date.now() - new Date(existingMap.generated_at).getTime()
        const oneHour = 60 * 60 * 1000

        if (mapAge < oneHour) {
          console.log('[map] Returning cached map')
          return res.status(200).json(existingMap.map_data)
        }
      }

      // Generate new map
      console.log('[map] Generating new map...')
      const mapData = await generateKnowledgeMap(userId)

      // Generate door suggestions
      const doors = await generateDoorSuggestions(userId, mapData)
      mapData.doors = doors

      // Save to database
      const { error: saveError } = await supabase
        .from('knowledge_maps')
        .upsert({
          user_id: userId,
          map_data: mapData,
          generated_at: new Date().toISOString()
        })

      if (saveError) {
        console.error('[map] Error saving map:', saveError)
        // Don't fail the request, just log the error
      }

      return res.status(200).json(mapData)
    }

    if (req.method === 'POST') {
      // Force regenerate the map
      console.log('[map] Force regenerating map...')
      const mapData = await generateKnowledgeMap(userId)

      // Generate door suggestions
      const doors = await generateDoorSuggestions(userId, mapData)
      mapData.doors = doors

      // Save to database
      const { error: saveError } = await supabase
        .from('knowledge_maps')
        .upsert({
          user_id: userId,
          map_data: mapData,
          generated_at: new Date().toISOString()
        })

      if (saveError) {
        console.error('[map] Error saving map:', saveError)
      }

      return res.status(200).json(mapData)
    }

    if (req.method === 'DELETE') {
      // Delete cached map to force regeneration next time
      const { error } = await supabase
        .from('knowledge_maps')
        .delete()
        .eq('user_id', userId)

      if (error) {
        return res.status(500).json({ error: error.message })
      }

      return res.status(200).json({ message: 'Map cache cleared' })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error: any) {
    console.error('[map] Error:', error)
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
}
