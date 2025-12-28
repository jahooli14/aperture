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

// Token usage tracking (resets on deployment)
let tokenStats = {
  total_requests: 0,
  total_input_tokens: 0,
  total_output_tokens: 0,
  total_tokens: 0,
  estimated_cost_usd: 0,
  last_reset: new Date().toISOString(),
  by_operation: {} as Record<string, { count: number; input_tokens: number; output_tokens: number }>
}

/**
 * Get current token usage stats
 */
export function getTokenStats() {
  return { ...tokenStats }
}

/**
 * Reset token stats
 */
export function resetTokenStats() {
  tokenStats = {
    total_requests: 0,
    total_input_tokens: 0,
    total_output_tokens: 0,
    total_tokens: 0,
    estimated_cost_usd: 0,
    last_reset: new Date().toISOString(),
    by_operation: {}
  }
}

/**
 * Track token usage for an operation
 */
function trackTokenUsage(operation: string, inputTokens: number, outputTokens: number) {
  tokenStats.total_requests++
  tokenStats.total_input_tokens += inputTokens
  tokenStats.total_output_tokens += outputTokens
  tokenStats.total_tokens += inputTokens + outputTokens

  // Gemini Flash pricing (as of 2025): $0.075 per 1M input tokens, $0.30 per 1M output tokens
  const inputCost = (inputTokens / 1_000_000) * 0.075
  const outputCost = (outputTokens / 1_000_000) * 0.30
  tokenStats.estimated_cost_usd += inputCost + outputCost

  if (!tokenStats.by_operation[operation]) {
    tokenStats.by_operation[operation] = { count: 0, input_tokens: 0, output_tokens: 0 }
  }
  tokenStats.by_operation[operation].count++
  tokenStats.by_operation[operation].input_tokens += inputTokens
  tokenStats.by_operation[operation].output_tokens += outputTokens
}

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

      // Track token usage
      const usage = result.response.usageMetadata
      if (usage) {
        trackTokenUsage('generateText', usage.promptTokenCount || 0, usage.candidatesTokenCount || 0)
        console.log(`[Token Stats] Input: ${usage.promptTokenCount}, Output: ${usage.candidatesTokenCount}, Total cost: $${tokenStats.estimated_cost_usd.toFixed(4)}`)
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
