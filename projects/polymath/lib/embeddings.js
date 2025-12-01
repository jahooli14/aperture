/**
 * Generate embeddings using Gemini text-embedding-004
 * Returns 768-dimensional vector
 */
export async function generateEmbedding(text) {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'models/text-embedding-004',
                content: {
                    parts: [{ text }]
                }
            })
        });
        // Read response text first (can only read body once)
        const responseText = await response.text();
        if (!response.ok) {
            console.error('Embedding API error:', responseText);
            throw new Error('Failed to generate embedding');
        }
        // Parse JSON
        let result;
        try {
            result = JSON.parse(responseText);
        }
        catch (e) {
            console.error('Failed to parse embedding response:', responseText.substring(0, 200));
            throw new Error('Invalid response from embedding API');
        }
        return result.embedding?.values || [];
    }
    catch (error) {
        console.error('Embedding generation error:', error);
        throw error;
    }
}
