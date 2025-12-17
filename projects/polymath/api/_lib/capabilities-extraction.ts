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
      .limit(30)
      .order('created_at', { ascending: false })

    const { data: memories } = await supabase
      .from('memories')
      .select('title, body')
      .eq('user_id', userId)
      .limit(30)
      .order('created_at', { ascending: false })

    if ((!projects || projects.length === 0) && (!memories || memories.length === 0)) {
      console.log('[capabilities] No data to analyze')
      return []
    }

    const content = [
      ...(projects || []).map(p => `Project: ${p.title}\n${p.description || ''}`),
      ...(memories || []).map(m => `Thought: ${m.title || ''}\n${m.body}`)
    ].join('\n\n')

    // 2. Analyze with Gemini (with retry)
    const generateCapabilities = async () => {
      const prompt = `Analyze the following user projects and thoughts. 
      Extract ALL relevant "Capabilities" (skills, tools, concepts, mental models, specific interests, or recurring themes) that this user demonstrates or is exploring, up to 20 items.
      
      Return a JSON array of objects with this structure:
      {
        "name": "kebab-case-name",
        "description": "One sentence description of how the user uses it.",
        "source": "project" or "thought"
      }
      
      Be generous and infer capabilities from the context of their work. Include soft skills and emerging interests.
      
      Content:
      ${content}`

      return generateText(prompt, {
        responseFormat: 'json',
        temperature: 0.4,
        maxTokens: 4000 // Increased from 2000
      })
    }

    let response = ''
    try {
      response = await generateCapabilities()
    } catch (e) {
      console.warn('[capabilities] First attempt failed, retrying...', e)
      await new Promise(resolve => setTimeout(resolve, 1000))
      try {
        response = await generateCapabilities()
      } catch (retryError) {
        console.error('[capabilities] Retry failed:', retryError)
        throw retryError
      }
    }

    let capabilities: any[] = []
    try {
      console.log('[capabilities] Raw response length:', response.length)

      if (!response || response.trim().length === 0) {
        throw new Error('Gemini API returned empty response')
      }

      // Approach 1: Try standard parse
      try {
        const jsonMatch = response.match(/\[[\s\S]*\]/)
        const jsonString = jsonMatch ? jsonMatch[0] : response
        capabilities = JSON.parse(jsonString)
      } catch (directParseError) {
        console.warn('[capabilities] Direct JSON parse failed, attempting partial repair...', directParseError)

        // Approach 2: Extract complete objects via regex (robust against truncation)
        // Matches { ... } structures
        const objectRegex = /\{[^{}]*\}/g
        const matches = response.match(objectRegex)

        if (matches && matches.length > 0) {
          capabilities = matches.map(m => {
            try {
              return JSON.parse(m)
            } catch {
              return null
            }
          }).filter(item => item !== null && item.name && item.description)

          console.log(`[capabilities] Successfully recovered ${capabilities.length} capabilities from truncated response`)
        } else {
          throw directParseError // Rethrow if repair fails
        }
      }

    } catch (parseError) {
      console.error('[capabilities] JSON Parse Error. Raw response preview:', response.slice(0, 500))
      console.error('[capabilities] Parse error details:', parseError instanceof Error ? parseError.message : String(parseError))
      throw parseError
    }

    if (!Array.isArray(capabilities)) capabilities = [] // Fallback

    console.log(`[capabilities] Found ${capabilities.length} capabilities`)

    // 3. Store
    const saved = []
    for (const cap of capabilities) {
      const embedding = await generateEmbedding(`${cap.name}: ${cap.description}`)

      const { data, error } = await supabase
        .from('capabilities')
        .upsert({
          name: cap.name,
          description: cap.description,
          source_project: 'user-extracted',
          strength: 1.2,
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
    throw error
  }
}
