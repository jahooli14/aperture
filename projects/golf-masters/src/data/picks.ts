export interface TeamPickData {
  team: string;
  picks: string[];
}

export const TEAM_PICKS: TeamPickData[] = [
  { team: 'Kieran', picks: ['Schauffele', 'JDay', 'Hojgaard', 'Kitayama'] },
  { team: 'Ollie', picks: ['Rahm', 'Min Woo Lee', 'Gotterup', 'Berger'] },
  { team: 'Tristan', picks: ['Rose', 'Bridgeman', 'Potgieter', 'Laopakdee'] },
  { team: 'George', picks: ['McIlroy', 'Spaun', 'Bradley', 'Sergio'] },
  { team: 'Jamie', picks: ['Young', 'Spieth', 'Scott', 'DJ'] },
  { team: 'Adam S', picks: ['Aberg', 'Lowry', 'Sungjae Im', 'Woodland'] },
  { team: 'Isabelle', picks: ['Fleetwood', 'Wyndham Clark', 'Conners', 'Penge'] },
  { team: 'Martin', picks: ['MacIntyre', 'Si Woo Kim', 'Bhatia', 'Knapp'] },
  { team: 'Dom', picks: ['DeChambeau', 'Koepka', 'Thomas', 'Straka'] },
  { team: 'Laurence', picks: ['Morikawa', 'Hovland', 'Cantlay', 'English'] },
  { team: 'Adam B', picks: ['Fitzpatrick', 'Reed', 'McNealy', 'Smith'] },
  { team: 'Katie', picks: ['Henley', 'Matsuyama', 'Burns', 'Hatton'] },
  { team: 'Team Tequila', picks: ['Scheffler', 'Gerard', 'Griffin', 'Hall'] },
];

// Map short/nick names to searchable terms for ESPN matching
export const NAME_ALIASES: Record<string, string[]> = {
  'JDay': ['Jason Day'],
  'DJ': ['Dustin Johnson'],
  'Sergio': ['Sergio Garcia', 'Garcia'],
  'Min Woo Lee': ['Min Woo Lee'],
  'Si Woo Kim': ['Si Woo Kim', 'Kim, Si Woo'],
  'Sungjae Im': ['Sungjae Im', 'Im, Sungjae'],
  'Aberg': ['Ludvig Aberg', 'Ludvig Åberg'],
  'Hojgaard': ['Nicolai Hojgaard', 'Nicolai Højgaard', 'Rasmus Hojgaard', 'Rasmus Højgaard'],
  'McIlroy': ['Rory McIlroy'],
  'Scott': ['Adam Scott'],
  'DeChambeau': ['Bryson DeChambeau'],
  'MacIntyre': ['Robert MacIntyre'],
  'McNealy': ['Maverick McNealy'],
};

export function getAllGolferPicks(): string[] {
  const picks = new Set<string>();
  for (const team of TEAM_PICKS) {
    for (const pick of team.picks) {
      picks.add(pick);
    }
  }
  return Array.from(picks);
}

export function getGolferToTeamsMap(): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const team of TEAM_PICKS) {
    for (const pick of team.picks) {
      if (!map[pick]) map[pick] = [];
      map[pick].push(team.team);
    }
  }
  return map;
}
