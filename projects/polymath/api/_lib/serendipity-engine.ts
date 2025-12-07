import { GoogleGenerativeAI } from '@google/generative-ai'
import { getSupabaseClient } from './supabase.js'
import { generateEmbedding, cosineSimilarity } from './gemini-embeddings.js'

const supabase = getSupabaseClient()
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export interface SerendipityMatch {
  source: { id: string, title: string, type: 'project' | 'thought' | 'article' }
  target: { id: string, title: string, type: 'project' | 'thought' | 'article' }
  bridge: string
  metaphor: string
}

/**
 * The Serendipity Engine
 * Finds "Structural Holes" - unconnected clusters of knowledge - and bridges them.
 */
export async function findStructuralHole(userId: string): Promise<SerendipityMatch | null> {
  console.log(`[Serendipity] Hunting for structural holes for user ${userId}`)

  let items: any[] = []

  try {
    // 1. Try RPC first
    const { data, error } = await supabase
      .rpc('get_random_items_with_embeddings', { 
        user_id_param: userId, 
        limit_param: 50 
      })
    
    if (error) throw error
    items = data || []
  } catch (rpcError) {
    console.warn('[Serendipity] RPC failed (migration might be missing), falling back to manual fetch:', rpcError)
    
    // Fallback: Fetch recent items from projects and thoughts manually
    const { data: projects } = await supabase
      .from('projects')
      .select('id, title, embedding')
      .eq('user_id', userId)
      .not('embedding', 'is', null)
      .limit(25)
      
    const { data: thoughts } = await supabase
      .from('memories')
      .select('id, title, body, embedding')
      .eq('user_id', userId)
      .not('embedding', 'is', null)
      .limit(25)

    if (projects) items.push(...projects.map((p: any) => ({ ...p, type: 'project' })))
    if (thoughts) items.push(...thoughts.map((t: any) => ({ ...t, title: t.title || t.body?.slice(0, 50), type: 'thought' })))
  }

  console.log(`[Serendipity] Found ${items.length} items with embeddings`)

  if (!items || items.length < 2) {
    console.log('[Serendipity] Not enough items to find holes.')
    return null
  }

  // 2. Find the pair with the LOWEST similarity (most distant)
  // But not zero (unrelated noise). Ideally 0.1 - 0.6 range (relaxed).
  let bestPair = null
  let minSimilarity = 1.0
  let targetSimilarity = 0.25 // High entropy target

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const sim = cosineSimilarity(items[i].embedding, items[j].embedding)
      
      // Relaxed Goldilocks distance
      if (sim > 0.05 && sim < 0.6) {
        // Prefer this pair if it's closer to our target "high entropy" score
        if (Math.abs(sim - targetSimilarity) < Math.abs(minSimilarity - targetSimilarity)) {
          minSimilarity = sim
          bestPair = [items[i], items[j]]
        }
      }
    }
  }

  if (!bestPair) {
    // Fallback: Just pick two random ones if no goldilocks pair found
    console.log('[Serendipity] No perfect hole found, picking random pair')
    const idx1 = Math.floor(Math.random() * items.length)
    let idx2 = Math.floor(Math.random() * items.length)
    while (idx1 === idx2) idx2 = Math.floor(Math.random() * items.length)
    bestPair = [items[idx1], items[idx2]]
  }

  const [source, target] = bestPair
  console.log(`[Serendipity] Bridging: "${source.title}" <-> "${target.title}" (Sim: ${minSimilarity.toFixed(2)})`)

  // 3. Generate the Bridge (Bisociation)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const prompt = `You are a Serendipity Engine. You have found two unconnected ideas in the user's database.
  
  Item A (${source.type}): "${source.title}"
  Item B (${target.type}): "${target.title}"
  
  Task: Create a "Bisociation" - a metaphorical bridge that connects these two distant concepts.
  How does the logic of A apply to B? Or vice versa?
  
  Return JSON:
  {
    "bridge": "A short, provocative question or statement linking them.",
    "metaphor": "A vivid 3-5 word visual metaphor (e.g., 'The Architect as Gardener')."
  }`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const data = jsonMatch ? JSON.parse(jsonMatch[0]) : { bridge: "Consider the connection.", metaphor: "The Hidden Bridge" }

    return {
      source: { id: source.id, title: source.title, type: source.type },
      target: { id: target.id, title: target.title, type: target.type },
      bridge: data.bridge,
      metaphor: data.metaphor
    }
  } catch (e) {
    console.error('[Serendipity] Failed to generate bridge:', e)
    return null
  }
}
