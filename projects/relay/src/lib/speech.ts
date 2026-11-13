/**
 * Display-only shaping of a line. What's stored is exactly what was sent;
 * these only change how it's laid out on screen and in the book.
 *
 * - `paragraphs` breaks a line where the writer pressed return, and between
 *   two separate bits of speech ("Can I say I told you so?" "Never change.")
 *   — the way dialogue is set in any novel. Speech that runs on from
 *   narration in the same sentence is left alone.
 * - `curlQuotes` turns typewriter quotes into printer's quotes.
 */

const OPENERS = new Set(['"', '“'])
const SENTENCE_END = /[.!?…][)"'”’]*$/

function isStraightOpening(text: string, at: number): boolean {
  const before = text[at - 1]
  return before === undefined || /[\s([{—–-]/.test(before)
}

/** Split one paragraph between separate pieces of speech. */
function splitSpeech(text: string): string[] {
  // Unbalanced straight quotes: too risky to guess, leave it whole.
  const straight = (text.match(/"/g) ?? []).length
  if (straight % 2 === 1) return [text]

  const parts: string[] = []
  let start = 0
  let inside = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const opens = ch === '“' || (ch === '"' && !inside && isStraightOpening(text, i))
    const closes = ch === '”' || (ch === '"' && inside)
    if (opens && !inside) {
      const before = text.slice(start, i)
      if (/\s$/.test(before) && SENTENCE_END.test(before.trimEnd())) {
        parts.push(before.trim())
        start = i
      }
      inside = true
    } else if (closes) {
      inside = false
    }
  }
  parts.push(text.slice(start).trim())
  return parts.filter(Boolean)
}

export function paragraphs(body: string): string[] {
  return body
    .split(/\r?\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap(splitSpeech)
}

/** True when a paragraph opens on speech — set with a hanging quote. */
export function opensOnSpeech(paragraph: string): boolean {
  return OPENERS.has(paragraph[0]) || paragraph[0] === '“'
}

export function curlQuotes(text: string): string {
  let out = ''
  let inside = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      const opening: boolean = !inside && isStraightOpening(text, i)
      out += opening ? '“' : '”'
      inside = opening
    } else if (ch === "'") {
      out += isStraightOpening(text, i) && /\p{L}/u.test(text[i + 1] ?? '') ? '‘' : '’'
    } else {
      if (ch === '“') inside = true
      if (ch === '”') inside = false
      out += ch
    }
  }
  return out
}
