import { findStructuralHole } from './_lib/serendipity-engine.js'

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getUserId } from './_lib/auth.js'
import { updateItemConnections } from './_lib/connection-logic.js' // New import
import { cosineSimilarity } from './_lib/gemini-embeddings.js' // Ensure this import is present

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!process.env.GEMINI_API_KEY) {
    console.error('[connections] GEMINI_API_KEY is not set. Cannot perform AI operations.')
    return res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY is not set.' })
  }

  const userId = getUserId() // Get the user ID

  // Handle GET requests for listing connections
  if (req.method === 'GET') {
    const { action, id, type } = req.query

    // SERENDIPITY ENGINE (Phase 4)
    if (action === 'serendipity') {
      try {
        const result = await findStructuralHole(userId)
        return res.status(200).json(result || { message: 'No serendipity found (yet)' })
      } catch (error) {
        console.error('[connections] Serendipity error:', error)
        return res.status(500).json({ error: 'Failed to find structural hole' })
      }
    }

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
          const { data } = await supabase.from('projects').select('title, embedding').eq('user_id', userId).eq('id', id).single()
          sourceEmbedding = data?.embedding
          sourceTitle = data?.title || ''
        } else if (type === 'thought') {
          const { data } = await supabase.from('memories').select('title, body, embedding').eq('user_id', userId).eq('id', id).single()
          sourceEmbedding = data?.embedding
          sourceTitle = data?.title || data?.body?.slice(0, 50) || ''
        } else if (type === 'article') {
          const { data } = await supabase.from('reading_queue').select('title, embedding').eq('user_id', userId).eq('id', id).single()
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
              .eq('user_id', userId) // Added user_id filter
              .not('embedding', 'is', null)
              .limit(50)
            items = data || []
          } else if (searchType === 'thought') {
            const { data } = await supabase
              .from('memories')
              .select('id, title, body, embedding')
              .eq('user_id', userId) // Added user_id filter
              .not('embedding', 'is', null)
              .limit(50)
            items = data || []
          } else if (searchType === 'article') {
            const { data } = await supabase
              .from('reading_queue')
              .select('id, title, excerpt, embedding')
              .eq('user_id', userId) // Added user_id filter
              .not('embedding', 'is', null)
              .limit(50)
            items = data || []
          }

          for (const item of items) {
            if (!item.embedding) continue
            const similarity = cosineSimilarity(sourceEmbedding, item.embedding) // Using imported cosineSimilarity
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

    // AI Analysis of item using its connections
    if (action === 'analyze') {
      try {
        if (!id || !type) {
          return res.status(400).json({ error: 'id and type are required' })
        }

        // Get the source item
        let sourceItem: any = null
        let sourceContent = ''

        if (type === 'project') {
          const { data } = await supabase.from('projects').select('*').eq('id', id).single()
          sourceItem = data
          sourceContent = `Project: ${data?.title}\n${data?.description || ''}`
        } else if (type === 'thought' || type === 'memory') {
          const { data } = await supabase.from('memories').select('*').eq('id', id).single()
          sourceItem = data
          sourceContent = `Thought: ${data?.title || ''}\n${data?.body || ''}`
        } else if (type === 'article') {
          const { data } = await supabase.from('reading_queue').select('*').eq('id', id).single()
          sourceItem = data
          sourceContent = `Article: ${data?.title}\n${data?.excerpt || data?.summary || ''}`
        }

        if (!sourceItem) {
          return res.status(404).json({ error: 'Item not found' })
        }

        // Get connections for this item
        const { data: connections } = await supabase
          .from('connections')
          .select('*')
          .eq('user_id', userId) // Added user_id filter
          .or(`and(source_type.eq.${type === 'memory' ? 'thought' : type},source_id.eq.${id}),and(target_type.eq.${type === 'memory' ? 'thought' : type},target_id.eq.${id})`)
          .limit(10)

        // Fetch details for connected items
        const connectedItems: string[] = []
        for (const conn of connections || []) {
          const isSource = (conn.source_type === type || conn.source_type === 'thought' && type === 'memory') && conn.source_id === id
          const relatedType = isSource ? conn.target_type : conn.source_type
          const relatedId = isSource ? conn.target_id : conn.source_id

          let itemText = ''
          if (relatedType === 'thought') {
            const { data } = await supabase.from('memories').select('title, body, themes').eq('user_id', userId).eq('id', relatedId).single()
            itemText = `[Thought] ${data?.title || data?.body?.slice(0, 100) || 'Untitled'} (themes: ${(data?.themes || []).join(', ')})`
          } else if (relatedType === 'project') {
            const { data } = await supabase.from('projects').select('title, description').eq('user_id', userId).eq('id', relatedId).single()
            itemText = `[Project] ${data?.title}: ${data?.description?.slice(0, 100) || ''}`
          } else if (relatedType === 'article') {
            const { data } = await supabase.from('reading_queue').select('title, excerpt').eq('user_id', userId).eq('id', relatedId).single()
            itemText = `[Article] ${data?.title}: ${data?.excerpt?.slice(0, 100) || ''}`
          }
          if (itemText) connectedItems.push(itemText)
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

        // Truncate content to prevent token overflow/timeouts
        const truncatedSource = sourceContent.slice(0, 1000)
        const truncatedConnections = connectedItems.map(i => i.slice(0, 500)).join('\n')

        const analysisPrompt = `You are an insight engine. Analyze this item and its connections to find the "So What?".

CURRENT ITEM:
${truncatedSource}...

CONNECTED ITEMS (${connectedItems.length}):
${connectedItems.length > 0 ? truncatedConnections : 'No connections yet'}

Output valid JSON with:
1. "summary": One punchy sentence on the core idea.
2. "patterns": Array of 1-2 unexpected patterns across items.
3. "insight": One "Aha!" moment. How do these connect to reveal a bigger truth?
4. "suggestion": One concrete next step to advance this thinking.

Keep it brief and high-impact. No fluff.`

        const result = await model.generateContent(analysisPrompt)
        const responseText = result.response.text()

        // Parse JSON from response
        let analysis
        try {
          const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/)
          analysis = jsonMatch ? JSON.parse(jsonMatch[1]) : JSON.parse(responseText)
        } catch {
          // Fallback if JSON parsing fails
          analysis = {
            summary: 'Unable to generate analysis',
            patterns: [],
            insight: '',
            suggestion: 'Try adding more connections to this item'
          }
        }

        return res.status(200).json({
          analysis,
          connectionCount: connections?.length || 0,
          itemType: type,
          itemTitle: sourceItem.title || sourceItem.body?.slice(0, 50) || 'Untitled'
        })

      } catch (error) {
        console.error('[connections] Analysis error:', error)
        return res.status(500).json({ error: 'Failed to analyze item' })
      }
    }

    // On-demand AI actions
    if (action === 'ai-action') {
      try {
        const { actionType } = req.query
        if (!id || !type || !actionType) {
          return res.status(400).json({ error: 'id, type, and actionType are required' })
        }

        // Get the source item
        let sourceContent = ''
        let sourceTitle = ''

        if (type === 'project') {
          const { data } = await supabase.from('projects').select('*').eq('user_id', userId).eq('id', id).single()
          sourceTitle = data?.title || 'Untitled'
          sourceContent = `Project: ${data?.title}\nDescription: ${data?.description || ''}\nStatus: ${data?.status || 'unknown'}`
        } else if (type === 'thought' || type === 'memory') {
          const { data } = await supabase.from('memories').select('*').eq('user_id', userId).eq('id', id).single()
          sourceTitle = data?.title || data?.body?.slice(0, 50) || 'Untitled'
          sourceContent = `Thought: ${data?.title || ''}\n${data?.body || ''}\nThemes: ${(data?.themes || []).join(', ')}`
        } else if (type === 'article') {
          const { data } = await supabase.from('reading_queue').select('*').eq('user_id', userId).eq('id', id).single()
          sourceTitle = data?.title || 'Untitled'
          sourceContent = `Article: ${data?.title}\n${data?.excerpt || data?.summary || ''}`
        }

        // Get connections
        const { data: connections } = await supabase
          .from('connections')
          .select('*')
          .eq('user_id', userId) // Added user_id filter
          .or(`and(source_type.eq.${type === 'memory' ? 'thought' : type},source_id.eq.${id}),and(target_type.eq.${type === 'memory' ? 'thought' : type},target_id.eq.${id})`)
          .limit(10)

        const connectedItems: string[] = []
        for (const conn of connections || []) {
          const isSource = (conn.source_type === type || conn.source_type === 'thought' && type === 'memory') && conn.source_id === id
          const relatedType = isSource ? conn.target_type : conn.source_type
          const relatedId = isSource ? conn.target_id : conn.source_id

          let itemText = ''
          if (relatedType === 'thought') {
            const { data } = await supabase.from('memories').select('title, body, themes').eq('user_id', userId).eq('id', relatedId).single()
            itemText = `[Thought] ${data?.title || data?.body?.slice(0, 100) || 'Untitled'} (themes: ${(data?.themes || []).join(', ')})`
          } else if (relatedType === 'project') {
            const { data } = await supabase.from('projects').select('title, description').eq('user_id', userId).eq('id', relatedId).single()
            itemText = `[Project] ${data?.title}: ${data?.description?.slice(0, 100) || ''}`
          } else if (relatedType === 'article') {
            const { data } = await supabase.from('reading_queue').select('title, excerpt').eq('user_id', userId).eq('id', relatedId).single()
            itemText = `[Article] ${data?.title}: ${data?.excerpt?.slice(0, 100) || ''}`
          }
          if (itemText) connectedItems.push(itemText)
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

        // Truncate content
        const truncatedSource = sourceContent.slice(0, 1000)
        const truncatedConnections = connectedItems.map(i => i.slice(0, 500)).join('\n')

        let prompt = ''
        switch (actionType) {
          case 'summarize':
            prompt = `Synthesize this item and its connections into 2 sentences. What is the core message when viewed together?

ITEM:
${truncatedSource}

CONNECTED ITEMS:
${connectedItems.length > 0 ? truncatedConnections : 'No connections'}`
            break

          case 'find-gaps':
            prompt = `Identify knowledge gaps in this cluster of ideas.

ITEM:
${truncatedSource}

CONNECTED ITEMS:
${connectedItems.length > 0 ? truncatedConnections : 'No connections'}

What key question remains unanswered? Provide 2-3 specific gaps.`
            break

          case 'suggest-next':
            prompt = `Suggest the single most high-impact next step for this topic.

ITEM:
${truncatedSource}

CONNECTED ITEMS:
${connectedItems.length > 0 ? truncatedConnections : 'No connections'}

Be concrete and actionable.`
            break

          case 'connect-dots':
            prompt = `Find the hidden pattern connecting these items.

ITEM:
${truncatedSource}

CONNECTED ITEMS:
${connectedItems.length > 0 ? truncatedConnections : 'No connections'}

What is the non-obvious link?`
            break

          default:
            return res.status(400).json({ error: 'Invalid actionType' })
        }

        const result = await model.generateContent(prompt)
        const responseText = result.response.text()

        return res.status(200).json({
          result: responseText,
          actionType,
          itemTitle: sourceTitle,
          connectionCount: connections?.length || 0
        })

      } catch (error) {
        console.error('[connections] AI action error:', error)
        return res.status(500).json({ error: 'Failed to perform AI action' })
      }
    }

    if (action === 'list-sparks') {
      try {
        // Get connections where this item is either source or target
        const { data: connections, error } = await supabase
          .from('connections')
          .select('*')
          .eq('user_id', userId) // Added user_id filter
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
          let relatedItem: any = null
          if (relatedType === 'thought') {
            const { data } = await supabase.from('memories').select('id, title, body').eq('user_id', userId).eq('id', relatedId).single()
            relatedItem = data
          } else if (relatedType === 'project') {
            const { data } = await supabase.from('projects').select('id, title, description').eq('user_id', userId).eq('id', relatedId).single()
            relatedItem = data
          } else if (relatedType === 'article') {
            const { data } = await supabase.from('reading_queue').select('id, title, excerpt').eq('user_id', userId).eq('id', relatedId).single()
            relatedItem = data
          }

          return {
            connection_id: conn.id,
            related_type: relatedType,
            related_id: relatedId,
            related_item: relatedItem,
            connection_type: conn.connection_type || 'relates_to',
            direction: isSource ? 'outbound' : 'inbound',
            created_by: conn.created_by || 'user',
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

    if (action === 'list-all') {
      try {
        const { data: connections, error } = await supabase
          .from('connections')
          .select('*')
          .eq('user_id', userId)
          .limit(1000) // Reasonable limit for graph view

        if (error) {
          console.error('[connections] Error fetching all:', error)
          return res.status(500).json({ error: 'Failed to fetch connections' })
        }

        return res.status(200).json({ connections })
      } catch (error) {
        console.error('[connections] Error:', error)
        return res.status(500).json({ error: 'Failed to list all connections' })
      }
    }

    return res.status(400).json({ error: 'Invalid action' })
  }

  // Only allow POST requests for creating connections
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { sourceId, sourceType, content, embedding } = req.body // userId is now from getUserId()

    if (!sourceId || !sourceType) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    console.log(`[connections] Finding connections for ${sourceType}:${sourceId} for user: ${userId}`)

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
        .eq('user_id', userId) // Added user_id filter
        .or(`and(source_type.eq.${sourceType},source_id.eq.${sourceId},target_type.eq.${candidate.type},target_id.eq.${candidate.id}),and(source_type.eq.${candidate.type},source_id.eq.${candidate.id},target_type.eq.${sourceType},target_id.eq.${sourceId})`)
        .maybeSingle()

      if (existing) continue

      if (candidate.similarity > 0.85) {
        // Auto-create connection
        await supabase
          .from('connections')
          .insert({
            user_id: userId, // Ensure user_id is set
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