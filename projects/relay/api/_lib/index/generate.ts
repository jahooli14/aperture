/**
 * Builds the story index with Gemini.
 *
 * The model is not asked what the story is about. It is asked to point at
 * lines: who appears, where things happen, what keeps coming back. Every
 * answer is then checked against the text (see ground.ts) and anything it
 * can't support is thrown away.
 */
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai'
import { MODELS } from '../models.js'
import { RULES } from '../plain-english.js'
import { groundIndex, type SourceLine, type StoryIndex } from './ground.js'

const MAX_LINES = 400

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_KEY || process.env.GEMINI_API_KEY)
}

const ENTRY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: 'Exactly as written in the story' },
    note: { type: Type.STRING, description: 'One short plain sentence, or empty' },
    lines: { type: Type.ARRAY, items: { type: Type.INTEGER }, description: 'Line numbers, up to six' },
  },
  required: ['name', 'lines'],
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    people: { type: Type.ARRAY, items: ENTRY_SCHEMA },
    places: { type: Type.ARRAY, items: ENTRY_SCHEMA },
    threads: { type: Type.ARRAY, items: ENTRY_SCHEMA },
  },
  required: ['people', 'places', 'threads'],
}

function buildPrompt(lines: SourceLine[]): string {
  const numbered = lines.map((line) => `${line.position}. ${line.body}`).join('\n')

  return `Two friends are writing a story together, one line each. Below is what
they have written so far, with line numbers.

Your job is to index it, the way the back of a book is indexed. You are not
reviewing it, summarising it, or saying what it is about.

Find three things:

PEOPLE — anyone who appears. Animals count. Use the name the story uses.
PLACES — where things happen. Cities, rooms, pubs, countries.
THREADS — things that keep coming back across several lines: an object, a
  recurring situation, something left unresolved. Only if it genuinely
  recurs in three or more lines. If nothing recurs, return an empty list.

For each one give:
- name: exactly as the story writes it
- note: one short plain sentence saying what it is, or "" if the name says it all
- lines: the line numbers where it actually appears, up to six, earliest first

Hard rules:
- Only include something written in the text. Never infer, never invent,
  never combine two things into one.
- The name must literally appear in at least one line you cite for it.
- If you are unsure, leave it out. A short honest index beats a long guessed one.

${RULES}

THE STORY SO FAR:
${numbered}`
}

/**
 * Returns an index grounded in the text. Throws if the model is unreachable
 * or returns something unparseable — callers decide what to show.
 */
export async function generateIndex(lines: SourceLine[]): Promise<StoryIndex> {
  const apiKey = process.env.GEMINI_KEY || process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('The index needs GEMINI_KEY set')

  const source = lines.slice(0, MAX_LINES)
  const ai = new GoogleGenAI({ apiKey })

  const response = await ai.models.generateContent({
    model: MODELS.INDEX,
    contents: buildPrompt(source),
    config: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.2,
      // Reading and pointing at lines is mechanical work — it does not need
      // deep reasoning, and reasoning tokens bill as output.
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  })

  const text = response.text
  if (!text) throw new Error('The model returned nothing')

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('The model returned something unreadable')
  }

  return groundIndex(raw as Partial<StoryIndex>, source)
}
