
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getUserId } from './_lib/auth.js'
import { updateItemConnections } from './_lib/connection-logic.js' // New import
import { cosineSimilarity, generateEmbedding } from './_lib/gemini-embeddings.js'
import { MODELS } from './_lib/models.js'
import { maintainEmbeddings } from './_lib/embeddings-maintenance.js'

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

    // SERENDIPITY ENGINE - DEPRECATED
    if (action === 'serendipity') {
      return res.status(410).json({ error: 'Serendipity Engine has been deprecated.' })
    }

    // REGENERATE CONNECTIONS - Admin utility (merged from admin/regenerate-connections.ts)
    if (action === 'regenerate') {
      try {
        console.log('[connections/regenerate] Starting connection regeneration for user:', userId)
        let processedCount = 0

        // 1. Fetch all items with embeddings
        const [projects, thoughts, articles] = await Promise.all([
          supabase.from('projects').select('id, embedding').eq('user_id', userId).not('embedding', 'is', null),
          supabase.from('memories').select('id, embedding').not('embedding', 'is', null),
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
    if (action === 'analyze') {
      try {
        if (!id || !type) {
          return res.status(400).json({ error: 'id and type are required' })
        }

        // Get the source item including embedding for semantic search
        let sourceItem: any = null
        let sourceContent = ''
        let sourceEmbedding: number[] | null = null

        if (type === 'project') {
          const { data } = await supabase.from('projects').select('*').eq('id', id).single()
          sourceItem = data
          sourceContent = `Project: ${data?.title}\n${data?.description || ''}`
          sourceEmbedding = data?.embedding || null
        } else if (type === 'thought' || type === 'memory') {
          const { data } = await supabase.from('memories').select('*').eq('id', id).single()
          sourceItem = data
          sourceContent = `Thought: ${data?.title || ''}\n${data?.body || ''}`
          sourceEmbedding = data?.embedding || null
        } else if (type === 'article') {
          const { data } = await supabase.from('reading_queue').select('*').eq('id', id).single()
          sourceItem = data
          sourceContent = `Article: ${data?.title}\n${data?.excerpt || data?.summary || ''}`
          sourceEmbedding = data?.embedding || null
        } else if (type === 'list') {
          const { data } = await supabase.from('lists').select('*').eq('id', id).single()
          sourceItem = data
          sourceContent = `List: ${data?.title}\n${data?.description || ''}`
        }

        if (!sourceItem) {
          return res.status(404).json({ error: 'Item not found' })
        }

        // Get saved connections for this item
        const { data: connections } = await supabase
          .from('connections')
          .select('*')
          .eq('user_id', userId)
          .or(`and(source_type.eq.${type === 'memory' ? 'thought' : type},source_id.eq.${id}),and(target_type.eq.${type === 'memory' ? 'thought' : type},target_id.eq.${id})`)
          .limit(10)

        const connectedItems: string[] = []
        const uniqueRelatedItems = new Map<string, string>()

        for (const conn of connections || []) {
          const isSource = (conn.source_type === type || conn.source_type === 'thought' && type === 'memory') && conn.source_id === id
          const relatedType = isSource ? conn.target_type : conn.source_type
          const relatedId = isSource ? conn.target_id : conn.source_id
          const key = `${relatedType}:${relatedId}`

          if (uniqueRelatedItems.has(key)) continue

          let itemText = ''
          if (relatedType === 'thought') {
            const { data } = await supabase.from('memories').select('title, body, themes').eq('user_id', userId).eq('id', relatedId).single()
            itemText = `[Thought] "${data?.title || data?.body?.slice(0, 100) || 'Untitled'}"${data?.themes?.length ? ` (themes: ${(data.themes as string[]).join(', ')})` : ''}`
          } else if (relatedType === 'project') {
            const { data } = await supabase.from('projects').select('title, description').eq('user_id', userId).eq('id', relatedId).single()
            itemText = `[Project] "${data?.title}": ${data?.description?.slice(0, 100) || ''}`
          } else if (relatedType === 'article') {
            const { data } = await supabase.from('reading_queue').select('title, excerpt').eq('user_id', userId).eq('id', relatedId).single()
            itemText = `[Article] "${data?.title}": ${data?.excerpt?.slice(0, 100) || ''}`
          }
          if (itemText) {
            connectedItems.push(itemText)
            uniqueRelatedItems.set(key, itemText)
          }
        }

        // --- Semantic similarity search across the FULL knowledge lake ---
        // Fetches ALL entity types (including same-type as source) — excluding only the source item itself
        const semanticItems: string[] = []
        if (sourceEmbedding) {
          const [memoriesRes, articlesRes, projectsRes, listItemsRes] = await Promise.all([
            supabase.from('memories').select('id, title, body, themes, embedding').eq('user_id', userId).neq('id', id).not('embedding', 'is', null).limit(150),
            supabase.from('reading_queue').select('id, title, excerpt, embedding').eq('user_id', userId).neq('id', id).not('embedding', 'is', null).limit(100),
            supabase.from('projects').select('id, title, description, embedding').eq('user_id', userId).neq('id', id).not('embedding', 'is', null).limit(100),
            supabase.from('list_items').select('id, content, metadata, embedding').eq('user_id', userId).not('embedding', 'is', null).limit(100),
          ])

          interface ScoredItem { label: string; score: number }
          const scored: ScoredItem[] = []

          for (const m of (memoriesRes.data || [])) {
            if (!m.embedding) continue
            const sim = cosineSimilarity(sourceEmbedding, m.embedding)
            if (sim > 0.3) scored.push({ label: `[Thought] "${m.title || m.body?.slice(0, 80) || 'Untitled'}"${m.themes?.length ? ` (${(m.themes as string[]).slice(0, 3).join(', ')})` : ''}`, score: sim })
          }
          for (const a of (articlesRes.data || [])) {
            if (!a.embedding) continue
            const sim = cosineSimilarity(sourceEmbedding, a.embedding)
            if (sim > 0.3) scored.push({ label: `[Article] "${a.title}": ${a.excerpt?.slice(0, 80) || ''}`, score: sim })
          }
          for (const p of (projectsRes.data || [])) {
            if (!p.embedding) continue
            const sim = cosineSimilarity(sourceEmbedding, p.embedding)
            if (sim > 0.3) scored.push({ label: `[Project] "${p.title}": ${p.description?.slice(0, 80) || ''}`, score: sim })
          }
          for (const li of (listItemsRes.data || [])) {
            if (!li.embedding) continue
            const sim = cosineSimilarity(sourceEmbedding, li.embedding)
            const label = li.content || li.metadata?.title || 'Untitled'
            const listName = li.metadata?.list_title || li.metadata?.list_name || ''
            if (sim > 0.3) scored.push({ label: `[List Item] "${label}"${listName ? ` (from ${listName})` : ''}`, score: sim })
          }

          scored.sort((a, b) => b.score - a.score)
          for (const item of scored.slice(0, 20)) {
            if (!uniqueRelatedItems.has(item.label)) semanticItems.push(item.label)
          }
        }

        const allContextItems = [...connectedItems, ...semanticItems.slice(0, Math.max(0, 20 - connectedItems.length))]
        const model = genAI.getGenerativeModel({ model: MODELS.DEFAULT_CHAT })
        const truncatedSource = sourceContent.slice(0, 1000)
        const contextBlock = allContextItems.length > 0
          ? allContextItems.map(i => `- ${i.slice(0, 200)}`).join('\n')
          : '(no related items found in knowledge lake)'

        const analysisPrompt = `You've read all of someone's notes, saved articles, and projects. Your job is to connect things they haven't connected yet — not summarize. Be specific, not impressive.

FOCUS ITEM:
${truncatedSource}

KNOWLEDGE LAKE — ${allContextItems.length} items from their entire corpus (thoughts, articles, projects, lists):
${contextBlock}

${allContextItems.length === 0 ? 'NOTE: This is a fresh item with no prior context yet — analyze it on its own merits and suggest what territory it opens up.\n\n' : ''}
Output ONLY valid JSON with exactly these 4 keys:

1. "summary": One razor-sharp sentence. Not what the item says — what it MEANS in the context of everything else. What is this person actually working on, thinking about, or moving toward?

2. "patterns": Array of 2-3 non-obvious patterns. Each must name SPECIFIC items from the lake and explain the connection. Don't say "both relate to X" — say WHY these two things appearing together in the same mind is surprising and what it reveals.

3. "insight": The "Aha!" that would make this person stop and say "I hadn't seen it that way." What does the corpus reveal about this item that the person couldn't see without having everything in front of them? Reference specific items. Be bold. Be specific.

4. "suggestion": One concrete, actionable next step. Not "explore more" — name exactly what they should make, write, build, or decide based on what you see in their corpus. Reference specific items and why.

Rules: Name actual titles. No generic observations. No hedging. Write like someone who has read every note they've ever taken and has something urgent to say.`

        let responseText = ''
        try {
          const result = await model.generateContent(analysisPrompt)
          responseText = result.response.text()
        } catch (apiError: any) {
          console.error('[connections] Gemini API Error during analyze:', apiError)
          return res.status(502).json({ error: 'AI Service unavailable', details: apiError.message })
        }

        let analysis
        try {
          const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/)
          analysis = jsonMatch ? JSON.parse(jsonMatch[1]) : JSON.parse(responseText)
        } catch {
          console.warn('[connections] Failed to parse JSON analysis, using fallback')
          analysis = {
            summary: 'Analysis generated but formatting failed.',
            patterns: [],
            insight: responseText.slice(0, 200),
            suggestion: 'Try again.'
          }
        }

        return res.status(200).json({
          analysis,
          connectionCount: connections?.length || 0,
          lakeItemCount: allContextItems.length,
          semanticCount: semanticItems.length,
          itemType: type,
          itemTitle: sourceItem.title || sourceItem.body?.slice(0, 50) || 'Untitled'
        })

      } catch (error: any) {
        console.error('[connections] Analysis general error:', error)
        return res.status(500).json({ error: 'Failed to analyze item', details: error.message })
      }
    }

    // On-demand AI actions — knowledge-lake-aware
    if (action === 'ai-action') {
      try {
        const { actionType } = req.query
        if (!id || !type || !actionType) {
          return res.status(400).json({ error: 'id, type, and actionType are required' })
        }

        // Get the source item including its embedding
        let sourceContent = ''
        let sourceTitle = ''
        let sourceEmbedding: number[] | null = null

        if (type === 'project') {
          const { data } = await supabase.from('projects').select('*').eq('user_id', userId).eq('id', id).single()
          sourceTitle = data?.title || 'Untitled'
          sourceContent = `Project: ${data?.title}\nDescription: ${data?.description || ''}\nStatus: ${data?.status || 'unknown'}`
          sourceEmbedding = data?.embedding || null
        } else if (type === 'thought' || type === 'memory') {
          const { data } = await supabase.from('memories').select('*').eq('user_id', userId).eq('id', id).single()
          sourceTitle = data?.title || data?.body?.slice(0, 50) || 'Untitled'
          sourceContent = `Thought: ${data?.title || ''}\n${data?.body || ''}\nThemes: ${(data?.themes || []).join(', ')}`
          sourceEmbedding = data?.embedding || null
        } else if (type === 'article') {
          const { data } = await supabase.from('reading_queue').select('*').eq('user_id', userId).eq('id', id).single()
          sourceTitle = data?.title || 'Untitled'
          sourceContent = `Article: ${data?.title}\n${data?.excerpt || data?.summary || ''}`
          sourceEmbedding = data?.embedding || null
        } else if (type === 'list') {
          const { data } = await supabase.from('lists').select('*').eq('user_id', userId).eq('id', id).single()
          sourceTitle = data?.title || 'Untitled'
          sourceContent = `List: ${data?.title}\n${data?.description || ''}`
        }

        // --- Fetch saved connections ---
        const { data: connections } = await supabase
          .from('connections')
          .select('*')
          .eq('user_id', userId)
          .or(`and(source_type.eq.${type === 'memory' ? 'thought' : type},source_id.eq.${id}),and(target_type.eq.${type === 'memory' ? 'thought' : type},target_id.eq.${id})`)
          .limit(10)

        const connectedItems: string[] = []
        const uniqueRelatedItems = new Map<string, string>()

        for (const conn of connections || []) {
          const isSource = (conn.source_type === type || conn.source_type === 'thought' && type === 'memory') && conn.source_id === id
          const relatedType = isSource ? conn.target_type : conn.source_type
          const relatedId = isSource ? conn.target_id : conn.source_id
          const key = `${relatedType}:${relatedId}`

          if (uniqueRelatedItems.has(key)) continue

          let itemText = ''
          if (relatedType === 'thought') {
            const { data } = await supabase.from('memories').select('title, body, themes').eq('user_id', userId).eq('id', relatedId).single()
            itemText = `[Thought] "${data?.title || data?.body?.slice(0, 100) || 'Untitled'}"${data?.themes?.length ? ` (themes: ${data.themes.join(', ')})` : ''}`
          } else if (relatedType === 'project') {
            const { data } = await supabase.from('projects').select('title, description').eq('user_id', userId).eq('id', relatedId).single()
            itemText = `[Project] "${data?.title}": ${data?.description?.slice(0, 100) || ''}`
          } else if (relatedType === 'article') {
            const { data } = await supabase.from('reading_queue').select('title, excerpt').eq('user_id', userId).eq('id', relatedId).single()
            itemText = `[Article] "${data?.title}": ${data?.excerpt?.slice(0, 100) || ''}`
          }
          if (itemText) {
            connectedItems.push(itemText)
            uniqueRelatedItems.set(key, itemText)
          }
        }

        // --- Semantic similarity search across the FULL knowledge lake ---
        // Fetches ALL entity types (including same-type as source) — excluding only the source item itself
        const semanticItems: string[] = []
        if (sourceEmbedding) {
          const [memoriesRes, articlesRes, projectsRes, listItemsRes] = await Promise.all([
            supabase.from('memories').select('id, title, body, themes, embedding').eq('user_id', userId).neq('id', id).not('embedding', 'is', null).limit(150),
            supabase.from('reading_queue').select('id, title, excerpt, embedding').eq('user_id', userId).neq('id', id).not('embedding', 'is', null).limit(100),
            supabase.from('projects').select('id, title, description, embedding').eq('user_id', userId).neq('id', id).not('embedding', 'is', null).limit(100),
            supabase.from('list_items').select('id, content, metadata, embedding').eq('user_id', userId).not('embedding', 'is', null).limit(100),
          ])

          interface ScoredItem { label: string; score: number }
          const scored: ScoredItem[] = []

          for (const m of (memoriesRes.data || [])) {
            if (!m.embedding) continue
            const sim = cosineSimilarity(sourceEmbedding, m.embedding)
            if (sim > 0.3) scored.push({ label: `[Thought] "${m.title || m.body?.slice(0, 80) || 'Untitled'}"${m.themes?.length ? ` (${m.themes.slice(0, 3).join(', ')})` : ''}`, score: sim })
          }
          for (const a of (articlesRes.data || [])) {
            if (!a.embedding) continue
            const sim = cosineSimilarity(sourceEmbedding, a.embedding)
            if (sim > 0.3) scored.push({ label: `[Article] "${a.title}": ${a.excerpt?.slice(0, 80) || ''}`, score: sim })
          }
          for (const p of (projectsRes.data || [])) {
            if (!p.embedding) continue
            const sim = cosineSimilarity(sourceEmbedding, p.embedding)
            if (sim > 0.3) scored.push({ label: `[Project] "${p.title}": ${p.description?.slice(0, 80) || ''}`, score: sim })
          }
          for (const li of (listItemsRes.data || [])) {
            if (!li.embedding) continue
            const sim = cosineSimilarity(sourceEmbedding, li.embedding)
            const label = li.content || li.metadata?.title || 'Untitled'
            const listName = li.metadata?.list_title || li.metadata?.list_name || ''
            if (sim > 0.3) scored.push({ label: `[List Item] "${label}"${listName ? ` (from ${listName})` : ''}`, score: sim })
          }

          scored.sort((a, b) => b.score - a.score)

          for (const item of scored.slice(0, 20)) {
            if (!uniqueRelatedItems.has(item.label)) {
              semanticItems.push(item.label)
            }
          }
        }

        // Combine saved connections + semantic corpus items
        const allContextItems = [...connectedItems, ...semanticItems.slice(0, Math.max(0, 20 - connectedItems.length))]

        const model = genAI.getGenerativeModel({ model: MODELS.DEFAULT_CHAT })
        const truncatedSource = sourceContent.slice(0, 1200)
        const contextBlock = allContextItems.length > 0
          ? allContextItems.map(i => `- ${i}`).join('\n')
          : '(no related items found in knowledge lake)'

        const corpusSize = allContextItems.length
        const savedCount = connectedItems.length
        const semanticCount = semanticItems.length

        let prompt = ''
        switch (actionType) {
          case 'summarize':
            prompt = `You've read all of someone's notes and saved stuff. Connect the dots they haven't connected yet.

FOCUS ITEM:
${truncatedSource}

KNOWLEDGE LAKE — ${corpusSize} items from their complete corpus (thoughts, articles, projects, lists):
${contextBlock}

Write a synthesis that reveals what this item ACTUALLY means in context — not what it says.

1. Open with ONE punchy sentence: what is the central idea, given everything else in their corpus?
2. Show 2-3 ways this idea echoes, extends, or evolves across specific items in the lake. Name titles directly. Make the connection feel inevitable in retrospect.
3. Close with what this entire cluster is building toward — the emergent thing they're working on without quite naming it yet.

Be specific. Be bold. Name actual titles. 3-5 tight sentences. No hedging, no generic observations.`
            break

          case 'find-gaps':
            prompt = `You've read everything this person has saved. Find what's missing — the gaps they can't see from inside.

FOCUS ITEM:
${truncatedSource}

KNOWLEDGE LAKE — ${corpusSize} items from their complete corpus (thoughts, articles, projects, lists):
${contextBlock}

You can see what's there. Now find what's missing.

1. What domains, perspectives, or voices are conspicuously absent given what they're working on? Name 2 specific gaps and why each matters given specific items in the lake.
2. What question does this corpus raise loudly but never answers? Name the exact tension you see in the items.
3. The ONE most valuable gap to fill next — what specific book, experiment, conversation, or deep-dive would unlock the most, and why (reference specific items to justify)?

Be a doctor reading a chart, not a cheerleader. Name what's missing precisely.`
            break

          case 'suggest-next':
            prompt = `You've read everything this person has written and saved. Tell them the one thing they should actually do next.

FOCUS ITEM:
${truncatedSource}

KNOWLEDGE LAKE — ${corpusSize} items from their complete corpus (thoughts, articles, projects, lists):
${contextBlock}

Give them ONE next action that is:
- Specific enough to start today (not "explore more" — name exactly what)
- Grounded in their corpus (reference 2-3 specific items that make this the obvious move)
- The highest-leverage thing: where theory meets practice, where a recurring thought can become something real

Tell them exactly: WHAT to do, WHY this specific moment calls for it (based on their corpus), and WHAT it will unlock. Reference actual titles. Be concrete. Be urgent.`
            break

          case 'connect-dots':
            prompt = `You've read everything this person has saved. Find the one thread they keep coming back to without realizing it.

FOCUS ITEM:
${truncatedSource}

KNOWLEDGE LAKE — ${corpusSize} items from their complete corpus (thoughts, articles, projects, lists):
${contextBlock}

Find the single most surprising, non-obvious connection between this item and their broader corpus.

1. Name the hidden through-line in one sharp, specific sentence — not "they're interested in X" but the precise way X appears in THIS person's mind.
2. Show the evidence: trace the pattern through 3 specific items, noting exactly how the idea mutates or deepens each time. Quote or closely paraphrase the specific items.
3. Why does this synthesis matter? What does it reveal that they couldn't see from inside any single item? What does it change about how they should think about this?

Make it feel like a revelation. They should read this and think: "I didn't know I was thinking about that."`
            break

          case 'chase-thread':
            prompt = `You are reading someone's notes and saved articles over time, following a single idea like a thread through everything.

FOCUS ITEM:
${truncatedSource}

KNOWLEDGE LAKE — ${corpusSize} items from their complete corpus (thoughts, articles, projects, lists):
${contextBlock}

Find the single most compelling recurring thread — the idea this person keeps returning to without fully naming.

1. Name it in one vivid, specific phrase. Not "creativity" — but "the moment when structure makes spontaneity possible" or whatever this person's actual version is. Make it feel THEIRS.
2. Track it through at least 3 specific items in the lake, showing exactly how the idea evolves: where it starts hesitant, where it gets confident, where it contradicts itself, where it resurfaces in a new domain.
3. Where is this thread leading? What's the natural culmination of this preoccupation — the project, idea, or decision that would represent arriving where they've been heading?

Write like a biographer who has found the hidden theme of someone's intellectual life.`
            break

          case 'provoke':
            prompt = `You've read all of this person's notes. Use what they've actually written to challenge what they just said. Be direct, not mean.

FOCUS ITEM:
${truncatedSource}

KNOWLEDGE LAKE — ${corpusSize} items from their complete corpus (thoughts, articles, projects, lists):
${contextBlock}

Construct the sharpest possible challenge using THEIR OWN knowledge base:

1. Identify the core assumption embedded in this item — the thing they're taking for granted.
2. Find 2-3 specific items in their own corpus that complicate, contradict, or create genuine tension with that assumption. Quote titles. Show exactly why their own thinking creates the problem.
3. Pose the ONE question they most need to sit with. Not rhetorical — a real question that, if answered honestly, would force an update. Make it sharp enough to be uncomfortable.

Don't soften it. Don't end with encouragement. Just the challenge. Use their own words and reading against them — constructively, but without mercy.`
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
          connectionCount: connections?.length || 0,
          semanticCount,
          totalContextItems: corpusSize
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
          const result = await model.generateContent(prompt)
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
            await supabase.from('connection_suggestions').insert({ user_id: userId, from_item_type: normSourceType, from_item_id: itemId, to_item_type: c.type, to_item_id: c.id, reasoning: r.reason, confidence: c.similarity, status: 'pending' })
            suggestedIds.push(c.id)
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
          const result = await model.embedContent({ content: { role: 'user', parts: [{ text: content }] } })
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
}