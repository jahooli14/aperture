import { normaliseName, type Prediction, type Stage } from './predictions'
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

// --- Real bracket vs mine ------------------------------------------------

const FEED_STAGE: Record<string, Stage> = {
  ROUND_OF_32: 'Round of 32',
  LAST_32: 'Round of 32',
  ROUND_OF_16: 'Round of 16',
  LAST_16: 'Round of 16',
  QUARTER_FINALS: 'Quarter-finals',
  QUARTER_FINAL: 'Quarter-finals',
  SEMI_FINALS: 'Semi-finals',
  SEMI_FINAL: 'Semi-finals',
  FINAL: 'Final',
}

export function feedStageToMine(stage: string): Stage | undefined {
  return FEED_STAGE[stage]
}

// --- Did my predicted teams actually reach this stage? --------------------

export type ParticipantStatus = 'correct' | 'wrong' | 'pending'

export interface TeamCheck {
  status: ParticipantStatus
  /** When wrong, the team that actually took this slot (if we can tell). */
  replacement?: string
}

const known = (n: string | null | undefined) => !!n && n.toLowerCase() !== 'tbd'

// For a predicted later-round match, check whether each predicted team is
// actually in the real bracket at that stage. If not, find who replaced it
// (the real opponent of the partner team I got right).
export function checkParticipants(
  pred: Prediction,
  matches: LiveMatch[]
): { home: TeamCheck; away: TeamCheck } {
  const real = matches.filter(
    (m) => feedStageToMine(m.stage) === pred.stage && known(m.home) && known(m.away)
  )
  if (real.length === 0) {
    return { home: { status: 'pending' }, away: { status: 'pending' } }
  }

  const norm = (s: string) => normaliseName(s).toLowerCase()
  const inStage = new Set<string>()
  for (const m of real) {
    inStage.add(norm(m.home))
    inStage.add(norm(m.away))
  }

  // The real opponent of a team that did qualify (to name a replacement).
  const opponentOf = (team: string): string | undefined => {
    const t = norm(team)
    for (const m of real) {
      if (norm(m.home) === t) return m.away
      if (norm(m.away) === t) return m.home
    }
    return undefined
  }

  const check = (team: string, partner: string): TeamCheck => {
    if (inStage.has(norm(team))) return { status: 'correct' }
    // Wrong: if the partner qualified, its real opponent is who took this slot.
    const replacement = inStage.has(norm(partner)) ? opponentOf(partner) : undefined
    return { status: 'wrong', replacement }
  }

  return { home: check(pred.home, pred.away), away: check(pred.away, pred.home) }
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
