import { GoogleGenerativeAI } from '@google/generative-ai'
import type { GeminiComputerUseResponse, GeminiAction } from '../types'

export class GeminiClient {
  private client: GoogleGenerativeAI
  private model: any

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey)
    this.model = this.client.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
    })
  }

  async findElement(
    description: string,
    screenshot: Buffer,
    oldLocator: string,
    errorMessage: string
  ): Promise<GeminiComputerUseResponse> {
    const prompt = `You are a test automation repair assistant. A Playwright test has failed.

**Test failure context:**
- Element description: ${description}
- Old selector: ${oldLocator}
- Error: ${errorMessage}

**Task:**
Analyze this screenshot and locate the "${description}" element. Provide:
1. Coordinates where the element is located (in 1000x1000 normalized grid)
2. Confidence level (high/medium/low)
3. Reasoning for your choice

Return a JSON response in this format:
{
  "action": {
    "type": "click_at",
    "coordinates": { "x": 500, "y": 300 },
    "confidence": "high",
    "reasoning": "Located the blue 'Submit' button at the bottom of the form"
  }
}

If you cannot find the element, set confidence to "low" and explain why.`

    try {
      const result = await this.model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: 'image/png',
            data: screenshot.toString('base64'),
          },
        },
      ])

      const response = result.response
      const text = response.text()

      // Parse JSON response
      const parsed = this.parseResponse(text)

      return {
        action: parsed.action,
        reasoning: parsed.action.reasoning || 'No reasoning provided',
        confidence: this.calculateConfidence(parsed.action),
      }
    } catch (error) {
      console.error('Gemini API error:', error)
      throw new Error(`Failed to analyze screenshot: ${error}`)
    }
  }

  async suggestAction(
    actionType: 'click' | 'fill' | 'hover' | 'scroll',
    description: string,
    screenshot: Buffer,
    fillValue?: string
  ): Promise<GeminiComputerUseResponse> {
    const actions: Record<string, string> = {
      click: 'click_at',
      fill: 'type_text_at',
      hover: 'hover_at',
      scroll: 'scroll_at',
    }

    const geminiAction = actions[actionType]

    const prompt = `You are a test automation assistant. Analyze this screenshot and suggest how to ${actionType} the "${description}" element.

${fillValue ? `The text to be entered is: "${fillValue}"` : ''}

Provide coordinates in 1000x1000 normalized grid and confidence level.

Return JSON:
{
  "action": {
    "type": "${geminiAction}",
    "coordinates": { "x": 500, "y": 300 },
    ${fillValue ? `"text": "${fillValue}",` : ''}
    "confidence": "high",
    "reasoning": "Brief explanation"
  }
}`

    try {
      const result = await this.model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: 'image/png',
            data: screenshot.toString('base64'),
          },
        },
      ])

      const text = result.response.text()
      const parsed = this.parseResponse(text)

      return {
        action: parsed.action,
        reasoning: parsed.action.reasoning || 'No reasoning provided',
        confidence: this.calculateConfidence(parsed.action),
      }
    } catch (error) {
      console.error('Gemini API error:', error)
      throw new Error(`Failed to suggest action: ${error}`)
    }
  }

  private parseResponse(text: string): { action: GeminiAction } {
    // Remove markdown code blocks if present
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    try {
      return JSON.parse(cleaned)
    } catch (error) {
      // Fallback: try to extract JSON from text
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      throw new Error(`Failed to parse Gemini response: ${text}`)
    }
  }

  private calculateConfidence(action: GeminiAction): number {
    const confidenceMap = {
      high: 0.9,
      medium: 0.6,
      low: 0.3,
    }

    return confidenceMap[action.confidence] || 0.5
  }

  async retryWithExponentialBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error as Error

        // Check if error is retryable
        if (
          error instanceof Error &&
          (error.message.includes('429') ||
            error.message.includes('503') ||
            error.message.includes('500'))
        ) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000)
          console.log(
            `Retry attempt ${attempt + 1}/${maxRetries} after ${backoffMs}ms...`
          )
          await new Promise((resolve) => setTimeout(resolve, backoffMs))
        } else {
          // Non-retryable error
          throw error
        }
      }
    }

    throw new Error(
      `Failed after ${maxRetries} attempts: ${lastError?.message}`
    )
  }
}
