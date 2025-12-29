import { getSupabaseClient } from './supabase.js'
import { GapAnalysisResult } from '../../src/types'
import { MODELS } from './models.js'

const supabase = getSupabaseClient()

/**
 * Analyzes user's memories and detects gaps for follow-up prompts
 * Uses semantic vector search to find relevant context instead of chronological
 */
export async function detectGaps(
  userId: string,
  latestMemoryId: string
): Promise<GapAnalysisResult> {
  // 1. Fetch the latest memory response
  const { data: latestMemory, error: latestError } = await supabase
    .from('memory_responses')
    .select(`
      *,
      memory_prompts (
        prompt_text,
        prompt_description
      )
    `)
    .eq('id', latestMemoryId)
    .single()

  if (latestError || !latestMemory) {
    console.error('Error fetching latest memory:', latestError)
    return { followUpPrompts: [] }
  }

  // 2. Find semantically similar memories using vector search (if embedding exists)
  let relatedMemories: any[] = []

  if (latestMemory.embedding) {
    // Use vector search for semantically relevant context
    const { data: similarMemories, error: vectorError } = await supabase.rpc('match_memory_responses', {
      query_embedding: latestMemory.embedding,
      filter_user_id: userId,
      match_threshold: 0.6,
      match_count: 5
    })

    if (!vectorError && similarMemories) {
      // Fetch full details for similar memories
      const similarIds = similarMemories.map((m: any) => m.id).filter((id: string) => id !== latestMemoryId)

      if (similarIds.length > 0) {
        const { data: fullMemories } = await supabase
          .from('memory_responses')
          .select(`
            *,
            memory_prompts (
              prompt_text,
              prompt_description
            )
          `)
          .in('id', similarIds)

        relatedMemories = fullMemories || []
      }
    }
  }

  // 3. Fallback to recent memories if no vector matches
  if (relatedMemories.length === 0) {
    const { data: recentMemories } = await supabase
      .from('memory_responses')
      .select(`
        *,
        memory_prompts (
          prompt_text,
          prompt_description
        )
      `)
      .eq('user_id', userId)
      .neq('id', latestMemoryId)
      .order('created_at', { ascending: false })
      .limit(5)

    relatedMemories = recentMemories || []
  }

  const allMemories = [latestMemory, ...relatedMemories]

  // Build context for Gemini
  const memoryContext = allMemories
    .map(m => {
      const promptText = m.memory_prompts?.prompt_text || m.custom_title || 'Untitled'
      return `Prompt: ${promptText}\nResponse:\n${m.bullets.map((b: string, i: number) => `${i + 1}. ${b}`).join('\n')}`
    })
    .join('\n\n---\n\n')

  try {
    // Call Gemini
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.DEFAULT_CHAT}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Analyze user's memory for gaps.

Latest: "${latestMemory.memory_prompts?.prompt_text || latestMemory.custom_title}"
${latestMemory.bullets.map((b: string, i: number) => `${i + 1}. ${b}`).join('\n')}

Related context (${allMemories.length - 1} semantically similar memories):
${memoryContext}

Generate 0-2 follow-up prompts that:
1. Dig deeper into interesting details
2. Explore emotional/relational aspects
3. Fill narrative gaps

Be specific. Return JSON:
{"followUpPrompts":[{"promptText":"...","reasoning":"..."}]}

If no gaps, return empty array.`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000
          }
        })
      }
    )

    if (!response.ok) {
      console.error('Gemini API error:', await response.text())
      return { followUpPrompts: [] }
    }

    const result = await response.json() as any // Explicitly cast to avoid 'unknown' error
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text

    if (!text) {
      return { followUpPrompts: [] }
    }

    // Parse JSON response
    const parsed = JSON.parse(text)

    // Create prompts and status entries
    for (const prompt of parsed.followUpPrompts || []) {
      // Insert custom prompt
      const { data: newPrompt } = await supabase
        .from('memory_prompts')
        .insert({
          prompt_text: prompt.promptText,
          prompt_description: prompt.reasoning,
          category: 'ai_suggested',
          is_required: false
        })
        .select()
        .single()

      if (newPrompt) {
        // Mark as suggested for user
        await supabase
          .from('user_prompt_status')
          .insert({
            user_id: userId,
            prompt_id: newPrompt.id,
            status: 'suggested',
            suggested_at: new Date().toISOString()
          })
      }
    }

    return parsed as GapAnalysisResult
  } catch (error) {
    console.error('Gap detection error:', error)
    return { followUpPrompts: [] }
  }
}
