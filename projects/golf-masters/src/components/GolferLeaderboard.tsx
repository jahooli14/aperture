import { motion } from 'framer-motion';
import { GolferScore } from '../types';

interface Props {
  golfers: GolferScore[];
  loading: boolean;
}

const TEAM_COLORS: Record<string, string> = {
  Kieran: 'bg-blue-50 text-blue-600 border-blue-100',
  Ollie: 'bg-purple-50 text-purple-600 border-purple-100',
  Tristan: 'bg-pink-50 text-pink-600 border-pink-100',
  George: 'bg-orange-50 text-orange-600 border-orange-100',
  Jamie: 'bg-teal-50 text-teal-600 border-teal-100',
  'Adam S': 'bg-indigo-50 text-indigo-600 border-indigo-100',
  Isabelle: 'bg-rose-50 text-rose-600 border-rose-100',
  Martin: 'bg-cyan-50 text-cyan-600 border-cyan-100',
  Dom: 'bg-amber-50 text-amber-700 border-amber-100',
  Laurence: 'bg-lime-50 text-lime-700 border-lime-100',
  'Adam B': 'bg-violet-50 text-violet-600 border-violet-100',
  Katie: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  'Team Tequila': 'bg-yellow-50 text-yellow-700 border-yellow-200',
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
              <div className="w-8 h-8 bg-masters-green/10 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="w-36 h-4 bg-masters-green/[0.06] rounded" />
                <div className="w-20 h-3 bg-masters-green/[0.04] rounded" />
              </div>
              <div className="w-11 h-11 bg-masters-green/[0.06] rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Column header */}
      <div className="flex items-center px-4 py-2 text-[10px] font-semibold uppercase tracking-widest select-none letterpress">
        <span className="w-8" />
        <span className="flex-1 pl-3">Player</span>
        <span className="w-[44px] text-center">Score</span>
        <span className="w-12 text-center hidden sm:block">Today</span>
        <span className="w-10 text-center hidden sm:block">Thru</span>
      </div>

      {golfers.map((g, i) => (
        <motion.div
          key={g.id}
          initial={{ opacity: 0, y: 16, rotateX: -6 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ delay: i * 0.025, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          style={{ perspective: 600, transformOrigin: 'top center' }}
          className={`paper-card ${leaderClass(i)}`}
        >
          <div className="flex items-center px-3 sm:px-4 py-3">
            {/* Position badge */}
            <div className="shrink-0 mr-3">
              <PosBadge index={i} position={g.position} />
            </div>

            {/* Golfer headshot */}
            {g.imageUrl && (
              <img
                src={g.imageUrl}
                alt=""
                className="w-7 h-7 rounded-full object-cover shrink-0 mr-2.5 ring-2 ring-masters-green/10 bg-gray-100"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}

            {/* Name + team chips */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-sm text-gray-900 truncate">
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
