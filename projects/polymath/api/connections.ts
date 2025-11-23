import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// Calculate cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dotProduct = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  normA = Math.sqrt(normA)
  normB = Math.sqrt(normB)
  if (normA === 0 || normB === 0) return 0
  return dotProduct / (normA * normB)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle GET requests for listing connections
  if (req.method === 'GET') {
    const { action, id, type } = req.query

    // Get suggestions for an item via vector similarity
    if (action === 'suggestions') {
      try {
        if (!id || !type) {
          return res.status(400).json({ error: 'id and type are required' })
        }

        // Get the source item's embedding
        let sourceEmbedding: number[] | null = null
        let sourceTitle = ''

        if (type === 'project') {
          const { data } = await supabase.from('projects').select('title, embedding').eq('id', id).single()
          sourceEmbedding = data?.embedding
          sourceTitle = data?.title || ''
        } else if (type === 'thought') {
          const { data } = await supabase.from('memories').select('title, body, embedding').eq('id', id).single()
          sourceEmbedding = data?.embedding
          sourceTitle = data?.title || data?.body?.slice(0, 50) || ''
        } else if (type === 'article') {
          const { data } = await supabase.from('reading_queue').select('title, embedding').eq('id', id).single()
          sourceEmbedding = data?.embedding
          sourceTitle = data?.title || ''
        }

        if (!sourceEmbedding) {
          return res.status(200).json({ suggestions: [], message: 'No embedding found for this item' })
        }

        const suggestions: Array<{
          id: string
          type: string
          title: string
          subtitle?: string
          similarity: number
          matchReason: string
        }> = []

        // Search all item types except the source type
        const searchTypes = ['project', 'thought', 'article'].filter(t => t !== type)

        for (const searchType of searchTypes) {
          let items: any[] = []

          if (searchType === 'project') {
            const { data } = await supabase
              .from('projects')
              .select('id, title, description, embedding')
              .not('embedding', 'is', null)
              .limit(50)
            items = data || []
          } else if (searchType === 'thought') {
            const { data } = await supabase
              .from('memories')
              .select('id, title, body, embedding')
              .not('embedding', 'is', null)
              .limit(50)
            items = data || []
          } else if (searchType === 'article') {
            const { data } = await supabase
              .from('reading_queue')
              .select('id, title, excerpt, embedding')
              .not('embedding', 'is', null)
              .limit(50)
            items = data || []
          }

          for (const item of items) {
            if (!item.embedding) continue
            const similarity = cosineSimilarity(sourceEmbedding, item.embedding)
            if (similarity > 0.5) {
              suggestions.push({
                id: item.id,
                type: searchType === 'thought' ? 'memory' : searchType,
                title: item.title || item.body?.slice(0, 50) || 'Untitled',
                subtitle: item.description?.slice(0, 100) || item.excerpt?.slice(0, 100) || item.body?.slice(0, 100),
                similarity,
                matchReason: `${Math.round(similarity * 100)}% semantic match`
              })
            }
          }
        }

        // Sort by similarity and limit
        suggestions.sort((a, b) => b.similarity - a.similarity)
        return res.status(200).json({ suggestions: suggestions.slice(0, 10) })

      } catch (error) {
        console.error('[connections] Suggestions error:', error)
        return res.status(500).json({ error: 'Failed to get suggestions' })
      }
    }

    if (action === 'list-sparks') {
      try {
        // Get connections where this item is either source or target
        const { data: connections, error } = await supabase
          .from('connections')
          .select('*')
          .or(`and(source_type.eq.${type},source_id.eq.${id}),and(target_type.eq.${type},target_id.eq.${id})`)

        if (error) {
          console.error('[connections] Error fetching:', error)
          return res.status(500).json({ error: 'Failed to fetch connections' })
        }

        // Transform connections to include related item info
        const enrichedConnections = await Promise.all((connections || []).map(async (conn) => {
          // Determine which side is the "related" item
          const isSource = conn.source_type === type && conn.source_id === id
          const relatedType = isSource ? conn.target_type : conn.source_type
          const relatedId = isSource ? conn.target_id : conn.source_id

          // Fetch related item details
          let relatedTitle = 'Unknown'
          if (relatedType === 'thought') {
            const { data } = await supabase.from('memories').select('title, body').eq('id', relatedId).single()
            relatedTitle = data?.title || data?.body?.slice(0, 50) + '...' || 'Untitled'
          } else if (relatedType === 'project') {
            const { data } = await supabase.from('projects').select('title').eq('id', relatedId).single()
            relatedTitle = data?.title || 'Untitled'
          } else if (relatedType === 'article') {
            const { data } = await supabase.from('reading_queue').select('title').eq('id', relatedId).single()
            relatedTitle = data?.title || 'Untitled'
          }

          return {
            id: conn.id,
            related_type: relatedType,
            related_id: relatedId,
            related_title: relatedTitle,
            connection_type: conn.connection_type,
            created_by: conn.created_by,
            ai_reasoning: conn.ai_reasoning,
            created_at: conn.created_at
          }
        }))

        return res.status(200).json({ connections: enrichedConnections })
      } catch (error) {
        console.error('[connections] Error:', error)
        return res.status(500).json({ error: 'Failed to list connections' })
      }
    }

    return res.status(400).json({ error: 'Invalid action' })
  }

  // Only allow POST requests for creating connections
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { sourceId, sourceType, content, embedding, userId } = req.body

    if (!sourceId || !sourceType || !userId) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    console.log(`[connections] Finding connections for ${sourceType}:${sourceId}`)

    // 1. Get embedding if not provided
    let vector = embedding
    if (!vector && content) {
      const model = genAI.getGenerativeModel({ model: 'text-embedding-004' })
      const result = await model.embedContent(content)
      vector = result.embedding.values
    }

    if (!vector) {
      return res.status(400).json({ error: 'Could not generate embedding' })
    }

    const candidates: Array<{ type: 'project' | 'thought' | 'article'; id: string; title: string; similarity: number }> = []

    // 2. Search Projects
    if (sourceType !== 'project') {
      const { data: projects } = await supabase
        .from('projects')
        .select('id, title, description, embedding')
        .eq('user_id', userId)
        .not('embedding', 'is', null)
        .limit(50)

      if (projects) {
        for (const p of projects) {
          if (p.embedding) {
            const similarity = cosineSimilarity(vector, p.embedding)
            if (similarity > 0.55) {
              candidates.push({ type: 'project', id: p.id, title: p.title, similarity })
            }
          }
        }
      }
    }

    // 3. Search Memories (Thoughts)
    if (sourceType !== 'thought') {
      const { data: memories } = await supabase
        .from('memories')
        .select('id, title, body, embedding')
        .eq('user_id', userId)
        .neq('id', sourceId) // Don't match self
        .not('embedding', 'is', null)
        .limit(50)

      if (memories) {
        for (const m of memories) {
          if (m.embedding) {
            const similarity = cosineSimilarity(vector, m.embedding)
            if (similarity > 0.55) {
              candidates.push({ type: 'thought', id: m.id, title: m.title || m.body?.slice(0, 50) + '...', similarity })
            }
          }
        }
      }
    }

    // 4. Search Articles
    if (sourceType !== 'article') {
      const { data: articles } = await supabase
        .from('reading_queue')
        .select('id, title, excerpt, embedding')
        .eq('user_id', userId)
        .neq('id', sourceId) // Don't match self
        .not('embedding', 'is', null)
        .limit(50)

      if (articles) {
        for (const a of articles) {
          if (a.embedding) {
            const similarity = cosineSimilarity(vector, a.embedding)
            if (similarity > 0.55) {
              candidates.push({ type: 'article', id: a.id, title: a.title, similarity })
            }
          }
        }
      }
    }

    // Sort by similarity
    candidates.sort((a, b) => b.similarity - a.similarity)

    // 5. Create Suggestions & Auto-links
    const suggestions = []
    const autoLinked = []

    for (const candidate of candidates.slice(0, 10)) {
      // Check for existing connection to avoid duplicates
      const { data: existing } = await supabase
        .from('connections')
        .select('id')
        .or(`and(source_type.eq.${sourceType},source_id.eq.${sourceId},target_type.eq.${candidate.type},target_id.eq.${candidate.id}),and(source_type.eq.${candidate.type},source_id.eq.${candidate.id},target_type.eq.${sourceType},target_id.eq.${sourceId})`)
        .maybeSingle()

      if (existing) continue

      if (candidate.similarity > 0.85) {
        // Auto-create connection
        await supabase
          .from('connections')
          .insert({
            source_type: sourceType,
            source_id: sourceId,
            target_type: candidate.type,
            target_id: candidate.id,
            connection_type: 'relates_to',
            created_by: 'ai',
            ai_reasoning: `${Math.round(candidate.similarity * 100)}% semantic match`
          })
        autoLinked.push(candidate)
      } else {
        // Create suggestion
        suggestions.push({
          from_item_type: sourceType,
          from_item_id: sourceId,
          to_item_type: candidate.type,
          to_item_id: candidate.id,
          reasoning: `${Math.round(candidate.similarity * 100)}% semantic similarity`,
          confidence: candidate.similarity,
          user_id: userId,
          status: 'pending'
        })
      }
    }

    // Batch insert suggestions
    if (suggestions.length > 0) {
      const { error } = await supabase
        .from('connection_suggestions')
        .insert(suggestions)

      if (error) console.error('Failed to insert suggestions:', error)
    }

    return res.status(200).json({
      success: true,
      autoLinked: autoLinked.length,
      suggestions: suggestions.length,
      candidates: candidates.slice(0, 5)
    })

  } catch (error) {
    console.error('[connections] Error:', error)
    return res.status(500).json({
      error: 'Connection search failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
