/**
 * Gemini Chat Service
 * For generating reasoning and insights
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

// Validate API key at module load
if (!process.env.GEMINI_API_KEY) {
  console.error('[Gemini Chat] GEMINI_API_KEY environment variable is not set')
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy-key-for-initialization')

/**
 * Generate text using Gemini 2.5 Flash (fast, cost-effective)
 */
export async function generateText(
  prompt: string,
  options: {
    maxTokens?: number
    temperature?: number
    responseFormat?: 'text' | 'json'
  } = {}
): Promise<string> {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'dummy-key-for-initialization') {
    throw new Error('GEMINI_API_KEY environment variable is not configured')
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: options.maxTokens || 500,
        temperature: options.temperature || 0.7,
        ...(options.responseFormat === 'json' && {
          responseMimeType: 'application/json'
        })
      }
    })

    return result.response.text()
  } catch (error: any) {
    console.error('[Gemini Chat] Generation error:', error)
    console.error('[Gemini Chat] Error details:', {
      message: error?.message,
      status: error?.status,
      promptLength: prompt.length
    })
    throw error
  }
}

/**
 * Generate connection reasoning in batch
 * More efficient than individual calls
 */
export async function generateBatchReasoning(
  sourceContent: string,
  sourceType: string,
  matches: Array<{ title: string; type: string; similarity: number }>
): Promise<Array<{ index: number; reasoning: string }>> {
  const prompt = `You are analyzing content connections for a personal knowledge management system.

Source ${sourceType}: "${sourceContent.slice(0, 500)}"

Related items found (sorted by relevance):
${matches.map((m, i) =>
  `${i+1}. [${m.type}] "${m.title}" (${(m.similarity * 100).toFixed(0)}% match)`
).join('\n')}

For each item, write ONE concise sentence (max 15 words) explaining why it's relevant to the source.

Output as JSON array:
[
  { "index": 1, "reasoning": "..." },
  { "index": 2, "reasoning": "..." },
  ...
]`

  const response = await generateText(prompt, {
    maxTokens: 500,
    temperature: 0.7,
    responseFormat: 'json'
  })

  return JSON.parse(response)
}
