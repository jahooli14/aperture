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
  prose: string
}

export interface StructuralContext {
  manuscriptTitle: string
  scenes: StructuralSceneSummary[]
}

// Action types the AI can propose
export type StructuralAction =
  | { type: 'move_scene'; sceneId: string; targetBeforeSceneId: string | null; targetSection: string }
  | { type: 'edit_prose'; sceneId: string; newProse: string }
  | { type: 'create_scene'; title: string; section: string; targetBeforeSceneId: string | null; sceneBeat: string; proseFramework: string }

function buildStructuralSystemPrompt(ctx: StructuralContext): string {
  const sceneList = ctx.scenes
    .map((s, i) => {
      const beat = s.sceneBeat ? `\nBeat: ${s.sceneBeat}` : ''
      const prose = s.prose
        ? `\n---\n${s.prose}\n---`
        : '\n(no prose yet)'
      return `### Scene ${i + 1}: "${s.title}" [${s.section}] (id: ${s.id}, ${s.wordCount} words)${beat}${prose}`
    })
    .join('\n\n')

  return `You are a structural editor working on a full manuscript rewrite of "${ctx.manuscriptTitle}". You have the complete text of every scene below and full authority to propose any change.

Sections (narrative order): departure → escape → rupture → alignment → reveal

${sceneList}

---

Your role is that of a hands-on developmental editor, not an advisor. When the author describes a problem or asks for a change, you:
1. Respond conversationally — confirm you understand, push back if needed, ask one clarifying question if genuinely required.
2. Propose the concrete changes as executable actions in an <actions> block at the END of your reply.

Action types available:

move_scene — reorder or move a scene to a different section:
{"type":"move_scene","sceneId":"<id>","targetBeforeSceneId":"<id or null>","targetSection":"<section>"}

edit_prose — rewrite or cut within a scene (return the complete new prose, not a diff):
{"type":"edit_prose","sceneId":"<id>","newProse":"<full revised prose>"}

create_scene — scaffold a new scene the author will develop:
{"type":"create_scene","title":"<title>","section":"<section>","targetBeforeSceneId":"<id or null>","sceneBeat":"<one-sentence beat>","proseFramework":"<detailed scene framework: key beats, emotional arc, what must be established, suggested opening — structured so the author can write directly into it>"}

Rules:
- Include as many actions as the request requires — batch them all in one <actions> block.
- The <actions> block must contain a valid JSON array, even for a single action.
- Place the <actions> block at the very end of your reply, after all conversational text.
- For edit_prose, always return the complete new prose for the scene — never a partial excerpt or diff.
- If no executable action is needed, omit the <actions> block entirely.
- Be direct. This is a working editorial session.`
}

export async function* streamStructuralResponse(
  apiKey: string,
  userMessage: string,
  ctx: StructuralContext,
  history: Array<{ role: 'user' | 'model'; content: string }>
): AsyncGenerator<string> {
  const ai = new GoogleGenAI({ apiKey })
  const systemPrompt = buildStructuralSystemPrompt(ctx)

  const contents = [
    {
      role: 'user' as const,
      parts: [{ text: systemPrompt }]
    },
    {
      role: 'model' as const,
      parts: [{ text: 'Understood. I have the full manuscript. Ready to work.' }]
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
