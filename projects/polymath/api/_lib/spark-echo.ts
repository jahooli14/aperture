/**
 * Stopping the same spark arriving in different words.
 *
 * spark-types.ts rotates the *shape* of the question and spark-rotation.ts
 * rotates the *project* it's about. Neither looks at what the question
 * actually said, so nothing stopped three days running of "watching ripples
 * multiply into reflections gives a quiet sense of infinity" — different
 * type, different project, same image. That is worse than a repeated type:
 * a repeated type reads as a habit, a repeated image reads as the app only
 * having one idea.
 *
 * Two halves, and they do different jobs:
 *
 *   1. The prompt is told what has already been asked (`avoidBlock`), which
 *      is the only half that can catch a near-synonym — "waves" for
 *      "ripples", "endlessness" for "infinity".
 *   2. The output is checked against the same history (`echoesRecent`),
 *      because a prompt instruction is a preference and this is a rule. A
 *      spark that echoes is dropped, and the bake loop tries another type
 *      rather than shipping it.
 *
 * Pure except for the one fetch at the bottom, same split as
 * spark-rotation.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/** How many recent sparks count as "what you've just been asked". Six is a
 *  bit under a week of daily sparks — long enough to catch a motif settling
 *  in, short enough that an image is allowed back eventually. */
export const ECHO_WINDOW_SPARKS = 6
/** Sparks older than this stop counting even if there are fewer than six. */
export const ECHO_LOOKBACK_DAYS = 14
/** Sharing this many distinctive words with ONE recent spark means it's the
 *  same question again. One shared word is a coincidence; two is a rewrite. */
export const OVERLAP_LIMIT = 2

/**
 * Words that carry no subject. Deliberately includes the app's own filler
 * ("project", "thing", "work") — those show up in nearly every spark, so
 * counting them would flag everything as an echo of everything.
 */
const STOPWORDS = new Set([
  'about', 'after', 'again', 'against', 'already', 'also', 'always', 'another',
  'anything', 'around', 'back', 'because', 'been', 'before', 'being', 'below',
  'between', 'both', 'call', 'came', 'come', 'could', 'covered', 'does', 'doing',
  'done', 'down', 'each', 'else', 'even', 'ever', 'every', 'find', 'first',
  'from', 'gave', 'give', 'goes', 'going', 'gone', 'good', 'have', 'having',
  'here', 'hold', 'idea', 'into', 'just', 'keep', 'kept', 'know', 'last',
  'left', 'less', 'like', 'look', 'made', 'make', 'many', 'might', 'more',
  'most', 'much', 'must', 'need', 'needs', 'never', 'next', 'nothing', 'noticed',
  'only', 'other', 'over', 'part', 'project', 'projects', 'really', 'right',
  'said', 'same', 'says', 'seem', 'seems', 'since', 'some', 'someone',
  'something', 'sort', 'spark', 'start', 'started', 'still', 'stuff', 'such',
  'sure', 'take', 'taken', 'tell', 'than', 'that', 'their', 'them', 'then',
  'there', 'these', 'they', 'thing', 'things', 'think', 'this', 'those',
  'though', 'thought', 'through', 'time', 'told', 'took', 'turn', 'under',
  'until', 'upon', 'used', 'using', 'very', 'want', 'wanted', 'wants', 'week',
  'well', 'went', 'were', 'what', 'when', 'where', 'which', 'while', 'will',
  'with', 'without', 'work', 'worked', 'working', 'would', 'year', 'your',
  'yours', 'youre',
])

/** Crude singular. "ripples" and "ripple" are the same motif; "glass" and
 *  "this" must not lose their endings. Applied to both sides, so an
 *  imperfect stem still matches itself. */
function stem(word: string): string {
  if (word.length < 5) return word
  if (/(ss|us|is)$/.test(word)) return word
  return word.endsWith('s') ? word.slice(0, -1) : word
}

/**
 * The words in a spark that actually name its subject: four letters or
 * more, not filler, de-pluralised, deduped.
 */
export function motifWords(text: string): string[] {
  const found = new Set<string>()
  for (const raw of text.toLowerCase().split(/[^a-z0-9'-]+/)) {
    const word = raw.replace(/^['-]+|['-]+$/g, '')
    if (word.length < 4 || STOPWORDS.has(word)) continue
    const s = stem(word)
    if (STOPWORDS.has(s)) continue
    found.add(s)
  }
  return [...found]
}

/**
 * Motifs that have already come round more than once. These are the ones
 * that make the app look like it has one idea, so the third appearance is
 * blocked outright rather than merely discouraged.
 */
export function repeatedMotifs(recentTexts: string[]): string[] {
  const counts = new Map<string, number>()
  for (const text of recentTexts) {
    for (const word of motifWords(text)) counts.set(word, (counts.get(word) ?? 0) + 1)
  }
  return [...counts.entries()].filter(([, n]) => n >= 2).map(([word]) => word)
}

/**
 * Is this the same question again? True if it reaches for a motif that has
 * already recurred, or if it shares two distinctive words with any single
 * recent spark.
 */
export function echoesRecent(candidate: string, recentTexts: string[]): boolean {
  const words = new Set(motifWords(candidate))
  if (words.size === 0 || recentTexts.length === 0) return false

  if (repeatedMotifs(recentTexts).some(word => words.has(word))) return true

  return recentTexts.some(text => {
    let shared = 0
    for (const word of motifWords(text)) {
      if (words.has(word) && ++shared >= OVERLAP_LIMIT) return true
    }
    return false
  })
}

/**
 * The prompt half: the recent questions verbatim, plus the motifs that have
 * already recurred. Verbatim matters — handed a word list alone the model
 * swaps in a synonym and calls it new; handed the sentences it can see the
 * shape it's being asked not to repeat.
 */
export function avoidBlock(recentTexts: string[]): string {
  if (recentTexts.length === 0) return ''

  const asked = recentTexts.map(text => `- "${text}"`).join('\n')
  const motifs = repeatedMotifs(recentTexts)
  const motifLine = motifs.length
    ? `\nThese words and images have already come round more than once: ${motifs.slice(0, 15).join(', ')}. Don't reach for them again, and don't reach for near-synonyms of them either — "waves" for "ripples" is the same spark.\n`
    : ''

  return `
ALREADY ASKED, recently:
${asked}
${motifLine}
Say something with a different subject and a different image. If the only thing
you can find is another version of one of those, return { "spark": null }.
`
}

/**
 * What the user has been asked lately. Empty on any failure: an echo check
 * that can't read the history should let the spark through, not starve the
 * slot.
 */
export async function fetchRecentSparkTexts(
  supabase: SupabaseClient,
  userId: string,
  limit: number = ECHO_WINDOW_SPARKS,
): Promise<string[]> {
  const cutoff = new Date(Date.now() - ECHO_LOOKBACK_DAYS * 86_400_000).toISOString()
  // Questions only. A `forgotten` spark is not a question — it is "you set
  // down <project> N months ago", so its distinctive words are a project
  // TITLE. Left in the history it made every real question about that
  // project read as an echo of itself, which is how four good drafts were
  // thrown away in one run. The filter exists to stop the same question
  // recurring, and a project name is not a question.
  const { data, error } = await supabase
    .from('sparks')
    .select('text')
    .eq('user_id', userId)
    .eq('type', 'mull')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data.map((s: any) => s.text).filter((t: unknown): t is string => typeof t === 'string' && t.length > 0)
}
