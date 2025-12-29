import { getSupabaseClient } from './supabase.js'
import { generateEmbedding, cosineSimilarity } from './gemini-embeddings.js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { MODELS } from './models.js'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

/**
 * Select diverse items from a set using max-min diversity algorithm
 * Ensures selected items are maximally dissimilar to each other
 */
function selectDiverseItems<T extends { embedding: number[] }>(
  items: T[],
  count: number
): T[] {
  if (items.length <= count) return items
  if (items.filter(i => i.embedding).length === 0) return items.slice(0, count)

  const selected: T[] = []
  const remaining = items.filter(i => i.embedding)

  // Start with first item
  selected.push(remaining[0])

  // Iteratively select items with max distance to already selected items
  while (selected.length < count && remaining.length > 0) {
    let maxMinSimilarity = -1
    let mostDifferentIdx = -1

    for (let i = 0; i < remaining.length; i++) {
      if (selected.includes(remaining[i])) continue

      // Calculate minimum similarity to all selected items
      const minSimilarity = Math.min(
        ...selected.map(s => cosineSimilarity(remaining[i].embedding, s.embedding))
      )

      // Select item with lowest maximum similarity (most different)
      if (minSimilarity > maxMinSimilarity) {
        maxMinSimilarity = minSimilarity
        mostDifferentIdx = i
      }
    }

    if (mostDifferentIdx !== -1) {
      selected.push(remaining[mostDifferentIdx])
    } else {
      break
    }
  }

  return selected
}

export async function extractCapabilities(userId: string) {
  const supabase = getSupabaseClient()
  console.log('[capabilities] Starting extraction for user:', userId)

  try {
    // 1. Fetch candidates with embeddings for diverse sampling
    const { data: allProjects } = await supabase
      .from('projects')
      .select('title, description, embedding')
      .eq('user_id', userId)
      .limit(40)
      .order('created_at', { ascending: false })

    const { data: allMemories } = await supabase
      .from('memories')
      .select('title, body, embedding')
      .eq('user_id', userId)
      .limit(40)
      .order('created_at', { ascending: false })

    if ((!allProjects || allProjects.length === 0) && (!allMemories || allMemories.length === 0)) {
      console.log('[capabilities] No data to analyze')
      return []
    }

    // 2. Select diverse representatives (15 each)
    const projects = selectDiverseItems(allProjects || [], 15)
    const memories = selectDiverseItems(allMemories || [], 15)

    console.log(`[capabilities] Selected ${projects.length} diverse projects and ${memories.length} diverse memories from ${allProjects?.length || 0} and ${allMemories?.length || 0} candidates`)

    const content = [
      "PROJECTS:",
      ...(projects || []).map(p => `Title: ${p.title}\nDescription: ${p.description || 'No description'}`),
      "\nTHOUGHTS:",
      ...(memories || []).map(m => `Title: ${m.title || 'Untitled'}\nBody: ${m.body}`)
    ].join('\n\n')

    // 2. Analyze with Gemini 3 Flash (Reliable JSON)
    const model = genAI.getGenerativeModel({
      model: MODELS.DEFAULT_CHAT,
      generationConfig: { responseMimeType: 'application/json' }
    })

    const prompt = `Analyze the provided User Projects and Thoughts to extract a list of the user's "Capabilities".
    
    Capabilities are:
    - Skills (e.g., React, Writing, Public Speaking)
    - Tools (e.g., VS Code, Figma)
    - Concepts/Mental Models (e.g., Systems Thinking, Agile)
    - Specific Interests that imply ability (e.g., Medieval History, GenAI)

    INSTRUCTIONS:
    1. Be generous. Infer skills from context (e.g., if they write about code, they can code).
    2. Extract up to 20 DISTINCT items.
    3. Return strictly a JSON array of objects.

    SCHEMA:
    Array<{
      "name": string (Title Case, e.g., "Systems Thinking"),
      "description": string (How the user demonstrates this, max 15 words)
    }>`

    const result = await model.generateContent([prompt, content])
    const responseText = result.response.text()

    console.log('[capabilities] Gemini response length:', responseText.length)

    let capabilities: any[] = []
    try {
      capabilities = JSON.parse(responseText)
    } catch (e) {
      console.error('[capabilities] JSON parse failed, attempting regex repair')
      const match = responseText.match(/\[[\s\S]*\]/)
      if (match) capabilities = JSON.parse(match[0])
    }

    if (!Array.isArray(capabilities)) capabilities = []

    console.log(`[capabilities] Found ${capabilities.length} capabilities`)

    // 3. Store
    const saved = []
    for (const cap of capabilities) {
      const embedding = await generateEmbedding(`${cap.name}: ${cap.description}`)

      // We assume if it exists, we update the description/embedding but keep strength if > 1.2
      // Actually, upsert overwrites. We want to increment strength or initialize it.

      // Check existing first
      const { data: existing } = await supabase.from('capabilities').select('id, strength').eq('name', cap.name).single()

      let strength = 1.2
      if (existing) {
        strength = Math.min(existing.strength + 0.1, 5.0) // Increment existing
      }

      const { data, error } = await supabase
        .from('capabilities')
        .upsert({
          name: cap.name,
          description: cap.description,
          source_project: 'user-extracted',
          strength: strength,
          embedding,
          last_used: new Date().toISOString()
        }, { onConflict: 'name' })
        .select()
        .single()

      if (error) {
        console.error('[capabilities] Error saving capability:', cap.name, error)
      } else if (data) {
        saved.push(data)
      }
    }

    return saved

  } catch (error) {
    console.error('[capabilities] Extraction failed:', error)
    throw error // Let the API handler catch it
  }
}
