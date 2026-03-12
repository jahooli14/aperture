/**
 * Smart Capture  client-side NLP classification
 *
 * Classifies what a user is typing into one of five capture types:
 * todo, thought, article, list-item, or ambiguous.
 *
 * All classification is local (no API calls). Fast, synchronous.
 */

export type CaptureType =
  | 'todo'       // Task to complete
  | 'thought'    // Idea, insight, reflection
  | 'article'    // URL or "want to read X"
  | 'list-item'  // "Add X to my films/books/music list"
  | 'ambiguous'  // Could be multiple things

export interface CaptureClassification {
  type: CaptureType
  confidence: number          // 01
  hint: string                // "Looks like a URL  save to Reading?"
  icon: string                // emoji for the type
  color: string               // CSS color
  alternativeType?: CaptureType  // second best guess
}

export const CAPTURE_TYPE_META: Record<
  CaptureType,
  { icon: string; color: string; label: string; hint: string }
> = {
  todo: {
    icon: '',
    color: "var(--brand-text-secondary)",
    label: 'Task',
    hint: 'Add to your todos',
  },
  thought: {
    icon: '',
    color: "var(--brand-text-secondary)",
    label: 'Thought',
    hint: 'Save to your thoughts',
  },
  article: {
    icon: '',
    color: "var(--brand-text-secondary)",
    label: 'Reading',
    hint: 'Save to reading queue',
  },
  'list-item': {
    icon: '',
    color: "var(--brand-text-secondary)",
    label: 'List',
    hint: 'Add to a list',
  },
  ambiguous: {
    icon: '',
    color: "var(--brand-text-secondary)",
    label: 'Capture',
    hint: 'Where should this go?',
  },
}

//  Signal patterns 

/** URL: starts with http(s):// or www. */
const RE_URL = /^https?:\/\/|^www\./i

/** Read/watch/listen intent */
const RE_READ_INTENT =
  /^(read|watch|listen(\s+to)?|see|check\s+out|look\s+at)\s+/i

/** List-item: mentions a list domain at end of phrase */
const RE_LIST_DOMAIN =
  /(film|movie|book|music|album|song|game|place|restaurant|quote|podcast|show|tv\s*show|series|recipe|article)\s*(list|queue)?(\s*$|[.!?])/i

/** Explicit "add X to [my] <type> list" phrasing */
const RE_LIST_ADD =
  /^add\s+.+\s+to\s+(my\s+)?(film|movie|book|music|album|song|game|place|restaurant|quote|podcast|show|series|recipe)\s*(list|queue)?/i

/** Thought / reflection signals at start of text */
const RE_THOUGHT_START =
  /^(why\s|what\s+if\s|i\s+wonder|thinking\s+about|i\s+realized|i\s+noticed|interesting[:\s]|insight[:\s]|maybe\s|perhaps\s|i\s+feel|it\s+seems|could\s+be|turns?\s+out|just\s+realized|random\s+thought|idea[:\s])/i

/** Mid-sentence thought markers */
const RE_THOUGHT_MID =
  /\b(realize[ds]?|noticed|interesting|insight|wonder(?:ing)?|reflect(?:ion|ing)?)\b/i

/** Action verbs that strongly signal a todo */
const RE_ACTION_VERB =
  /^(buy|get|call|email|send|finish|complete|schedule|book|order|fix|write|review|update|check|follow[\s-]up|meet|ask|remind|pay|pick\s+up|drop|cancel|submit|prepare|plan|research|find|clean|organize|set\s+up|sign\s+up|register|download|install|reply|respond|contact|confirm|arrange|draft)\b/i

/** Date/time markers that indicate scheduling intent  todo */
const RE_DATE_MARKER =
  /(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next\s+week|by\s+\w|before\s+\w|at\s+\d|@\d|eod|eow|tom\b|tmr\b)/i

//  Scoring 

interface Scores {
  todo: number
  thought: number
  article: number
  'list-item': number
}

function scoreText(text: string): Scores {
  const trimmed = text.trim()
  const scores: Scores = { todo: 0, thought: 0, article: 0, 'list-item': 0 }

  if (!trimmed) return scores

  //  Article signals 
  if (RE_URL.test(trimmed)) {
    scores.article += 0.95
  }
  if (RE_READ_INTENT.test(trimmed)) {
    // "read X" could be a todo ("read the report") or article ("read this link")
    scores.article += 0.45
    scores.todo += 0.25
  }

  //  List-item signals 
  if (RE_LIST_ADD.test(trimmed)) {
    scores['list-item'] += 0.90
  } else if (RE_LIST_DOMAIN.test(trimmed)) {
    scores['list-item'] += 0.55
  }

  //  Thought signals 
  if (RE_THOUGHT_START.test(trimmed)) {
    scores.thought += 0.75
  } else if (RE_THOUGHT_MID.test(trimmed)) {
    scores.thought += 0.40
  }

  // Long text with no action verb and no date  likely a thought
  if (trimmed.length > 60 && !RE_ACTION_VERB.test(trimmed) && !RE_DATE_MARKER.test(trimmed)) {
    scores.thought += 0.30
  }

  // Ends with a question mark  reflective thought
  if (trimmed.endsWith('?')) {
    scores.thought += 0.25
  }

  //  Todo signals 
  if (RE_ACTION_VERB.test(trimmed)) {
    scores.todo += 0.70
  }
  if (RE_DATE_MARKER.test(trimmed)) {
    scores.todo += 0.35
  }
  // Short, imperative-ish text with no other signals is probably a todo
  if (trimmed.length > 2 && trimmed.length <= 50 && scores.todo === 0 && scores.thought === 0 && scores.article === 0 && scores['list-item'] === 0) {
    scores.todo += 0.20
  }

  return scores
}

//  Main export 

export function classifyCapture(text: string): CaptureClassification {
  const trimmed = text.trim()

  if (!trimmed) {
    return {
      type: 'ambiguous',
      confidence: 0,
      hint: CAPTURE_TYPE_META.ambiguous.hint,
      icon: CAPTURE_TYPE_META.ambiguous.icon,
      color: CAPTURE_TYPE_META.ambiguous.color,
    }
  }

  // Hard-rule: URL always wins immediately
  if (RE_URL.test(trimmed)) {
    return {
      type: 'article',
      confidence: 0.97,
      hint: 'Looks like a link  save to Reading?',
      icon: CAPTURE_TYPE_META.article.icon,
      color: CAPTURE_TYPE_META.article.color,
      alternativeType: 'todo',
    }
  }

  const scores = scoreText(trimmed)
  const entries = Object.entries(scores) as [CaptureType, number][]
  entries.sort((a, b) => b[1] - a[1])

  const [[bestType, bestScore], [secondType, secondScore]] = entries

  // If everything is zero  ambiguous
  if (bestScore === 0) {
    return {
      type: 'ambiguous',
      confidence: 0.3,
      hint: CAPTURE_TYPE_META.ambiguous.hint,
      icon: CAPTURE_TYPE_META.ambiguous.icon,
      color: CAPTURE_TYPE_META.ambiguous.color,
    }
  }

  // If top two are very close  ambiguous
  const gap = bestScore - secondScore
  if (gap < 0.15 && bestScore < 0.6) {
    const meta = CAPTURE_TYPE_META[bestType]
    return {
      type: 'ambiguous',
      confidence: bestScore,
      hint: `Could be a ${CAPTURE_TYPE_META[bestType].label} or ${CAPTURE_TYPE_META[secondType].label}`,
      icon: meta.icon,
      color: CAPTURE_TYPE_META.ambiguous.color,
      alternativeType: secondType,
    }
  }

  // Clamp confidence to 01
  const confidence = Math.min(bestScore, 1)
  const meta = CAPTURE_TYPE_META[bestType]

  // Build contextual hint
  let hint = meta.hint
  if (bestType === 'article' && RE_READ_INTENT.test(trimmed)) {
    hint = 'Sounds like reading intent  save to queue?'
  } else if (bestType === 'thought' && trimmed.endsWith('?')) {
    hint = 'Reflective question  save as a thought?'
  } else if (bestType === 'list-item') {
    hint = 'Sounds like a list item  which list?'
  } else if (bestType === 'todo' && RE_DATE_MARKER.test(trimmed)) {
    hint = 'Has a date  add as a scheduled task?'
  }

  return {
    type: bestType,
    confidence,
    hint,
    icon: meta.icon,
    color: meta.color,
    alternativeType: secondScore > 0 ? secondType : undefined,
  }
}

/**
 * Detect if pasted text looks like a bare URL (no surrounding prose).
 * Use this on paste events to immediately show an article indicator.
 */
export function isLikelyUrl(text: string): boolean {
  return RE_URL.test(text.trim())
}
