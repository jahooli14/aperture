import { useEffect, useMemo, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import {
  predictions,
  stageOrder,
  flags,
  goldenBootPick,
  normaliseName,
  type Stage,
} from './predictions'
import { scorePrediction, findLiveMatch, phaseOf, pairKey, type Scored } from './logic'
import { useLiveData } from './useLiveData'
import type { LiveScorer } from './types'

const flag = (team: string) => flags[normaliseName(team)] ?? '🏳️'

export function App() {
  const { data, loading, lastUpdated } = useLiveData()
  const matches = data?.matches ?? []
  const scorers = data?.scorers ?? []

  const scored: Scored[] = useMemo(
    () => predictions.map((p) => scorePrediction(p, findLiveMatch(p, matches))),
    [matches]
  )

  const totals = useMemo(() => {
    let exact = 0
    let outcome = 0
    let decided = 0
    for (const s of scored) {
      if (s.result === 'pending') continue
      decided++
      if (s.result === 'exact') exact++
      else if (s.result === 'outcome') outcome++
    }
    return { exact, outcome, decided, correct: exact + outcome }
  }, [scored])

  useConfettiOnCorrect(scored, loading)

  return (
    <div className="app">
      <div className="backdrop" aria-hidden="true" />
      <Header lastUpdated={lastUpdated} live={matches.some((m) => phaseOf(m.status) === 'live')} />

      {data && !data.configured && (
        <div className="notice">
          Live scores aren't switched on yet. Add a free{' '}
          <a href="https://www.football-data.org/client/register" target="_blank" rel="noreferrer">
            football-data.org
          </a>{' '}
          API key as <code>FOOTBALL_DATA_API_KEY</code> in Vercel.
        </div>
      )}

      <Scoreboard totals={totals} />

      <main>
        {stageOrder.map((stage) => (
          <StageSection key={stage} stage={stage} scored={scored} />
        ))}
      </main>

      <GoldenBoot scorers={scorers} />

      <footer className="footer">
        My World Cup 2026 predictions · live data via football-data.org · photo by Alex Simpson /
        Unsplash
      </footer>
    </div>
  )
}

// --- Header --------------------------------------------------------------

function Header({ lastUpdated, live }: { lastUpdated: Date | null; live: boolean }) {
  const share = async () => {
    const shareData = {
      title: 'My World Cup 2026 Predictions',
      text: 'Tracking my World Cup predictions against the live scores',
      url: window.location.href,
    }
    try {
      if (navigator.share) await navigator.share(shareData)
      else {
        await navigator.clipboard.writeText(window.location.href)
        alert('Link copied to clipboard!')
      }
    } catch {
      /* dismissed */
    }
  }

  return (
    <header className="header">
      <div className="header-top">
        {live ? (
          <span className="pill live">
            <span className="dot" /> LIVE
          </span>
        ) : (
          <span />
        )}
        <button className="share-btn" onClick={share}>
          Share
        </button>
      </div>
      <h1>
        My World Cup <span className="year">2026</span>
      </h1>
      <p className="subtitle">My predictions, tracked against the live scores</p>
      {lastUpdated && (
        <p className="updated">
          Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </header>
  )
}

// --- Scoreboard ----------------------------------------------------------

function Scoreboard({
  totals,
}: {
  totals: { exact: number; outcome: number; decided: number; correct: number }
}) {
  return (
    <section className="scoreboard">
      <div className="stat">
        <span className="stat-value">{totals.correct}</span>
        <span className="stat-label">Results right</span>
      </div>
      <div className="stat">
        <span className="stat-value">{totals.exact}</span>
        <span className="stat-label">Exact scores</span>
      </div>
      <div className="stat">
        <span className="stat-value">{totals.decided}</span>
        <span className="stat-label">Games played</span>
      </div>
    </section>
  )
}

// --- Stage section -------------------------------------------------------

function StageSection({ stage, scored }: { stage: Stage; scored: Scored[] }) {
  const rows = scored.filter((s) => s.pred.stage === stage)
  // Round of 32 is open by default; later rounds collapse to cut scrolling.
  const [open, setOpen] = useState(stage === 'Round of 32')

  return (
    <section className="stage">
      <button className="stage-title" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="stage-name">{stage}</span>
        <span className="stage-count">{rows.length}</span>
        <span className={`chevron ${open ? 'open' : ''}`} aria-hidden="true">
          ⌄
        </span>
      </button>
      {open && (
        <div className="cards">
          {rows.map((s) => (
            <PredictionCard key={pairKey(s.pred.home, s.pred.away)} scored={s} />
          ))}
        </div>
      )}
    </section>
  )
}

// --- Prediction card -----------------------------------------------------

function resultMeta(result: Scored['result']) {
  switch (result) {
    case 'exact':
      return { label: 'Exact score', cls: 'exact' }
    case 'outcome':
      return { label: 'Right result', cls: 'outcome' }
    case 'wrong':
      return { label: 'Missed', cls: 'wrong' }
    default:
      return { label: '', cls: 'pending' }
  }
}

function PredictionCard({ scored }: { scored: Scored }) {
  const { pred, live, phase, result } = scored
  const meta = resultMeta(result)

  let liveHome: number | null = null
  let liveAway: number | null = null
  if (live && live.homeScore != null && live.awayScore != null) {
    const swapped = normaliseName(live.home).toLowerCase() !== normaliseName(pred.home).toLowerCase()
    liveHome = swapped ? live.awayScore : live.homeScore
    liveAway = swapped ? live.homeScore : live.awayScore
  }
  const hasLive = liveHome != null && liveAway != null

  const pickCls =
    result === 'exact' || result === 'outcome' ? 'correct' : result === 'wrong' ? 'wrong' : 'pending'

  return (
    <article className={`card ${meta.cls} ${phase}`}>
      <div className="card-top">
        <span className="caption">
          {phase === 'live' ? (
            <span className="pill live">
              <span className="dot" /> LIVE
            </span>
          ) : phase === 'final' ? (
            'Full time'
          ) : (
            <KickOff iso={live?.utcDate} inline />
          )}
        </span>
        {phase === 'final' && meta.label && (
          <span className={`result-pill ${meta.cls}`}>
            <span className="dot" />
            {meta.label}
          </span>
        )}
      </div>

      <div className="match">
        <div className="side">
          <span className="crest">{flag(pred.home)}</span>
          <span className="tname">{pred.home}</span>
        </div>

        <div className="center">
          <span className={`bigscore ${phase}`}>{hasLive ? `${liveHome}–${liveAway}` : 'vs'}</span>
          <span className={`pick ${pickCls}`}>
            Pick {pred.homeScore}–{pred.awayScore}
          </span>
        </div>

        <div className="side">
          <span className="crest">{flag(pred.away)}</span>
          <span className="tname">{pred.away}</span>
        </div>
      </div>

      <div className="card-foot">
        <span className="venue">
          <StadiumIcon />
          <span className="venue-text">
            <span className="vstadium">{pred.venue ?? live?.venue ?? 'Venue TBC'}</span>
            {pred.city && <span className="vcity">{pred.city}</span>}
          </span>
        </span>
        {pred.advances && (
          <span className="advances">{flag(pred.advances)} {pred.advances} advance</span>
        )}
      </div>
    </article>
  )
}

function StadiumIcon() {
  return (
    <svg className="stadium-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 9c0-1.1 4-2 9-2s9 .9 9 2-4 2-9 2-9-.9-9-2Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M3 9v4c0 1.1 4 2 9 2s9-.9 9-2V9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 11.5V15M16 11.5V15" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function KickOff({ iso, inline }: { iso?: string; inline?: boolean }) {
  if (!iso) return <span className="kickoff">Date TBC</span>
  const d = new Date(iso)
  const date = d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (inline) return <>{`${date} · ${time}`}</>
  return (
    <span className="kickoff">
      {date}
      <br />
      {time}
    </span>
  )
}

// --- Golden Boot ---------------------------------------------------------

function GoldenBoot({ scorers }: { scorers: LiveScorer[] }) {
  const pickLast = goldenBootPick.player.toLowerCase().split(' ').pop()!
  const pickFirst = goldenBootPick.player.toLowerCase().split(' ')[0]
  const isMyPick = (name: string) =>
    name.toLowerCase().includes(pickLast) && name.toLowerCase().includes(pickFirst)

  const pickRank = scorers.findIndex((s) => isMyPick(s.name))
  const top = scorers.slice(0, 10)

  return (
    <section className="golden">
      <h2 className="golden-title">Golden Boot race</h2>
      <div className="pick-banner">
        <span className="pick-tag">MY PICK</span>
        <span className="pick-body">
          {flag(goldenBootPick.team)} <strong>{goldenBootPick.player}</strong>
          {pickRank >= 0 ? (
            <span className="pick-rank"> · #{pickRank + 1}, {scorers[pickRank].goals} goals</span>
          ) : (
            <span className="pick-rank muted"> · not scored yet</span>
          )}
        </span>
      </div>

      {top.length === 0 ? (
        <p className="empty">
          The live top-scorer list appears here once the app is connected to the live feed.
        </p>
      ) : (
        <ol className="scorer-list">
          {top.map((s, i) => (
            <li key={`${s.name}-${i}`} className={`scorer-row ${isMyPick(s.name) ? 'my-pick' : ''}`}>
              <span className="rank">{i + 1}</span>
              <span className="who">
                <span className="sname">{s.name}</span>
                <span className="steam">
                  {flag(s.team)} {s.team}
                </span>
              </span>
              <span className="sgoals">
                {s.goals}
                <span className="sgoals-label">goals</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

// --- Confetti when a prediction comes true -------------------------------

function useConfettiOnCorrect(scored: Scored[], loading: boolean) {
  const celebrated = useRef<Set<string>>(new Set())
  const initialised = useRef(false)

  useEffect(() => {
    if (loading) return
    const correctNow = scored.filter((s) => s.result === 'exact' || s.result === 'outcome')

    if (!initialised.current) {
      correctNow.forEach((s) => celebrated.current.add(pairKey(s.pred.home, s.pred.away)))
      initialised.current = true
      return
    }

    const fresh = correctNow.filter((s) => !celebrated.current.has(pairKey(s.pred.home, s.pred.away)))
    if (fresh.length === 0) return

    fresh.forEach((s) => celebrated.current.add(pairKey(s.pred.home, s.pred.away)))
    fireConfetti()
  }, [scored, loading])
}

function fireConfetti() {
  const burst = (originX: number) =>
    confetti({
      particleCount: 80,
      spread: 70,
      startVelocity: 45,
      origin: { x: originX, y: 0.7 },
      colors: ['#E8B647', '#F2D27A', '#34D399', '#ffffff'],
    })
  burst(0.25)
  setTimeout(() => burst(0.75), 150)
}
