/**
 * Generate embeddings using Gemini gemini-embedding-001
 * Returns 768-dimensional vector (via MRL outputDimensionality)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          content: {
            parts: [{ text }]
          },
          outputDimensionality: 768
        })
      }
    )

    // Read response text first (can only read body once)
    const responseText = await response.text()

    if (!response.ok) {
      console.error('Embedding API error:', responseText)
      throw new Error('Failed to generate embedding')
    }

    // Parse JSON
    let result
    try {
      result = JSON.parse(responseText)
    } catch (e) {
      console.error('Failed to parse embedding response:', responseText.substring(0, 200))
      throw new Error('Invalid response from embedding API')
    }

    return result.embedding?.values || []
  } catch (error) {
    console.error('Embedding generation error:', error)
    throw error
  }
}
