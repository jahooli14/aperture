import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
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
import { fetchWeather, syntheticWeather, type Weather, type Condition } from './weather'
import type { LiveScorer, LiveMatch } from './types'

const flag = (team: string) => flags[normaliseName(team)] ?? '🏳️'

// Fetch live weather for the cities that currently have a game in play.
// Cached ~10 min per city so we don't hammer the API on every poll.
function useWeather(liveCities: string[]): Record<string, Weather> {
  const [map, setMap] = useState<Record<string, Weather>>({})
  const cache = useRef<Record<string, { w: Weather; t: number }>>({})

  useEffect(() => {
    let active = true
    liveCities.forEach(async (city) => {
      const cached = cache.current[city]
      if (cached && Date.now() - cached.t < 600_000) return
      const w = await fetchWeather(city)
      if (w && active) {
        cache.current[city] = { w, t: Date.now() }
        setMap((m) => ({ ...m, [city]: w }))
      }
    })
    return () => {
      active = false
    }
  }, [liveCities.join('|')])

  return map
}

export function App() {
  const { data, loading, lastUpdated } = useLiveData()
  const matches = data?.matches ?? []
  const scorers = data?.scorers ?? []

  // Preview helpers: ?demoLive=1 forces the first game live; ?weather=<cond>
  // forces that game's weather (and implies demoLive so you can see it).
  const params = new URLSearchParams(window.location.search)
  const demoWeather = params.get('weather') as Condition | null
  const demoLive = params.get('demoLive') === '1' || !!demoWeather

  const scored: Scored[] = useMemo(
    () =>
      predictions.map((p, idx) => {
        if (demoLive && idx === 0) {
          const fake: LiveMatch = {
            id: -1,
            utcDate: new Date().toISOString(),
            status: 'IN_PLAY',
            stage: '',
            home: p.home,
            away: p.away,
            homeScore: 2,
            awayScore: 1,
            venue: null,
          }
          return scorePrediction(p, fake)
        }
        return scorePrediction(p, findLiveMatch(p, matches))
      }),
    [matches, demoLive]
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

  // Cities with a live game → fetch their weather for the card backgrounds.
  const liveCities = useMemo(() => {
    const set = new Set<string>()
    for (const s of scored) {
      if (s.phase === 'live' && s.pred.city) set.add(s.pred.city)
    }
    return [...set]
  }, [scored])
  const fetched = useWeather(liveCities)

  // Apply the ?weather= override to the first live game's city for preview.
  const weather: Record<string, Weather> = useMemo(() => {
    if (!demoWeather) return fetched
    const city = predictions.find((_, i) => i === 0)?.city
    return city ? { ...fetched, [city]: syntheticWeather(demoWeather) } : fetched
  }, [fetched, demoWeather])

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
          <StageSection key={stage} stage={stage} scored={scored} weather={weather} />
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

function StageSection({
  stage,
  scored,
  weather,
}: {
  stage: Stage
  scored: Scored[]
  weather: Record<string, Weather>
}) {
  // Live games pinned to the top, then most recent kickoff first.
  const rows = scored
    .filter((s) => s.pred.stage === stage)
    .slice()
    .sort((a, b) => {
      const aLive = a.phase === 'live' ? 1 : 0
      const bLive = b.phase === 'live' ? 1 : 0
      if (aLive !== bLive) return bLive - aLive
      const ta = a.live?.utcDate ? Date.parse(a.live.utcDate) : -Infinity
      const tb = b.live?.utcDate ? Date.parse(b.live.utcDate) : -Infinity
      return tb - ta
    })
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
            <PredictionCard
              key={pairKey(s.pred.home, s.pred.away)}
              scored={s}
              weather={s.pred.city ? weather[s.pred.city] : undefined}
            />
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

function PredictionCard({ scored, weather }: { scored: Scored; weather?: Weather }) {
  const { pred, live, phase, result } = scored
  const meta = resultMeta(result)
  const isLive = phase === 'live'

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

  // Live games get a cinematic weather scene as the card background.
  const wxCondition = isLive && weather ? weather.condition : null

  return (
    <article className={`card ${meta.cls} ${phase} ${wxCondition ? `wx wx-${wxCondition}` : ''}`}>
      {wxCondition && <CardWeather condition={wxCondition} />}
      <div className="card-inner">
      <div className="card-top">
        <span className="caption">
          {isLive ? (
            <span className="pill live">
              <span className="dot" /> LIVE
            </span>
          ) : phase === 'final' ? (
            'Full time'
          ) : (
            <KickOff iso={live?.utcDate} inline />
          )}
        </span>
        {isLive && weather && (
          <span className="weather-chip">
            {weather.icon} {weather.tempC}° · {weather.label}
          </span>
        )}
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

// --- Cinematic weather scene (lives inside a live game card) --------------

function CardWeather({ condition }: { condition: Condition }) {
  const particles = condition === 'rain' || condition === 'thunder' || condition === 'snow'
  const hasClouds = condition !== 'clear-night'
  return (
    <div className={`card-weather wx-bg-${condition}`} aria-hidden="true">
      {condition === 'sunny' && <div className="wx-sun" />}
      {condition === 'clear-night' && <div className="wx-moon" />}
      {hasClouds && (
        <>
          <div className="cloud cloud-a" />
          <div className="cloud cloud-b" />
          <div className="cloud cloud-c" />
        </>
      )}
      {particles && (
        <div className="precip">
          {Array.from({ length: 36 }).map((_, i) => (
            <span key={i} className="drop" style={dropStyle(i)} />
          ))}
        </div>
      )}
      {condition === 'thunder' && <div className="lightning" />}
      <div className="card-scrim" />
    </div>
  )
}

// Deterministic per-index positions/timing (no Math.random, stable across renders).
function dropStyle(i: number): CSSProperties {
  const left = (i * 37) % 100
  const delay = ((i * 13) % 100) / 100
  const dur = 0.5 + ((i * 7) % 60) / 100
  return {
    left: `${left}%`,
    animationDelay: `-${delay * dur}s`,
    animationDuration: `${dur}s`,
  }
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
