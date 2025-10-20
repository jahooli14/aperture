import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ExtractedMetadata } from '../types'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

/**
 * Extract entities, themes, and metadata from memory text using Gemini
 */
export async function extractMetadata(
  title: string,
  body: string,
  transcript?: string
): Promise<ExtractedMetadata> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

  const prompt = `Analyze this voice note and extract structured metadata.

Title: ${title}

Body:
${body}

${transcript ? `Original Transcript:\n${transcript}` : ''}

Extract the following in JSON format:
{
  "memory_type": "foundational" | "event" | "insight",
  "entities": {
    "people": ["specific person names mentioned"],
    "places": ["specific locations mentioned"],
    "topics": ["key topics, concepts, or subjects discussed"]
  },
  "themes": ["high-level themes or patterns"],
  "emotional_tone": "brief description of emotional tone (e.g., 'reflective', 'excited', 'concerned')"
}

Memory type definitions:
- foundational: Deep dives on people, places, or topics. Rich context. Often recorded in one sitting.
- event: Specific moments, conversations, experiences. Time-stamped.
- insight: Thoughts sparked by reading, connections, or realizations.

Return ONLY valid JSON, no other text.`

  const result = await model.generateContent(prompt)
  const text = result.response.text()

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Failed to extract JSON from Gemini response')
  }

  return JSON.parse(jsonMatch[0])
}

/**
 * Generate text embedding using Gemini
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' })

  const result = await model.embedContent(text)
  return result.embedding.values
}
