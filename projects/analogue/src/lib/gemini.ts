import { GoogleGenAI } from '@google/genai'

export const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview'
export const STRUCTURAL_MODEL = 'gemini-3-flash-preview'

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

export async function transcribeVoiceNote(
  apiKey: string,
  audioBase64: string,
  mimeType: string,
  ctx: GeminiContext
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey })

  const prompt = `You are a writing assistant for a manuscript titled "${ctx.manuscriptTitle}" (section: ${ctx.sectionLabel}, scene: "${ctx.sceneTitle}").

The author has recorded a voice note. Transcribe it accurately, then clean it up into polished prose that matches the manuscript's tone and voice. Remove filler words, false starts, and repetition. Format as ready-to-use prose paragraphs. Do not add any preamble or explanation — output only the cleaned prose.

${ctx.sceneBeat ? `Scene summary: ${ctx.sceneBeat}.` : ''}
${ctx.prose ? `Existing prose for context:\n---\n${ctx.prose.slice(0, 1000)}\n---` : ''}`

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: audioBase64 } },
          { text: prompt }
        ]
      }
    ]
  })

  return response.text ?? ''
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

// --- Structural chatbot (manuscript-level) ---

export interface StructuralSceneSummary {
  id: string
  title: string
  section: string
  order: number
  wordCount: number
  sceneBeat: string | null
  // prose included only when an edit is needed
  prose?: string
}

export interface StructuralContext {
  manuscriptTitle: string
  scenes: StructuralSceneSummary[]
}

// Action types the AI can propose
export type StructuralAction =
  | { type: 'move_scene'; sceneId: string; targetBeforeSceneId: string | null; targetSection: string }
  | { type: 'edit_prose'; sceneId: string; newProse: string }
  | { type: 'none' }

function buildStructuralSystemPrompt(ctx: StructuralContext): string {
  const sceneList = ctx.scenes
    .map((s, i) => {
      const beat = s.sceneBeat ? ` — ${s.sceneBeat}` : ''
      return `  ${i + 1}. [${s.section}] "${s.title}" (id: ${s.id}, ${s.wordCount} words)${beat}`
    })
    .join('\n')

  return `You are a structural editor helping the author of "${ctx.manuscriptTitle}" reshape their manuscript at a high level.

The manuscript currently has these scenes in order:
${sceneList}

Sections (in narrative order): departure → escape → rupture → alignment → reveal

Your job:
- Respond conversationally to the author's structural notes — analyse, agree, push back, or ask questions as a thoughtful editor.
- When the author asks you to execute a structural change (move, cut, edit), propose the change explicitly and embed a single JSON action block at the very end of your reply using this exact format:

<action>
{"type":"move_scene","sceneId":"<id>","targetBeforeSceneId":"<id or null>","targetSection":"<section>"}
</action>

or for a prose edit (only when the author asks to cut or rewrite part of a scene and you have the full prose):

<action>
{"type":"edit_prose","sceneId":"<id>","newProse":"<full revised prose>"}
</action>

Rules:
- Only include ONE action block per reply. If multiple changes are needed, address them one at a time.
- For prose edits, you'll receive the full scene prose. Return the complete revised prose, not a diff.
- If no executable action is needed, do not include an action block.
- Be direct and concise. This is a working session, not a lecture.`
}

export async function* streamStructuralResponse(
  apiKey: string,
  userMessage: string,
  ctx: StructuralContext,
  history: Array<{ role: 'user' | 'model'; content: string }>
): AsyncGenerator<string> {
  const ai = new GoogleGenAI({ apiKey })
  const systemPrompt = buildStructuralSystemPrompt(ctx)

  // Build multi-turn contents from history
  const contents = [
    // Inject system prompt as the first user turn (GoogleGenAI SDK pattern)
    {
      role: 'user' as const,
      parts: [{ text: systemPrompt }]
    },
    {
      role: 'model' as const,
      parts: [{ text: 'Understood. Ready to help with structural edits.' }]
    },
    ...history.map(m => ({
      role: m.role as 'user' | 'model',
      parts: [{ text: m.content }]
    })),
    {
      role: 'user' as const,
      parts: [{ text: userMessage }]
    }
  ]

  const stream = await ai.models.generateContentStream({
    model: STRUCTURAL_MODEL,
    contents
  })

  for await (const chunk of stream) {
    const text = chunk.text
    if (text) {
      yield text
    }
  }
}
