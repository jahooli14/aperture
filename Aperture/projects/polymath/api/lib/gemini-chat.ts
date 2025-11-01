/**
 * Gemini Chat Service
 * For generating reasoning and insights
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

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
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

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
