import { normaliseName, type Prediction, type Stage } from './predictions'
import type { LiveMatch } from './types'

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
  const sameOutcome = sign(pred.homeScore, pred.awayScore) === sign(liveHome, liveAway)

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
