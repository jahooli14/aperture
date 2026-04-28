/**
 * Deterministic filter applied to every Writer output before it's served.
 *
 * The exploration doc was clear: the cringe is structural, not lexical.
 * Banning words like "leverage" doesn't help when the *shape* of "here's an
 * insight, now do this 30-min chore" is the disease. So this filter rejects
 * by shape, not vocabulary:
 *
 *   - imperative-verb sentence starts ("Spend…", "Build…", "Send…")
 *   - time estimates ("30 minutes", "today", "by Friday")
 *   - artefact nouns ("brief", "manifesto", "voice note", "outline")
 *   - "you should", "you could", "you might want to"
 *   - performative insight verbs ("identify", "clarify", "leverage", etc.)
 *
 * If a candidate trips this filter, the orchestrator asks the Writer to try
 * again (or moves on to the next Noticer candidate). Silence is acceptable.
 */

const IMPERATIVE_OPENERS = [
  'spend', 'build', 'draft', 'send', 'write', 'make', 'list', 'pick',
  'identify', 'clarify', 'leverage', 'unlock', 'map', 'outline', 'sketch',
  'try', 'start', 'finish', 'ship', 'create', 'design', 'prototype',
  'commit', 'schedule', 'book', 'set up', 'put together', 'plan',
  'go', 'do', 'run', 'open', 'call', 'email', 'message', 'text', 'post',
  'record', 'capture', 'note', 'add', 'remove', 'delete', 'review',
  'organise', 'organize', 'structure', 'reach out',
]

const TIME_PATTERNS = [
  /\b\d+\s*(min|mins|minute|minutes|hour|hours|hr|hrs|day|days|week|weeks)\b/i,
  /\bby\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tonight|tomorrow|next week|the end of)/i,
  /\bthis\s+(morning|afternoon|evening|weekend|week|month)\b/i,
  /\bthe next\s+\d+/i,
]

const ARTEFACT_NOUNS = [
  'brief', 'manifesto', 'outline', 'roadmap', 'framework', 'blueprint',
  'prototype', 'mvp', 'one-pager', 'one pager', 'pitch deck', 'deck',
  'list of', 'plan for', 'agenda', 'checklist', 'spec', 'doc',
]

const INSTRUCTIONAL_PHRASES = [
  'you should', 'you could', 'you might want to', 'you ought to',
  'you need to', 'you have to', 'consider doing', 'try doing',
  'why not', 'how about', "let's", 'lets ',
]

const PERFORMATIVE_VERBS = [
  'leverage', 'synergy', 'synergies', 'unlock', 'crystallise', 'crystallize',
  'weaponise', 'weaponize', 'systematically', 'holistic', 'ecosystem',
  'actionable', 'optimise your', 'optimize your', 'maximise', 'maximize',
  'productivity', 'productive', 'workflow', 'level up',
]

const PERFORMATIVE_INSIGHT = [
  'i notice that', 'i see that', "i'm noticing", 'noticing that you',
  'it seems you', 'it appears you', 'this suggests', 'this indicates',
  'patterns emerge', 'emerging patterns', 'recurring theme',
  'on a deeper level',
]

export interface ForbiddenShapeReason {
  rule: string
  hit: string
  line: string
}

/**
 * Returns null if the lines pass; otherwise the first violation found.
 */
export function findForbiddenShape(lines: string[]): ForbiddenShapeReason | null {
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const lower = trimmed.toLowerCase()
    const firstWord = lower.split(/[\s,.;:!?]+/)[0]
    const firstTwo = lower.split(/[\s,.;:!?]+/).slice(0, 2).join(' ')

    if (IMPERATIVE_OPENERS.includes(firstWord) || IMPERATIVE_OPENERS.includes(firstTwo)) {
      return { rule: 'imperative_opener', hit: firstWord, line: trimmed }
    }

    for (const re of TIME_PATTERNS) {
      const m = trimmed.match(re)
      if (m) return { rule: 'time_estimate', hit: m[0], line: trimmed }
    }

    for (const noun of ARTEFACT_NOUNS) {
      // Word-boundary match so "list" inside "list item" doesn't trip.
      const re = new RegExp(`\\b${noun.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i')
      if (re.test(trimmed)) {
        return { rule: 'artefact_noun', hit: noun, line: trimmed }
      }
    }

    for (const phrase of INSTRUCTIONAL_PHRASES) {
      if (lower.includes(phrase)) {
        return { rule: 'instructional', hit: phrase, line: trimmed }
      }
    }

    for (const word of PERFORMATIVE_VERBS) {
      if (lower.includes(word)) {
        return { rule: 'performative_verb', hit: word, line: trimmed }
      }
    }

    for (const phrase of PERFORMATIVE_INSIGHT) {
      if (lower.includes(phrase)) {
        return { rule: 'performative_insight', hit: phrase, line: trimmed }
      }
    }
  }

  return null
}

/**
 * The forbidden-shapes list as a string the Writer prompt can include.
 * Keeping it close to the filter so the prompt and the gate can't drift.
 */
export function forbiddenShapesPromptBlock(): string {
  return [
    'FORBIDDEN SHAPES (any one of these and the noticing is rejected):',
    '- A sentence starting with an imperative verb. No "Spend…", "Build…", "Draft…", "Send…", "Write…", "Make…", "Try…", "Start…", "Pick…", "List…", "Identify…", "Clarify…".',
    '- Any time estimate. No "30 minutes", "today", "by Friday", "this week".',
    '- Any artefact noun. No "brief", "manifesto", "outline", "roadmap", "prototype", "MVP", "deck", "one-pager".',
    '- "You should", "you could", "you might want to", "you need to", "consider…", "why not…", "how about…", "let\'s…".',
    '- Performance words: "leverage", "synergy", "unlock", "actionable", "ecosystem", "systematically", "productivity", "workflow", "level up".',
    '- Performative-insight tells: "I notice that…", "It seems you…", "patterns emerge…", "on a deeper level…".',
  ].join('\n')
}
