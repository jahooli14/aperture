/**
 * Validates bullet responses using AI quality check
 * Ensures minimum 3 bullets with substantive content
 */
export async function validateBullets(
  promptText: string,
  bullets: string[]
): Promise<{ valid: boolean; message?: string }> {
  // Basic validation
  if (!bullets || bullets.length < 3) {
    return { valid: false, message: 'Add at least 3 bullets' }
  }

  // Check for too-short bullets
  const tooShort = bullets.some(b => b.trim().length < 10)
  if (tooShort) {
    return { valid: false, message: 'Add more detail to each bullet (minimum 10 characters)' }
  }

  // Check for empty bullets
  const hasEmpty = bullets.some(b => !b.trim())
  if (hasEmpty) {
    return { valid: false, message: 'Remove empty bullets' }
  }

  // AI quality check with Gemini Flash
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Rate the quality of this memory response on a scale of 1-5:

Prompt: "${promptText}"

Response:
${bullets.map((b, i) => `${i + 1}. ${b}`).join('\n')}

Quality criteria:
- Are the bullets specific and detailed?
- Do they answer the prompt?
- Are they substantive (not just "idk", "nothing", one-word answers)?
- Do they provide meaningful information?

Return ONLY valid JSON (no markdown):
{
  "quality": 1-5,
  "feedback": "Optional improvement suggestion if quality < 3"
}

Examples:
- Quality 5: Specific, detailed, meaningful responses
- Quality 3: Adequate but could be more specific
- Quality 1: Vague, one-word, or meaningless responses`
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 200
          }
        })
      }
    )

    if (!response.ok) {
      console.error('Validation API error:', await response.text())
      // Fail open - allow if API fails
      return { valid: true }
    }

    const result = await response.json() as any // Explicitly cast to avoid 'unknown' error
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text

    if (!text) {
      return { valid: true }
    }

    const parsed = JSON.parse(text)

    if (parsed.quality < 3) {
      return {
        valid: false,
        message: parsed.feedback || 'Try being more specific - add concrete details!'
      }
    }

    return { valid: true }
  } catch (error) {
    console.error('Validation error:', error)
    // Fail open - allow if validation fails
    return { valid: true }
  }
}
