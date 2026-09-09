/**
 * The gist — three bullets at the top of an article.
 *
 * Opening a long read cold is the moment most articles get abandoned. The
 * gist answers "is this worth my next fifteen minutes?" before the first
 * paragraph, and it answers it in the article's own terms rather than a
 * blurb the publisher wrote to get the click.
 *
 * One Gemini call per article, ever: the result is cached on the row, so
 * re-opening costs nothing. Mechanical extraction, so thinking is capped.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { MODELS } from './models.js'
import { thinkingFragment } from './gemini-thinking.js'
import { PLAIN_ENGLISH_RULES, findVoiceViolations } from './plain-english.js'

export interface ArticleGist {
  bullets: string[]
  topics: string[]
  generated_at: string
  model: string
}

/** Below this the article IS the summary — don't spend a call on it. */
export const MIN_WORDS_FOR_GIST = 220

/** How much of the article the model sees. Enough for a long essay. */
const MAX_CHARS = 24000

export function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    // &amp; decodes LAST -- decoding it first turns a literal "&amp;lt;"
    // (an already-escaped ampersand that happens to precede "lt;") into
    // "&lt;" in time for the very next line to decode that into a real
    // "<", double-unescaping text that was only ever supposed to become
    // a plain "&".
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

export function wordCount(text: string): number {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

/**
 * Trim one bullet to something a person would actually say. Drops the
 * "The author argues that…" scaffolding the model reaches for, kills
 * trailing full stops on fragments, caps the length.
 */
export function tidyBullet(raw: string): string {
  let s = String(raw ?? '').trim()
  s = s.replace(/^[-•*\d.)\s]+/, '')
  const before = s
  s = s.replace(/^(the )?(author|writer|piece|article|post)\s+(argues|says|claims|explains|suggests|makes the case)\s+that\s+/i, '')
  s = s.replace(/^(this )?(article|piece|post)\s+(is about|covers|explores|discusses)\s+/i, '')
  // Only re-capitalise where we actually cut a prefix off, so a bullet that
  // legitimately starts lowercase ("iPhone sales fell") is left alone.
  if (s !== before && s) s = s.charAt(0).toUpperCase() + s.slice(1)
  s = s.replace(/\s+/g, ' ').trim()
  if (s.length > 180) {
    s = s.slice(0, 180).replace(/\s+\S*$/, '') + '…'
  }
  return s
}

/**
 * Keep only bullets that are worth the space: real sentences, plain
 * English, no near-duplicates. Fewer good bullets beat three padded ones.
 */
export function cleanBullets(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const bullet = tidyBullet(item)
    if (bullet.length < 12) continue
    if (findVoiceViolations(bullet).length > 0) continue
    const key = bullet.toLowerCase().replace(/[^a-z0-9 ]/g, '')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(bullet)
    if (out.length === 3) break
  }
  return out
}

export function cleanTopics(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const topic = item.trim().replace(/\s+/g, ' ')
    if (!topic || topic.length > 40) continue
    const key = topic.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(topic)
    if (out.length === 5) break
  }
  return out
}

export function buildGistPrompt(title: string, source: string, body: string): string {
  return `Read this article and say what it actually claims, in three bullets.

TITLE: ${title || 'Untitled'}
${source ? `SOURCE: ${source}\n` : ''}
ARTICLE:
${body}

Write exactly three bullets. Each one is a single sentence, under 25 words,
saying something the article specifically claims or shows — a fact, a
figure, an argument, a conclusion. Someone who reads your three bullets
should know whether the piece is worth their next fifteen minutes.

- No "this article discusses X". Say the X.
- No preamble, no closing thought, no advice to the reader.
- If the piece has a number or a name that carries the point, use it.
- British spelling.

${PLAIN_ENGLISH_RULES}

BAD:  "The author explores the transformative potential of AI in creative workflows."
GOOD: "Task composition beats one big prompt: shared subtasks get reused across workflows and improve everywhere at once."

Also list up to five topics — plain nouns, the things this piece is about.

Return ONLY JSON:
{"bullets": ["...", "...", "..."], "topics": ["...", "..."]}`
}

export function parseGistResponse(text: string): { bullets: string[]; topics: string[] } {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return { bullets: [], topics: [] }
  try {
    const parsed = JSON.parse(match[0])
    return {
      bullets: cleanBullets(parsed.bullets),
      topics: cleanTopics(parsed.topics),
    }
  } catch {
    return { bullets: [], topics: [] }
  }
}

/**
 * Generate the gist. Returns null when the article is too short to be
 * worth one, or when the model gives us nothing usable — the reader shows
 * no card at all rather than a hedged one.
 */
export async function generateGist(article: {
  title?: string | null
  source?: string | null
  content?: string | null
  excerpt?: string | null
}): Promise<ArticleGist | null> {
  const plain = stripTags(article.content || '') || (article.excerpt || '')
  if (wordCount(plain) < MIN_WORDS_FOR_GIST) return null

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: MODELS.DEFAULT_CHAT,
    generationConfig: {
      temperature: 0.3,
      // Flash-Lite is a thinking model: this budget covers the reasoning
      // AND the answer. Three bullets need barely any of it, but a tight
      // cap here truncates mid-JSON and we get nothing at all.
      maxOutputTokens: 2400,
      ...thinkingFragment('low'),
    },
  })

  const prompt = buildGistPrompt(
    article.title || '',
    article.source || '',
    plain.slice(0, MAX_CHARS),
  )

  const result = await model.generateContent(prompt)
  const { bullets, topics } = parseGistResponse(result.response.text())

  // Two bullets that say something beat three where one is filler, but
  // one lonely bullet isn't a gist — that's just a subtitle.
  if (bullets.length < 2) return null

  return {
    bullets,
    topics,
    generated_at: new Date().toISOString(),
    model: MODELS.DEFAULT_CHAT,
  }
}
