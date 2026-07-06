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

// --- Compact builder for the 11 people added after the original three -----
// Same fixtures/venues/dates as everyone else — only home/away/scores/advances
// differ per person, so this fills in the repeated venue/city/dateText by
// bracket position instead of repeating it by hand for every entry.

type Pick = [string, number, string, number, string?] // home, homeScore, away, awayScore, advances?

const R32_VENUES: [string, string][] = [
  ['Gillette Stadium', 'Boston, USA'],
  ['MetLife Stadium', 'New York, USA'],
  ['SoFi Stadium', 'Los Angeles, USA'],
  ['Estadio BBVA', 'Monterrey, Mexico'],
  ['BMO Field', 'Toronto, Canada'],
  ['SoFi Stadium', 'Los Angeles, USA'],
  ["Levi's Stadium", 'San Francisco, USA'],
  ['Lumen Field', 'Seattle, USA'],
  ['NRG Stadium', 'Houston, USA'],
  ['AT&T Stadium', 'Dallas, USA'],
  ['Estadio Azteca', 'Mexico City, Mexico'],
  ['Mercedes-Benz Stadium', 'Atlanta, USA'],
  ['Hard Rock Stadium', 'Miami, USA'],
  ['AT&T Stadium', 'Dallas, USA'],
  ['BC Place', 'Vancouver, Canada'],
  ['Arrowhead Stadium', 'Kansas City, USA'],
]

const LATER_SCHEDULE: Partial<Record<Stage, [string, string, string][]>> = {
  'Round of 16': [
    ['Sat 4 Jul', 'NRG Stadium', 'Houston, USA'],
    ['Sat 4 Jul', 'Lincoln Financial Field', 'Philadelphia, USA'],
    ['Sun 5 Jul', 'MetLife Stadium', 'New York, USA'],
    ['Sun 5 Jul', 'Estadio Azteca', 'Mexico City, Mexico'],
    ['Mon 6 Jul', 'AT&T Stadium', 'Dallas, USA'],
    ['Mon 6 Jul', 'Lumen Field', 'Seattle, USA'],
    ['Tue 7 Jul', 'Mercedes-Benz Stadium', 'Atlanta, USA'],
    ['Tue 7 Jul', 'BC Place', 'Vancouver, Canada'],
  ],
  'Quarter-finals': [
    ['Thu 9 Jul', 'Gillette Stadium', 'Boston, USA'],
    ['Fri 10 Jul', 'SoFi Stadium', 'Los Angeles, USA'],
    ['Sat 11 Jul', 'Hard Rock Stadium', 'Miami, USA'],
    ['Sat 11 Jul', 'Arrowhead Stadium', 'Kansas City, USA'],
  ],
  'Semi-finals': [
    ['Tue 14 Jul', 'AT&T Stadium', 'Dallas, USA'],
    ['Wed 15 Jul', 'Mercedes-Benz Stadium', 'Atlanta, USA'],
  ],
  Final: [['Sun 19 Jul', 'MetLife Stadium', 'New York, USA']],
}

// Builds a full bracket from compact per-stage pick lists — R32 always 16
// picks in canonical fixture order, R16 always 8, QF 4, SF 2, Final 1.
function buildBracketPredictions(stages: {
  r32: Pick[]
  r16: Pick[]
  qf: Pick[]
  sf: Pick[]
  final: Pick[]
}): Prediction[] {
  const out: Prediction[] = []
  stages.r32.forEach(([home, homeScore, away, awayScore, advances], i) => {
    const [venue, city] = R32_VENUES[i]
    out.push({ stage: 'Round of 32', home, homeScore, away, awayScore, advances, venue, city })
  })
  ;(
    [
      ['Round of 16', stages.r16],
      ['Quarter-finals', stages.qf],
      ['Semi-finals', stages.sf],
      ['Final', stages.final],
    ] as [Stage, Pick[]][]
  ).forEach(([stage, picks]) => {
    picks.forEach(([home, homeScore, away, awayScore, advances], i) => {
      const [dateText, venue, city] = LATER_SCHEDULE[stage]![i]
      out.push({ stage, home, homeScore, away, awayScore, advances, dateText, venue, city })
    })
  })
  return out
}

export const anjuPredictions = buildBracketPredictions({
  r32: [
    ['Germany', 2, 'Paraguay', 1], ['France', 4, 'Sweden', 1],
    ['South Africa', 2, 'Canada', 2, 'Canada'], ['Netherlands', 3, 'Morocco', 1],
    ['Portugal', 1, 'Croatia', 1, 'Portugal'], ['Spain', 2, 'Austria', 0],
    ['USA', 3, 'Bosnia', 0], ['Belgium', 1, 'Senegal', 0],
    ['Brazil', 2, 'Japan', 2, 'Brazil'], ['Ivory Coast', 1, 'Norway', 2],
    ['Mexico', 3, 'Ecuador', 0], ['England', 2, 'DR Congo', 0],
    ['Argentina', 3, 'Cape Verde', 0], ['Australia', 2, 'Egypt', 3],
    ['Switzerland', 2, 'Algeria', 1], ['Colombia', 0, 'Ghana', 0, 'Colombia'],
  ],
  r16: [
    ['Germany', 1, 'France', 3], ['Netherlands', 2, 'Canada', 0],
    ['Portugal', 1, 'Spain', 1, 'Spain'], ['USA', 1, 'Belgium', 0],
    ['Brazil', 2, 'Norway', 1], ['Mexico', 1, 'England', 1, 'Mexico'],
    ['Argentina', 4, 'Egypt', 0], ['Switzerland', 0, 'Colombia', 0, 'Colombia'],
  ],
  qf: [
    ['France', 2, 'Netherlands', 0], ['Spain', 2, 'USA', 1],
    ['Brazil', 1, 'Mexico', 1, 'Brazil'], ['Argentina', 2, 'Colombia', 0],
  ],
  sf: [['France', 2, 'Spain', 1], ['Brazil', 1, 'Argentina', 1, 'Argentina']],
  final: [['France', 1, 'Argentina', 1, 'France']],
})

export const nikPredictions = buildBracketPredictions({
  r32: [
    ['Germany', 3, 'Paraguay', 1], ['France', 4, 'Sweden', 1],
    ['South Africa', 1, 'Canada', 2], ['Netherlands', 3, 'Morocco', 2],
    ['Portugal', 1, 'Croatia', 0], ['Spain', 2, 'Austria', 0],
    ['USA', 2, 'Bosnia', 0], ['Belgium', 2, 'Senegal', 1],
    ['Brazil', 2, 'Japan', 2, 'Brazil'], ['Ivory Coast', 1, 'Norway', 2],
    ['Mexico', 1, 'Ecuador', 1, 'Mexico'], ['England', 2, 'DR Congo', 0],
    ['Argentina', 3, 'Cape Verde', 0], ['Australia', 1, 'Egypt', 2],
    ['Switzerland', 2, 'Algeria', 1], ['Colombia', 2, 'Ghana', 2, 'Ghana'],
  ],
  r16: [
    ['Germany', 1, 'France', 3], ['Canada', 1, 'Netherlands', 1, 'Netherlands'],
    ['Portugal', 1, 'Spain', 2], ['USA', 1, 'Belgium', 1, 'USA'],
    ['Brazil', 4, 'Norway', 2], ['Mexico', 1, 'England', 1, 'England'],
    ['Argentina', 3, 'Egypt', 0], ['Switzerland', 1, 'Ghana', 0],
  ],
  qf: [
    ['France', 4, 'Netherlands', 2], ['Spain', 2, 'USA', 0],
    ['Brazil', 3, 'England', 2], ['Argentina', 2, 'Switzerland', 0],
  ],
  sf: [['France', 2, 'Spain', 2, 'France'], ['Brazil', 1, 'Argentina', 3]],
  final: [['France', 1, 'Argentina', 1, 'France']],
})

export const jamesPredictions = buildBracketPredictions({
  r32: [
    ['Germany', 3, 'Paraguay', 0], ['France', 4, 'Sweden', 1],
    ['South Africa', 1, 'Canada', 2], ['Netherlands', 1, 'Morocco', 1, 'Morocco'],
    ['Portugal', 2, 'Croatia', 2, 'Portugal'], ['Spain', 3, 'Austria', 2],
    ['USA', 3, 'Bosnia', 0], ['Belgium', 3, 'Senegal', 1],
    ['Brazil', 3, 'Japan', 0], ['Ivory Coast', 1, 'Norway', 4],
    ['Mexico', 2, 'Ecuador', 2, 'Mexico'], ['England', 3, 'DR Congo', 1],
    ['Argentina', 4, 'Cape Verde', 0], ['Australia', 0, 'Egypt', 2],
    ['Switzerland', 1, 'Algeria', 0], ['Colombia', 3, 'Ghana', 0],
  ],
  r16: [
    ['Germany', 2, 'France', 3], ['Canada', 2, 'Morocco', 3],
    ['Portugal', 1, 'Spain', 4], ['USA', 2, 'Belgium', 1],
    ['Brazil', 2, 'Norway', 3], ['Mexico', 1, 'England', 1, 'England'],
    ['Argentina', 3, 'Egypt', 2], ['Switzerland', 2, 'Colombia', 4],
  ],
  qf: [
    ['France', 4, 'Morocco', 2], ['Spain', 4, 'USA', 1],
    ['Norway', 2, 'England', 4], ['Argentina', 3, 'Colombia', 1],
  ],
  sf: [['France', 3, 'Spain', 3, 'France'], ['England', 3, 'Argentina', 2]],
  final: [['England', 2, 'France', 2, 'England']],
})

export const martinPredictions = buildBracketPredictions({
  r32: [
    ['Germany', 3, 'Paraguay', 1], ['France', 3, 'Sweden', 1],
    ['South Africa', 1, 'Canada', 2], ['Netherlands', 1, 'Morocco', 1, 'Morocco'],
    ['Portugal', 1, 'Croatia', 1, 'Portugal'], ['Spain', 3, 'Austria', 0],
    ['United States', 2, 'Bosnia and Herzegovina', 0], ['Belgium', 2, 'Senegal', 1],
    ['Brazil', 3, 'Japan', 2], ['Ivory Coast', 2, 'Norway', 1],
    ['Mexico', 2, 'Ecuador', 3], ['England', 2, 'DR Congo', 0],
    ['Argentina', 3, 'Cape Verde', 0], ['Australia', 0, 'Egypt', 0, 'Egypt'],
    ['Switzerland', 2, 'Algeria', 1], ['Colombia', 2, 'Ghana', 2, 'Colombia'],
  ],
  r16: [
    ['Germany', 2, 'France', 3], ['Canada', 0, 'Morocco', 2],
    ['Portugal', 1, 'Spain', 1, 'Portugal'], ['United States', 1, 'Belgium', 0],
    ['Brazil', 2, 'Ivory Coast', 1], ['Ecuador', 1, 'England', 3],
    ['Argentina', 3, 'Egypt', 0], ['Switzerland', 1, 'Colombia', 2],
  ],
  qf: [
    ['France', 3, 'Morocco', 1], ['Portugal', 2, 'United States', 0],
    ['Brazil', 1, 'England', 1, 'England'], ['Argentina', 2, 'Colombia', 2, 'Argentina'],
  ],
  sf: [['France', 3, 'Portugal', 0], ['England', 1, 'Argentina', 2]],
  final: [['France', 1, 'Argentina', 2]],
})

export const rachePredictions = buildBracketPredictions({
  r32: [
    ['Germany', 3, 'Paraguay', 1], ['France', 2, 'Sweden', 0],
    ['South Africa', 1, 'Canada', 1, 'Canada'], ['Netherlands', 2, 'Morocco', 2, 'Morocco'],
    ['Portugal', 1, 'Croatia', 0], ['Spain', 3, 'Austria', 0],
    ['USA', 1, 'Bosnia', 1, 'USA'], ['Belgium', 1, 'Senegal', 0],
    ['Brazil', 3, 'Japan', 1], ['Ivory Coast', 2, 'Norway', 1],
    ['Mexico', 2, 'Ecuador', 0], ['England', 2, 'DR Congo', 1],
    ['Argentina', 4, 'Cape Verde', 0], ['Australia', 0, 'Egypt', 1],
    ['Switzerland', 0, 'Algeria', 0, 'Switzerland'], ['Colombia', 1, 'Ghana', 0],
  ],
  r16: [
    ['Germany', 1, 'France', 3], ['Canada', 0, 'Morocco', 1],
    ['Portugal', 0, 'Spain', 2], ['USA', 1, 'Belgium', 1, 'Belgium'],
    ['Brazil', 3, 'Ivory Coast', 2], ['Mexico', 1, 'England', 2],
    ['Argentina', 3, 'Egypt', 0], ['Switzerland', 0, 'Colombia', 2],
  ],
  qf: [
    ['France', 2, 'Morocco', 1], ['Spain', 3, 'Belgium', 0],
    ['Brazil', 2, 'England', 1], ['Argentina', 2, 'Colombia', 0],
  ],
  sf: [['France', 2, 'Spain', 1], ['Brazil', 0, 'Argentina', 2]],
  final: [['France', 2, 'Argentina', 1]],
})

export const gusPredictions = buildBracketPredictions({
  r32: [
    ['Germany', 2, 'Paraguay', 0], ['France', 3, 'Sweden', 1],
    ['South Africa', 1, 'Canada', 1, 'Canada'], ['Netherlands', 0, 'Morocco', 1],
    ['Portugal', 2, 'Croatia', 0], ['Spain', 3, 'Austria', 0],
    ['USA', 2, 'Bosnia', 0], ['Belgium', 1, 'Senegal', 2],
    ['Brazil', 2, 'Japan', 1], ['Ivory Coast', 1, 'Norway', 1, 'Norway'],
    ['Mexico', 1, 'Ecuador', 1, 'Mexico'], ['England', 2, 'DR Congo', 0],
    ['Argentina', 4, 'Cape Verde', 0], ['Australia', 0, 'Egypt', 1],
    ['Switzerland', 2, 'Algeria', 1], ['Colombia', 2, 'Ghana', 1],
  ],
  r16: [
    ['Germany', 1, 'France', 3], ['Canada', 0, 'Morocco', 1],
    ['Portugal', 0, 'Spain', 2], ['USA', 2, 'Senegal', 1],
    ['Brazil', 3, 'Norway', 1], ['Mexico', 1, 'England', 1, 'England'],
    ['Argentina', 3, 'Egypt', 1], ['Switzerland', 0, 'Colombia', 0, 'Colombia'],
  ],
  qf: [
    ['France', 2, 'Morocco', 1], ['Spain', 2, 'USA', 0],
    ['Brazil', 1, 'England', 2], ['Argentina', 3, 'Colombia', 1],
  ],
  sf: [['France', 2, 'Spain', 1], ['England', 1, 'Argentina', 2]],
  final: [['France', 1, 'Argentina', 2]],
})

export const stuPredictions = buildBracketPredictions({
  r32: [
    ['Germany', 2, 'Paraguay', 0], ['France', 1, 'Sweden', 0],
    ['South Africa', 0, 'Canada', 2], ['Netherlands', 0, 'Morocco', 1],
    ['Portugal', 1, 'Croatia', 3], ['Spain', 0, 'Austria', 0, 'Spain'],
    ['USA', 2, 'Bosnia', 0], ['Belgium', 0, 'Senegal', 1],
    ['Brazil', 2, 'Japan', 1], ['Ivory Coast', 1, 'Norway', 0],
    ['Mexico', 1, 'Ecuador', 0], ['England', 3, 'DR Congo', 0],
    ['Argentina', 4, 'Cape Verde', 0], ['Australia', 1, 'Egypt', 1, 'Egypt'],
    ['Switzerland', 0, 'Algeria', 2], ['Colombia', 0, 'Ghana', 1],
  ],
  r16: [
    ['Germany', 3, 'France', 0], ['Canada', 1, 'Morocco', 1, 'Morocco'],
    ['Croatia', 1, 'Spain', 0], ['USA', 1, 'Senegal', 0],
    ['Brazil', 2, 'Ivory Coast', 0], ['Mexico', 2, 'England', 0],
    ['Argentina', 3, 'Egypt', 0], ['Algeria', 0, 'Ghana', 1],
  ],
  qf: [
    ['Germany', 1, 'Morocco', 2], ['Croatia', 0, 'USA', 1],
    ['Brazil', 1, 'Mexico', 2], ['Argentina', 2, 'Ghana', 0],
  ],
  sf: [['USA', 0, 'Morocco', 1], ['Argentina', 2, 'Mexico', 1]],
  final: [['Argentina', 1, 'Morocco', 0]],
})

// Duncan and Steph never sent Round of 32 picks — cutoffFor() in logic.ts
// gives them a "baselined from today" cutoff instead of the shared 30 June
// one, so there's no gap where an un-scoreable round would otherwise sit.
export const duncanPredictions = buildBracketPredictions({
  r32: [],
  r16: [
    ['Germany', 1, 'France', 3], ['Canada', 0, 'Morocco', 2],
    ['Croatia', 0, 'Spain', 1], ['USA', 2, 'Senegal', 1],
    ['Japan', 2, 'Norway', 1], ['Mexico', 0, 'England', 0, 'England'],
    ['Argentina', 3, 'Australia', 0], ['Switzerland', 1, 'Colombia', 0],
  ],
  qf: [
    ['France', 2, 'Morocco', 1], ['Spain', 1, 'USA', 2],
    ['Japan', 1, 'England', 2], ['Argentina', 2, 'Switzerland', 0],
  ],
  sf: [['France', 3, 'USA', 0], ['England', 0, 'Argentina', 2]],
  final: [['France', 3, 'Argentina', 1]],
})

export const stephPredictions = buildBracketPredictions({
  r32: [],
  r16: [
    ['Germany', 1, 'France', 2], ['South Africa', 0, 'Netherlands', 1],
    ['Portugal', 2, 'Spain', 3], ['Bosnia', 0, 'Belgium', 2],
    ['Brazil', 2, 'Norway', 0], ['Mexico', 0, 'England', 1],
    ['Argentina', 3, 'Australia', 0], ['Switzerland', 0, 'Colombia', 0, 'Colombia'],
  ],
  qf: [
    ['France', 2, 'Netherlands', 0], ['Spain', 2, 'Belgium', 0],
    ['Brazil', 2, 'England', 1], ['Argentina', 2, 'Colombia', 0],
  ],
  sf: [['France', 2, 'Spain', 1], ['Brazil', 2, 'Argentina', 1]],
  final: [['France', 2, 'Brazil', 1]],
})

// Every other person's r16/qf/sf arrays are in canonical bracket-slot order
// (matching R32 slot pairing 0&1→R16 slot0, 2&3→slot1, etc.) — that's what
// lets the compare panel line each person's pick up against the right
// fixture by array position. Robbie2.0 has no R32 picks to anchor that
// order, and his original submission listed r16/qf in a different sequence
// (e.g. Portugal v Spain was his 5th R16 entry, not the 3rd/canonical
// position) — so every stage from R16 on was quietly showing against the
// wrong fixture in Compare picks. Reordered to canonical position; no pick
// content changed. (This also reverts an earlier "fix" to his semis made
// during this same investigation — that fix used his own scrambled QF
// order to judge whether the semis were a valid pairing, and concluded
// wrongly that they weren't; his original semis were correct all along
// once mapped to canonical slots.)
export const robbie2Predictions = buildBracketPredictions({
  r32: [],
  r16: [
    ['Germany', 1, 'France', 2], ['Canada', 1, 'Netherlands', 2],
    ['Spain', 2, 'Portugal', 1], ['Belgium', 1, 'United States', 2],
    ['Brazil', 2, 'Norway', 0], ['England', 2, 'Mexico', 1],
    ['Argentina', 3, 'Australia', 1], ['Colombia', 1, 'Switzerland', 2],
  ],
  qf: [
    ['France', 2, 'Netherlands', 1], ['Spain', 2, 'United States', 0],
    ['Brazil', 3, 'England', 1], ['Argentina', 2, 'Switzerland', 1],
  ],
  sf: [['France', 2, 'Spain', 1], ['Argentina', 2, 'Brazil', 2, 'Argentina']],
  final: [['Argentina', 2, 'France', 1]],
})

// Every game 1-1, higher FIFA-ranked team wins on pens (per the June 2026
// official ranking) — Robbie1.0's stated rule, applied mechanically.
export const robbie1Predictions = buildBracketPredictions({
  r32: [
    ['Germany', 1, 'Paraguay', 1, 'Germany'], ['France', 1, 'Sweden', 1, 'France'],
    ['South Africa', 1, 'Canada', 1, 'Canada'], ['Netherlands', 1, 'Morocco', 1, 'Morocco'],
    ['Portugal', 1, 'Croatia', 1, 'Portugal'], ['Spain', 1, 'Austria', 1, 'Spain'],
    ['USA', 1, 'Bosnia', 1, 'USA'], ['Belgium', 1, 'Senegal', 1, 'Belgium'],
    ['Brazil', 1, 'Japan', 1, 'Brazil'], ['Ivory Coast', 1, 'Norway', 1, 'Norway'],
    ['Mexico', 1, 'Ecuador', 1, 'Mexico'], ['England', 1, 'DR Congo', 1, 'England'],
    ['Argentina', 1, 'Cape Verde', 1, 'Argentina'], ['Australia', 1, 'Egypt', 1, 'Australia'],
    ['Switzerland', 1, 'Algeria', 1, 'Switzerland'], ['Colombia', 1, 'Ghana', 1, 'Colombia'],
  ],
  r16: [
    ['Germany', 1, 'France', 1, 'France'], ['Canada', 1, 'Morocco', 1, 'Morocco'],
    ['Portugal', 1, 'Spain', 1, 'Spain'], ['USA', 1, 'Belgium', 1, 'Belgium'],
    ['Brazil', 1, 'Norway', 1, 'Brazil'], ['Mexico', 1, 'England', 1, 'England'],
    ['Argentina', 1, 'Australia', 1, 'Argentina'], ['Switzerland', 1, 'Colombia', 1, 'Colombia'],
  ],
  qf: [
    ['France', 1, 'Morocco', 1, 'France'], ['Spain', 1, 'Belgium', 1, 'Spain'],
    ['Brazil', 1, 'England', 1, 'England'], ['Argentina', 1, 'Colombia', 1, 'Argentina'],
  ],
  sf: [['France', 1, 'Spain', 1, 'Spain'], ['England', 1, 'Argentina', 1, 'Argentina']],
  final: [['Spain', 1, 'Argentina', 1, 'Argentina']],
})

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
  gav: {
    slug: 'gav',
    title: 'Gav',
    predictions: gavinPredictions,
    goldenBoot: { player: 'Kylian Mbappé', team: 'France' },
  },
  anju: { slug: 'anju', title: 'AnnaJules', predictions: anjuPredictions, goldenBoot: KANE },
  nik: { slug: 'nik', title: 'Nik', predictions: nikPredictions, goldenBoot: KANE },
  james: { slug: 'james', title: 'James', predictions: jamesPredictions, goldenBoot: KANE },
  martin: { slug: 'martin', title: 'Martin', predictions: martinPredictions, goldenBoot: KANE },
  rache: { slug: 'rache', title: 'Rache', predictions: rachePredictions, goldenBoot: KANE },
  gus: { slug: 'gus', title: 'Gus', predictions: gusPredictions, goldenBoot: KANE },
  stu: { slug: 'stu', title: 'Stu', predictions: stuPredictions, goldenBoot: KANE },
  duncan: { slug: 'duncan', title: 'Duncan', predictions: duncanPredictions, goldenBoot: KANE },
  steph: { slug: 'steph', title: 'Steph', predictions: stephPredictions, goldenBoot: KANE },
  robbie1: { slug: 'robbie1', title: 'Robbie1.0', predictions: robbie1Predictions, goldenBoot: KANE },
  robbie2: { slug: 'robbie2', title: 'Robbie2.0', predictions: robbie2Predictions, goldenBoot: KANE },
}

// Pick whose predictions to show from the URL path (e.g. /sarjack). Defaults to KatDan.
export function resolvePerson(pathname: string): Person {
  const slug = pathname.replace(/[^a-z0-9]/gi, '').toLowerCase()
  return people[slug] ?? people.katdan
}
