import { getSupabaseClient } from './supabase'
import { GapAnalysisResult } from '../../src/types'

const supabase = getSupabaseClient()

/**
 * Analyzes user's memories and detects gaps for follow-up prompts
 * Uses Gemini Flash 2.5 with full memory context
 */
export async function detectGaps(
  userId: string,
  latestMemoryId: string
): Promise<GapAnalysisResult> {
  // Fetch all user memories with prompts
  const { data: allMemories, error } = await supabase
    .from('memory_responses')
    .select(`
      *,
      memory_prompts (
        prompt_text,
        prompt_description
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching memories:', error)
    return { followUpPrompts: [] }
  }

  if (!allMemories || allMemories.length === 0) {
    return { followUpPrompts: [] }
  }

  const latestMemory = allMemories.find(m => m.id === latestMemoryId)
  if (!latestMemory) {
    return { followUpPrompts: [] }
  }

  // Build context for Gemini
  const memoryContext = allMemories
    .map(m => {
      const promptText = m.memory_prompts?.prompt_text || m.custom_title || 'Untitled'
      return `Prompt: ${promptText}\nResponse:\n${m.bullets.map((b, i) => `${i + 1}. ${b}`).join('\n')}`
    })
    .join('\n\n---\n\n')

  try {
    // Call Gemini Flash 2.5
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are analyzing a user's memory responses to detect interesting gaps or unexplored depth.

User just answered: "${latestMemory.memory_prompts?.prompt_text || latestMemory.custom_title}"
Their response:
${latestMemory.bullets.map((b, i) => `${i + 1}. ${b}`).join('\n')}

All their memories so far (${allMemories.length} total):

${memoryContext}

Analyze for interesting gaps or unexplored depth. Generate 0-2 follow-up prompts that:
1. Dig deeper into interesting details they mentioned
2. Explore emotional/relational aspects not yet covered
3. Fill narrative gaps (e.g., "how did X happen?", "tell me about Y")

Be specific and reference what they said. Make prompts feel personal and curious.

Return ONLY valid JSON (no markdown, no code blocks):
{
  "followUpPrompts": [
    {
      "promptText": "...",
      "reasoning": "Why this gap is interesting"
    }
  ]
}

If no interesting gaps, return empty array.`
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
