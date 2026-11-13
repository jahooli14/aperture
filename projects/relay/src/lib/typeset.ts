/**
 * Typesetting: how a line looks on the page, never what it says.
 *
 * Lines are typed on phones, so they arrive with typewriter quotes, hyphens
 * standing in for dashes, three dots for an ellipsis, and every bit of speech
 * run together on one line. This sets them the way a printed novel would.
 * Stored text is exactly what was sent — this runs only at display time, in
 * the thread, the read view and the book alike, so all three agree.
 *
 * Wording, spelling and punctuation choices stay the writers'. Only the
 * glyphs and the paragraph breaks change.
 */

export type Paragraph = {
  text: string
  /** Opens on speech — set with its opening quote hung in the margin. */
  speech: boolean
}

export function typeset(body: string): Paragraph[] {
  return paragraphs(body).map((raw) => {
    const text = glyphs(raw)
    return { text, speech: text.startsWith('“') }
  })
}

/** For one-line previews: the same glyphs, no paragraph breaks. */
export function typesetInline(body: string): string {
  return glyphs(body.replace(/\s*\n+\s*/g, ' ').trim())
}

// ------------------------------------------------------------- paragraphs

const SENTENCE_END = /[.!?…][)"'”’]*$/

function isOpeningPosition(text: string, at: number): boolean {
  const before = text[at - 1]
  return before === undefined || /[\s([{—–-]/.test(before)
}

/**
 * Break where the writer pressed return, and between two separate pieces of
 * speech ("Can I say I told you so?" "Never change.") — one speaker's turn
 * per paragraph. Speech that runs on inside a sentence stays where it is.
 */
export function paragraphs(body: string): string[] {
  return body
    .split(/\r?\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap(splitSpeech)
}

function splitSpeech(text: string): string[] {
  // Unbalanced straight quotes: too risky to guess, leave it whole.
  if ((text.match(/"/g) ?? []).length % 2 === 1) return [text]

  const parts: string[] = []
  let start = 0
  let inside = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const opens = ch === '“' || (ch === '"' && !inside && isOpeningPosition(text, i))
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

// ----------------------------------------------------------------- glyphs

/** Printer's glyphs for typewriter ones. */
export function glyphs(text: string): string {
  return curlQuotes(
    text
      .replace(/ {2,}/g, ' ')
      .replace(/\.{3}/g, '…')
      // A spaced hyphen or double hyphen is a dash: "Garbage - sorry".
      .replace(/ ?-- ?/g, '—')
      .replace(/ - /g, ' — ')
  )
}

export function curlQuotes(text: string): string {
  let out = ''
  let inside = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      const opening: boolean = !inside && isOpeningPosition(text, i)
      out += opening ? '“' : '”'
      inside = opening
    } else if (ch === "'") {
      out += isOpeningPosition(text, i) && /\p{L}/u.test(text[i + 1] ?? '') ? '‘' : '’'
    } else {
      if (ch === '“') inside = true
      if (ch === '”') inside = false
      out += ch
    }
  }
  return out
}
