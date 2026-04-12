export interface GolferScore {
  id: string;
  name: string;
  displayName: string;
  position: string;
  score: number;
  scoreDisplay: string;
  today: string;
  thru: string;
  round1: string;
  round2: string;
  round3: string;
  round4: string;
  status: 'active' | 'cut' | 'withdrawn' | 'finished';
  pickedBy: string[];
  imageUrl?: string;
}

export interface TeamPick {
  pickName: string;
  golfer: GolferScore | null;
}

export interface TeamScore {
  name: string;
  picks: TeamPick[];
  totalScore: number;
  totalScoreDisplay: string;
}

export interface LeaderboardData {
  eventName: string;
  roundInfo: string;
  lastUpdated: Date;
  golfers: GolferScore[];
  teams: TeamScore[];
  loading: boolean;
  error: string | null;
}
