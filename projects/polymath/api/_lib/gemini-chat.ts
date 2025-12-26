/**
 * Gemini Chat Service
 * For generating reasoning and insights
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { MODELS } from './models.js'

// Validate API key at module load
if (!process.env.GEMINI_API_KEY) {
  console.error('[Gemini Chat] GEMINI_API_KEY environment variable is not set')
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy-key-for-initialization')

/**
 * Generate text using Gemini (fast, cost-effective)
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
    const model = genAI.getGenerativeModel({
      model: MODELS.DEFAULT_CHAT,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ]
    })

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: options.maxTokens || 2048,
        temperature: options.temperature || 0.7,
        ...(options.responseFormat === 'json' && {
          responseMimeType: 'application/json'
        })
      }
    })

    if (!result.response) {
      throw new Error('Gemini API returned no response object')
    }

    try {
      const text = result.response.text()
      if (!text || text.trim() === '') {
        throw new Error('Gemini returned empty response')
      }
      return text
    } catch (e) {
      // Check for safety blocks
      if (result.response.promptFeedback?.blockReason) {
        throw new Error(`Gemini blocked content: ${result.response.promptFeedback.blockReason}`)
      }
      // Check for empty candidates
      if (!result.response.candidates || result.response.candidates.length === 0) {
        throw new Error('Gemini returned no candidates - possibly safety filtered')
      }
      // Check for finish reason
      if (result.response.candidates?.[0]?.finishReason) {
        const reason = result.response.candidates[0].finishReason
        if (reason !== 'STOP') {
          throw new Error(`Gemini stopped generation: ${reason}`)
        }
      }
      console.error('[Gemini Chat] Response parsing error:', {
        hasResponse: !!result.response,
        candidatesCount: result.response.candidates?.length,
        finishReason: result.response.candidates?.[0]?.finishReason
      })
      throw e
    }
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
    `${i + 1}. [${m.type}] "${m.title}" (${(m.similarity * 100).toFixed(0)}% match)`
  ).join('\n')}

For each item, write ONE concise sentence (max 15 words) explaining why it's relevant to the source.

Output as JSON array:
[
  { "index": 1, "reasoning": "..." },
  { "index": 2, "reasoning": "..." },
  ...
]`

  const response = await generateText(prompt, {
    maxTokens: 1024,
    temperature: 0.7,
    responseFormat: 'json'
  })

  return JSON.parse(response)
}
