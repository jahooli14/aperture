import { GoogleGenAI } from '@google/genai'

export const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview'

export interface GeminiContext {
  manuscriptTitle: string
  sectionLabel: string
  sceneTitle: string
  sceneBeat: string | null
  prose: string
}

function buildSystemPrompt(ctx: GeminiContext): string {
  const proseSnippet = ctx.prose.length > 2000 ? ctx.prose.slice(0, 2000) + '...' : ctx.prose

  return `You are a writing assistant helping with a book manuscript titled "${ctx.manuscriptTitle}".
Current section: ${ctx.sectionLabel}. Current scene: "${ctx.sceneTitle}".
${ctx.sceneBeat ? `Scene summary: ${ctx.sceneBeat}.` : ''}

The manuscript prose for this scene:
---
${proseSnippet || '(no prose written yet)'}
---

Help the author make progress on their rewrite. Be direct, specific, and creative.
Keep responses concise and actionable. Match the existing tone and voice.
If suggesting rewrites, provide the actual rewritten text, not just advice.`
}

export async function generateResponse(
  apiKey: string,
  userMessage: string,
  ctx: GeminiContext
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey })

  const systemPrompt = buildSystemPrompt(ctx)

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: 'user',
        parts: [{ text: `${systemPrompt}\n\n---\n\n${userMessage}` }]
      }
    ]
  })

  return response.text ?? ''
}

export async function* streamResponse(
  apiKey: string,
  userMessage: string,
  ctx: GeminiContext
): AsyncGenerator<string> {
  const ai = new GoogleGenAI({ apiKey })
  const systemPrompt = buildSystemPrompt(ctx)

  const stream = await ai.models.generateContentStream({
    model: GEMINI_MODEL,
    contents: [
      {
        role: 'user',
        parts: [{ text: `${systemPrompt}\n\n---\n\n${userMessage}` }]
      }
    ]
  })

  for await (const chunk of stream) {
    const text = chunk.text
    if (text) {
      yield text
    }
  }
}
