import { getSupabaseClient } from './supabase.js'
import { generateText } from './gemini-chat.js'
import { generateEmbedding } from './gemini-embeddings.js'

export async function extractCapabilities(userId: string) {
  const supabase = getSupabaseClient()
  console.log('[capabilities] Starting extraction for user:', userId)

  try {
    // 1. Fetch recent data
    const { data: projects } = await supabase
      .from('projects')
      .select('title, description')
      .eq('user_id', userId)
      .limit(10)
      .order('created_at', { ascending: false })

    const { data: memories } = await supabase
      .from('memories')
      .select('title, body')
      .eq('user_id', userId)
      .limit(10)
      .order('created_at', { ascending: false })

    if ((!projects || projects.length === 0) && (!memories || memories.length === 0)) {
      console.log('[capabilities] No data to analyze')
      return []
    }

    const content = [
      ...(projects || []).map(p => `Project: ${p.title}\n${p.description || ''}`),
      ...(memories || []).map(m => `Thought: ${m.title || ''}\n${m.body}`)
    ].join('\n\n')

    // 2. Analyze with Gemini
    const prompt = `Analyze the following user projects and thoughts. 
    Extract a list of "Capabilities" (skills, tools, concepts, mental models, or specific interests) that this user demonstrates.
    
    Return a JSON array of objects with this structure:
    {
      "name": "kebab-case-name",
      "description": "Brief description of the capability and how the user uses it.",
      "source": "project" or "thought"
    }
    
    Focus on specific, actionable capabilities (e.g., "react-development", "system-design", "creative-writing").
    
    Content:
    ${content}`

    const response = await generateText(prompt, { 
      responseFormat: 'json', 
      temperature: 0.2,
      maxTokens: 2000 // Increase token limit to prevent truncation
    })

    let capabilities
    try {
      // Attempt to find JSON array in the response
      const jsonMatch = response.match(/\[[\s\S]*\]/)
      const jsonString = jsonMatch ? jsonMatch[0] : response
      capabilities = JSON.parse(jsonString)
    } catch (parseError) {
      console.error('[capabilities] JSON Parse Error. Raw response:', response)
      throw parseError
    }

    if (!Array.isArray(capabilities)) throw new Error('Invalid AI response format: Not an array')

    console.log(`[capabilities] Found ${capabilities.length} capabilities`)

    // 3. Store
    const saved = []
    for (const cap of capabilities) {
      const embedding = await generateEmbedding(`${cap.name}: ${cap.description}`)

      const { data, error } = await supabase
        .from('capabilities')
        .upsert({
          user_id: userId,
          name: cap.name,
          description: cap.description,
          source_project: 'user-extracted',
          strength: 1.0,
          embedding,
          last_used: new Date().toISOString()
        }, { onConflict: 'user_id,name' })
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
    throw error
  }
}
