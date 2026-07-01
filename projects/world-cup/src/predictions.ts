// My World Cup 2026 predictions, knockout stage.
// Scores are predicted full-time results. For predicted draws, `advances` names
// the team I think goes through (on penalties / extra time).

export type Stage =
  | 'Round of 32'
  | 'Round of 16'
  | 'Quarter-finals'
  | 'Semi-finals'
  | 'Final'

export interface Prediction {
  stage: Stage
  home: string
  away: string
  homeScore: number
  awayScore: number
  /** For a predicted draw, the team I think progresses. */
  advances?: string
  /** Stadium name and city — the free live feed doesn't provide these, so baked in. */
  venue?: string
  city?: string
  /** Scheduled date for later rounds (the feed has no date until teams are set). */
  dateText?: string
}

export const katdanPredictions: Prediction[] = [
  // Round of 32 (stadium + host city)
  { stage: 'Round of 32', home: 'Germany', away: 'Paraguay', homeScore: 3, awayScore: 1, venue: 'Gillette Stadium', city: 'Boston, USA' },
  { stage: 'Round of 32', home: 'France', away: 'Sweden', homeScore: 2, awayScore: 1, venue: 'MetLife Stadium', city: 'New York, USA' },
  { stage: 'Round of 32', home: 'South Africa', away: 'Canada', homeScore: 1, awayScore: 1, advances: 'Canada', venue: 'SoFi Stadium', city: 'Los Angeles, USA' },
  { stage: 'Round of 32', home: 'Netherlands', away: 'Morocco', homeScore: 1, awayScore: 1, advances: 'Netherlands', venue: 'Estadio BBVA', city: 'Monterrey, Mexico' },
  { stage: 'Round of 32', home: 'Portugal', away: 'Croatia', homeScore: 2, awayScore: 0, venue: 'BMO Field', city: 'Toronto, Canada' },
  { stage: 'Round of 32', home: 'Spain', away: 'Austria', homeScore: 1, awayScore: 0, venue: 'SoFi Stadium', city: 'Los Angeles, USA' },
  { stage: 'Round of 32', home: 'USA', away: 'Bosnia', homeScore: 2, awayScore: 0, venue: "Levi's Stadium", city: 'San Francisco, USA' },
  { stage: 'Round of 32', home: 'Belgium', away: 'Senegal', homeScore: 3, awayScore: 1, venue: 'Lumen Field', city: 'Seattle, USA' },
  { stage: 'Round of 32', home: 'Brazil', away: 'Japan', homeScore: 2, awayScore: 0, venue: 'NRG Stadium', city: 'Houston, USA' },
  { stage: 'Round of 32', home: 'Ivory Coast', away: 'Norway', homeScore: 1, awayScore: 2, venue: 'AT&T Stadium', city: 'Dallas, USA' },
  { stage: 'Round of 32', home: 'Mexico', away: 'Ecuador', homeScore: 2, awayScore: 1, venue: 'Estadio Azteca', city: 'Mexico City, Mexico' },
  { stage: 'Round of 32', home: 'England', away: 'DR Congo', homeScore: 3, awayScore: 1, venue: 'Mercedes-Benz Stadium', city: 'Atlanta, USA' },
  { stage: 'Round of 32', home: 'Argentina', away: 'Cape Verde', homeScore: 3, awayScore: 1, venue: 'Hard Rock Stadium', city: 'Miami, USA' },
  { stage: 'Round of 32', home: 'Australia', away: 'Egypt', homeScore: 1, awayScore: 2, venue: 'AT&T Stadium', city: 'Dallas, USA' },
  { stage: 'Round of 32', home: 'Switzerland', away: 'Algeria', homeScore: 1, awayScore: 0, venue: 'BC Place', city: 'Vancouver, Canada' },
  { stage: 'Round of 32', home: 'Colombia', away: 'Ghana', homeScore: 3, awayScore: 1, venue: 'Arrowhead Stadium', city: 'Kansas City, USA' },

  // Round of 16 (dates/venues from the official 2026 schedule)
  { stage: 'Round of 16', home: 'Germany', away: 'France', homeScore: 1, awayScore: 2, dateText: 'Sat 4 Jul', venue: 'NRG Stadium', city: 'Houston, USA' },
  { stage: 'Round of 16', home: 'Canada', away: 'Netherlands', homeScore: 2, awayScore: 1, dateText: 'Sat 4 Jul', venue: 'Lincoln Financial Field', city: 'Philadelphia, USA' },
  { stage: 'Round of 16', home: 'Portugal', away: 'Spain', homeScore: 1, awayScore: 1, advances: 'Spain', dateText: 'Sun 5 Jul', venue: 'MetLife Stadium', city: 'New York, USA' },
  { stage: 'Round of 16', home: 'USA', away: 'Belgium', homeScore: 0, awayScore: 2, dateText: 'Sun 5 Jul', venue: 'Estadio Azteca', city: 'Mexico City, Mexico' },
  { stage: 'Round of 16', home: 'Brazil', away: 'Norway', homeScore: 2, awayScore: 1, dateText: 'Mon 6 Jul', venue: 'AT&T Stadium', city: 'Dallas, USA' },
  { stage: 'Round of 16', home: 'Mexico', away: 'England', homeScore: 0, awayScore: 1, dateText: 'Mon 6 Jul', venue: 'Lumen Field', city: 'Seattle, USA' },
  { stage: 'Round of 16', home: 'Argentina', away: 'Egypt', homeScore: 3, awayScore: 0, dateText: 'Tue 7 Jul', venue: 'Mercedes-Benz Stadium', city: 'Atlanta, USA' },
  { stage: 'Round of 16', home: 'Switzerland', away: 'Colombia', homeScore: 0, awayScore: 2, dateText: 'Tue 7 Jul', venue: 'BC Place', city: 'Vancouver, Canada' },

  // Quarter-finals
  { stage: 'Quarter-finals', home: 'France', away: 'Canada', homeScore: 3, awayScore: 0, dateText: 'Thu 9 Jul', venue: 'Gillette Stadium', city: 'Boston, USA' },
  { stage: 'Quarter-finals', home: 'Spain', away: 'Belgium', homeScore: 1, awayScore: 0, dateText: 'Fri 10 Jul', venue: 'SoFi Stadium', city: 'Los Angeles, USA' },
  { stage: 'Quarter-finals', home: 'Brazil', away: 'England', homeScore: 1, awayScore: 2, dateText: 'Sat 11 Jul', venue: 'Hard Rock Stadium', city: 'Miami, USA' },
  { stage: 'Quarter-finals', home: 'Argentina', away: 'Colombia', homeScore: 3, awayScore: 1, dateText: 'Sat 11 Jul', venue: 'Arrowhead Stadium', city: 'Kansas City, USA' },

  // Semi-finals
  { stage: 'Semi-finals', home: 'France', away: 'Spain', homeScore: 1, awayScore: 1, advances: 'Spain', dateText: 'Tue 14 Jul', venue: 'AT&T Stadium', city: 'Dallas, USA' },
  { stage: 'Semi-finals', home: 'England', away: 'Argentina', homeScore: 2, awayScore: 1, dateText: 'Wed 15 Jul', venue: 'Mercedes-Benz Stadium', city: 'Atlanta, USA' },

  // Final
  { stage: 'Final', home: 'Spain', away: 'England', homeScore: 0, awayScore: 1, dateText: 'Sun 19 Jul', venue: 'MetLife Stadium', city: 'New York, USA' },
]

// My Golden Boot (top scorer) pick for the tournament.
export const goldenBootPick = {
  player: 'Harry Kane',
  team: 'England',
}

export const stageOrder: Stage[] = [
  'Round of 32',
  'Round of 16',
  'Quarter-finals',
  'Semi-finals',
  'Final',
]

// Flag emoji per nation (England uses the St George cross tag sequence).
export const flags: Record<string, string> = {
  Germany: '🇩🇪',
  Paraguay: '🇵🇾',
  France: '🇫🇷',
  Sweden: '🇸🇪',
  'South Africa': '🇿🇦',
  Canada: '🇨🇦',
  Netherlands: '🇳🇱',
  Morocco: '🇲🇦',
  Portugal: '🇵🇹',
  Croatia: '🇭🇷',
  Spain: '🇪🇸',
  Austria: '🇦🇹',
  USA: '🇺🇸',
  Bosnia: '🇧🇦',
  Belgium: '🇧🇪',
  Senegal: '🇸🇳',
  Brazil: '🇧🇷',
  Japan: '🇯🇵',
  'Ivory Coast': '🇨🇮',
  Norway: '🇳🇴',
  Mexico: '🇲🇽',
  Ecuador: '🇪🇨',
  England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'DR Congo': '🇨🇩',
  Argentina: '🇦🇷',
  'Cape Verde': '🇨🇻',
  Australia: '🇦🇺',
  Egypt: '🇪🇬',
  Switzerland: '🇨🇭',
  Algeria: '🇩🇿',
  Colombia: '🇨🇴',
  Ghana: '🇬🇭',
  // Other qualified nations (may appear in the scorers table or real bracket)
  'New Zealand': '🇳🇿',
  'South Korea': '🇰🇷',
  'Saudi Arabia': '🇸🇦',
  Iran: '🇮🇷',
  Qatar: '🇶🇦',
  Tunisia: '🇹🇳',
  Uruguay: '🇺🇾',
  Jordan: '🇯🇴',
  Uzbekistan: '🇺🇿',
  Panama: '🇵🇦',
  'Costa Rica': '🇨🇷',
  Curacao: '🇨🇼',
  Haiti: '🇭🇹',
  'New Caledonia': '🇳🇨',
  Italy: '🇮🇹',
  Denmark: '🇩🇰',
  Scotland: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  Wales: '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
}

// ISO codes for flag images (flagcdn.com). England/Scotland/Wales use GB subtags.
export const countryCode: Record<string, string> = {
  Germany: 'de',
  Paraguay: 'py',
  France: 'fr',
  Sweden: 'se',
  'South Africa': 'za',
  Canada: 'ca',
  Netherlands: 'nl',
  Morocco: 'ma',
  Portugal: 'pt',
  Croatia: 'hr',
  Spain: 'es',
  Austria: 'at',
  USA: 'us',
  Bosnia: 'ba',
  Belgium: 'be',
  Senegal: 'sn',
  Brazil: 'br',
  Japan: 'jp',
  'Ivory Coast': 'ci',
  Norway: 'no',
  Mexico: 'mx',
  Ecuador: 'ec',
  England: 'gb-eng',
  'DR Congo': 'cd',
  Argentina: 'ar',
  'Cape Verde': 'cv',
  Australia: 'au',
  Egypt: 'eg',
  Switzerland: 'ch',
  Algeria: 'dz',
  Colombia: 'co',
  Ghana: 'gh',
  'New Zealand': 'nz',
  'South Korea': 'kr',
  'Saudi Arabia': 'sa',
  Iran: 'ir',
  Qatar: 'qa',
  Tunisia: 'tn',
  Uruguay: 'uy',
  Jordan: 'jo',
  Uzbekistan: 'uz',
  Panama: 'pa',
  'Costa Rica': 'cr',
  Curacao: 'cw',
  Haiti: 'ht',
  Italy: 'it',
  Denmark: 'dk',
  Scotland: 'gb-sct',
  Wales: 'gb-wls',
}

export function flagUrl(team: string): string {
  const code = countryCode[normaliseName(team)]
  return code ? `https://flagcdn.com/w640/${code}.png` : ''
}

// Thematic landmark photo for a country (used half-and-half on non-live cards).
export function countryImage(team: string): string {
  const code = countryCode[normaliseName(team)]
  return code ? `/countries/${code}.jpg` : ''
}

// FIFA 3-letter codes — compact team labels for the tight compare-picks rows.
const TEAM_CODES: Record<string, string> = {
  Germany: 'GER', Paraguay: 'PAR', France: 'FRA', Sweden: 'SWE', 'South Africa': 'RSA',
  Canada: 'CAN', Netherlands: 'NED', Morocco: 'MAR', Portugal: 'POR', Croatia: 'CRO',
  Spain: 'ESP', Austria: 'AUT', USA: 'USA', Bosnia: 'BIH', Belgium: 'BEL', Senegal: 'SEN',
  Brazil: 'BRA', Japan: 'JPN', 'Ivory Coast': 'CIV', Norway: 'NOR', Mexico: 'MEX',
  Ecuador: 'ECU', England: 'ENG', 'DR Congo': 'COD', Argentina: 'ARG', 'Cape Verde': 'CPV',
  Australia: 'AUS', Egypt: 'EGY', Switzerland: 'SUI', Algeria: 'ALG', Colombia: 'COL',
  Ghana: 'GHA', 'New Zealand': 'NZL', 'South Korea': 'KOR', 'Saudi Arabia': 'KSA', Iran: 'IRN',
  Qatar: 'QAT', Tunisia: 'TUN', Uruguay: 'URU', Jordan: 'JOR', Uzbekistan: 'UZB', Panama: 'PAN',
  'Costa Rica': 'CRC', Curacao: 'CUW', Haiti: 'HAI', 'New Caledonia': 'NCL', Italy: 'ITA',
  Denmark: 'DEN', Scotland: 'SCO', Wales: 'WAL',
}
export function teamCode(team: string): string {
  const n = normaliseName(team)
  return TEAM_CODES[n] ?? n.slice(0, 3).toUpperCase()
}

// Stable ordering value per team, from its Round-of-32 bracket position. Lets us
// put the same team on the same side in compare rows even before a later-round
// fixture's real teams are known. Built lazily on first use (normaliseName +
// nameAliases are defined further down this file).
let BRACKET_ORDER: Record<string, number> | null = null
export function bracketOrder(team: string): number {
  if (!BRACKET_ORDER) {
    BRACKET_ORDER = {}
    katdanPredictions
      .filter((p) => p.stage === 'Round of 32')
      .forEach((p, i) => {
        BRACKET_ORDER![normaliseName(p.home).toLowerCase()] = i * 2
        BRACKET_ORDER![normaliseName(p.away).toLowerCase()] = i * 2 + 1
      })
  }
  return BRACKET_ORDER[normaliseName(team).toLowerCase()] ?? 999
}

// Aliases to reconcile my names with various live-feed spellings.
// Keys are normalised (lowercased, punctuation stripped) feed names → my name.
export const nameAliases: Record<string, string> = {
  'united states': 'USA',
  'united states of america': 'USA',
  usa: 'USA',
  'cote divoire': 'Ivory Coast',
  'côte divoire': 'Ivory Coast',
  'ivory coast': 'Ivory Coast',
  'congo dr': 'DR Congo',
  'dr congo': 'DR Congo',
  'democratic republic of congo': 'DR Congo',
  'cabo verde': 'Cape Verde',
  'cape verde': 'Cape Verde',
  'cape verde islands': 'Cape Verde',
  'bosnia and herzegovina': 'Bosnia',
  'bosnia herzegovina': 'Bosnia',
  bosnia: 'Bosnia',
  'korea republic': 'South Korea',
  'south africa': 'South Africa',
  netherlands: 'Netherlands',
  holland: 'Netherlands',
}

export function normaliseName(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // turn hyphens / punctuation into spaces so "Bosnia-Herzegovina" → "bosnia herzegovina"
    .replace(/[^a-z]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return nameAliases[cleaned] ?? raw
}

// Real Round-of-32 kickoff times (UTC), baked in so dates always show even if
// the live feed is unavailable. Keyed by the two teams (order-independent).
function rkey(a: string, b: string): string {
  return [normaliseName(a).toLowerCase(), normaliseName(b).toLowerCase()].sort().join('|')
}
const R32_KICKOFFS: Record<string, string> = {
  [rkey('Germany', 'Paraguay')]: '2026-06-29T20:30:00Z',
  [rkey('France', 'Sweden')]: '2026-06-30T21:00:00Z',
  [rkey('South Africa', 'Canada')]: '2026-06-28T19:00:00Z',
  [rkey('Netherlands', 'Morocco')]: '2026-06-30T01:00:00Z',
  [rkey('Portugal', 'Croatia')]: '2026-07-02T23:00:00Z',
  [rkey('Spain', 'Austria')]: '2026-07-02T19:00:00Z',
  [rkey('USA', 'Bosnia')]: '2026-07-02T00:00:00Z',
  [rkey('Belgium', 'Senegal')]: '2026-07-01T20:00:00Z',
  [rkey('Brazil', 'Japan')]: '2026-06-29T17:00:00Z',
  [rkey('Ivory Coast', 'Norway')]: '2026-06-30T17:00:00Z',
  [rkey('Mexico', 'Ecuador')]: '2026-07-01T01:00:00Z',
  [rkey('England', 'DR Congo')]: '2026-07-01T16:00:00Z',
  [rkey('Argentina', 'Cape Verde')]: '2026-07-03T22:00:00Z',
  [rkey('Australia', 'Egypt')]: '2026-07-03T18:00:00Z',
  [rkey('Switzerland', 'Algeria')]: '2026-07-03T03:00:00Z',
  [rkey('Colombia', 'Ghana')]: '2026-07-04T01:30:00Z',
}
export function kickoffFor(home: string, away: string): string | undefined {
  return R32_KICKOFFS[rkey(home, away)]
}

// Real kickoff times (UTC) and venues for the later rounds, keyed by bracket
// slot ("<stage>#<index>"). From the official FIFA 2026 match schedule (match
// numbers cross-checked against the BBC bracket). Baked so a game shows its time
// + venue even while its teams are TBC; once teams are known the live feed's
// time takes over. Times are UTC — the UI renders them in UK time.
const KO_SCHEDULE: Record<string, string> = {
  'Round of 16#0': '2026-07-04T21:00:00Z', // Philadelphia
  'Round of 16#1': '2026-07-04T17:00:00Z', // Houston
  'Round of 16#2': '2026-07-06T19:00:00Z', // Arlington
  'Round of 16#3': '2026-07-07T00:00:00Z', // Seattle
  'Round of 16#4': '2026-07-05T20:00:00Z', // East Rutherford
  'Round of 16#5': '2026-07-06T00:00:00Z', // Mexico City (1am Mon UK)
  'Round of 16#6': '2026-07-07T16:00:00Z', // Atlanta
  'Round of 16#7': '2026-07-07T20:00:00Z', // Vancouver
  'Quarter-finals#0': '2026-07-09T20:00:00Z', // Boston
  'Quarter-finals#1': '2026-07-10T19:00:00Z', // Los Angeles
  'Quarter-finals#2': '2026-07-11T21:00:00Z', // Miami
  'Quarter-finals#3': '2026-07-12T01:00:00Z', // Kansas City
  'Semi-finals#0': '2026-07-14T19:00:00Z', // Dallas
  'Semi-finals#1': '2026-07-15T19:00:00Z', // Atlanta
  'Final#0': '2026-07-19T19:00:00Z', // New York
}
export function scheduledKickoff(stage: string, index: number): string | undefined {
  return KO_SCHEDULE[`${stage}#${index}`]
}

// Official venue per later-round bracket slot [stadium, city]. The team-based
// slots (0,1,4,5 in R16) were verified against the real fixtures; the rest come
// from the FIFA bracket by match number.
const VENUE_SCHEDULE: Record<string, [string, string]> = {
  'Round of 16#0': ['Lincoln Financial Field', 'Philadelphia, USA'],
  'Round of 16#1': ['NRG Stadium', 'Houston, USA'],
  'Round of 16#2': ['AT&T Stadium', 'Dallas, USA'],
  'Round of 16#3': ['Lumen Field', 'Seattle, USA'],
  'Round of 16#4': ['MetLife Stadium', 'New York, USA'],
  'Round of 16#5': ['Estadio Azteca', 'Mexico City, Mexico'],
  'Round of 16#6': ['Mercedes-Benz Stadium', 'Atlanta, USA'],
  'Round of 16#7': ['BC Place', 'Vancouver, Canada'],
  'Quarter-finals#0': ['Gillette Stadium', 'Boston, USA'],
  'Quarter-finals#1': ['SoFi Stadium', 'Los Angeles, USA'],
  'Quarter-finals#2': ['Hard Rock Stadium', 'Miami, USA'],
  'Quarter-finals#3': ['Arrowhead Stadium', 'Kansas City, USA'],
  'Semi-finals#0': ['AT&T Stadium', 'Dallas, USA'],
  'Semi-finals#1': ['Mercedes-Benz Stadium', 'Atlanta, USA'],
  'Final#0': ['MetLife Stadium', 'New York, USA'],
}
export function scheduledVenue(
  stage: string,
  index: number
): { venue: string; city: string } | undefined {
  const v = VENUE_SCHEDULE[`${stage}#${index}`]
  return v ? { venue: v[0], city: v[1] } : undefined
}

// SarJack's predictions (her bracket — champions: Argentina).
export const sarjackPredictions: Prediction[] = [
  // Round of 32 (same fixtures + venues as everyone)
  { stage: 'Round of 32', home: 'Germany', away: 'Paraguay', homeScore: 3, awayScore: 1, venue: 'Gillette Stadium', city: 'Boston, USA' },
  { stage: 'Round of 32', home: 'France', away: 'Sweden', homeScore: 2, awayScore: 1, venue: 'MetLife Stadium', city: 'New York, USA' },
  { stage: 'Round of 32', home: 'South Africa', away: 'Canada', homeScore: 1, awayScore: 1, advances: 'South Africa', venue: 'SoFi Stadium', city: 'Los Angeles, USA' },
  { stage: 'Round of 32', home: 'Netherlands', away: 'Morocco', homeScore: 4, awayScore: 0, venue: 'Estadio BBVA', city: 'Monterrey, Mexico' },
  { stage: 'Round of 32', home: 'Portugal', away: 'Croatia', homeScore: 3, awayScore: 0, venue: 'BMO Field', city: 'Toronto, Canada' },
  { stage: 'Round of 32', home: 'Spain', away: 'Austria', homeScore: 4, awayScore: 2, venue: 'SoFi Stadium', city: 'Los Angeles, USA' },
  { stage: 'Round of 32', home: 'USA', away: 'Bosnia', homeScore: 3, awayScore: 1, venue: "Levi's Stadium", city: 'San Francisco, USA' },
  { stage: 'Round of 32', home: 'Belgium', away: 'Senegal', homeScore: 4, awayScore: 1, venue: 'Lumen Field', city: 'Seattle, USA' },
  { stage: 'Round of 32', home: 'Brazil', away: 'Japan', homeScore: 3, awayScore: 2, venue: 'NRG Stadium', city: 'Houston, USA' },
  { stage: 'Round of 32', home: 'Ivory Coast', away: 'Norway', homeScore: 0, awayScore: 2, venue: 'AT&T Stadium', city: 'Dallas, USA' },
  { stage: 'Round of 32', home: 'Mexico', away: 'Ecuador', homeScore: 1, awayScore: 0, venue: 'Estadio Azteca', city: 'Mexico City, Mexico' },
  { stage: 'Round of 32', home: 'England', away: 'DR Congo', homeScore: 4, awayScore: 2, venue: 'Mercedes-Benz Stadium', city: 'Atlanta, USA' },
  { stage: 'Round of 32', home: 'Argentina', away: 'Cape Verde', homeScore: 3, awayScore: 1, venue: 'Hard Rock Stadium', city: 'Miami, USA' },
  { stage: 'Round of 32', home: 'Australia', away: 'Egypt', homeScore: 1, awayScore: 2, venue: 'AT&T Stadium', city: 'Dallas, USA' },
  { stage: 'Round of 32', home: 'Switzerland', away: 'Algeria', homeScore: 2, awayScore: 0, venue: 'BC Place', city: 'Vancouver, Canada' },
  { stage: 'Round of 32', home: 'Colombia', away: 'Ghana', homeScore: 2, awayScore: 0, venue: 'Arrowhead Stadium', city: 'Kansas City, USA' },

  // Round of 16
  { stage: 'Round of 16', home: 'France', away: 'Germany', homeScore: 3, awayScore: 0, dateText: 'Sat 4 Jul', venue: 'NRG Stadium', city: 'Houston, USA' },
  { stage: 'Round of 16', home: 'Netherlands', away: 'South Africa', homeScore: 4, awayScore: 1, dateText: 'Sat 4 Jul', venue: 'Lincoln Financial Field', city: 'Philadelphia, USA' },
  { stage: 'Round of 16', home: 'Spain', away: 'Portugal', homeScore: 3, awayScore: 2, dateText: 'Sun 5 Jul', venue: 'MetLife Stadium', city: 'New York, USA' },
  { stage: 'Round of 16', home: 'Belgium', away: 'USA', homeScore: 2, awayScore: 0, dateText: 'Sun 5 Jul', venue: 'Estadio Azteca', city: 'Mexico City, Mexico' },
  { stage: 'Round of 16', home: 'Brazil', away: 'Norway', homeScore: 3, awayScore: 3, advances: 'Brazil', dateText: 'Mon 6 Jul', venue: 'AT&T Stadium', city: 'Dallas, USA' },
  { stage: 'Round of 16', home: 'England', away: 'Mexico', homeScore: 2, awayScore: 1, dateText: 'Mon 6 Jul', venue: 'Lumen Field', city: 'Seattle, USA' },
  { stage: 'Round of 16', home: 'Argentina', away: 'Egypt', homeScore: 2, awayScore: 0, dateText: 'Tue 7 Jul', venue: 'Mercedes-Benz Stadium', city: 'Atlanta, USA' },
  { stage: 'Round of 16', home: 'Colombia', away: 'Switzerland', homeScore: 2, awayScore: 0, dateText: 'Tue 7 Jul', venue: 'BC Place', city: 'Vancouver, Canada' },

  // Quarter-finals
  { stage: 'Quarter-finals', home: 'France', away: 'Netherlands', homeScore: 3, awayScore: 1, dateText: 'Thu 9 Jul', venue: 'Gillette Stadium', city: 'Boston, USA' },
  { stage: 'Quarter-finals', home: 'Spain', away: 'Belgium', homeScore: 3, awayScore: 1, dateText: 'Fri 10 Jul', venue: 'SoFi Stadium', city: 'Los Angeles, USA' },
  { stage: 'Quarter-finals', home: 'England', away: 'Brazil', homeScore: 1, awayScore: 0, dateText: 'Sat 11 Jul', venue: 'Hard Rock Stadium', city: 'Miami, USA' },
  { stage: 'Quarter-finals', home: 'Argentina', away: 'Colombia', homeScore: 3, awayScore: 2, dateText: 'Sat 11 Jul', venue: 'Arrowhead Stadium', city: 'Kansas City, USA' },

  // Semi-finals
  { stage: 'Semi-finals', home: 'France', away: 'Spain', homeScore: 4, awayScore: 2, dateText: 'Tue 14 Jul', venue: 'AT&T Stadium', city: 'Dallas, USA' },
  { stage: 'Semi-finals', home: 'Argentina', away: 'England', homeScore: 2, awayScore: 1, dateText: 'Wed 15 Jul', venue: 'Mercedes-Benz Stadium', city: 'Atlanta, USA' },

  // Final
  { stage: 'Final', home: 'France', away: 'Argentina', homeScore: 1, awayScore: 1, advances: 'Argentina', dateText: 'Sun 19 Jul', venue: 'MetLife Stadium', city: 'New York, USA' },
]

// Gavin's predictions (his bracket — champions: Spain).
export const gavinPredictions: Prediction[] = [
  // Round of 32
  { stage: 'Round of 32', home: 'Germany', away: 'Paraguay', homeScore: 2, awayScore: 0, venue: 'Gillette Stadium', city: 'Boston, USA' },
  { stage: 'Round of 32', home: 'France', away: 'Sweden', homeScore: 3, awayScore: 1, venue: 'MetLife Stadium', city: 'New York, USA' },
  { stage: 'Round of 32', home: 'South Africa', away: 'Canada', homeScore: 0, awayScore: 1, venue: 'SoFi Stadium', city: 'Los Angeles, USA' },
  { stage: 'Round of 32', home: 'Netherlands', away: 'Morocco', homeScore: 1, awayScore: 1, advances: 'Morocco', venue: 'Estadio BBVA', city: 'Monterrey, Mexico' },
  { stage: 'Round of 32', home: 'Portugal', away: 'Croatia', homeScore: 2, awayScore: 1, venue: 'BMO Field', city: 'Toronto, Canada' },
  { stage: 'Round of 32', home: 'Spain', away: 'Austria', homeScore: 3, awayScore: 0, venue: 'SoFi Stadium', city: 'Los Angeles, USA' },
  { stage: 'Round of 32', home: 'USA', away: 'Bosnia', homeScore: 2, awayScore: 0, venue: "Levi's Stadium", city: 'San Francisco, USA' },
  { stage: 'Round of 32', home: 'Belgium', away: 'Senegal', homeScore: 1, awayScore: 2, venue: 'Lumen Field', city: 'Seattle, USA' },
  { stage: 'Round of 32', home: 'Brazil', away: 'Japan', homeScore: 2, awayScore: 1, venue: 'NRG Stadium', city: 'Houston, USA' },
  { stage: 'Round of 32', home: 'Ivory Coast', away: 'Norway', homeScore: 2, awayScore: 1, venue: 'AT&T Stadium', city: 'Dallas, USA' },
  { stage: 'Round of 32', home: 'Mexico', away: 'Ecuador', homeScore: 2, awayScore: 0, venue: 'Estadio Azteca', city: 'Mexico City, Mexico' },
  { stage: 'Round of 32', home: 'England', away: 'DR Congo', homeScore: 2, awayScore: 1, venue: 'Mercedes-Benz Stadium', city: 'Atlanta, USA' },
  { stage: 'Round of 32', home: 'Argentina', away: 'Cape Verde', homeScore: 3, awayScore: 0, venue: 'Hard Rock Stadium', city: 'Miami, USA' },
  { stage: 'Round of 32', home: 'Australia', away: 'Egypt', homeScore: 1, awayScore: 1, advances: 'Egypt', venue: 'AT&T Stadium', city: 'Dallas, USA' },
  { stage: 'Round of 32', home: 'Switzerland', away: 'Algeria', homeScore: 0, awayScore: 1, venue: 'BC Place', city: 'Vancouver, Canada' },
  { stage: 'Round of 32', home: 'Colombia', away: 'Ghana', homeScore: 2, awayScore: 1, venue: 'Arrowhead Stadium', city: 'Kansas City, USA' },

  // Round of 16
  { stage: 'Round of 16', home: 'France', away: 'Germany', homeScore: 2, awayScore: 1, dateText: 'Sat 4 Jul', venue: 'NRG Stadium', city: 'Houston, USA' },
  { stage: 'Round of 16', home: 'Canada', away: 'Morocco', homeScore: 1, awayScore: 1, advances: 'Canada', dateText: 'Sat 4 Jul', venue: 'Lincoln Financial Field', city: 'Philadelphia, USA' },
  { stage: 'Round of 16', home: 'Spain', away: 'Portugal', homeScore: 2, awayScore: 1, dateText: 'Sun 5 Jul', venue: 'MetLife Stadium', city: 'New York, USA' },
  { stage: 'Round of 16', home: 'USA', away: 'Senegal', homeScore: 1, awayScore: 0, dateText: 'Sun 5 Jul', venue: 'Estadio Azteca', city: 'Mexico City, Mexico' },
  { stage: 'Round of 16', home: 'Brazil', away: 'Ivory Coast', homeScore: 3, awayScore: 0, dateText: 'Mon 6 Jul', venue: 'AT&T Stadium', city: 'Dallas, USA' },
  { stage: 'Round of 16', home: 'England', away: 'Mexico', homeScore: 1, awayScore: 1, advances: 'England', dateText: 'Mon 6 Jul', venue: 'Lumen Field', city: 'Seattle, USA' },
  { stage: 'Round of 16', home: 'Argentina', away: 'Egypt', homeScore: 3, awayScore: 1, dateText: 'Tue 7 Jul', venue: 'Mercedes-Benz Stadium', city: 'Atlanta, USA' },
  { stage: 'Round of 16', home: 'Colombia', away: 'Algeria', homeScore: 2, awayScore: 1, dateText: 'Tue 7 Jul', venue: 'BC Place', city: 'Vancouver, Canada' },

  // Quarter-finals
  { stage: 'Quarter-finals', home: 'France', away: 'Canada', homeScore: 2, awayScore: 0, dateText: 'Thu 9 Jul', venue: 'Gillette Stadium', city: 'Boston, USA' },
  { stage: 'Quarter-finals', home: 'Spain', away: 'USA', homeScore: 3, awayScore: 1, dateText: 'Fri 10 Jul', venue: 'SoFi Stadium', city: 'Los Angeles, USA' },
  { stage: 'Quarter-finals', home: 'Brazil', away: 'England', homeScore: 2, awayScore: 1, dateText: 'Sat 11 Jul', venue: 'Hard Rock Stadium', city: 'Miami, USA' },
  { stage: 'Quarter-finals', home: 'Argentina', away: 'Colombia', homeScore: 2, awayScore: 0, dateText: 'Sat 11 Jul', venue: 'Arrowhead Stadium', city: 'Kansas City, USA' },

  // Semi-finals
  { stage: 'Semi-finals', home: 'Spain', away: 'France', homeScore: 2, awayScore: 1, dateText: 'Tue 14 Jul', venue: 'AT&T Stadium', city: 'Dallas, USA' },
  { stage: 'Semi-finals', home: 'Brazil', away: 'Argentina', homeScore: 2, awayScore: 1, dateText: 'Wed 15 Jul', venue: 'Mercedes-Benz Stadium', city: 'Atlanta, USA' },

  // Final
  { stage: 'Final', home: 'Spain', away: 'Brazil', homeScore: 3, awayScore: 1, dateText: 'Sun 19 Jul', venue: 'MetLife Stadium', city: 'New York, USA' },
]

export interface Person {
  slug: string
  title: string
  predictions: Prediction[]
  goldenBoot: { player: string; team: string }
}

const KANE = { player: 'Harry Kane', team: 'England' }

export const people: Record<string, Person> = {
  katdan: { slug: 'katdan', title: 'KatDan', predictions: katdanPredictions, goldenBoot: KANE },
  sarjack: { slug: 'sarjack', title: 'SarJack', predictions: sarjackPredictions, goldenBoot: KANE },
  gavin: {
    slug: 'gavin',
    title: 'Gavin',
    predictions: gavinPredictions,
    goldenBoot: { player: 'Kylian Mbappé', team: 'France' },
  },
}

// Pick whose predictions to show from the URL path (e.g. /sarjack). Defaults to KatDan.
export function resolvePerson(pathname: string): Person {
  const slug = pathname.replace(/[^a-z]/gi, '').toLowerCase()
  return people[slug] ?? people.katdan
}
