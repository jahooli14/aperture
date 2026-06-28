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
}

export const predictions: Prediction[] = [
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

  // Round of 16
  { stage: 'Round of 16', home: 'Germany', away: 'France', homeScore: 1, awayScore: 2 },
  { stage: 'Round of 16', home: 'Canada', away: 'Netherlands', homeScore: 2, awayScore: 1 },
  { stage: 'Round of 16', home: 'Portugal', away: 'Spain', homeScore: 1, awayScore: 1, advances: 'Spain' },
  { stage: 'Round of 16', home: 'USA', away: 'Belgium', homeScore: 0, awayScore: 2 },
  { stage: 'Round of 16', home: 'Brazil', away: 'Norway', homeScore: 2, awayScore: 1 },
  { stage: 'Round of 16', home: 'Mexico', away: 'England', homeScore: 0, awayScore: 1 },
  { stage: 'Round of 16', home: 'Argentina', away: 'Egypt', homeScore: 3, awayScore: 0 },
  { stage: 'Round of 16', home: 'Switzerland', away: 'Colombia', homeScore: 0, awayScore: 2 },

  // Quarter-finals
  { stage: 'Quarter-finals', home: 'France', away: 'Canada', homeScore: 3, awayScore: 0 },
  { stage: 'Quarter-finals', home: 'Spain', away: 'Belgium', homeScore: 1, awayScore: 0 },
  { stage: 'Quarter-finals', home: 'Brazil', away: 'England', homeScore: 1, awayScore: 2 },
  { stage: 'Quarter-finals', home: 'Argentina', away: 'Colombia', homeScore: 3, awayScore: 1 },

  // Semi-finals
  { stage: 'Semi-finals', home: 'France', away: 'Spain', homeScore: 1, awayScore: 1, advances: 'Spain' },
  { stage: 'Semi-finals', home: 'England', away: 'Argentina', homeScore: 2, awayScore: 1 },

  // Final
  { stage: 'Final', home: 'Spain', away: 'England', homeScore: 0, awayScore: 1 },
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
