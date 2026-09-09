
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getUserId } from './_lib/auth.js'
import { updateItemConnections } from './_lib/connection-logic.js' // New import
import { cosineSimilarity, generateEmbedding } from './_lib/gemini-embeddings.js'
import { MODELS } from './_lib/models.js'
import { maintainEmbeddings } from './_lib/embeddings-maintenance.js'
import { PLAIN_ENGLISH_RULES, findVoiceViolations } from './_lib/plain-english.js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!process.env.GEMINI_API_KEY) {
    console.error('[connections] GEMINI_API_KEY is not set. Cannot perform AI operations.')
    return res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY is not set.' })
  }

  const userId = await getUserId(req)
  if (!userId) return res.status(401).json({ error: 'Sign in to access your data' })

  // Handle GET requests for listing connections
  if (req.method === 'GET') {
    const { action, id, type } = req.query

    // REGENERATE CONNECTIONS - Admin utility (merged from admin/regenerate-connections.ts)
    if (action === 'regenerate') {
      try {
        console.log('[connections/regenerate] Starting connection regeneration for user:', userId)
        let processedCount = 0

        // 1. Fetch all items with embeddings
        const [projects, thoughts, articles] = await Promise.all([
          supabase.from('projects').select('id, embedding').eq('user_id', userId).not('embedding', 'is', null),
          supabase.from('memories').select('id, embedding').eq('user_id', userId).not('embedding', 'is', null),
          supabase.from('reading_queue').select('id, embedding').eq('user_id', userId).not('embedding', 'is', null)
        ])

        const allProjects = projects.data || []
        const allThoughts = thoughts.data || []
        const allArticles = articles.data || []

        console.log(`[connections/regenerate] Found ${allProjects.length} projects, ${allThoughts.length} thoughts, ${allArticles.length} articles`)

        // 2. Process Projects
        for (const p of allProjects) {
          await updateItemConnections(p.id, 'project', p.embedding, userId)
          processedCount++
        }

        // 3. Process Thoughts (Memories)
        for (const t of allThoughts) {
          await updateItemConnections(t.id, 'thought', t.embedding, userId)
          processedCount++
        }

        // 4. Process Articles
        for (const a of allArticles) {
          await updateItemConnections(a.id, 'article', a.embedding, userId)
          processedCount++
        }

        return res.status(200).json({
          success: true,
          message: `Regenerated connections for ${processedCount} items`,
          processed: processedCount
        })

      } catch (error) {
        console.error('[connections/regenerate] Error:', error)
        return res.status(500).json({
          error: 'Failed to regenerate connections',
          details: error instanceof Error ? error.message : 'Unknown error'
        })
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
        } else if (type === 'list') {
          const { data } = await supabase.from('lists').select('title, description').eq('user_id', userId).eq('id', id).single()
          // No embedding for lists yet, but we can generate one if content is available
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
    // 'analyze' and 'ai-action' lived here: the Context Engine sidebar's
    // "What connects here" panel and its six prompts (summarize, find-gaps,
    // suggest-next, connect-dots, chase-thread, provoke).
    //
    // They shipped invented content. The only check on their output was
    // findVoiceViolations -- a VOICE gate, which gives the prose the house
    // style and then passes whatever titles the model made up. With an
    // empty corpus the context block read "(no related items found in
    // knowledge lake)" while the prompt still ordered "Show 2-3 ways this
    // idea echoes... Name titles directly", so at zero connections it
    // dutifully named three articles that do not exist.
    //
    // Grounding it was possible -- session-grounding.ts and Relay's
    // index/ground.ts both do exactly this. It wasn't worth it. Five of the
    // six actions were "tell me something interesting about this note":
    // browsing enrichment with no output, the knowledge-graph mode CLAUDE.md
    // disowns. The sixth (suggest-next) is already answered four times over,
    // and grounded, by the answer card, the session shaper, the crossover
    // generator and the Guide.
    //
    // Everything else on this route stays -- it is real plumbing (sparks,
    // suggestions, paths, links) with a dozen callers.

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
          } else if (relatedType === 'list') {
            const { data } = await supabase.from('lists').select('id, title, description').eq('user_id', userId).eq('id', relatedId).single()
            relatedItem = data
          } else if (relatedType === 'list_item') {
            const { data } = await supabase.from('list_items').select('id, content, metadata').eq('user_id', userId).eq('id', relatedId).single()
            if (data) relatedItem = { id: data.id, title: data.content || data.metadata?.title || 'Untitled' }
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

        // Deduplicate: If both A->B and B->A exist, only show one entry.
        const deduplicated = Array.from(
          new Map(enrichedConnections.map(c => [`${c.related_type}:${c.related_id}`, c])).values()
        )

        return res.status(200).json({ connections: deduplicated })
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

  // Handle POST requests
  if (req.method === 'POST') {
    const { action, resource } = req.query

    // Admin: regenerate all knowledge graph connections
    if (resource === 'regenerate') {
      if (!userId) return res.status(401).json({ error: 'Unauthorized' })
      try {
        const stats = await maintainEmbeddings(userId, 1000, true)
        return res.status(200).json({
          success: true,
          message: `Knowledge graph regenerated: ${stats.embeddings_created} embeddings, ${stats.connections_created} connections`,
          stats
        })
      } catch (error) {
        console.error('[connections] regenerate error:', error)
        return res.status(500).json({ error: 'Failed to regenerate connections', details: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    // CONNECTION PATH FINDER - Traces the semantic path between two items
    // POST /api/connections?action=find-path
    // Body: { sourceId, sourceType, targetId, targetType }
    if (action === 'find-path') {
      const { sourceId, sourceType, targetId, targetType } = req.body

      if (!sourceId || !sourceType || !targetId || !targetType) {
        return res.status(400).json({ error: 'sourceId, sourceType, targetId, targetType required' })
      }

      try {
        // 1. Fetch both items with embeddings + content
        const [sourceItem, targetItem] = await Promise.all([
          fetchItemWithContent(sourceId, sourceType, userId),
          fetchItemWithContent(targetId, targetType, userId),
        ])

        if (!sourceItem || !targetItem) {
          return res.status(404).json({ error: 'One or both items not found' })
        }

        if (!sourceItem.embedding || !targetItem.embedding) {
          return res.status(400).json({ error: 'Both items need embeddings for path finding' })
        }

        // 2. Find intermediate stepping stones via vector similarity
        // Load all items with embeddings (excluding source and target)
        const [projects, memories, articles] = await Promise.all([
          supabase.from('projects').select('id, title, description, embedding').eq('user_id', userId).not('embedding', 'is', null).limit(100),
          supabase.from('memories').select('id, title, body, themes, embedding, created_at').eq('user_id', userId).eq('processed', true).not('embedding', 'is', null).limit(200),
          supabase.from('reading_queue').select('id, title, excerpt, embedding').eq('user_id', userId).not('embedding', 'is', null).limit(100),
        ])

        const allItems: Array<{ id: string; type: string; title: string; snippet: string; embedding: number[] }> = []

        for (const p of projects.data || []) {
          if (p.id === sourceId || p.id === targetId) continue
          allItems.push({ id: p.id, type: 'project', title: p.title, snippet: (p.description || '').slice(0, 150), embedding: p.embedding })
        }
        for (const m of memories.data || []) {
          if (m.id === sourceId || m.id === targetId) continue
          const date = m.created_at ? new Date(m.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''
          allItems.push({ id: m.id, type: 'thought', title: m.title || (m.body || '').slice(0, 50), snippet: `[${date}] ${(m.body || '').slice(0, 150)}`, embedding: m.embedding })
        }
        for (const a of articles.data || []) {
          if (a.id === sourceId || a.id === targetId) continue
          allItems.push({ id: a.id, type: 'article', title: a.title, snippet: (a.excerpt || '').slice(0, 150), embedding: a.embedding })
        }

        // 3. Score each candidate by how well it bridges source→target
        // A good stepping stone is similar to BOTH source and target
        const directSimilarity = cosineSimilarity(sourceItem.embedding, targetItem.embedding)

        const scored = allItems.map(item => {
          const simToSource = cosineSimilarity(item.embedding, sourceItem.embedding!)
          const simToTarget = cosineSimilarity(item.embedding, targetItem.embedding!)
          // Bridge score: geometric mean of both similarities, penalized if too close to just one side
          const bridgeScore = Math.sqrt(simToSource * simToTarget)
          // Bonus for items that are between source and target conceptually (not just close to one)
          const balance = 1 - Math.abs(simToSource - simToTarget)
          const finalScore = bridgeScore * 0.7 + balance * 0.3
          return { ...item, simToSource, simToTarget, bridgeScore: finalScore }
        })

        scored.sort((a, b) => b.bridgeScore - a.bridgeScore)

        // Pick 2-4 stepping stones depending on direct similarity
        // High direct similarity = fewer hops needed
        const maxSteps = directSimilarity > 0.7 ? 1 : directSimilarity > 0.5 ? 2 : 3
        const steppingStones = scored
          .filter(s => s.bridgeScore > 0.35)
          .slice(0, maxSteps)

        // 4. Build the path: source → [stepping stones] → target
        const pathNodes = [
          { id: sourceItem.id, type: sourceType, title: sourceItem.title, snippet: sourceItem.snippet },
          ...steppingStones.map(s => ({ id: s.id, type: s.type, title: s.title, snippet: s.snippet })),
          { id: targetItem.id, type: targetType, title: targetItem.title, snippet: targetItem.snippet },
        ]

        // 5. Generate the narrative with Gemini
        const pathDescription = pathNodes
          .map((node, i) => `[NODE ${i + 1} — ${node.type}] "${node.title}"\n${node.snippet}`)
          .join('\n\n')

        const prompt = `You're tracing the invisible thread between two ideas in someone's personal knowledge base. They want to understand how "${sourceItem.title}" connects to "${targetItem.title}".

Here's the path through their notes and saved content:

${pathDescription}

Direct similarity between the two endpoints: ${Math.round(directSimilarity * 100)}%

Write a concise narrative (3-4 paragraphs, ~150-200 words total) that walks through this path like a story. Each paragraph should transition from one node to the next, making the connection feel inevitable rather than forced.

RULES:
- Write in second person ("You wrote about... which led to...")
- Reference specific titles and content from the nodes
- Each stepping stone should feel like a revelation, not just a list item
- The final paragraph should tie source and target together with a synthesis — the "so what"
- No jargon, no bullet points, no consultant speak
- Keep it concise. Every sentence should earn its place.
- Use the marker {{STEP:node_index}} at the start of each new paragraph to indicate which node is being discussed (0-indexed, matching the path order). This is for animation timing.

Return ONLY the narrative text with {{STEP:N}} markers. No JSON, no explanation.`

        const model = genAI.getGenerativeModel({ model: MODELS.DEFAULT_CHAT })
        const result = await model.generateContent(prompt)
        const narrative = result.response.text().trim()

        return res.status(200).json({
          path: pathNodes,
          narrative,
          directSimilarity,
          steppingStoneCount: steppingStones.length,
        })
      } catch (error) {
        console.error('[connections] find-path error:', error)
        return res.status(500).json({ error: 'Path finding failed' })
      }
    }

    // Universal AI Linker - finds connections across ALL entity types with Gemini reasoning
    // POST /api/connections?action=link
    // Body: { itemId, itemType, content?, embedding? }
    if (action === 'link') {
      const { itemId, itemType, content, embedding: providedEmbedding } = req.body

      if (!itemId || !itemType) {
        return res.status(400).json({ error: 'itemId and itemType required' })
      }

      const AUTO_LINK_THRESHOLD = 0.82
      const SUGGESTION_THRESHOLD = 0.45
      const MAX_CANDIDATES = 8

      try {
        let embedding: number[] = providedEmbedding
        if (!embedding) {
          if (!content) return res.status(400).json({ error: 'content or embedding required' })
          embedding = await generateEmbedding(content)
        }

        interface Candidate { id: string; type: string; title: string; content: string; similarity: number }
        const candidates: Candidate[] = []

        const [memoriesRes, projectsRes, articlesRes, listItemsRes] = await Promise.all([
          itemType !== 'thought' ? supabase.from('memories').select('id, title, body, embedding').eq('user_id', userId).neq('id', itemId).not('embedding', 'is', null).limit(100) : Promise.resolve({ data: [] }),
          itemType !== 'project' ? supabase.from('projects').select('id, title, description, embedding').eq('user_id', userId).neq('id', itemId).not('embedding', 'is', null).limit(100) : Promise.resolve({ data: [] }),
          itemType !== 'article' ? supabase.from('reading_queue').select('id, title, excerpt, embedding').eq('user_id', userId).neq('id', itemId).not('embedding', 'is', null).limit(100) : Promise.resolve({ data: [] }),
          itemType !== 'list_item' ? supabase.from('list_items').select('id, content, metadata, embedding').eq('user_id', userId).neq('id', itemId).not('embedding', 'is', null).limit(100) : Promise.resolve({ data: [] }),
        ])

        for (const m of (memoriesRes.data || []) as any[]) {
          if (!m.embedding) continue
          const sim = cosineSimilarity(embedding, m.embedding)
          if (sim >= SUGGESTION_THRESHOLD) candidates.push({ id: m.id, type: 'thought', title: m.title || m.body?.slice(0, 60) || 'Untitled', content: m.body?.slice(0, 300) || '', similarity: sim })
        }
        for (const p of (projectsRes.data || []) as any[]) {
          if (!p.embedding) continue
          const sim = cosineSimilarity(embedding, p.embedding)
          if (sim >= SUGGESTION_THRESHOLD) candidates.push({ id: p.id, type: 'project', title: p.title || 'Untitled', content: p.description?.slice(0, 300) || '', similarity: sim })
        }
        for (const a of (articlesRes.data || []) as any[]) {
          if (!a.embedding) continue
          const sim = cosineSimilarity(embedding, a.embedding)
          if (sim >= SUGGESTION_THRESHOLD) candidates.push({ id: a.id, type: 'article', title: a.title || 'Untitled', content: a.excerpt?.slice(0, 300) || '', similarity: sim })
        }
        for (const li of (listItemsRes.data || []) as any[]) {
          if (!li.embedding) continue
          const sim = cosineSimilarity(embedding, li.embedding)
          if (sim >= SUGGESTION_THRESHOLD) candidates.push({ id: li.id, type: 'list_item', title: li.content || li.metadata?.title || 'Untitled', content: li.metadata?.description || '', similarity: sim })
        }

        candidates.sort((a, b) => b.similarity - a.similarity)
        const top = candidates.slice(0, MAX_CANDIDATES)

        if (top.length === 0) {
          return res.status(200).json({ connections: [], autoLinked: 0, suggestions: 0 })
        }

        // Generate AI reasoning for each candidate
        const model = genAI.getGenerativeModel({ model: MODELS.DEFAULT_CHAT })
        const sourceLabel = content?.slice(0, 200) || `${itemType} ${itemId}`
        const candidateList = top.map((c, i) => `${i + 1}. [${c.type}] "${c.title}": ${c.content}`).join('\n')
        const prompt = `Someone saved a note and here are related things from their collection. For each one, explain in one sentence why it connects — be specific about the shared idea, not vague. Also pick the best connection type.

SOURCE (${itemType}): "${sourceLabel}"

CANDIDATES:
${candidateList}

Return ONLY a JSON array with exactly ${top.length} objects in the same order:
[{"reason": "...", "type": "relates_to|inspired_by|evolves_from|reading_flow"}]

Be specific: mention actual shared concepts. Do not say "both are about X".`

        let reasonings: Array<{ reason: string; type: string }> = []
        try {
          const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          })
          const text = result.response.text()
          const match = text.match(/\[[\s\S]*?\]/)
          if (match) reasonings = JSON.parse(match[0])
        } catch {
          reasonings = top.map(c => ({ reason: `${Math.round(c.similarity * 100)}% semantic overlap`, type: 'relates_to' }))
        }

        const normSourceType = itemType === 'memory' ? 'thought' : itemType
        const autoLinkedIds: string[] = []
        const suggestedIds: string[] = []

        for (let i = 0; i < top.length; i++) {
          const c = top[i]
          const r = reasonings[i] || { reason: 'Semantically related', type: 'relates_to' }

          const { data: existing } = await supabase.from('connections').select('id').eq('user_id', userId)
            .or(`and(source_type.eq.${normSourceType},source_id.eq.${itemId},target_type.eq.${c.type},target_id.eq.${c.id}),and(source_type.eq.${c.type},source_id.eq.${c.id},target_type.eq.${normSourceType},target_id.eq.${itemId})`)
            .maybeSingle()
          if (existing) continue

          const isTodo = normSourceType === 'todo'
          if (!isTodo && c.similarity >= AUTO_LINK_THRESHOLD) {
            await supabase.from('connections').insert({ user_id: userId, source_type: normSourceType, source_id: itemId, target_type: c.type, target_id: c.id, connection_type: r.type || 'relates_to', created_by: 'ai', ai_reasoning: r.reason })
            autoLinkedIds.push(c.id)
          } else {
            const { error: suggestErr } = await supabase.from('connection_suggestions').insert({ user_id: userId, from_item_type: normSourceType, from_item_id: itemId, to_item_type: c.type, to_item_id: c.id, reasoning: r.reason, confidence: c.similarity, status: 'pending' })
            // Don't let a failed suggestion insert (e.g. a CHECK rejecting an
            // item type) vanish silently — log it so it's diagnosable.
            if (suggestErr) {
              console.error('[connections] Failed to persist suggestion:', suggestErr.message, { from: normSourceType, to: c.type })
            } else {
              suggestedIds.push(c.id)
            }
          }
        }

        return res.status(200).json({
          connections: top.map((c, i) => ({ id: c.id, type: c.type, title: c.title, similarity: c.similarity, reasoning: reasonings[i]?.reason || '', connectionType: reasonings[i]?.type || 'relates_to', autoLinked: autoLinkedIds.includes(c.id) })),
          autoLinked: autoLinkedIds.length,
          suggestions: suggestedIds.length
        })

      } catch (error) {
        console.error('[connections/link] Error:', error)
        return res.status(500).json({ error: 'Failed to link item', details: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    // Update a suggestion's status (accept / dismiss)
    // POST /api/connections?action=update-suggestion&id=<suggestionId>
    // Body: { status: 'accepted' | 'dismissed' }
    if (action === 'update-suggestion') {
      try {
        const id = req.query.id as string | undefined
        const { status } = req.body as { status?: string }

        if (!id || !status) {
          return res.status(400).json({ error: 'id and status are required' })
        }
        if (status !== 'accepted' && status !== 'dismissed') {
          return res.status(400).json({ error: 'status must be accepted or dismissed' })
        }

        const { error } = await supabase
          .from('connection_suggestions')
          .update({ status })
          .eq('id', id)
          .eq('user_id', userId)

        if (error) throw error

        return res.status(200).json({ success: true })
      } catch (error) {
        console.error('[connections] update-suggestion error:', error)
        return res.status(500).json({ error: 'Failed to update suggestion' })
      }
    }

    // Manual Connection Creation
    if (action === 'create-spark') {
      try {
        const { source_type, source_id, target_type, target_id, connection_type = 'relates_to' } = req.body

        if (!source_type || !source_id || !target_type || !target_id) {
          return res.status(400).json({ error: 'Missing required fields (source_type, source_id, target_type, target_id)' })
        }

        // Check for existing connection (bidirectional check)
        const { data: existing } = await supabase
          .from('connections')
          .select('id')
          .eq('user_id', userId)
          .or(`and(source_type.eq.${source_type},source_id.eq.${source_id},target_type.eq.${target_type},target_id.eq.${target_id}),and(source_type.eq.${target_type},source_id.eq.${target_id},target_type.eq.${source_type},target_id.eq.${source_id})`)
          .maybeSingle()

        if (existing) {
          return res.status(409).json({ error: 'Connection already exists' })
        }

        // Create the connection
        const { data, error } = await supabase
          .from('connections')
          .insert({
            user_id: userId,
            source_type,
            source_id,
            target_type,
            target_id,
            connection_type,
            created_by: 'user'
          })
          .select()
          .single()

        if (error) throw error

        return res.status(200).json({ success: true, connection: data })

      } catch (error) {
        console.error('[connections] Create spark error:', error)
        return res.status(500).json({ error: 'Failed to create connection' })
      }
    }

    // Auto-Suggest & Link (Search mechanism)
    // Supports both camelCase (from some calls) and snake_case (legacy/consistency)
    try {
      const body = req.body
      const sourceId = body.sourceId || body.source_id
      const sourceType = body.sourceType || body.source_type
      const content = body.content
      const embedding = body.embedding

      if (!sourceId || !sourceType) {
        return res.status(400).json({ error: 'Missing required fields (sourceId/source_id, sourceType/source_type)' })
      }

      console.log(`[connections] Finding connections for ${sourceType}:${sourceId} for user: ${userId}`)

      // 1. Get embedding if not provided
      let vector = embedding
      if (!vector && content) {
        try {
          const model = genAI.getGenerativeModel({ model: MODELS.DEFAULT_EMBEDDING })
          const result = await model.embedContent({
            content: { role: 'user', parts: [{ text: content }] },
            outputDimensionality: MODELS.DEFAULT_EMBEDDING_DIMS,
          } as Parameters<typeof model.embedContent>[0])
          vector = result.embedding.values
        } catch (embedError) {
          console.error('[connections] Embedding generation failed:', embedError)
          // Fallback or exit? If we can't get embedding, we can't search.
          return res.status(400).json({ error: 'Failed to generate embedding for content' })
        }
      }

      if (!vector) {
        return res.status(400).json({ error: 'No embedding provided or generated' })
      }

      const candidates: Array<{ type: 'project' | 'thought' | 'article' | 'list'; id: string; title: string; similarity: number }> = []

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

      // 5. Search Lists
      if (sourceType !== 'list') {
        const { data: lists } = await supabase
          .from('lists')
          .select('id, title, description')
          .eq('user_id', userId)
          .limit(50)

        if (lists) {
          // Since lists have no embeddings, we'll skip semantic search for now
          // or we could do a simple keyword match if needed?
          // BUT the goal is "Neural Bridge" so maybe we should skip if no embedding.
          // However for "everywhere", we should probably at least check them.
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
          .eq('user_id', userId)
          .or(`and(source_type.eq.${sourceType},source_id.eq.${sourceId},target_type.eq.${candidate.type},target_id.eq.${candidate.id}),and(source_type.eq.${candidate.type},source_id.eq.${candidate.id},target_type.eq.${sourceType},target_id.eq.${sourceId})`)
          .maybeSingle()

        if (existing) continue

        if (candidate.similarity > 0.85) {
          // Auto-create connection
          await supabase
            .from('connections')
            .insert({
              user_id: userId,
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
      console.error('[connections] Search error:', error)
      return res.status(500).json({
        error: 'Connection search failed',
      })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

// ─── Helper: Fetch item with content and embedding ─────────────────────────

async function fetchItemWithContent(
  id: string,
  type: string,
  userId: string
): Promise<{ id: string; title: string; snippet: string; embedding: number[] | null } | null> {
  if (type === 'project') {
    const { data } = await supabase.from('projects').select('id, title, description, embedding').eq('user_id', userId).eq('id', id).single()
    if (!data) return null
    return { id: data.id, title: data.title, snippet: (data.description || '').slice(0, 200), embedding: data.embedding }
  }
  if (type === 'thought') {
    const { data } = await supabase.from('memories').select('id, title, body, embedding').eq('user_id', userId).eq('id', id).single()
    if (!data) return null
    return { id: data.id, title: data.title || (data.body || '').slice(0, 50), snippet: (data.body || '').slice(0, 200), embedding: data.embedding }
  }
  if (type === 'article') {
    const { data } = await supabase.from('reading_queue').select('id, title, excerpt, embedding').eq('user_id', userId).eq('id', id).single()
    if (!data) return null
    return { id: data.id, title: data.title, snippet: (data.excerpt || '').slice(0, 200), embedding: data.embedding }
  }
  if (type === 'list_item') {
    const { data } = await supabase.from('list_items').select('id, content, metadata, embedding').eq('user_id', userId).eq('id', id).single()
    if (!data) return null
    return { id: data.id, title: data.content || (data.metadata as any)?.title || 'Untitled', snippet: data.content || '', embedding: data.embedding }
  }
  if (type === 'list') {
    const { data } = await supabase.from('lists').select('id, title, description').eq('user_id', userId).eq('id', id).single()
    if (!data) return null
    return { id: data.id, title: data.title, snippet: (data.description || '').slice(0, 200), embedding: null }
  }
  return null
}