import { useState, useEffect, useCallback } from 'react';
import { GolferScore, TeamScore, LeaderboardData } from '../types';
import { TEAM_PICKS, NAME_ALIASES, getAllGolferPicks, getGolferToTeamsMap } from '../data/picks';

// Proxied via Vite (dev) and Vercel rewrites (prod) to avoid CORS
const ESPN_SCOREBOARD = '/api/espn/apis/site/v2/sports/golf/pga/scoreboard';
const REFRESH_INTERVAL = 60_000;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function matchGolfer(pickName: string, espnDisplayName: string): boolean {
  const espn = normalize(espnDisplayName);
  const pick = normalize(pickName);

  // Check explicit aliases first
  const aliases = NAME_ALIASES[pickName];
  if (aliases) {
    return aliases.some((alias) => espn.includes(normalize(alias)));
  }

  // Direct containment (e.g. "Schauffele" in "Xander Schauffele")
  if (espn.includes(pick)) return true;

  // Match against last name
  const espnParts = espn.split(/\s+/);
  if (espnParts[espnParts.length - 1] === pick) return true;

  // Multi-word pick: all words present in ESPN name
  const pickParts = pick.split(/\s+/);
  if (pickParts.length > 1 && pickParts.every((p) => espn.includes(p))) return true;

  return false;
}

function parseScore(raw: unknown): { value: number; display: string } {
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;
    const val =
      typeof obj.value === 'number'
        ? obj.value
        : typeof obj.displayValue === 'string'
          ? parseInt(obj.displayValue)
          : 0;
    const display =
      (obj.displayValue as string) || (val === 0 ? 'E' : val > 0 ? `+${val}` : String(val));
    return { value: isNaN(val) ? 999 : val, display };
  }
  if (typeof raw === 'number') {
    return { value: raw, display: raw === 0 ? 'E' : raw > 0 ? `+${raw}` : String(raw) };
  }
  if (typeof raw === 'string') {
    if (raw === 'E' || raw === 'Even') return { value: 0, display: 'E' };
    const parsed = parseInt(raw);
    return { value: isNaN(parsed) ? 999 : parsed, display: raw };
  }
  return { value: 999, display: 'N/A' };
}

export function useLeaderboard(): LeaderboardData {
  const [data, setData] = useState<LeaderboardData>({
    eventName: 'The Masters',
    roundInfo: '',
    lastUpdated: new Date(),
    golfers: [],
    teams: [],
    loading: true,
    error: null,
  });

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(ESPN_SCOREBOARD);
      if (!res.ok) throw new Error(`ESPN API returned ${res.status}`);
      const json = await res.json();

      // Find the Masters event, fallback to first event
      const event =
        json.events?.find(
          (e: Record<string, unknown>) =>
            typeof e.name === 'string' &&
            (e.name.toLowerCase().includes('masters') ||
              (typeof e.shortName === 'string' && e.shortName.toLowerCase().includes('masters'))),
        ) || json.events?.[0];

      if (!event) throw new Error('No golf event found');

      const competition = event.competitions?.[0];
      if (!competition) throw new Error('No competition data');

      const eventName: string = event.name || 'The Masters';
      const roundInfo: string = event.status?.type?.shortDetail || '';

      const allPicks = getAllGolferPicks();
      const golferToTeams = getGolferToTeamsMap();
      const matched = new Map<string, GolferScore>();
      const competitors: Array<Record<string, unknown>> = competition.competitors || [];

      for (const comp of competitors) {
        const athlete = comp.athlete as Record<string, unknown> | undefined;
        const displayName = (athlete?.displayName as string) || '';
        if (!displayName) continue;

        for (const pickName of allPicks) {
          if (matched.has(pickName)) continue;
          if (!matchGolfer(pickName, displayName)) continue;

          const { value: scoreVal, display: scoreDisp } = parseScore(comp.score);
          const status = comp.status as Record<string, unknown> | undefined;
          const position =
            (status?.position as Record<string, unknown>)?.displayName ||
            comp.sortOrder ||
            comp.order ||
            '?';
          const thru = status?.displayValue || status?.thru || '';
          const linescores = (comp.linescores as Array<Record<string, string>>) || [];

          let golferStatus: GolferScore['status'] = 'active';
          const statusType = ((status?.type as Record<string, unknown>)?.name as string) || '';
          if (statusType.includes('CUT')) golferStatus = 'cut';
          else if (statusType.includes('WD')) golferStatus = 'withdrawn';
          else if (statusType.includes('FINAL') || statusType.includes('COMPLETE'))
            golferStatus = 'finished';

          const athleteId = (comp.id as string) || '';

          matched.set(pickName, {
            id: athleteId || displayName,
            name: pickName,
            displayName,
            position: String(position),
            score: scoreVal,
            scoreDisplay: scoreDisp === '0' ? 'E' : scoreDisp,
            today:
              linescores.length > 0
                ? linescores[linescores.length - 1]?.displayValue || '-'
                : '-',
            thru: String(thru || '-'),
            round1: linescores[0]?.displayValue || '-',
            round2: linescores[1]?.displayValue || '-',
            round3: linescores[2]?.displayValue || '-',
            round4: linescores[3]?.displayValue || '-',
            status: golferStatus,
            pickedBy: golferToTeams[pickName] || [],
            imageUrl: athleteId
              ? `https://a.espncdn.com/i/headshots/golf/players/full/${athleteId}.png`
              : undefined,
          });
        }
      }

      // Build golfer array, including unmatched picks
      const golfers: GolferScore[] = allPicks.map(
        (pickName) =>
          matched.get(pickName) || {
            id: pickName,
            name: pickName,
            displayName: pickName,
            position: '-',
            score: 999,
            scoreDisplay: 'N/A',
            today: '-',
            thru: '-',
            round1: '-',
            round2: '-',
            round3: '-',
            round4: '-',
            status: 'cut' as const,
            pickedBy: golferToTeams[pickName] || [],
          },
      );

      golfers.sort((a, b) => a.score - b.score);

      // Compute positions with tie handling
      for (let i = 0; i < golfers.length; ) {
        if (golfers[i].score >= 900) {
          golfers[i].position = '-';
          i++;
          continue;
        }
        let j = i;
        while (j < golfers.length && golfers[j].score === golfers[i].score) j++;
        const tied = j - i > 1;
        const posStr = tied ? `T${i + 1}` : String(i + 1);
        for (let k = i; k < j; k++) {
          golfers[k].position = posStr;
        }
        i = j;
      }

      // Calculate team scores
      const teams: TeamScore[] = TEAM_PICKS.map((team) => {
        const picks = team.picks.map((pickName) => ({
          pickName,
          golfer: matched.get(pickName) || null,
        }));

        const scores = picks.map((p) => p.golfer?.score ?? 999);
        const totalScore = scores.reduce((sum, s) => sum + s, 0);

        let totalScoreDisplay: string;
        if (scores.some((s) => s >= 900)) {
          // Some golfers not found — show partial total
          const validScores = scores.filter((s) => s < 900);
          const partial = validScores.reduce((sum, s) => sum + s, 0);
          const missing = scores.filter((s) => s >= 900).length;
          totalScoreDisplay =
            (partial === 0 ? 'E' : partial > 0 ? `+${partial}` : String(partial)) +
            ` (${missing} N/A)`;
        } else if (totalScore === 0) {
          totalScoreDisplay = 'E';
        } else if (totalScore > 0) {
          totalScoreDisplay = `+${totalScore}`;
        } else {
          totalScoreDisplay = String(totalScore);
        }

        return { name: team.team, picks, totalScore, totalScoreDisplay };
      });

      teams.sort((a, b) => a.totalScore - b.totalScore);

      setData({
        eventName,
        roundInfo,
        lastUpdated: new Date(),
        golfers,
        teams,
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error('Leaderboard fetch error:', err);
      setData((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load scores',
      }));
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  return { ...data, refetch: fetchLeaderboard } as LeaderboardData;
}
