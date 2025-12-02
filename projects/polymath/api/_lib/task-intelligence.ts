
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function analyzeTaskEnergy(taskText: string): Promise<'low' | 'moderate' | 'high'> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const prompt = `Analyze the cognitive load and energy required for this task: "${taskText}"

Classify as:
- 'low': Administrative, rote, simple, quick (<15m), consumption (reading/watching).
- 'moderate': Standard work, writing emails, minor bug fixes, routine coding.
- 'high': Deep work, complex problem solving, creative synthesis, architectural design, learning new complex concepts.

Return ONLY the classification word: low, moderate, or high.`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim().toLowerCase()
    
    if (text.includes('high')) return 'high'
    if (text.includes('low')) return 'low'
    return 'moderate'
  } catch (error) {
    console.error('Task energy analysis failed:', error)
    return 'moderate' // Default safe fallback
  }
}
