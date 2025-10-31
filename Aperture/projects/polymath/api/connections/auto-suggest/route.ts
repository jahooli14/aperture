import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

interface AutoSuggestRequest {
  itemType: 'project' | 'thought' | 'article'
  itemId: string
  content: string
  userId: string
  existingConnectionIds?: string[]
}

interface SuggestionCandidate {
  type: 'project' | 'thought' | 'article'
  id: string
  title: string
  content: string
  similarity: number
}

export async function POST(req: Request) {
  try {
    const body: AutoSuggestRequest = await req.json()
    const { itemType, itemId, content, userId, existingConnectionIds = [] } = body

    if (!itemType || !itemId || !content || !userId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Step 1: Generate embedding for the input content
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: content
    })
    const embedding = embeddingResponse.data[0].embedding

    // Step 2: Find similar items across all content types
    const candidates: SuggestionCandidate[] = []

    // Search projects
    if (itemType !== 'project') {
      const { data: projects } = await supabase
        .from('projects')
        .select('id, title, description')
        .eq('user_id', userId)
        .limit(50)

      if (projects) {
        for (const project of projects) {
          if (existingConnectionIds.includes(project.id)) continue

          const projectContent = `${project.title} ${project.description || ''}`
          const projectEmbedding = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: projectContent
          })

          const similarity = cosineSimilarity(embedding, projectEmbedding.data[0].embedding)

          if (similarity > 0.7) { // Threshold for relevance
            candidates.push({
              type: 'project',
              id: project.id,
              title: project.title,
              content: projectContent,
              similarity
            })
          }
        }
      }
    }

    // Search thoughts/memories
    if (itemType !== 'thought') {
      const { data: thoughts } = await supabase
        .from('memories')
        .select('id, title, body')
        .eq('user_id', userId)
        .limit(50)

      if (thoughts) {
        for (const thought of thoughts) {
          if (existingConnectionIds.includes(thought.id)) continue

          const thoughtContent = `${thought.title || ''} ${thought.body}`
          const thoughtEmbedding = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: thoughtContent
          })

          const similarity = cosineSimilarity(embedding, thoughtEmbedding.data[0].embedding)

          if (similarity > 0.7) {
            candidates.push({
              type: 'thought',
              id: thought.id,
              title: thought.title || thought.body.slice(0, 60) + '...',
              content: thoughtContent,
              similarity
            })
          }
        }
      }
    }

    // Search articles
    if (itemType !== 'article') {
      const { data: articles } = await supabase
        .from('articles')
        .select('id, title, summary')
        .eq('user_id', userId)
        .limit(50)

      if (articles) {
        for (const article of articles) {
          if (existingConnectionIds.includes(article.id)) continue

          const articleContent = `${article.title} ${article.summary || ''}`
          const articleEmbedding = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: articleContent
          })

          const similarity = cosineSimilarity(embedding, articleEmbedding.data[0].embedding)

          if (similarity > 0.7) {
            candidates.push({
              type: 'article',
              id: article.id,
              title: article.title,
              content: articleContent,
              similarity
            })
          }
        }
      }
    }

    // Step 3: Sort by similarity and take top 5
    const topCandidates = candidates
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5)

    // Step 4: Use AI to generate reasoning for each suggestion
    const suggestions = await Promise.all(
      topCandidates.map(async (candidate) => {
        const reasoningPrompt = `You are analyzing connections between content items. Explain in one concise sentence why these two items are related:

Item 1 (${itemType}): ${content.slice(0, 200)}

Item 2 (${candidate.type}): ${candidate.content.slice(0, 200)}

Focus on the key theme or concept that connects them. Be specific and insightful.`

        const reasoningResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: reasoningPrompt }],
          max_tokens: 60,
          temperature: 0.7
        })

        const reasoning = reasoningResponse.choices[0].message.content?.trim() || 'Related content'

        // Store suggestion in database
        const { data: suggestion } = await supabase
          .from('connection_suggestions')
          .insert({
            from_item_type: itemType,
            from_item_id: itemId,
            to_item_type: candidate.type,
            to_item_id: candidate.id,
            reasoning,
            confidence: candidate.similarity,
            user_id: userId,
            status: 'pending'
          })
          .select()
          .single()

        return {
          id: suggestion?.id,
          toItemType: candidate.type,
          toItemId: candidate.id,
          toItemTitle: candidate.title,
          reasoning,
          confidence: candidate.similarity
        }
      })
    )

    return new Response(JSON.stringify({ suggestions }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('[auto-suggest] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Calculate cosine similarity between two embeddings
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
  return dotProduct / (magnitudeA * magnitudeB)
}
