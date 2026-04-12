import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { GolferScore } from '../types';

interface Props {
  golfers: GolferScore[];
}

function parseTodayScore(today: string): number | null {
  if (!today || today === '-') return null;
  if (today === 'E') return 0;
  const n = parseInt(today);
  return isNaN(n) ? null : n;
}

export default function MoversShakers({ golfers }: Props) {
  const withScores = golfers
    .filter((g) => g.score < 900 && parseTodayScore(g.today) !== null)
    .sort((a, b) => (parseTodayScore(a.today) ?? 0) - (parseTodayScore(b.today) ?? 0));

  if (withScores.length < 6) return null;

  // Ensure movers and shakers don't overlap
  const movers = withScores.slice(0, 3);
  const moverIds = new Set(movers.map((g) => g.id));
  const shakers = withScores
    .slice()
    .reverse()
    .filter((g) => !moverIds.has(g.id))
    .slice(0, 3);

  // Don't show if no meaningful variation
  const bestScore = parseTodayScore(movers[0].today) ?? 0;
  const worstScore = parseTodayScore(shakers[0].today) ?? 0;
  if (bestScore === worstScore) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, rotateX: -6 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      style={{ perspective: 600, transformOrigin: 'top center' }}
      className="paper-card mb-4 overflow-hidden"
    >
      <div className="grid grid-cols-2">
        {/* Movers – best today */}
        <div className="p-3 sm:p-4 border-r border-masters-green/[0.06]">
          <div className="flex items-center gap-1.5 mb-3">
            <TrendingUp className="w-3.5 h-3.5 text-masters-green" />
            <span className="text-[10px] font-semibold text-masters-green uppercase tracking-widest">
              Moving Up
            </span>
          </div>
          <div className="space-y-2.5">
            {movers.map((g) => (
              <div key={g.id} className="flex items-center gap-2">
                {g.imageUrl && (
                  <img
                    src={g.imageUrl}
                    alt=""
                    className="w-6 h-6 rounded-full object-cover ring-1 ring-masters-green/10 bg-gray-100 shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <span className="text-xs font-medium text-gray-700 truncate flex-1 min-w-0">
                  {g.displayName}
                </span>
                <span className="text-xs font-bold text-masters-green shrink-0">{g.today}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Shakers – worst today */}
        <div className="p-3 sm:p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <TrendingDown className="w-3.5 h-3.5 text-red-500" />
            <span className="text-[10px] font-semibold text-red-500 uppercase tracking-widest">
              Falling Back
            </span>
          </div>
          <div className="space-y-2.5">
            {shakers.map((g) => (
              <div key={g.id} className="flex items-center gap-2">
                {g.imageUrl && (
                  <img
                    src={g.imageUrl}
                    alt=""
                    className="w-6 h-6 rounded-full object-cover ring-1 ring-red-100 bg-gray-100 shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <span className="text-xs font-medium text-gray-700 truncate flex-1 min-w-0">
                  {g.displayName}
                </span>
                <span className="text-xs font-bold text-red-500 shrink-0">{g.today}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
