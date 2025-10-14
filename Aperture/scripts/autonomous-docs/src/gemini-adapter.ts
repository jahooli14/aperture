import { GoogleGenerativeAI } from '@google/generative-ai'

export class GeminiClient {
  private genAI: GoogleGenerativeAI
  private model: any

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey)
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-pro" })
  }

  async generateText(prompt: string, maxTokens: number = 4000): Promise<string> {
    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.1,
        },
      })

      const response = await result.response
      return response.text()

    } catch (error) {
      console.error('Gemini API error:', error)
      throw error
    }
  }
}

// Drop-in replacement interface
export interface LLMClient {
  generateText(prompt: string, maxTokens?: number): Promise<string>
}

export class AnthropicClient implements LLMClient {
  private anthropic: any

  constructor(apiKey: string) {
    // Import would be: import Anthropic from '@anthropic-ai/sdk'
    const Anthropic = require('@anthropic-ai/sdk')
    this.anthropic = new Anthropic({ apiKey })
  }

  async generateText(prompt: string, maxTokens: number = 4000): Promise<string> {
    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: maxTokens,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }]
    })

    return response.content[0].text
  }
}