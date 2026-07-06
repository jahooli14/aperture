import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import confetti from 'canvas-confetti'
import {
  people,
  stageOrder,
  flags,
  countryImage,
  normaliseName,
  kickoffFor,
  teamCode,
  bracketOrder,
  type Stage,
  type Prediction,
} from './predictions'
import {
  scorePrediction,
  findLiveMatch,
  findLive,
  phaseOf,
  pairKey,
  eliminatedTeams,
  personTotal,
  buildBracket,
  slotPickResult,
  goalsForFixture,
  type Scored,
  type BracketSlot,
} from './logic'
import { useLiveData } from './useLiveData'
import { useOdds } from './useOdds'
import { fetchWeather, syntheticWeather, type Weather, type Condition } from './weather'
import type { LiveScorer, LiveMatch, MatchGoals, MatchOdds } from './types'

const flag = (team: string) => flags[normaliseName(team)] ?? '🏳️'

// Short labels for the timeline tabs — full stage names don't fit 4-across
// on a phone screen.
const STAGE_TAB_LABEL: Record<Stage, string> = {
  'Round of 32': 'R32',
  'Round of 16': 'R16',
  'Quarter-finals': 'QF',
  'Semi-finals': 'SF',
  Final: 'Final',
}

type CompareEntry = {
  slug: string
  title: string
  // Bracket slot ("<stage>#<i>") → that person's pick for the slot.
  bySlot: Record<string, Prediction>
}

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

// Fetch player headshots from Wikipedia (CORS-enabled, no key). Cached per name.
function usePlayerPhotos(names: string[]): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>({})
  const cache = useRef<Record<string, boolean>>({})

  useEffect(() => {
    let active = true
    names.forEach(async (name) => {
      if (cache.current[name]) return
      cache.current[name] = true
      try {
        const url =
          'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
          '&prop=pageimages&piprop=thumbnail&pithumbsize=160&redirects=1&titles=' +
          encodeURIComponent(name)
        const resp = await fetch(url)
        const data = await resp.json()
        const pages = data?.query?.pages ?? {}
        let src = ''
        for (const k in pages) {
          const t = pages[k]?.thumbnail?.source
          if (t) {
            src = t
            break
          }
        }
        if (src && active) setMap((m) => ({ ...m, [name]: src }))
      } catch {
        /* no photo — fall back to flag */
      }
    })
    return () => {
      active = false
    }
  }, [names.join('|')])

  return map
}

// Who "you" are — remembered between visits. Old /gavin, /sarjack paths just
// pre-select that person the first time; there's one shared link otherwise.
function initialSlug(): string {
  if (typeof window === 'undefined') return 'katdan'
  const path = window.location.pathname.replace(/[^a-z]/gi, '').toLowerCase()
  if (people[path]) return path
  try {
    const saved = window.localStorage.getItem('wc-person')
    if (saved && people[saved]) return saved
  } catch {
    /* no storage */
  }
  return 'katdan'
}

export function App() {
  const { data, loading, lastUpdated } = useLiveData()
  const scorers = data?.scorers ?? []
  const odds = useOdds()

  const [currentSlug, setCurrentSlug] = useState<string>(initialSlug)
  const person = people[currentSlug] ?? people.katdan
  const [mainTab, setMainTab] = useState<'games' | 'leaderboard' | 'scorers'>('games')
  useEffect(() => {
    try {
      window.localStorage.setItem('wc-person', currentSlug)
    } catch {
      /* no storage */
    }
    document.title = 'World Cup 2026'
  }, [currentSlug])

  const matches = data?.matches ?? []

  // The real bracket, filled from actual results (TBC where undecided). The R32
  // fixtures + each slot's venue/date come from a canonical set — same for all.
  const canonical = people.katdan.predictions
  const bracket = useMemo(() => buildBracket(canonical, matches), [canonical, matches])

  // Everyone's picks, indexed by bracket slot, for the compare panel.
  const compareIndex: CompareEntry[] = useMemo(
    () =>
      Object.values(people).map((p) => {
        const bySlot: Record<string, Prediction> = {}
        const seen: Record<string, number> = {}
        for (const pr of p.predictions) {
          const i = seen[pr.stage] ?? 0
          bySlot[`${pr.stage}#${i}`] = pr
          seen[pr.stage] = i + 1
        }
        return { slug: p.slug, title: p.title, bySlot }
      }),
    []
  )

  // A stage is "done" once every one of its slots is a decided, finished
  // fixture — not just "no live game right now" (that's also true before a
  // stage's teams are even set).
  const isStageDone = (stage: Stage) => {
    const slots = bracket[stage] ?? []
    return (
      slots.length > 0 &&
      slots.every((slot) => {
        if (!slot.home || !slot.away) return false
        const live = findLive(slot.home, slot.away, matches)
        return !!live && phaseOf(live.status) === 'final'
      })
    )
  }

  // Whichever stage still has games left to play — that's the one that opens
  // expanded by default, and every earlier (fully finished) stage collapses.
  const openStage = useMemo(() => {
    const undone = stageOrder.find((stage) => !isStageDone(stage))
    return undone ?? stageOrder[stageOrder.length - 1]
  }, [bracket, matches])

  // Fully-finished stages stay in the same tab row as everything else, just
  // styled grey — the Final never greys out even once decided, since the
  // champion result is the one thing worth staying prominent for good.
  const pastStages = useMemo(() => {
    return stageOrder.filter((stage) => isStageDone(stage) && stage !== 'Final')
  }, [bracket, matches])

  // The single next game to be played (earliest kickoff among known-team,
  // not-yet-finished slots) — moot whenever something's already live, since
  // the live-game scroll above takes priority in that case.
  const nextGame = useMemo(() => {
    if (matches.some((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED')) return null
    let best: string | null = null
    let bestTime = Infinity
    for (const stage of stageOrder) {
      const slots = bracket[stage] ?? []
      slots.forEach((slot, index) => {
        if (!slot.home || !slot.away) return // TBC — not a concrete "next game" yet
        const live = findLive(slot.home, slot.away, matches)
        if (live && phaseOf(live.status) === 'final') return // already played
        const t = slotTime(slot, matches, index)
        if (t < bestTime) {
          bestTime = t
          best = `${stage}#${index}`
        }
      })
    }
    return best
  }, [bracket, matches])

  // Celebrate when the selected person's pick comes good.
  const myScored: Scored[] = useMemo(
    () => person.predictions.map((p) => scorePrediction(p, findLiveMatch(p, matches))),
    [person, matches]
  )
  useConfettiOnCorrect(myScored, loading, currentSlug)

  // Cities with a live game → fetch weather for the card backgrounds.
  const liveCities = useMemo(() => {
    const set = new Set<string>()
    for (const stage of stageOrder) {
      for (const slot of bracket[stage] ?? []) {
        if (!slot.city) continue
        const live = findLive(slot.home, slot.away, matches)
        if (live && phaseOf(live.status) === 'live') set.add(slot.city)
      }
    }
    return [...set]
  }, [bracket, matches])
  const fetched = useWeather(liveCities)

  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const demoWeather = params.get('weather') as Condition | null
  const weather: Record<string, Weather> = useMemo(() => {
    if (!demoWeather) return fetched
    const city = bracket['Round of 32']?.[0]?.city
    return city ? { ...fetched, [city]: syntheticWeather(demoWeather) } : fetched
  }, [fetched, demoWeather, bracket])

  return (
    <div className="app">
      <div className="backdrop" aria-hidden="true" />
      <Header
        lastUpdated={lastUpdated}
        personToggle={<PersonToggle currentSlug={currentSlug} onSelect={setCurrentSlug} />}
      />

      {data && !data.configured && (
        <div className="notice">
          Live scores aren't switched on yet. Add a free{' '}
          <a href="https://www.football-data.org/client/register" target="_blank" rel="noreferrer">
            football-data.org
          </a>{' '}
          API key as <code>FOOTBALL_DATA_API_KEY</code> in Vercel.
        </div>
      )}

      <div className="main-tabs" role="tablist">
        {(
          [
            ['games', 'Games'],
            ['leaderboard', 'Leaderboard'],
            ['scorers', 'Golden Boot'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={mainTab === key}
            className={`main-tab ${mainTab === key ? 'active' : ''}`}
            onClick={() => setMainTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {mainTab === 'leaderboard' && (
        <Leaderboard matches={matches} currentSlug={currentSlug} ready={data !== null} />
      )}

      {mainTab === 'games' && (
        <main>
          {/* Doesn't mount StageTabs until live data has actually arrived —
              openStage defaults to Round of 32 while matches is still empty
              (there's genuinely no way to know the real current stage
              before the data exists), so mounting early meant briefly
              showing R32 before snapping to the real answer once data
              loaded. Waiting avoids ever showing that wrong intermediate
              state instead of just reacting to it faster. */}
          {data ? (
            <StageTabs
              stages={stageOrder}
              pastStages={pastStages}
              bracket={bracket}
              weather={weather}
              matches={matches}
              odds={odds}
              goals={data?.goals}
              compareIndex={compareIndex}
              currentSlug={currentSlug}
              openStage={openStage}
              nextGame={nextGame}
            />
          ) : (
            <p className="empty">Loading live scores…</p>
          )}
        </main>
      )}

      {mainTab === 'scorers' && <GoldenBoot scorers={scorers} pick={person.goldenBoot} />}
    </div>
  )
}

// --- Header --------------------------------------------------------------

function Header({
  lastUpdated,
  personToggle,
}: {
  lastUpdated: Date | null
  personToggle: React.ReactNode
}) {
  return (
    <header className="header">
      {/* Title gets its own full-width row — competing with the dropdown for
          space on one line is what caused it to truncate/overlap. */}
      <h1>
        Merelie World Cup <span className="year">2026</span>
      </h1>
      <div className="header-row">
        {lastUpdated && (
          <p className="updated">
            Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
        {personToggle}
      </div>
    </header>
  )
}

// --- Person toggle -------------------------------------------------------

function PersonToggle({
  currentSlug,
  onSelect,
}: {
  currentSlug: string
  onSelect: (slug: string) => void
}) {
  return (
    <div className="person-toggle">
      <span className="pt-label">Viewing as</span>
      <div className="pt-select-wrap">
        <select
          className="pt-select"
          value={currentSlug}
          onChange={(e) => onSelect(e.target.value)}
        >
          {Object.values(people).map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.title}
            </option>
          ))}
        </select>
        <span className="pt-select-chevron" aria-hidden="true">
          ⌄
        </span>
      </div>
    </div>
  )
}

// --- Leaderboard ---------------------------------------------------------

// Used to collapse to top-3-plus-you when the leaderboard shared a page
// with the games carousel — a dozen rows pushed the actual games (the
// point of the app) far down the screen. Now that Leaderboard is its own
// tab it isn't competing with anything, so everyone shows by default —
// it's a small family group, and half the fun is seeing where everyone
// landed, not just the podium.
const LB_COLLAPSED_COUNT = 14

const MEDALS = ['🥇', '🥈', '🥉']

function Leaderboard({
  matches,
  currentSlug,
  ready,
}: {
  matches: LiveMatch[]
  currentSlug: string
  ready: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  // Before the first live fetch resolves, `matches` is empty and points would
  // read as baseline-only — misleadingly low, and the ranking/crown could be
  // wrong. Show a placeholder instead of a number that's about to jump.
  const rows = useMemo(() => {
    return Object.values(people)
      .map((p) => ({ slug: p.slug, title: p.title, points: personTotal(p, matches) }))
      .sort((a, b) => (ready ? b.points - a.points || a.title.localeCompare(b.title) : 0))
  }, [matches, ready])

  // Competition ranking — a tie shares the same rank number (the next rank
  // then skips ahead, e.g. 1, 2, 2, 4 not 1, 2, 2, 3), with the alphabetical
  // sort above deciding which tied name sits higher in the list.
  const ranks = useMemo(() => {
    const r: number[] = []
    rows.forEach((row, i) => {
      r.push(i > 0 && row.points === rows[i - 1].points ? r[i - 1] : i + 1)
    })
    return r
  }, [rows])

  const leaderPts = rows[0]?.points ?? 0
  const myIndex = rows.findIndex((r) => r.slug === currentSlug)
  const collapsible = rows.length > LB_COLLAPSED_COUNT
  const visible = expanded || !collapsible ? rows : rows.slice(0, LB_COLLAPSED_COUNT)
  const showMeSeparately = collapsible && !expanded && myIndex >= LB_COLLAPSED_COUNT

  // "You've moved up" since their last visit — a reason to open the app
  // between games, not just during kick-off. Snapshotted once per page
  // load (not on every live-score poll) so it doesn't flicker mid-session;
  // compares against the rank stored the last time they had it ready.
  const [movement, setMovement] = useState<{ from: number; to: number } | null>(null)
  const checkedRef = useRef(false)
  useEffect(() => {
    if (checkedRef.current || !ready || myIndex < 0) return
    checkedRef.current = true
    const myRank = ranks[myIndex]
    const key = `wc-rank-${currentSlug}`
    const prev = window.localStorage.getItem(key)
    if (prev != null && Number(prev) !== myRank) {
      setMovement({ from: Number(prev), to: myRank })
    }
    window.localStorage.setItem(key, String(myRank))
  }, [ready, myIndex, ranks, currentSlug])

  const renderRow = (r: (typeof rows)[number], i: number) => {
    const rank = ranks[i]
    const isLeader = ready && rank === 1
    const medal = ready ? MEDALS[rank - 1] : undefined
    return (
      <li
        key={r.slug}
        className={`lb-row ${isLeader ? 'leader' : ''} ${r.slug === currentSlug ? 'me' : ''}`}
      >
        <span className="lb-rank">
          {/* Top 3 get a medal instead of a bare number — the standard
              podium treatment, easier to scan at a glance than digits. */}
          {medal ? <span aria-hidden="true">{medal}</span> : rank}
        </span>
        <span className="lb-name">{r.title}</span>
        <span className="lb-pts">{ready ? r.points : '···'}</span>
        <span className="lb-gap">{!ready || isLeader ? '' : `−${leaderPts - r.points}`}</span>
      </li>
    )
  }

  return (
    <section className="leaderboard">
      {movement && (
        <p className={`lb-movement ${movement.to < movement.from ? 'up' : 'down'}`}>
          {movement.to < movement.from
            ? `You've moved up ${movement.from - movement.to} place${movement.from - movement.to === 1 ? '' : 's'}${movement.to === 1 ? " — you're in the lead!" : '!'}`
            : `You've dropped to ${movement.to}${movement.to === 2 ? 'nd' : movement.to === 3 ? 'rd' : 'th'} since you last checked.`}
        </p>
      )}
      <ol className="lb-list">
        {visible.map((r, i) => renderRow(r, i))}
        {showMeSeparately && (
          <>
            <li className="lb-ellipsis" aria-hidden="true">
              ⋯
            </li>
            {renderRow(rows[myIndex], myIndex)}
          </>
        )}
      </ol>
      {collapsible && (
        <button className="lb-toggle" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Show less' : `See all ${rows.length}`}
          <span className={`chevron ${expanded ? 'open' : ''}`} aria-hidden="true">
            ⌄
          </span>
        </button>
      )}
    </section>
  )
}

// --- Stage section -------------------------------------------------------

// The actual swipeable row of cards for one stage — shared between the
// accordion (past rounds) and the tab-selected single carousel (active
// rounds).
function GamesCarousel({
  stage,
  slots,
  weather,
  matches,
  odds,
  goals,
  compareIndex,
  currentSlug,
  nextGame,
}: {
  stage: Stage
  slots: BracketSlot[]
  weather: Record<string, Weather>
  matches: LiveMatch[]
  odds: MatchOdds[]
  goals?: MatchGoals[]
  compareIndex: CompareEntry[]
  currentSlug: string
  nextGame: string | null
}) {
  // Keep each slot's bracket index (the compare panel keys off it), then order
  // for display by kickoff — finished/live/next, earliest first.
  const games = slots
    .map((slot, index) => ({ slot, index }))
    .sort((a, b) => {
      const ta = slotTime(a.slot, matches, a.index)
      const tb = slotTime(b.slot, matches, b.index)
      return ta - tb
    })

  // Which card is currently centred, for the dot indicator — also makes it
  // obvious at a glance there's more than one game to swipe through.
  const trackRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const onScroll = () => {
      const i = Math.round(el.scrollLeft / (el.clientWidth * 0.92))
      setActiveIndex(Math.max(0, Math.min(games.length - 1, i)))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => el.removeEventListener('scroll', onScroll)
  }, [games.length])

  return (
    <>
      <div className="cards" ref={trackRef}>
        {games.map(({ slot, index }) => (
          <TrueGameCard
            key={`${stage}#${index}`}
            stage={stage}
            slotIndex={index}
            slot={slot}
            weather={slot.city ? weather[slot.city] : undefined}
            matches={matches}
            odds={odds}
            goals={goals}
            compareIndex={compareIndex}
            currentSlug={currentSlug}
            isNextUp={nextGame === `${stage}#${index}`}
          />
        ))}
      </div>
      {games.length > 1 && (
        <div className="carousel-dots" role="tablist" aria-label="Games in this round">
          {games.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === activeIndex}
              aria-label={`Game ${i + 1} of ${games.length}`}
              className={`carousel-dot ${i === activeIndex ? 'active' : ''}`}
              onClick={() => {
                const el = trackRef.current
                if (el) el.scrollTo({ left: i * el.clientWidth * 0.92, behavior: 'smooth' })
              }}
            />
          ))}
        </div>
      )}
    </>
  )
}

function StageSection({
  stage,
  slots,
  weather,
  matches,
  odds,
  goals,
  compareIndex,
  currentSlug,
  defaultOpen,
  nextGame,
  past,
}: {
  stage: Stage
  slots: BracketSlot[]
  weather: Record<string, Weather>
  matches: LiveMatch[]
  odds: MatchOdds[]
  goals?: MatchGoals[]
  compareIndex: CompareEntry[]
  currentSlug: string
  defaultOpen: boolean
  nextGame: string | null
  past?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  // Live match data loads async, so the very first defaultOpen (computed
  // before any results are in) can be wrong — keep following it until the
  // user actually clicks the toggle themselves.
  const userToggled = useRef(false)
  useEffect(() => {
    if (!userToggled.current) setOpen(defaultOpen)
  }, [defaultOpen])

  return (
    <section className={`stage ${past ? 'stage-past' : ''}`} data-stage={stage}>
      <button
        className="stage-title"
        onClick={() => {
          userToggled.current = true
          setOpen((o) => !o)
        }}
        aria-expanded={open}
      >
        <span className="stage-name">{stage}</span>
        <span className="stage-count">{slots.length}</span>
        <span className={`chevron ${open ? 'open' : ''}`} aria-hidden="true">
          ⌄
        </span>
      </button>
      {open && (
        <GamesCarousel
          stage={stage}
          slots={slots}
          weather={weather}
          matches={matches}
          odds={odds}
          goals={goals}
          compareIndex={compareIndex}
          currentSlug={currentSlug}
          nextGame={nextGame}
        />
      )}
    </section>
  )
}

// "Who wins it all" — everyone's outright champion pick in one place,
// instead of buried a tap away inside the single Final card. Grouped by
// team so it reads as a tally ("6 of you: ...") rather than a flat list.
function FinalPredictionsSummary({
  compareIndex,
  currentSlug,
}: {
  compareIndex: CompareEntry[]
  currentSlug: string
}) {
  const groups = useMemo(() => {
    const byTeam: Record<string, { team: string; names: string[] }> = {}
    for (const ci of compareIndex) {
      const pick = ci.bySlot['Final#0']
      if (!pick) continue
      const decisive = pick.homeScore !== pick.awayScore
      const champion = decisive ? (pick.homeScore! > pick.awayScore! ? pick.home : pick.away) : pick.advances
      if (!champion) continue
      const key = normaliseName(champion).toLowerCase()
      const entry = (byTeam[key] ??= { team: champion, names: [] })
      entry.names.push(ci.slug === currentSlug ? `${ci.title} (you)` : ci.title)
    }
    return Object.values(byTeam).sort((a, b) => b.names.length - a.names.length)
  }, [compareIndex, currentSlug])

  if (!groups.length) return null

  return (
    <section className="final-summary">
      <h2 className="final-summary-title">Who wins it all</h2>
      <ul className="final-summary-list">
        {groups.map((g) => (
          <li key={g.team} className="final-summary-row">
            <span className="final-summary-team">
              {flag(g.team)} {teamCode(g.team)}
            </span>
            <span className="final-summary-count">{g.names.length}</span>
            <span className="final-summary-names">{g.names.join(', ')}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// Timeline tab bar (Round of 16 / Quarter-finals / Semi-finals / Final) —
// one stage selected at a time, its games shown below in a single carousel,
// instead of every stage stacked as its own accordion + carousel.
function StageTabs({
  stages,
  pastStages,
  bracket,
  weather,
  matches,
  odds,
  goals,
  compareIndex,
  currentSlug,
  openStage,
  nextGame,
}: {
  stages: Stage[]
  pastStages: Stage[]
  bracket: Record<Stage, BracketSlot[]>
  weather: Record<string, Weather>
  matches: LiveMatch[]
  odds: MatchOdds[]
  goals?: MatchGoals[]
  compareIndex: CompareEntry[]
  currentSlug: string
  openStage: Stage
  nextGame: string | null
}) {
  const [selected, setSelected] = useState<Stage>(openStage)
  // Same "keep following the computed default until the user actually picks
  // a tab themselves" pattern as the old accordion — live data resolves
  // async, so the first computed default can change underneath us.
  const userSelected = useRef(false)
  useEffect(() => {
    if (!userSelected.current && stages.includes(openStage)) setSelected(openStage)
  }, [openStage, stages])

  const activeStage = stages.includes(selected) ? selected : stages[0]

  return (
    <div className="stage-tabs-wrap" data-stage={activeStage}>
      <div className="stage-tabs" role="tablist">
        {stages.map((stage) => (
          <button
            key={stage}
            role="tab"
            aria-selected={stage === activeStage}
            className={`stage-tab ${stage === activeStage ? 'active' : ''} ${
              pastStages.includes(stage) ? 'stage-tab-past' : ''
            }`}
            onClick={() => {
              userSelected.current = true
              setSelected(stage)
            }}
          >
            {STAGE_TAB_LABEL[stage]}
          </button>
        ))}
      </div>
      {activeStage === 'Final' && (
        <FinalPredictionsSummary compareIndex={compareIndex} currentSlug={currentSlug} />
      )}
      {activeStage && (
        <GamesCarousel
          // Forces a fresh mount per stage — without this, switching tabs
          // reused the same instance, carrying over stale scroll position
          // and dot-index state from whichever stage was open before.
          key={activeStage}
          stage={activeStage}
          slots={bracket[activeStage] ?? []}
          weather={weather}
          matches={matches}
          odds={odds}
          goals={goals}
          compareIndex={compareIndex}
          currentSlug={currentSlug}
          nextGame={nextGame}
        />
      )}
    </div>
  )
}

// Sort key: real kickoff if we have one, else keep bracket order.
function slotTime(slot: BracketSlot, matches: LiveMatch[], index: number): number {
  const live = findLive(slot.home, slot.away, matches)
  const iso =
    live?.utcDate ||
    slot.kickoff ||
    (slot.home && slot.away ? kickoffFor(slot.home, slot.away) : '')
  return iso ? Date.parse(iso) : 1e15 + index
}

// --- True game card ------------------------------------------------------

function TrueGameCard({
  stage,
  slotIndex,
  slot,
  weather,
  matches,
  odds,
  goals,
  compareIndex,
  currentSlug,
  isNextUp,
}: {
  stage: Stage
  slotIndex: number
  slot: BracketSlot
  weather?: Weather
  matches: LiveMatch[]
  odds: MatchOdds[]
  goals?: MatchGoals[]
  compareIndex: CompareEntry[]
  currentSlug: string
  isNextUp: boolean
}) {
  const { home, away } = slot
  const known = !!home && !!away
  const live = findLive(home, away, matches)
  const phase = live ? phaseOf(live.status) : 'upcoming'
  const isLive = phase === 'live'
  const [cmpOpen, setCmpOpen] = useState(false)
  const eliminated = useMemo(() => eliminatedTeams(matches), [matches])

  // Pre-match favorite, shown through kickoff and the live phase (frozen at
  // its last fetched price), gone once the result is known — a 90-min-only
  // price stops meaning anything once we already know who actually won.
  const matchOdds =
    known && phase !== 'final'
      ? odds.find((o) => pairKey(o.home, o.away) === pairKey(home!, away!))
      : undefined

  // Orient the real score to home/away (the feed may list teams swapped).
  let sHome: number | null = null
  let sAway: number | null = null
  if (known && live && live.homeScore != null && live.awayScore != null) {
    const swapped = normaliseName(live.home).toLowerCase() !== normaliseName(home!).toLowerCase()
    sHome = swapped ? live.awayScore : live.homeScore
    sAway = swapped ? live.homeScore : live.awayScore
  }
  const hasScore = sHome != null && sAway != null

  // Draw settled on penalties — mark the side that went through with a 🏆.
  const pensAdvancer =
    phase === 'final' && hasScore && sHome === sAway && live?.advancer ? live.advancer : null
  const wentThrough = (name: string | null) =>
    !!name && !!pensAdvancer && normaliseName(name).toLowerCase() === normaliseName(pensAdvancer).toLowerCase()

  const g = known && phase !== 'upcoming' ? goalsForFixture(home!, away!, goals) : null
  const hasGoals = !!g && (g.home.length > 0 || g.away.length > 0)

  const wxCondition = isLive && weather ? weather.condition : null
  const koIso =
    live?.utcDate || slot.kickoff || (known ? kickoffFor(home!, away!) : undefined)

  const cmpRows = useMemo(() => {
    const me = compareIndex.find((c) => c.slug === currentSlug)
    const rest = compareIndex.filter((c) => c.slug !== currentSlug)
    return me ? [me, ...rest] : compareIndex
  }, [compareIndex, currentSlug])

  // Who backed which side, visible on the closed card — answers "who's
  // still alive on this one" at a glance, without opening Compare picks.
  const backed = useMemo(() => {
    if (!known) return null
    let homeCount = 0
    let awayCount = 0
    for (const ci of cmpRows) {
      const pick = ci.bySlot[`${stage}#${slotIndex}`]
      if (!pick) continue
      const decisive = pick.homeScore !== pick.awayScore
      const backedName = decisive ? (pick.homeScore! > pick.awayScore! ? pick.home : pick.away) : pick.advances
      if (!backedName) continue
      if (normaliseName(backedName).toLowerCase() === normaliseName(home!).toLowerCase()) homeCount++
      else if (normaliseName(backedName).toLowerCase() === normaliseName(away!).toLowerCase()) awayCount++
    }
    return homeCount + awayCount > 0 ? { homeCount, awayCount } : null
  }, [known, cmpRows, stage, slotIndex, home, away])

  return (
    <article
      className={`card ${phase} ${wxCondition ? `wx wx-${wxCondition}` : ''} ${
        !isLive ? 'placed lighttext' : ''
      } ${isNextUp && phase !== 'live' ? 'next-up' : ''}`}
      data-slot-key={`${stage}#${slotIndex}`}
    >
      <div className="card-inner">
        {known ? (
          wxCondition ? (
            <>
              <CardPlace home={home!} away={away!} light />
              <CardWeather condition={wxCondition} overPhoto />
            </>
          ) : (
            <CardPlace home={home!} away={away!} />
          )
        ) : (
          // TBC slot — no teams yet, so show a World Cup stadium behind it.
          <div className="card-place" aria-hidden="true">
            <div className="pfull" style={{ backgroundImage: 'url(/stadium.jpg)' }} />
            <div className="place-veil" />
          </div>
        )}
        {/* Positioned above the (absolutely-positioned) photo — without this,
            the photo paints over plain in-flow text regardless of z-index.
            Only ever holds card-top + match: neither one's height varies by
            match state, so the photo behind them is the same size on every
            card. Anything that DOES vary (odds, goals, venue) lives below,
            off the photo, so it can never affect the photo's size. */}
        <div className="card-header">
          <div className="card-top">
            <span className="caption">
              {isLive ? (
                <span className="pill live">
                  <span className="dot" /> LIVE{live?.minute ? ` ${live.minute}` : ''}
                </span>
              ) : phase === 'final' ? (
                'Full time'
              ) : koIso ? (
                <KickOff iso={koIso} inline />
              ) : (
                slot.dateText ?? 'Date TBC'
              )}
            </span>
            {isLive && weather && (
              <span className="weather-chip">
                {weather.icon} {weather.tempC}° · {weather.label}
              </span>
            )}
          </div>

          <div className="match">
            <TeamSide name={home} advanced={wentThrough(home)} />
            <div className="center">
              <span className={`bigscore ${phase}`}>{hasScore ? `${sHome}–${sAway}` : 'vs'}</span>
            </div>
            <TeamSide name={away} advanced={wentThrough(away)} />
          </div>
        </div>
      </div>

      <div className="card-extra">
        {matchOdds && (
          <div className="odds-line">
            <span className="odds-label">Bookies favourite (90 mins):</span>
            <span className="odds-value">
              {matchOdds.favorite === 'Draw' ? 'Draw' : `${matchOdds.favorite} to win`}{' '}
              {matchOdds.fractional}
            </span>
          </div>
        )}

        {hasGoals && g && (
          <div className="goals-line">
            <div className="gside">
              {g.home.map((goal, i) => (
                <span key={i} className="goal">
                  ⚽ {goal.name} {goal.minute}
                </span>
              ))}
            </div>
            <div className="gside right">
              {g.away.map((goal, i) => (
                <span key={i} className="goal">
                  {goal.name} {goal.minute} ⚽
                </span>
              ))}
            </div>
          </div>
        )}

        {backed && (
          <div className="backed-line">
            {flag(home!)} {backed.homeCount} backed {teamCode(home!)} · {flag(away!)} {backed.awayCount} backed{' '}
            {teamCode(away!)}
          </div>
        )}

        <div className="card-foot">
          <span className="venue">
            <StadiumIcon />
            <span className="venue-text">
              <span className="vstadium">{slot.venue ?? live?.venue ?? 'Venue TBC'}</span>
              {slot.city && <span className="vcity">{slot.city}</span>}
            </span>
          </span>
        </div>
      </div>

      {/* Outside the photo header so opening this never stretches the photo
          to cover it — the photo only ever fills the header above. */}
      <div className="card-compare">
        <button
          className="compare-toggle"
          onClick={() => setCmpOpen((o) => !o)}
          aria-expanded={cmpOpen}
        >
          Compare picks
          <span className={`chevron ${cmpOpen ? 'open' : ''}`} aria-hidden="true">
            ⌄
          </span>
        </button>
        {cmpOpen && (
          <div className="compare">
            {cmpRows.map((ci) => {
              const pick = ci.bySlot[`${stage}#${slotIndex}`]
              const r = slotPickResult(pick, home, away, live)
              const cls =
                r === 'exact' ? 'cmp-exact' : r === 'outcome' ? 'cmp-ok' : r === 'wrong' ? 'cmp-wrong' : ''
              // From R16 on show each person's own teams; R32 everyone shares them.
              const showTeams = !!pick && stage !== 'Round of 32'
              const sameName = (a: string, b: string) =>
                normaliseName(a).toLowerCase() === normaliseName(b).toLowerCase()

              let t1 = pick?.home
              let t2 = pick?.away
              let sc1 = pick?.homeScore
              let sc2 = pick?.awayScore
              const swap = () => {
                t1 = pick!.away
                t2 = pick!.home
                sc1 = pick!.awayScore
                sc2 = pick!.homeScore
              }
              if (pick) {
                if (home && away) {
                  // Real teams known → order to match the card (same team first).
                  if (sameName(pick.home, away) || sameName(pick.away, home)) swap()
                } else if (bracketOrder(pick.home) > bracketOrder(pick.away)) {
                  // TBC slot → order by bracket position so the same team is
                  // always on the same side across everyone's rows.
                  swap()
                }
              }

              const isFinal = stage === 'Final'
              const decisive = sc1 != null && sc2 != null && sc1 !== sc2
              const champion = isFinal ? (decisive ? (sc1! > sc2! ? t1 : t2) : pick?.advances) : undefined
              const pensAdv = !isFinal && !decisive ? pick?.advances : undefined
              // One advancer per row: the Final's champion (however they won —
              // still the trophy, penalties or not), or a drawn pick's backed
              // team in any other round. 🏆 either way, plus a bold/gold
              // highlight on the name itself so it doesn't rely on the emoji
              // alone to read clearly.
              // Every winning pick gets the gold/bold highlight, decisive or
              // not — the 🏆 stays reserved for the Final's champion or a
              // penalties call, where the scoreline alone doesn't already
              // make the winner obvious.
              const trophyWorthy = champion ?? pensAdv
              const winner = decisive ? (sc1! > sc2! ? t1 : t2) : trophyWorthy
              const renderTeam = (name: string) => {
                const wins = !!winner && sameName(name, winner)
                const trophy = !!trophyWorthy && sameName(name, trophyWorthy)
                const out = eliminated.has(normaliseName(name).toLowerCase())
                return (
                  <span>
                    {flag(name)}{' '}
                    <span className={`${out ? 'cmp-out' : ''} ${wins ? 'cmp-advancer' : ''}`}>
                      {teamCode(name)}
                    </span>
                    {trophy && ' 🏆'}
                  </span>
                )
              }

              return (
                <div key={ci.slug} className={`cmp-row ${ci.slug === currentSlug ? 'me' : ''}`}>
                  <span className="cmp-name">{ci.title}</span>
                  {pick ? (
                    <>
                      <span className="cmp-mid">
                        {showTeams && t1 && t2 && (
                          <>
                            {renderTeam(t1)} <span className="cmp-v">v</span> {renderTeam(t2)}
                          </>
                        )}
                      </span>
                      {/* Fixed columns so stars line up under stars and trophies
                          under trophies across every row. */}
                      <span className="cmp-star" title={r === 'exact' ? 'Exact score' : undefined}>
                        {r === 'exact' ? '⭐' : ''}
                      </span>
                      <span
                        className="cmp-trophy"
                        title={r === 'exact' || r === 'outcome' ? 'Right result' : undefined}
                      >
                        {r === 'exact' || r === 'outcome' ? '🏆' : ''}
                      </span>
                      <span className={`cmp-num ${cls}`}>
                        {sc1}–{sc2}
                      </span>
                    </>
                  ) : (
                    <span className="cmp-na">—</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </article>
  )
}

function TeamSide({ name, advanced }: { name: string | null; advanced?: boolean }) {
  if (!name) {
    return (
      <div className="side">
        <span className="crest crest-tbc">🏳️</span>
        <span className="tname tbc">TBC</span>
      </div>
    )
  }
  return (
    <div className="side">
      <span className="crest">{flag(name)}</span>
      <span className="tname">
        {name}
        {advanced && <span className="pens-trophy" title="Won on penalties"> 🏆</span>}
      </span>
    </div>
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
  // Always show UK time (Europe/London → BST in summer) so everyone in the pool
  // sees the same kickoff regardless of their device timezone.
  const tz = { timeZone: 'Europe/London' } as const
  const date = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...tz })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', ...tz })
  if (inline) return <>{`${date} · ${time}`}</>
  return (
    <span className="kickoff">
      {date}
      <br />
      {time}
    </span>
  )
}

// --- Half-and-half country photos (non-live cards) ------------------------

function CardPlace({ home, away, light }: { home: string; away: string; light?: boolean }) {
  const h = countryImage(home)
  const a = countryImage(away)
  return (
    <div className="card-place" aria-hidden="true">
      {h && <div className="phalf phome" style={{ backgroundImage: `url(${h})` }} />}
      {a && <div className="phalf paway" style={{ backgroundImage: `url(${a})` }} />}
      <div className={`place-veil ${light ? 'light' : ''}`} />
    </div>
  )
}

// --- Cinematic weather scene (lives inside a live game card) --------------

function CardWeather({ condition, overPhoto }: { condition: Condition; overPhoto?: boolean }) {
  const particles = condition === 'rain' || condition === 'thunder' || condition === 'snow'
  const hasClouds = condition !== 'clear-night'
  return (
    <div className={`card-weather wx-bg-${condition} ${overPhoto ? 'wx-over' : ''}`} aria-hidden="true">
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

function GoldenBoot({
  scorers,
  pick,
}: {
  scorers: LiveScorer[]
  pick: { player: string; team: string }
}) {
  // Shows top 8 automatically — this is its own dedicated tab now (not
  // competing with the leaderboard/games for space on one long page), so
  // there's no reason to hide it behind a tap the way the leaderboard does.
  const AUTO_COUNT = 8
  const [expanded, setExpanded] = useState(false)

  const pickLast = pick.player.toLowerCase().split(' ').pop()!
  const pickFirst = pick.player.toLowerCase().split(' ')[0]
  const isMyPick = (name: string) =>
    name.toLowerCase().includes(pickLast) && name.toLowerCase().includes(pickFirst)

  const pickRank = scorers.findIndex((s) => isMyPick(s.name))
  const top = scorers.slice(0, 15)
  const collapsible = top.length > AUTO_COUNT
  const visible = expanded || !collapsible ? top : top.slice(0, AUTO_COUNT)
  const photos = usePlayerPhotos(top.map((s) => s.name))

  return (
    <section className="golden">
      <h2 className="golden-title">Golden Boot race</h2>
      <div className="pick-banner">
        <span className="pick-tag">MY PICK</span>
        <span className="pick-body">
          {flag(pick.team)} <strong>{pick.player}</strong>
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
        <>
          <ol className="scorer-list">
            {visible.map((s, i) => (
              <li key={`${s.name}-${i}`} className={`scorer-row ${isMyPick(s.name) ? 'my-pick' : ''}`}>
                <span className="rank">{i + 1}</span>
                {photos[s.name] ? (
                  <img className="savatar" src={photos[s.name]} alt="" loading="lazy" />
                ) : (
                  <span className="savatar savatar-fallback">{flag(s.team)}</span>
                )}
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
          {collapsible && (
            <button className="lb-toggle" onClick={() => setExpanded((e) => !e)}>
              {expanded ? 'Show less' : `See all ${top.length}`}
              <span className={`chevron ${expanded ? 'open' : ''}`} aria-hidden="true">
                ⌄
              </span>
            </button>
          )}
        </>
      )}
    </section>
  )
}

// --- Confetti when a prediction comes true -------------------------------

function useConfettiOnCorrect(scored: Scored[], loading: boolean, personSlug: string) {
  // Keyed per-person — otherwise switching "viewing as" surfaces a whole new
  // set of already-correct picks that just aren't in the celebrated set yet
  // (seeded from whoever was viewed first), firing confetti for old results
  // instead of only for a result that's genuinely just turned correct.
  const celebrated = useRef<Map<string, Set<string>>>(new Map())
  const initialised = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (loading) return
    const correctNow = scored.filter((s) => s.result === 'exact' || s.result === 'outcome')
    const seen = celebrated.current.get(personSlug) ?? new Set<string>()
    celebrated.current.set(personSlug, seen)

    if (!initialised.current.has(personSlug)) {
      correctNow.forEach((s) => seen.add(pairKey(s.pred.home, s.pred.away)))
      initialised.current.add(personSlug)
      return
    }

    const fresh = correctNow.filter((s) => !seen.has(pairKey(s.pred.home, s.pred.away)))
    if (fresh.length === 0) return

    fresh.forEach((s) => seen.add(pairKey(s.pred.home, s.pred.away)))
    fireConfetti()
  }, [scored, loading, personSlug])
}

function fireConfetti() {
  // Canvas-based, so the CSS prefers-reduced-motion rule doesn't touch it —
  // check directly rather than fire a big moving animation regardless.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
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
