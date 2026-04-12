import { motion } from 'framer-motion';
import { GolferScore } from '../types';

interface Props {
  golfers: GolferScore[];
  loading: boolean;
}

const TEAM_COLORS: Record<string, string> = {
  Kieran: 'bg-blue-100 text-blue-700',
  Ollie: 'bg-purple-100 text-purple-700',
  Tristan: 'bg-pink-100 text-pink-700',
  George: 'bg-orange-100 text-orange-700',
  Jamie: 'bg-teal-100 text-teal-700',
  'Adam S': 'bg-indigo-100 text-indigo-700',
  Isabelle: 'bg-rose-100 text-rose-700',
  Martin: 'bg-cyan-100 text-cyan-700',
  Dom: 'bg-amber-100 text-amber-700',
  Laurence: 'bg-lime-100 text-lime-700',
  'Adam B': 'bg-violet-100 text-violet-700',
  Katie: 'bg-emerald-100 text-emerald-700',
  'Team Tequila': 'bg-yellow-100 text-yellow-800',
};

function scoreClass(score: number, display: string): string {
  if (display === 'N/A') return 'text-gray-400';
  if (score < 0) return 'score-under';
  if (score > 0) return 'score-over';
  return 'score-even';
}

function positionAccent(index: number): string {
  if (index === 0) return 'border-l-4 border-yellow-400 bg-yellow-50/50';
  if (index === 1) return 'border-l-4 border-gray-300 bg-gray-50/30';
  if (index === 2) return 'border-l-4 border-amber-600 bg-amber-50/30';
  return '';
}

export default function GolferLeaderboard({ golfers, loading }: Props) {
  if (loading && golfers.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="paper-card p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-8 h-5 bg-gray-200 rounded" />
              <div className="flex-1 space-y-2">
                <div className="w-36 h-4 bg-gray-200 rounded" />
                <div className="w-20 h-3 bg-gray-100 rounded" />
              </div>
              <div className="w-12 h-5 bg-gray-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Column headers */}
      <div className="flex items-center px-4 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider select-none">
        <span className="w-10 text-center">Pos</span>
        <span className="flex-1 pl-3">Player</span>
        <span className="w-14 text-center">Score</span>
        <span className="w-12 text-center hidden sm:block">R4</span>
        <span className="w-10 text-center hidden sm:block">Thru</span>
      </div>

      {golfers.map((g, i) => (
        <motion.div
          key={g.id}
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.025, duration: 0.3 }}
          className={`paper-card ${positionAccent(i)}`}
        >
          <div className="flex items-center px-4 py-3">
            {/* Position */}
            <span className="w-10 text-center text-sm font-bold text-gray-400 shrink-0">
              {g.position}
            </span>

            {/* Name + chips */}
            <div className="flex-1 pl-3 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-sm text-gray-900 truncate">
                  {g.displayName}
                </span>
                {g.status === 'cut' && g.scoreDisplay !== 'N/A' && (
                  <span className="chip bg-red-50 text-red-500 text-[10px]">MC</span>
                )}
                {g.status === 'withdrawn' && (
                  <span className="chip bg-gray-100 text-gray-500 text-[10px]">WD</span>
                )}
                {g.scoreDisplay === 'N/A' && (
                  <span className="chip bg-gray-100 text-gray-400 text-[10px]">Not in field</span>
                )}
              </div>
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                {g.pickedBy.map((team) => (
                  <span
                    key={team}
                    className={`chip text-[10px] leading-tight ${TEAM_COLORS[team] || 'bg-gray-100 text-gray-600'}`}
                  >
                    {team}
                  </span>
                ))}
              </div>
            </div>

            {/* Score */}
            <span
              className={`w-14 text-center text-sm shrink-0 ${scoreClass(g.score, g.scoreDisplay)}`}
            >
              {g.scoreDisplay}
            </span>

            {/* Today's round */}
            <span className="w-12 text-center text-xs text-gray-500 hidden sm:block shrink-0">
              {g.today}
            </span>

            {/* Thru */}
            <span className="w-10 text-center text-xs text-gray-500 hidden sm:block shrink-0">
              {g.thru}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
