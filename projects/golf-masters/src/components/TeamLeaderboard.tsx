import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Trophy } from 'lucide-react';
import { TeamScore } from '../types';

interface Props {
  teams: TeamScore[];
  loading: boolean;
}

function scoreClass(score: number): string {
  if (score < 0) return 'score-under';
  if (score > 0) return 'score-over';
  return 'score-even';
}

function golferScoreDisplay(score: number | undefined, display: string | undefined): string {
  if (!display || display === 'N/A' || (score !== undefined && score >= 900)) return 'N/A';
  return display;
}

const PODIUM_STYLES = [
  'bg-gradient-to-r from-yellow-50 to-yellow-100/40 border-l-4 border-yellow-400',
  'bg-gradient-to-r from-gray-50 to-gray-100/30 border-l-4 border-gray-300',
  'bg-gradient-to-r from-amber-50 to-amber-100/30 border-l-4 border-amber-600',
];

export default function TeamLeaderboard({ teams, loading }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (loading && teams.length === 0) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="paper-card p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="w-24 h-4 bg-gray-200 rounded" />
                <div className="w-16 h-3 bg-gray-100 rounded" />
              </div>
              <div className="w-14 h-5 bg-gray-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {teams.map((team, index) => {
        const isOpen = expanded === team.name;

        return (
          <motion.div
            key={team.name}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.04, duration: 0.3 }}
            className={`paper-card overflow-hidden ${PODIUM_STYLES[index] || ''}`}
          >
            {/* Team header row */}
            <button
              onClick={() => setExpanded(isOpen ? null : team.name)}
              className="w-full flex items-center px-4 py-3 text-left hover:bg-black/[0.015] transition-colors"
            >
              {/* Position badge */}
              <div className="w-9 h-9 rounded-full bg-masters-green/10 flex items-center justify-center mr-3 shrink-0">
                {index < 3 ? (
                  <Trophy
                    className={`w-4 h-4 ${
                      index === 0
                        ? 'text-yellow-500'
                        : index === 1
                          ? 'text-gray-400'
                          : 'text-amber-600'
                    }`}
                  />
                ) : (
                  <span className="text-sm font-bold text-gray-400">{index + 1}</span>
                )}
              </div>

              {/* Team info */}
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-sm text-gray-900">{team.name}</span>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {team.picks.filter((p) => p.golfer && p.golfer.score < 900).length}/
                  {team.picks.length} golfers active
                </p>
              </div>

              {/* Total score */}
              <span
                className={`text-lg font-bold mr-3 shrink-0 ${
                  team.totalScore >= 900 ? 'text-gray-400 text-base' : scoreClass(team.totalScore)
                }`}
              >
                {team.totalScoreDisplay}
              </span>

              {/* Expand chevron */}
              <motion.div
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="shrink-0"
              >
                <ChevronDown className="w-5 h-5 text-gray-300" />
              </motion.div>
            </button>

            {/* Expanded golfer details */}
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-3 pt-1 border-t border-gray-100">
                    {team.picks
                      .slice()
                      .sort((a, b) => (a.golfer?.score ?? 999) - (b.golfer?.score ?? 999))
                      .map((pick, i) => (
                        <div
                          key={pick.pickName}
                          className="flex items-center py-2.5 border-b border-gray-50 last:border-0"
                        >
                          <span className="w-6 text-xs text-gray-300 font-medium">{i + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-700">
                              {pick.golfer?.displayName || pick.pickName}
                            </span>
                            {pick.golfer && pick.golfer.position !== '-' && (
                              <span className="text-[11px] text-gray-400 ml-2">
                                {pick.golfer.position}
                              </span>
                            )}
                            {pick.golfer && pick.golfer.thru !== '-' && (
                              <span className="text-[11px] text-gray-300 ml-1">
                                &middot; Thru {pick.golfer.thru}
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-sm font-semibold shrink-0 ${
                              pick.golfer && pick.golfer.score < 900
                                ? scoreClass(pick.golfer.score)
                                : 'text-gray-400'
                            }`}
                          >
                            {golferScoreDisplay(pick.golfer?.score, pick.golfer?.scoreDisplay)}
                          </span>
                        </div>
                      ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
