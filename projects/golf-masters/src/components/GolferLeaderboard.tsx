import { motion } from 'framer-motion';
import { GolferScore } from '../types';

interface Props {
  golfers: GolferScore[];
  loading: boolean;
}

const TEAM_COLORS: Record<string, string> = {
  Kieran: 'bg-blue-100 text-blue-700 border-blue-200',
  Ollie: 'bg-purple-100 text-purple-700 border-purple-200',
  Tristan: 'bg-pink-100 text-pink-700 border-pink-200',
  George: 'bg-orange-100 text-orange-700 border-orange-200',
  Jamie: 'bg-teal-100 text-teal-700 border-teal-200',
  'Adam S': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  Isabelle: 'bg-rose-100 text-rose-700 border-rose-200',
  Martin: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  Dom: 'bg-amber-100 text-amber-700 border-amber-200',
  Laurence: 'bg-lime-100 text-lime-700 border-lime-200',
  'Adam B': 'bg-violet-100 text-violet-700 border-violet-200',
  Katie: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Team Tequila': 'bg-yellow-100 text-yellow-800 border-yellow-200',
};

function scoreBadgeClass(score: number, display: string): string {
  if (display === 'N/A') return 'score-badge score-badge-na';
  if (score < 0) return 'score-badge score-badge-under';
  if (score > 0) return 'score-badge score-badge-over';
  return 'score-badge score-badge-even';
}

function leaderClass(index: number): string {
  if (index === 0) return 'leader-1';
  if (index === 1) return 'leader-2';
  if (index === 2) return 'leader-3';
  return '';
}

function PosBadge({ index, position }: { index: number; position: string }) {
  if (index < 3) {
    const cls = `pos-badge pos-badge-${index + 1}`;
    return <div className={cls}>{position}</div>;
  }
  return (
    <div className="pos-badge bg-gray-100 text-gray-400">
      {position}
    </div>
  );
}

export default function GolferLeaderboard({ golfers, loading }: Props) {
  if (loading && golfers.length === 0) {
    return (
      <div className="space-y-2.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="paper-card p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 bg-gray-200 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="w-36 h-4 bg-gray-200 rounded" />
                <div className="w-20 h-3 bg-gray-100 rounded" />
              </div>
              <div className="w-10 h-10 bg-gray-200 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Column header */}
      <div className="flex items-center px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest select-none">
        <span className="w-8" />
        <span className="flex-1 pl-3">Player</span>
        <span className="w-[42px] text-center">Score</span>
        <span className="w-12 text-center hidden sm:block">R4</span>
        <span className="w-10 text-center hidden sm:block">Thru</span>
      </div>

      {golfers.map((g, i) => (
        <motion.div
          key={g.id}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.02, duration: 0.3 }}
          className={`paper-card ${leaderClass(i)}`}
        >
          <div className="flex items-center px-3 sm:px-4 py-3">
            {/* Position badge */}
            <div className="shrink-0 mr-3">
              <PosBadge index={i} position={g.position} />
            </div>

            {/* Name + team chips */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-[13px] text-gray-900 truncate">
                  {g.displayName}
                </span>
                {g.status === 'cut' && g.scoreDisplay !== 'N/A' && (
                  <span className="chip bg-red-50 text-red-400 text-[10px] border-red-100">MC</span>
                )}
                {g.status === 'withdrawn' && (
                  <span className="chip bg-gray-100 text-gray-400 text-[10px]">WD</span>
                )}
                {g.scoreDisplay === 'N/A' && (
                  <span className="chip bg-gray-50 text-gray-400 text-[10px]">Not in field</span>
                )}
              </div>
              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                {g.pickedBy.map((team) => (
                  <span
                    key={team}
                    className={`chip text-[10px] leading-tight ${TEAM_COLORS[team] || 'bg-gray-100 text-gray-600 border-gray-200'}`}
                  >
                    {team}
                  </span>
                ))}
              </div>
            </div>

            {/* Score badge */}
            <div className={scoreBadgeClass(g.score, g.scoreDisplay)}>
              <span className="text-xs">{g.scoreDisplay}</span>
            </div>

            {/* Today's round (desktop) */}
            <span className="w-12 text-center text-xs text-gray-500 hidden sm:block shrink-0">
              {g.today}
            </span>

            {/* Thru (desktop) */}
            <span className="w-10 text-center text-xs text-gray-400 hidden sm:block shrink-0">
              {g.thru}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
