/**
 * Generate embeddings using Gemini text-embedding-004
 * Returns 768-dimensional vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: {
            parts: [{ text }]
          }
        })
      }
    )

    if (!response.ok) {
      console.error('Embedding API error:', await response.text())
      throw new Error('Failed to generate embedding')
    }

    const result = await response.json()
    return result.embedding?.values || []
  } catch (error) {
    console.error('Embedding generation error:', error)
    throw error
  }
}
