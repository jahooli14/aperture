import {
  normaliseName,
  stageOrder,
  kickoffFor,
  type Prediction,
  type Stage,
  type Person,
} from './predictions'
import type { LiveMatch, MatchGoals, Goal } from './types'

// Goalscorers for a prediction's fixture, oriented to my home/away order.
export function goalsFor(
  pred: Prediction,
  goals?: MatchGoals[]
): { home: Goal[]; away: Goal[] } | null {
  if (!goals) return null
  const key = pairKey(pred.home, pred.away)
  const g = goals.find((x) => pairKey(x.home, x.away) === key)
  if (!g) return null
  const swapped = normaliseName(g.home).toLowerCase() !== normaliseName(pred.home).toLowerCase()
  return swapped
    ? { home: g.awayScorers, away: g.homeScorers }
    : { home: g.homeScorers, away: g.awayScorers }
}

// --- Match phase ---------------------------------------------------------

export type Phase = 'upcoming' | 'live' | 'final'

export function phaseOf(status: string): Phase {
  switch (status) {
    case 'IN_PLAY':
    case 'PAUSED':
      return 'live'
    case 'FINISHED':
    case 'AWARDED':
      return 'final'
    default:
      return 'upcoming'
  }
}

// --- Pairing predictions with live fixtures ------------------------------

// An order-independent key for a fixture, e.g. "argentina v brazil".
export function pairKey(a: string, b: string): string {
  return [normaliseName(a), normaliseName(b)]
    .map((n) => n.toLowerCase())
    .sort()
    .join(' v ')
}

export function findLiveMatch(
  pred: Prediction,
  matches: LiveMatch[]
): LiveMatch | undefined {
  const key = pairKey(pred.home, pred.away)
  return matches.find((m) => pairKey(m.home, m.away) === key)
}

// --- Outcome scoring -----------------------------------------------------

export type Result = 'exact' | 'outcome' | 'wrong' | 'pending'

const sign = (h: number, a: number): -1 | 0 | 1 => (h === a ? 0 : h > a ? 1 : -1)

export interface Scored {
  pred: Prediction
  live?: LiveMatch
  phase: Phase
  result: Result
  points: number
}

export const POINTS = { exact: 3, outcome: 1 } as const

export function scorePrediction(pred: Prediction, live?: LiveMatch): Scored {
  if (!live || phaseOf(live.status) !== 'final' || live.homeScore == null || live.awayScore == null) {
    return {
      pred,
      live,
      phase: live ? phaseOf(live.status) : 'upcoming',
      result: 'pending',
      points: 0,
    }
  }

  // Live feed may list the fixture with teams swapped relative to my prediction.
  const swapped = normaliseName(live.home).toLowerCase() !== normaliseName(pred.home).toLowerCase()
  const liveHome = swapped ? live.awayScore : live.homeScore
  const liveAway = swapped ? live.homeScore : live.awayScore

  const exactScore = liveHome === pred.homeScore && liveAway === pred.awayScore
  let sameOutcome = sign(pred.homeScore, pred.awayScore) === sign(liveHome, liveAway)

  // For a predicted draw I also name the team I think goes through, and THAT is
  // what the result hinges on. An exact 1-1 doesn't count if the other side
  // advanced on penalties (e.g. picked 1-1 Netherlands, but Morocco went through).
  let advanceCorrect = true
  if (pred.homeScore === pred.awayScore && pred.advances) {
    const backed = normaliseName(pred.advances).toLowerCase()
    if (liveHome === liveAway) {
      // Actual draw too → decided on penalties; match against the real advancer.
      advanceCorrect = live.advancer
        ? normaliseName(live.advancer).toLowerCase() === backed
        : true // advancer unknown yet — don't penalise
    } else {
      // Actual was decisive → the winner must be who I backed to go through.
      const realWinner = liveHome > liveAway ? pred.home : pred.away
      advanceCorrect = normaliseName(realWinner).toLowerCase() === backed
      if (advanceCorrect) sameOutcome = true
    }
  }

  const exact = exactScore && advanceCorrect
  const result: Result = exact ? 'exact' : sameOutcome && advanceCorrect ? 'outcome' : 'wrong'
  const points = result === 'exact' ? POINTS.exact : result === 'outcome' ? POINTS.outcome : 0

  return { pred, live, phase: 'final', result, points }
}

// The team that actually progressed from a finished knockout fixture, named to
// match my prediction's spelling. Decisive games: the higher score. Draws settled
// on penalties: the feed's `advancer`. Returns undefined until we can tell.
export function actualAdvancer(pred: Prediction, live?: LiveMatch): string | undefined {
  if (!live || phaseOf(live.status) !== 'final') return undefined
  if (live.homeScore == null || live.awayScore == null) return undefined
  const toMine = (feedName: string): string => {
    const n = normaliseName(feedName).toLowerCase()
    if (normaliseName(pred.home).toLowerCase() === n) return pred.home
    if (normaliseName(pred.away).toLowerCase() === n) return pred.away
    return feedName
  }
  if (live.homeScore !== live.awayScore) {
    return toMine(live.homeScore > live.awayScore ? live.home : live.away)
  }
  return live.advancer ? toMine(live.advancer) : undefined
}

// --- Pool scoring / leaderboard ------------------------------------------

// Points for a correct result, per round.
const RESULT_POINTS: Record<Stage, number> = {
  'Round of 32': 5,
  'Round of 16': 7,
  'Quarter-finals': 10,
  'Semi-finals': 15,
  Final: 20,
}
// Bonus per team whose exact goal count you predicted — awarded ONLY when you
// also got the result right.
const GOAL_BONUS: Record<Stage, number> = {
  'Round of 32': 2,
  'Round of 16': 3,
  'Quarter-finals': 4,
  'Semi-finals': 5,
  Final: 7,
}

// Points one prediction earns against a finished fixture. Correct result → the
// round's base; plus, for each team whose exact goals you nailed, that round's
// bonus. Wrong result → nothing (the bonus is gated on getting the result right).
// "Correct result" reuses scorePrediction, so it matches the card badges exactly
// — including a predicted draw where the team you backed actually went through.
export function matchPoints(pred: Prediction, live?: LiveMatch): number {
  const { result } = scorePrediction(pred, live)
  if (result !== 'exact' && result !== 'outcome') return 0
  if (!live || live.homeScore == null || live.awayScore == null) return 0
  const swapped = normaliseName(live.home).toLowerCase() !== normaliseName(pred.home).toLowerCase()
  const actHome = swapped ? live.awayScore : live.homeScore
  const actAway = swapped ? live.homeScore : live.awayScore
  let pts = RESULT_POINTS[pred.stage]
  const bonus = GOAL_BONUS[pred.stage]
  if (pred.homeScore === actHome) pts += bonus
  if (pred.awayScore === actAway) pts += bonus
  return pts
}

// Standings baseline: each person's running total up to lunchtime 30 Jun 2026 —
// i.e. group stage plus the four R32 games that had finished before the Ivory
// Coast v Norway kick-off. Live points for every game from that one onward get
// added on top, so we never double-count what's already in these numbers.
export const SCORE_BASELINE: Record<string, number> = {
  katdan: 331,
  sarjack: 292,
  gavin: 356,
}
const SCORE_CUTOFF_MS = new Date('2026-06-30T12:00:00Z').getTime()

// A person's live total: their baseline plus points from every finished knockout
// game that kicked off at/after the cutoff (games before it are already counted).
export function personTotal(person: Person, matches: LiveMatch[]): number {
  let total = SCORE_BASELINE[person.slug] ?? 0
  for (const pred of person.predictions) {
    const live = findLiveMatch(pred, matches)
    if (!live || phaseOf(live.status) !== 'final') continue
    const iso = live.utcDate || kickoffFor(pred.home, pred.away) || ''
    const koMs = iso ? new Date(iso).getTime() : 0
    if (!(koMs >= SCORE_CUTOFF_MS)) continue // already baked into the baseline
    total += matchPoints(pred, live)
  }
  return total
}

// --- Real bracket vs mine ------------------------------------------------

const FEED_STAGE: Record<string, Stage> = {
  // football-data / demo style
  round_of_32: 'Round of 32',
  last_32: 'Round of 32',
  round_of_16: 'Round of 16',
  last_16: 'Round of 16',
  quarter_finals: 'Quarter-finals',
  quarter_final: 'Quarter-finals',
  semi_finals: 'Semi-finals',
  semi_final: 'Semi-finals',
  final: 'Final',
  // BBC style ("Last 32", "Quarter-finals", …)
  'last 32': 'Round of 32',
  'last 16': 'Round of 16',
  'quarter-finals': 'Quarter-finals',
  'quarter-final': 'Quarter-finals',
  'semi-finals': 'Semi-finals',
  'semi-final': 'Semi-finals',
}

export function feedStageToMine(stage: string): Stage | undefined {
  return FEED_STAGE[(stage || '').trim().toLowerCase()]
}

// --- Did my predicted teams actually reach this stage? --------------------

export type ParticipantStatus = 'correct' | 'wrong' | 'pending'

export interface TeamCheck {
  status: ParticipantStatus
  /** When wrong, the team that actually took this slot (if we can tell). */
  replacement?: string
}

function prevStage(s: Stage): Stage | undefined {
  const i = stageOrder.indexOf(s)
  return i > 0 ? stageOrder[i - 1] : undefined
}

// Winner / loser of a finished knockout game. Decisive scoreline → higher score;
// a draw → the side the feed marks as advancing (penalty shootout winner).
function koOutcome(m: LiveMatch): { winner: string; loser: string } | null {
  if (phaseOf(m.status) !== 'final' || m.homeScore == null || m.awayScore == null) return null
  if (m.homeScore !== m.awayScore) {
    return m.homeScore > m.awayScore
      ? { winner: m.home, loser: m.away }
      : { winner: m.away, loser: m.home }
  }
  if (m.advancer) {
    const n = (s: string) => normaliseName(s).toLowerCase()
    const winner = m.advancer
    const loser = n(winner) === n(m.home) ? m.away : m.home
    return { winner, loser }
  }
  return null
}

// Every team that has been knocked out — i.e. lost a finished knockout game
// (including on penalties). Normalised lowercase names, for quick lookup.
export function eliminatedTeams(matches: LiveMatch[]): Set<string> {
  const out = new Set<string>()
  for (const m of matches) {
    const o = koOutcome(m)
    if (o) out.add(normaliseName(o.loser).toLowerCase())
  }
  return out
}

// Whether each predicted team actually reached this stage. A team reaches stage S
// exactly when it wins its game in the round before S — so we read the previous
// round's finished results: won → correct; lost → wrong (and the winner is who
// took the slot); not played yet → pending.
export function checkParticipants(
  pred: Prediction,
  matches: LiveMatch[]
): { home: TeamCheck; away: TeamCheck } {
  const prev = prevStage(pred.stage)
  if (!prev) return { home: { status: 'pending' }, away: { status: 'pending' } }

  const n = (s: string) => normaliseName(s).toLowerCase()
  const outcomes = matches
    .filter((m) => feedStageToMine(m.stage) === prev)
    .map(koOutcome)
    .filter((o): o is { winner: string; loser: string } => o !== null)

  if (outcomes.length === 0) {
    return { home: { status: 'pending' }, away: { status: 'pending' } }
  }

  const check = (team: string): TeamCheck => {
    for (const o of outcomes) {
      if (n(o.winner) === n(team)) return { status: 'correct' }
      if (n(o.loser) === n(team)) return { status: 'wrong', replacement: o.winner }
    }
    return { status: 'pending' }
  }

  return { home: check(pred.home), away: check(pred.away) }
}

// Live fixtures in a given stage that don't correspond to any of my predicted
// matchups — i.e. where the real bracket diverged from mine.
export function divergentFixtures(
  stage: Stage,
  preds: Prediction[],
  matches: LiveMatch[]
): LiveMatch[] {
  const myKeys = new Set(preds.filter((p) => p.stage === stage).map((p) => pairKey(p.home, p.away)))
  return matches.filter(
    (m) => feedStageToMine(m.stage) === stage && !myKeys.has(pairKey(m.home, m.away))
  )
}

// --- The real bracket (true games, no predictions) -----------------------

export interface BracketSlot {
  /** Real team in this slot, or null when its feeder game hasn't been decided (TBC). */
  home: string | null
  away: string | null
  venue?: string
  city?: string
  dateText?: string
}

// Find the live fixture for two teams (order-independent).
export function findLive(
  home: string | null,
  away: string | null,
  matches: LiveMatch[]
): LiveMatch | undefined {
  if (!home || !away) return undefined
  const key = pairKey(home, away)
  return matches.find((m) => pairKey(m.home, m.away) === key)
}

// The canonical winner of a slot's game (returned as whichever of home/away won),
// or null if the teams aren't both known yet or the game isn't decided.
function slotWinner(home: string | null, away: string | null, matches: LiveMatch[]): string | null {
  const live = findLive(home, away, matches)
  if (!live) return null
  const o = koOutcome(live)
  if (!o) return null
  const n = (s: string) => normaliseName(s).toLowerCase()
  return n(o.winner) === n(home!) ? home : n(o.winner) === n(away!) ? away : normaliseName(o.winner)
}

// Build the real bracket round by round from actual results. The R32 fixtures and
// each later slot's venue/date come from a canonical prediction set (they're the
// same for everyone — only the teams differ). A later slot fills with the real
// team once its feeder game has a winner; otherwise it stays null (TBC).
export function buildBracket(
  canonical: Prediction[],
  matches: LiveMatch[]
): Record<Stage, BracketSlot[]> {
  const byStage: Record<string, Prediction[]> = {}
  for (const p of canonical) (byStage[p.stage] ??= []).push(p)

  const out = {} as Record<Stage, BracketSlot[]>
  out['Round of 32'] = (byStage['Round of 32'] ?? []).map((p) => ({
    home: p.home,
    away: p.away,
    venue: p.venue,
    city: p.city,
    dateText: p.dateText,
  }))
  for (let s = 1; s < stageOrder.length; s++) {
    const stage = stageOrder[s]
    const prev = out[stageOrder[s - 1]]
    const meta = byStage[stage] ?? []
    const cur: BracketSlot[] = []
    for (let i = 0; i < prev.length / 2; i++) {
      const a = prev[2 * i]
      const b = prev[2 * i + 1]
      const m = meta[i]
      cur.push({
        home: slotWinner(a.home, a.away, matches),
        away: slotWinner(b.home, b.away, matches),
        venue: m?.venue,
        city: m?.city,
        dateText: m?.dateText,
      })
    }
    out[stage] = cur
  }
  return out
}

// How a person's pick for a bracket slot did against the real game. If the real
// teams aren't both known yet → pending. If they picked the wrong teams for this
// slot (their team didn't make it), it's a miss once the real game is decided.
export function slotPickResult(
  pick: Prediction | undefined,
  home: string | null,
  away: string | null,
  live: LiveMatch | undefined
): Result {
  if (!pick || !home || !away) return 'pending'
  const decided = !!live && phaseOf(live.status) === 'final'
  if (pairKey(pick.home, pick.away) !== pairKey(home, away)) {
    return decided ? 'wrong' : 'pending'
  }
  if (!decided) return 'pending'
  return scorePrediction(pick, live).result
}

// Goalscorers for a real fixture, oriented to the given home/away order.
export function goalsForFixture(
  home: string,
  away: string,
  goals?: MatchGoals[]
): { home: Goal[]; away: Goal[] } | null {
  if (!goals) return null
  const key = pairKey(home, away)
  const g = goals.find((x) => pairKey(x.home, x.away) === key)
  if (!g) return null
  const swapped = normaliseName(g.home).toLowerCase() !== normaliseName(home).toLowerCase()
  return swapped
    ? { home: g.awayScorers, away: g.homeScorers }
    : { home: g.homeScorers, away: g.awayScorers }
}
