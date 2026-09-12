/**
 * The corpus as a time series.
 *
 * Everything this channel read was recency-bound: the newest 150 fragments
 * for joint mining, 45 days for notes and articles, momentum weighting for
 * projects. A corpus with years in it was being asked "what happened
 * lately", so most of it may as well not have existed — and the half that
 * was disregarded is the half where someone's actual convictions live.
 *
 * Dates fix that, and they pay twice. They reach the whole history, and
 * what they produce is a class of fact a model cannot invent: you cannot
 * hallucinate that someone has been saying a thing since March 2023. Every
 * shape below is arithmetic over timestamps. The model is handed one and
 * asked to write the question; it never chooses the shape and never
 * supplies the fact.
 *
 * Two dimensions, and the second is the one that was missing entirely:
 *
 *   TIME      — when, how long ago, how long between.
 *   REGULARITY — how often, and how evenly. A steady drip across two years
 *                is a conviction. The same number of mentions inside one
 *                week is a single afternoon's thinking wearing a disguise.
 *
 * So span beats count, everywhere. `joints.occurrence_count` counting five
 * fragments from one Tuesday as a recurrence is exactly the mistake this
 * module exists to stop.
 */

const DAY = 86_400_000

export interface Capture {
  id: string
  /** Only needed for the captures that end up in a chosen shape. */
  text: string
  createdAt: string
  projectId: string | null
  source: 'thought' | 'fragment' | 'list' | 'project'
}

export interface Timeline {
  first: Date
  last: Date
  spanDays: number
  count: number
  /** Days between consecutive mentions, oldest first. */
  gaps: number[]
  longestGapDays: number
  /** Days since the most recent mention. */
  quietDays: number
  /** Mentions per year across the span. */
  cadencePerYear: number
  /** 1 = a perfectly even drip, 0 = everything in one moment. */
  evenness: number
}

/** Below this a "recurrence" is one sitting, however many mentions it has. */
export const MIN_SPAN_DAYS = 45
/** A conviction has been held across seasons, not across a fortnight. */
export const CONVICTION_SPAN_DAYS = 400
/** Long enough that coming back is a decision rather than a continuation. */
export const RETURN_SILENCE_DAYS = 150
/** A return only counts while it's still warm. */
export const RETURN_FRESH_DAYS = 45
/** Past this with no mention, a regular drip has actually stopped. */
export const WENT_QUIET_DAYS = 120
/** Everything inside this window is one sitting. */
export const BURST_WINDOW_DAYS = 10
/** A burst is only interesting once it's clearly not coming back. */
export const BURST_COLD_DAYS = 240
/** Two captures this close together were on someone's mind at the same time. */
export const SIMULTANEITY_DAYS = 4

export function describeTimeline(isoDates: string[], now: Date = new Date()): Timeline | null {
  const times = isoDates
    .map(d => new Date(d).getTime())
    .filter(t => Number.isFinite(t))
    .sort((a, b) => a - b)
  if (times.length === 0) return null

  const gaps: number[] = []
  for (let i = 1; i < times.length; i++) gaps.push((times[i] - times[i - 1]) / DAY)

  const spanDays = (times[times.length - 1] - times[0]) / DAY
  const meanGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0

  // Evenness as 1 - (spread of the gaps / their mean), floored at 0. A drip
  // every six weeks scores near 1; four mentions in a day and one a year
  // later scores near 0. This is the whole difference between a conviction
  // and an afternoon.
  let evenness = 1
  if (gaps.length > 1 && meanGap > 0) {
    const variance = gaps.reduce((sum, g) => sum + (g - meanGap) ** 2, 0) / gaps.length
    evenness = Math.max(0, 1 - Math.sqrt(variance) / meanGap)
  }

  return {
    first: new Date(times[0]),
    last: new Date(times[times.length - 1]),
    spanDays,
    count: times.length,
    gaps,
    longestGapDays: gaps.length > 0 ? Math.max(...gaps) : 0,
    quietDays: (now.getTime() - times[times.length - 1]) / DAY,
    cadencePerYear: spanDays > 0 ? (times.length / spanDays) * 365 : times.length,
    evenness,
  }
}

/** The middle of the other gaps — what silence is normal here. */
function typicalGap(gaps: number[]): number {
  if (gaps.length < 2) return 0
  const rest = [...gaps].sort((a, b) => a - b).slice(0, -1)
  return rest[Math.floor(rest.length / 2)]
}

export type TemporalShape =
  | 'conviction'
  | 'return'
  | 'long_unfinished'
  | 'went_quiet'
  | 'burst'
  | 'simultaneity'
  | 'drift'

export interface ShapeFinding {
  shape: TemporalShape
  /** A true sentence, with real dates, written here and never by a model. */
  fact: string
  /** Higher wins. Comparable across shapes. */
  strength: number
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

/** "March 2023" — a date someone can place themselves in. */
export function monthYear(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

/** "fourteen months", "three weeks" — how a person says a duration. */
export function humanDuration(days: number): string {
  const d = Math.round(days)
  if (d < 14) return `${Math.max(1, d)} days`
  if (d < 60) return `${Math.round(d / 7)} weeks`
  if (d < 730) return `${Math.round(d / 30)} months`
  const years = d / 365
  return years < 1.75 ? 'a year and a half' : `${Math.round(years)} years`
}

export interface ClassifyInput {
  timeline: Timeline
  /** Has this ever become a project with work logged against it? */
  hasProject?: boolean
  label: string
}

/**
 * Which shape a timeline is, if any. Ordered: the first match wins, most
 * revealing first. Most timelines are none of these, which is correct —
 * the ordinary case is a thing mentioned twice in a fortnight and it is
 * not worth a question.
 */
export function classifyTimeline(input: ClassifyInput): ShapeFinding | null {
  const t = input.timeline
  if (t.count < 2) return null

  // Said across years, never built. The project is already half-named by
  // the user, which is the shortest path there is to "oh — I should make
  // that".
  if (t.spanDays >= CONVICTION_SPAN_DAYS && input.hasProject === false) {
    return {
      shape: 'long_unfinished',
      fact: `They have been saying this since ${monthYear(t.first)} — ${t.count} times over ${humanDuration(t.spanDays)}, most recently ${humanDuration(t.quietDays)} ago — and have never made it a project.`,
      strength: 1.0 + Math.min(t.spanDays / 1000, 0.5),
    }
  }

  // Dropped, then picked back up. The gap is the evidence: they did without
  // it for a year and came back anyway.
  //
  // The silence has to be out of character for THIS timeline, not merely
  // long. Something mentioned every ten months for three years has a
  // 300-day gap every time and is not returning to anything — it's a slow
  // conviction, and calling each mention a comeback would be a lie with a
  // date on it.
  if (
    t.longestGapDays >= RETURN_SILENCE_DAYS &&
    t.quietDays <= RETURN_FRESH_DAYS &&
    t.longestGapDays >= 2 * typicalGap(t.gaps)
  ) {
    return {
      shape: 'return',
      fact: `They said this, went quiet about it for ${humanDuration(t.longestGapDays)}, and came back to it ${humanDuration(t.quietDays)} ago. First time was ${monthYear(t.first)}.`,
      strength: 0.95 + Math.min(t.longestGapDays / 2000, 0.3),
    }
  }

  // Held across seasons and still alive.
  if (t.spanDays >= CONVICTION_SPAN_DAYS && t.quietDays <= WENT_QUIET_DAYS) {
    return {
      shape: 'conviction',
      fact: `They have kept coming back to this since ${monthYear(t.first)} — ${t.count} times across ${humanDuration(t.spanDays)}, and again ${humanDuration(t.quietDays)} ago.`,
      strength: 0.9 + Math.min(t.evenness * 0.3, 0.3),
    }
  }

  // A real rhythm that stopped on a date. Not "this died" — something
  // changed in August, and the corpus can say which August.
  if (t.evenness >= 0.4 && t.count >= 3 && t.spanDays >= MIN_SPAN_DAYS && t.quietDays >= WENT_QUIET_DAYS) {
    return {
      shape: 'went_quiet',
      fact: `This came up about every ${humanDuration(t.spanDays / Math.max(1, t.count - 1))} from ${monthYear(t.first)} — and then stopped in ${monthYear(t.last)}, ${humanDuration(t.quietDays)} ago.`,
      strength: 0.75 + Math.min(t.count / 40, 0.2),
    }
  }

  // One sitting, long ago, never returned to. It mattered enough to say
  // several times in a week and then never again, and nobody has ever
  // asked why.
  if (t.spanDays <= BURST_WINDOW_DAYS && t.count >= 3 && t.quietDays >= BURST_COLD_DAYS) {
    return {
      shape: 'burst',
      fact: `They said this ${t.count} times inside one week in ${monthYear(t.first)}, and never again — that was ${humanDuration(t.quietDays)} ago.`,
      strength: 0.6,
    }
  }

  return null
}

export interface SimultaneousPair {
  a: Capture
  b: Capture
  daysApart: number
}

/**
 * Two things that were on someone's mind in the same few days, filed under
 * different projects, and never brought together since.
 *
 * Entirely temporal — no embeddings, no similarity. That is the point: a
 * vector search can only return things that resemble each other, so it can
 * never find the pair whose only connection is that you were thinking about
 * both on the same Tuesday in 2024. That pair is invisible to every other
 * mechanism in the app.
 */
export function findSimultaneous(
  captures: Capture[],
  now: Date = new Date(),
  windowDays = SIMULTANEITY_DAYS,
): SimultaneousPair[] {
  const dated = captures
    .filter(c => c.projectId)
    .map(c => ({ c, t: new Date(c.createdAt).getTime() }))
    .filter(x => Number.isFinite(x.t))
    .sort((a, b) => a.t - b.t)

  // Which project pairs have been near each other more than once? A pair
  // that keeps co-occurring is just two projects worked on together, and
  // saying so tells the user nothing they don't live with daily.
  const pairCounts = new Map<string, number>()
  const key = (x: string, y: string) => [x, y].sort().join('|')

  const found: SimultaneousPair[] = []
  for (let i = 0; i < dated.length; i++) {
    for (let j = i + 1; j < dated.length; j++) {
      const daysApart = (dated[j].t - dated[i].t) / DAY
      if (daysApart > windowDays) break
      if (dated[i].c.projectId === dated[j].c.projectId) continue
      const k = key(dated[i].c.projectId!, dated[j].c.projectId!)
      pairCounts.set(k, (pairCounts.get(k) ?? 0) + 1)
      found.push({ a: dated[i].c, b: dated[j].c, daysApart })
    }
  }

  return found
    .filter(p => pairCounts.get(key(p.a.projectId!, p.b.projectId!)) === 1)
    // Old ones first: a coincidence from last week is still just this week.
    .sort((x, y) => new Date(x.a.createdAt).getTime() - new Date(y.a.createdAt).getTime())
    .filter(p => (now.getTime() - new Date(p.a.createdAt).getTime()) / DAY >= WENT_QUIET_DAYS)
}

export function simultaneityFact(pair: SimultaneousPair, now: Date = new Date()): string {
  const when = monthYear(new Date(pair.a.createdAt))
  const ago = humanDuration((now.getTime() - new Date(pair.a.createdAt).getTime()) / DAY)
  const apart = pair.daysApart < 1.5 ? 'the same day' : `${Math.round(pair.daysApart)} days apart`
  return `They wrote both of these ${apart} in ${when} — ${ago} ago — under different projects, and have never put them together since.`
}

/**
 * Has the way they describe a recurring thing changed?
 *
 * Compares the distinctive words of the earliest third against the latest
 * third. Words that appear only at one end are the drift, and the
 * direction of that drift is a fact about the person that no single note
 * contains. Needs a span, or it's just two people's vocabulary on a
 * Tuesday.
 */
export function findDrift(
  captures: { text: string; createdAt: string }[],
  distinctive: (text: string) => string[],
): { early: string[]; late: string[]; spanDays: number } | null {
  const sorted = [...captures]
    .filter(c => Number.isFinite(new Date(c.createdAt).getTime()))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  if (sorted.length < 4) return null

  const spanDays =
    (new Date(sorted[sorted.length - 1].createdAt).getTime() - new Date(sorted[0].createdAt).getTime()) / DAY
  if (spanDays < CONVICTION_SPAN_DAYS / 2) return null

  const third = Math.max(1, Math.floor(sorted.length / 3))
  const earlyWords = new Set(sorted.slice(0, third).flatMap(c => distinctive(c.text)))
  const lateWords = new Set(sorted.slice(-third).flatMap(c => distinctive(c.text)))

  const early = [...earlyWords].filter(w => !lateWords.has(w))
  const late = [...lateWords].filter(w => !earlyWords.has(w))
  if (early.length < 2 || late.length < 2) return null

  return { early: early.slice(0, 6), late: late.slice(0, 6), spanDays }
}
