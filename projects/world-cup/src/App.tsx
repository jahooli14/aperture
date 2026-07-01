import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import confetti from 'canvas-confetti'
import {
  people,
  stageOrder,
  flags,
  countryImage,
  normaliseName,
  kickoffFor,
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
import { fetchWeather, syntheticWeather, type Weather, type Condition } from './weather'
import type { LiveScorer, LiveMatch, MatchGoals } from './types'

const flag = (team: string) => flags[normaliseName(team)] ?? '🏳️'

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

  const [currentSlug, setCurrentSlug] = useState<string>(initialSlug)
  const person = people[currentSlug] ?? people.katdan
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

  // On first load with a game in play, scroll it into view.
  const scrolledRef = useRef(false)
  useEffect(() => {
    if (scrolledRef.current) return
    if (!matches.some((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED')) return
    scrolledRef.current = true
    const doScroll = () => {
      const el = document.querySelector('.card.live')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    const timers = [500, 1400, 2800].map((ms) => setTimeout(doScroll, ms))
    return () => timers.forEach(clearTimeout)
  }, [matches])

  // Celebrate when the selected person's pick comes good.
  const myScored: Scored[] = useMemo(
    () => person.predictions.map((p) => scorePrediction(p, findLiveMatch(p, matches))),
    [person, matches]
  )
  useConfettiOnCorrect(myScored, loading)

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
      <Header lastUpdated={lastUpdated} live={matches.some((m) => phaseOf(m.status) === 'live')} />

      <PersonToggle currentSlug={currentSlug} onSelect={setCurrentSlug} />

      {data && !data.configured && (
        <div className="notice">
          Live scores aren't switched on yet. Add a free{' '}
          <a href="https://www.football-data.org/client/register" target="_blank" rel="noreferrer">
            football-data.org
          </a>{' '}
          API key as <code>FOOTBALL_DATA_API_KEY</code> in Vercel.
        </div>
      )}

      <Leaderboard matches={matches} currentSlug={currentSlug} />

      <main>
        {stageOrder.map((stage) => (
          <StageSection
            key={stage}
            stage={stage}
            slots={bracket[stage] ?? []}
            weather={weather}
            matches={matches}
            goals={data?.goals}
            compareIndex={compareIndex}
            currentSlug={currentSlug}
          />
        ))}
      </main>

      <GoldenBoot scorers={scorers} pick={person.goldenBoot} />

      <footer className="footer">
        World Cup 2026 · live data via football-data.org · photo by Alex Simpson / Unsplash
      </footer>
    </div>
  )
}

// --- Header --------------------------------------------------------------

function Header({ lastUpdated, live }: { lastUpdated: Date | null; live: boolean }) {
  const share = async () => {
    const shareData = {
      title: 'World Cup 2026',
      text: 'World Cup 2026 — predictions vs the live scores',
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
        World Cup <span className="year">2026</span>
      </h1>
      {lastUpdated && (
        <p className="updated">
          Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
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
      <div className="pt-seg" role="tablist">
        {Object.values(people).map((p) => (
          <button
            key={p.slug}
            role="tab"
            aria-selected={p.slug === currentSlug}
            className={`pt-btn ${p.slug === currentSlug ? 'active' : ''}`}
            onClick={() => onSelect(p.slug)}
          >
            {p.title}
          </button>
        ))}
      </div>
    </div>
  )
}

// --- Leaderboard ---------------------------------------------------------

function Leaderboard({ matches, currentSlug }: { matches: LiveMatch[]; currentSlug: string }) {
  const rows = useMemo(() => {
    return Object.values(people)
      .map((p) => ({ slug: p.slug, title: p.title, points: personTotal(p, matches) }))
      .sort((a, b) => b.points - a.points)
  }, [matches])

  const leaderPts = rows[0]?.points ?? 0

  return (
    <section className="leaderboard">
      <ol className="lb-list">
        {rows.map((r, i) => {
          const isLeader = i === 0
          return (
            <li
              key={r.slug}
              className={`lb-row ${isLeader ? 'leader' : ''} ${
                r.slug === currentSlug ? 'me' : ''
              }`}
            >
              <span className="lb-rank">{i + 1}</span>
              <span className="lb-name">
                {r.title}
                {r.slug === currentSlug ? ' (you)' : ''}
                {isLeader && <span className="lb-crown"> 👑</span>}
              </span>
              <span className="lb-pts">{r.points}</span>
              <span className="lb-gap">{isLeader ? '' : `−${leaderPts - r.points}`}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

// --- Stage section -------------------------------------------------------

function StageSection({
  stage,
  slots,
  weather,
  matches,
  goals,
  compareIndex,
  currentSlug,
}: {
  stage: Stage
  slots: BracketSlot[]
  weather: Record<string, Weather>
  matches: LiveMatch[]
  goals?: MatchGoals[]
  compareIndex: CompareEntry[]
  currentSlug: string
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

  const [open, setOpen] = useState(stage === 'Round of 32')

  return (
    <section className="stage">
      <button className="stage-title" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="stage-name">{stage}</span>
        <span className="stage-count">{slots.length}</span>
        <span className={`chevron ${open ? 'open' : ''}`} aria-hidden="true">
          ⌄
        </span>
      </button>
      {open && (
        <div className="cards">
          {games.map(({ slot, index }) => (
            <TrueGameCard
              key={`${stage}#${index}`}
              stage={stage}
              slotIndex={index}
              slot={slot}
              weather={slot.city ? weather[slot.city] : undefined}
              matches={matches}
              goals={goals}
              compareIndex={compareIndex}
              currentSlug={currentSlug}
            />
          ))}
        </div>
      )}
    </section>
  )
}

// Sort key: real kickoff if we have one, else keep bracket order.
function slotTime(slot: BracketSlot, matches: LiveMatch[], index: number): number {
  const live = findLive(slot.home, slot.away, matches)
  const iso = live?.utcDate || (slot.home && slot.away ? kickoffFor(slot.home, slot.away) : '')
  return iso ? Date.parse(iso) : 1e15 + index
}

// --- True game card ------------------------------------------------------

function TrueGameCard({
  stage,
  slotIndex,
  slot,
  weather,
  matches,
  goals,
  compareIndex,
  currentSlug,
}: {
  stage: Stage
  slotIndex: number
  slot: BracketSlot
  weather?: Weather
  matches: LiveMatch[]
  goals?: MatchGoals[]
  compareIndex: CompareEntry[]
  currentSlug: string
}) {
  const { home, away } = slot
  const known = !!home && !!away
  const live = findLive(home, away, matches)
  const phase = live ? phaseOf(live.status) : 'upcoming'
  const isLive = phase === 'live'
  const [cmpOpen, setCmpOpen] = useState(false)
  const eliminated = useMemo(() => eliminatedTeams(matches), [matches])

  // Orient the real score to home/away (the feed may list teams swapped).
  let sHome: number | null = null
  let sAway: number | null = null
  if (known && live && live.homeScore != null && live.awayScore != null) {
    const swapped = normaliseName(live.home).toLowerCase() !== normaliseName(home!).toLowerCase()
    sHome = swapped ? live.awayScore : live.homeScore
    sAway = swapped ? live.homeScore : live.awayScore
  }
  const hasScore = sHome != null && sAway != null

  const g = known && phase !== 'upcoming' ? goalsForFixture(home!, away!, goals) : null
  const hasGoals = !!g && (g.home.length > 0 || g.away.length > 0)

  const wxCondition = isLive && weather ? weather.condition : null
  const koIso = live?.utcDate || (known ? kickoffFor(home!, away!) : undefined)

  const cmpRows = useMemo(() => {
    const me = compareIndex.find((c) => c.slug === currentSlug)
    const rest = compareIndex.filter((c) => c.slug !== currentSlug)
    return me ? [me, ...rest] : compareIndex
  }, [compareIndex, currentSlug])

  return (
    <article
      className={`card ${phase} ${wxCondition ? `wx wx-${wxCondition}` : ''} ${
        !isLive ? 'placed lighttext' : ''
      }`}
    >
      {known &&
        (wxCondition ? (
          <>
            <CardPlace home={home!} away={away!} light />
            <CardWeather condition={wxCondition} overPhoto />
          </>
        ) : (
          <CardPlace home={home!} away={away!} />
        ))}
      <div className="card-inner">
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
          <TeamSide name={home} />
          <div className="center">
            <span className={`bigscore ${phase}`}>{hasScore ? `${sHome}–${sAway}` : 'vs'}</span>
          </div>
          <TeamSide name={away} />
        </div>

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

        <div className="card-foot">
          <span className="venue">
            <StadiumIcon />
            <span className="venue-text">
              <span className="vstadium">{slot.venue ?? live?.venue ?? 'Venue TBC'}</span>
              {slot.city && <span className="vcity">{slot.city}</span>}
            </span>
          </span>
        </div>

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
              // Order each row to match the real card (same team first) when known.
              if (pick && home && away && (sameName(pick.home, away) || sameName(pick.away, home))) {
                t1 = pick.away
                t2 = pick.home
                sc1 = pick.awayScore
                sc2 = pick.homeScore
              }

              const isFinal = stage === 'Final'
              const decisive = sc1 != null && sc2 != null && sc1 !== sc2
              const champion = isFinal ? (decisive ? (sc1! > sc2! ? t1 : t2) : pick?.advances) : undefined
              const pensAdv = !isFinal && !decisive ? pick?.advances : undefined
              const renderTeam = (name: string) => {
                const champ = !!champion && sameName(name, champion)
                const pens = !!pensAdv && sameName(name, pensAdv)
                const out = eliminated.has(normaliseName(name).toLowerCase())
                return (
                  <span className={champ || pens ? 'cmp-win' : undefined}>
                    {flag(name)} <span className={out ? 'cmp-out' : undefined}>{name}</span>
                    {champ && ' 🏆'}
                    {pens && <span className="cmp-pens"> pens</span>}
                  </span>
                )
              }

              return (
                <div key={ci.slug} className={`cmp-row ${ci.slug === currentSlug ? 'me' : ''}`}>
                  <span className="cmp-name">
                    {ci.title}
                    {ci.slug === currentSlug ? ' (you)' : ''}
                  </span>
                  {pick ? (
                    <>
                      <span className="cmp-mid">
                        {showTeams && t1 && t2 && (
                          <>
                            {renderTeam(t1)} <span className="cmp-v">v</span> {renderTeam(t2)}
                          </>
                        )}
                      </span>
                      {(r === 'exact' || r === 'outcome') && (
                        <span
                          className="cmp-mark"
                          title={r === 'exact' ? 'Exact score' : 'Right result'}
                        >
                          {r === 'exact' ? '🏆⭐' : '🏆'}
                        </span>
                      )}
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

function TeamSide({ name }: { name: string | null }) {
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
      <span className="tname">{name}</span>
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
  const pickLast = pick.player.toLowerCase().split(' ').pop()!
  const pickFirst = pick.player.toLowerCase().split(' ')[0]
  const isMyPick = (name: string) =>
    name.toLowerCase().includes(pickLast) && name.toLowerCase().includes(pickFirst)

  const pickRank = scorers.findIndex((s) => isMyPick(s.name))
  const top = scorers.slice(0, 15)
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
        <ol className="scorer-list">
          {top.map((s, i) => (
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
