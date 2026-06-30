import { normaliseName, stageOrder, type Prediction, type Stage } from './predictions'
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

  const exact = liveHome === pred.homeScore && liveAway === pred.awayScore
  let sameOutcome = sign(pred.homeScore, pred.awayScore) === sign(liveHome, liveAway)

  // If I predicted a draw with a team to go through, count it as the right
  // result when that team actually won (e.g. picked a 1-1 with Canada advancing,
  // and Canada won) — even though the literal scoreline differs.
  if (!sameOutcome && pred.advances && liveHome !== liveAway) {
    const realWinner = liveHome > liveAway ? pred.home : pred.away
    if (normaliseName(realWinner).toLowerCase() === normaliseName(pred.advances).toLowerCase()) {
      sameOutcome = true
    }
  }

  const result: Result = exact ? 'exact' : sameOutcome ? 'outcome' : 'wrong'
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
