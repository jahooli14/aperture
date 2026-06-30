import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import confetti from 'canvas-confetti'
import {
  resolvePerson,
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
  phaseOf,
  pairKey,
  checkParticipants,
  actualAdvancer,
  goalsFor,
  type Scored,
  type TeamCheck,
} from './logic'
import { useLiveData } from './useLiveData'
import { fetchWeather, syntheticWeather, type Weather, type Condition } from './weather'
import type { LiveScorer, LiveMatch, MatchGoals } from './types'

const flag = (team: string) => flags[normaliseName(team)] ?? '🏳️'

type CompareEntry = {
  slug: string
  title: string
  byPair: Record<string, Prediction>
  // From R16 on, brackets diverge — match by bracket slot ("<stage>#<i>") instead.
  bySlot: Record<string, Prediction>
}

// Sample "real" bracket for ?demoBracket=1 — lets you preview the
// prediction-vs-reality check before the actual teams are decided.
const DEMO_BRACKET: LiveMatch[] = [
  { id: -101, utcDate: '2026-07-14T19:00:00Z', status: 'TIMED', stage: 'SEMI_FINALS', home: 'France', away: 'Brazil', homeScore: null, awayScore: null, venue: null },
  { id: -102, utcDate: '2026-07-15T19:00:00Z', status: 'TIMED', stage: 'SEMI_FINALS', home: 'England', away: 'Argentina', homeScore: null, awayScore: null, venue: null },
  { id: -103, utcDate: '2026-07-19T19:00:00Z', status: 'TIMED', stage: 'FINAL', home: 'France', away: 'England', homeScore: null, awayScore: null, venue: null },
]

// ?demoFinished=1 — sample full-time R32 results to preview finished cards.
const DEMO_FINISHED: LiveMatch[] = [
  // exact match to the KatDan pick (3-1) → "Exact score"
  { id: -201, utcDate: '2026-06-28T18:00:00Z', status: 'FINISHED', stage: 'LAST_32', home: 'Germany', away: 'Paraguay', homeScore: 3, awayScore: 1, venue: null },
  // France win but not the exact scoreline (pick 2-1) → "Right result"
  { id: -202, utcDate: '2026-06-28T20:00:00Z', status: 'FINISHED', stage: 'LAST_32', home: 'France', away: 'Sweden', homeScore: 1, awayScore: 0, venue: null },
  // Canada win, pick was a draw → "Missed"
  { id: -203, utcDate: '2026-06-28T22:00:00Z', status: 'FINISHED', stage: 'LAST_32', home: 'South Africa', away: 'Canada', homeScore: 0, awayScore: 2, venue: null },
]

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

export function App() {
  const { data, loading, lastUpdated } = useLiveData()
  const scorers = data?.scorers ?? []

  // Whose predictions to show (from the URL path, e.g. /sarjack).
  const person = resolvePerson(window.location.pathname)
  const predictions = person.predictions

  // Index every person's predictions for the tap-to-compare panel: by fixture
  // (R32, where everyone shares the same matchups) and by bracket slot (R16 on,
  // where each person's predicted teams differ but the bracket position lines up).
  const compareIndex = useMemo(
    () =>
      Object.values(people).map((p) => {
        const byPair: Record<string, Prediction> = {}
        const bySlot: Record<string, Prediction> = {}
        const seen: Record<string, number> = {}
        for (const pr of p.predictions) {
          byPair[pairKey(pr.home, pr.away)] = pr
          const i = seen[pr.stage] ?? 0
          bySlot[`${pr.stage}#${i}`] = pr
          seen[pr.stage] = i + 1
        }
        return { slug: p.slug, title: p.title, byPair, bySlot }
      }),
    []
  )

  // Map the current person's fixtures to their bracket slot, so a tapped card can
  // look up the same slot in everyone else's bracket.
  const slotByPair = useMemo(() => {
    const m: Record<string, string> = {}
    const seen: Record<string, number> = {}
    for (const pr of predictions) {
      const i = seen[pr.stage] ?? 0
      m[pairKey(pr.home, pr.away)] = `${pr.stage}#${i}`
      seen[pr.stage] = i + 1
    }
    return m
  }, [predictions])
  useEffect(() => {
    document.title = `${person.title} World Cup 2026`
  }, [person.title])

  // Preview helpers: ?demoLive=1 forces the first game live; ?weather=<cond>
  // forces that game's weather; ?demoBracket=1 injects a sample real bracket so
  // you can preview the prediction-vs-reality check on later rounds.
  const params = new URLSearchParams(window.location.search)
  const demoWeather = params.get('weather') as Condition | null
  const demoLive = params.get('demoLive') === '1' || !!demoWeather
  const demoBracket = params.get('demoBracket') === '1'
  const demoFinished = params.get('demoFinished') === '1'
  let matches = data?.matches ?? []
  if (demoFinished) matches = [...DEMO_FINISHED, ...matches]
  if (demoBracket) matches = [...matches, ...DEMO_BRACKET]

  // On first load with a game in play, scroll it into view. Retry a few times
  // so late layout shifts (images/fonts on mobile) don't leave us at the top.
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
      <Header
        title={person.title}
        lastUpdated={lastUpdated}
        live={matches.some((m) => phaseOf(m.status) === 'live')}
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

      <Scoreboard totals={totals} />

      <main>
        {stageOrder.map((stage) => (
          <StageSection
            key={stage}
            stage={stage}
            scored={scored}
            weather={weather}
            matches={matches}
            goals={data?.goals}
            compareIndex={compareIndex}
            slotByPair={slotByPair}
            currentSlug={person.slug}
          />
        ))}
      </main>

      <GoldenBoot scorers={scorers} pick={person.goldenBoot} />

      <footer className="footer">
        My World Cup 2026 predictions · live data via football-data.org · photo by Alex Simpson /
        Unsplash
      </footer>
    </div>
  )
}

// --- Header --------------------------------------------------------------

function Header({
  title,
  lastUpdated,
  live,
}: {
  title: string
  lastUpdated: Date | null
  live: boolean
}) {
  const share = async () => {
    const shareData = {
      title: `${title} World Cup 2026`,
      text: `${title} World Cup 2026 — predictions vs the live scores`,
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
        {title} World Cup <span className="year">2026</span>
      </h1>
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
  matches,
  goals,
  compareIndex,
  slotByPair,
  currentSlug,
}: {
  stage: Stage
  scored: Scored[]
  weather: Record<string, Weather>
  matches: LiveMatch[]
  goals?: MatchGoals[]
  compareIndex: CompareEntry[]
  slotByPair: Record<string, string>
  currentSlug: string
}) {
  // One chronological list (earliest kickoff first). Finished games stay inline,
  // just greyed out; the page auto-scrolls to the live game on load.
  const rows = scored
    .filter((s) => s.pred.stage === stage)
    .slice()
    .sort((a, b) => {
      const ka = a.live?.utcDate ?? kickoffFor(a.pred.home, a.pred.away)
      const kb = b.live?.utcDate ?? kickoffFor(b.pred.home, b.pred.away)
      const ta = ka ? Date.parse(ka) : Infinity
      const tb = kb ? Date.parse(kb) : Infinity
      return ta - tb
    })

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
              matches={matches}
              goals={goals}
              compareIndex={compareIndex}
              slotByPair={slotByPair}
              currentSlug={currentSlug}
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

function PredictionCard({
  scored,
  weather,
  matches,
  goals,
  compareIndex,
  slotByPair,
  currentSlug,
}: {
  scored: Scored
  weather?: Weather
  matches: LiveMatch[]
  goals?: MatchGoals[]
  compareIndex: CompareEntry[]
  slotByPair: Record<string, string>
  currentSlug: string
}) {
  const { pred, live, phase, result } = scored
  const meta = resultMeta(result)
  const isLive = phase === 'live'
  const [cmpOpen, setCmpOpen] = useState(false)
  const matchGoals = phase === 'upcoming' ? null : goalsFor(pred, goals)
  const hasGoals = !!matchGoals && (matchGoals.home.length > 0 || matchGoals.away.length > 0)

  // For rounds past the R32, check whether my predicted teams actually got here.
  const checks =
    pred.stage !== 'Round of 32' ? checkParticipants(pred, matches) : null

  // My "advances on a draw" pick. Two ways it can be wrong:
  //  1. The team didn't even reach this stage (later rounds — checkParticipants).
  //  2. The fixture happened and the *other* team went through, e.g. a draw lost
  //     on penalties (Netherlands 1-1 Morocco, Morocco win on pens).
  const advCheck =
    pred.advances && checks
      ? normaliseName(pred.advances).toLowerCase() === normaliseName(pred.home).toLowerCase()
        ? checks.home
        : checks.away
      : undefined
  // The team that actually progressed from this fixture (when it's finished).
  const realAdvancer = pred.advances ? actualAdvancer(pred, live) : undefined
  const advWrong =
    advCheck?.status === 'wrong' ||
    (!!pred.advances &&
      !!realAdvancer &&
      normaliseName(realAdvancer).toLowerCase() !== normaliseName(pred.advances).toLowerCase())

  let liveHome: number | null = null
  let liveAway: number | null = null
  if (live && live.homeScore != null && live.awayScore != null) {
    const swapped = normaliseName(live.home).toLowerCase() !== normaliseName(pred.home).toLowerCase()
    liveHome = swapped ? live.awayScore : live.homeScore
    liveAway = swapped ? live.homeScore : live.awayScore
  }
  const hasLive = liveHome != null && liveAway != null

  // The predicted score is only "correct" (green) if it was exact. A right
  // result with the wrong scoreline shows the score in red (but keeps the green
  // "Right result" badge).
  const pickCls =
    result === 'exact' ? 'correct' : result === 'pending' ? 'pending' : 'wrong'

  // Live games get a cinematic weather scene as the card background.
  const wxCondition = isLive && weather ? weather.condition : null

  return (
    <article
      className={`card ${meta.cls} ${phase} ${wxCondition ? `wx wx-${wxCondition}` : ''} ${
        !isLive ? 'placed lighttext' : ''
      }`}
    >
      {wxCondition ? (
        <>
          <CardPlace home={pred.home} away={pred.away} light />
          <CardWeather condition={wxCondition} overPhoto />
        </>
      ) : (
        <CardPlace home={pred.home} away={pred.away} />
      )}
      <div className="card-inner">
      <div className="card-top">
        <span className="caption">
          {isLive ? (
            <span className="pill live">
              <span className="dot" /> LIVE{live?.minute ? ` ${live.minute}` : ''}
            </span>
          ) : phase === 'final' ? (
            'Full time'
          ) : live?.utcDate ?? kickoffFor(pred.home, pred.away) ? (
            <KickOff iso={(live?.utcDate ?? kickoffFor(pred.home, pred.away))!} inline />
          ) : (
            pred.dateText ?? 'Date TBC'
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
        <Side team={pred.home} check={checks?.home} />

        <div className="center">
          <span className={`bigscore ${phase}`}>{hasLive ? `${liveHome}–${liveAway}` : 'vs'}</span>
          <span className={`pick ${pickCls}`}>
            Pick {pred.homeScore}–{pred.awayScore}
          </span>
        </div>

        <Side team={pred.away} check={checks?.away} />
      </div>

      {hasGoals && matchGoals && (
        <div className="goals-line">
          <div className="gside">
            {matchGoals.home.map((g, i) => (
              <span key={i} className="goal">
                ⚽ {g.name} {g.minute}
              </span>
            ))}
          </div>
          <div className="gside right">
            {matchGoals.away.map((g, i) => (
              <span key={i} className="goal">
                {g.name} {g.minute} ⚽
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="card-foot">
        <span className="venue">
          <StadiumIcon />
          <span className="venue-text">
            <span className="vstadium">{pred.venue ?? live?.venue ?? 'Venue TBC'}</span>
            {pred.city && <span className="vcity">{pred.city}</span>}
          </span>
        </span>
        {pred.advances && (
          <span className={`advances ${advWrong ? 'wrong' : ''}`}>
            {/* When my pick was wrong and we know who really went through, show
                them on top so the card doesn't imply my team progressed. */}
            {advWrong && realAdvancer && (
              <span className="adv-real">
                {flag(realAdvancer)}{' '}
                {pred.stage === 'Final' ? `${realAdvancer} won it 🏆` : `${realAdvancer} went through`}
              </span>
            )}
            <span className="adv-label">my pick</span>
            <span className="adv-team">
              {flag(pred.advances)}{' '}
              <span className={advWrong ? 'struck' : ''}>
                {pred.stage === 'Final' ? `${pred.advances} win it 🏆` : `${pred.advances} go through`}
              </span>
            </span>
          </span>
        )}
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
          {compareIndex.map((ci) => {
            // R32: everyone shares the fixture, match by pair. R16 on: brackets
            // diverge, so match by bracket slot and show each person's own teams.
            const slot = slotByPair[pairKey(pred.home, pred.away)]
            const cp =
              ci.byPair[pairKey(pred.home, pred.away)] ?? (slot ? ci.bySlot[slot] : undefined)
            // Only score against the live result when this person picked the same
            // two teams that are actually playing this fixture.
            const sameFixture =
              cp && pairKey(cp.home, cp.away) === pairKey(pred.home, pred.away)
            const r =
              cp && sameFixture && phase === 'final' && live
                ? scorePrediction(cp, live).result
                : 'pending'
            const cls =
              r === 'exact' ? 'cmp-exact' : r === 'outcome' ? 'cmp-ok' : r === 'wrong' ? 'cmp-wrong' : ''
            // From R16 on, always show each person's teams — even when they match
            // the card — so you can read the whole bracket at a glance.
            const showTeams = !!cp && pred.stage !== 'Round of 32'
            // Order every row's teams to match the card (same team always first),
            // flipping the score to match. Where a person picked a different team
            // for a slot, the team aligned to the card's side keeps its position.
            const sameName = (a: string, b: string) =>
              normaliseName(a).toLowerCase() === normaliseName(b).toLowerCase()
            let t1 = cp?.home
            let t2 = cp?.away
            let sc1 = cp?.homeScore
            let sc2 = cp?.awayScore
            if (cp && (sameName(cp.home, pred.away) || sameName(cp.away, pred.home))) {
              t1 = cp.away
              t2 = cp.home
              sc1 = cp.awayScore
              sc2 = cp.homeScore
            }
            // Mark who this person has progressing. Final: the champion (gets a
            // 🏆). Earlier rounds: only a drawn pick needs marking (the team they
            // chose to go through on penalties) — decisive winners are obvious.
            const isFinal = pred.stage === 'Final'
            const decisive = sc1 != null && sc2 != null && sc1 !== sc2
            const champion = isFinal ? (decisive ? (sc1! > sc2! ? t1 : t2) : cp?.advances) : undefined
            const pensAdv = !isFinal && !decisive ? cp?.advances : undefined
            const renderTeam = (name: string) => {
              const champ = !!champion && sameName(name, champion)
              const pens = !!pensAdv && sameName(name, pensAdv)
              return (
                <span className={champ || pens ? 'cmp-win' : undefined}>
                  {flag(name)} {name}
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
                {cp ? (
                  <>
                    <span className="cmp-mid">
                      {showTeams && t1 && t2 && (
                        <>
                          {renderTeam(t1)} <span className="cmp-v">v</span> {renderTeam(t2)}
                        </>
                      )}
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

function Side({ team, check }: { team: string; check?: TeamCheck }) {
  // Wrong pick with a known replacement: the team that actually went through is
  // big on top (with its flag); my crossed-out prediction sits small beneath.
  if (check?.status === 'wrong' && check.replacement) {
    return (
      <div className="side">
        <span className="crest">{flag(check.replacement)}</span>
        <span className="tname">{check.replacement}</span>
        <span className="mini-out">
          <span className="mo-label">my pick</span>
          <span className="mo-name">{team}</span>
        </span>
      </div>
    )
  }
  return (
    <div className="side">
      <span className="crest">{flag(team)}</span>
      <span className={`tname ${check?.status === 'correct' ? 'team-correct' : ''}`}>{team}</span>
      {check?.status === 'correct' && <span className="team-tick">✓</span>}
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
  const top = scorers.slice(0, 10)
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
