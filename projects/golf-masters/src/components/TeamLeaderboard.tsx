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

function golferScoreBadge(score: number | undefined, display: string | undefined): string {
  const disp = golferScoreDisplay(score, display);
  if (disp === 'N/A') return 'score-badge-na';
  if (score !== undefined && score < 0) return 'score-badge-under';
  if (score !== undefined && score > 0) return 'score-badge-over';
  return 'score-badge-even';
}

function PosBadge({ index }: { index: number }) {
  if (index < 3) {
    const trophyColor =
      index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : 'text-amber-600';
    return (
      <div className={`pos-badge pos-badge-${index + 1}`}>
        <Trophy className={`w-3.5 h-3.5 ${trophyColor}`} />
      </div>
    );
  }
  return (
    <div className="pos-badge bg-gray-100 text-gray-400">
      {index + 1}
    </div>
  );
}

export default function TeamLeaderboard({ teams, loading }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (loading && teams.length === 0) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="paper-card p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 bg-gray-200 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="w-28 h-4 bg-gray-200 rounded" />
                <div className="w-16 h-3 bg-gray-100 rounded" />
              </div>
              <div className="w-10 h-10 bg-gray-200 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {teams.map((team, index) => {
        const isOpen = expanded === team.name;
        const leaderCls =
          index === 0 ? 'leader-1' : index === 1 ? 'leader-2' : index === 2 ? 'leader-3' : '';

        return (
          <motion.div
            key={team.name}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.035, duration: 0.3 }}
            className={`paper-card paper-card-lg overflow-hidden ${leaderCls}`}
          >
            {/* Team header row */}
            <button
              onClick={() => setExpanded(isOpen ? null : team.name)}
              className="w-full flex items-center px-3 sm:px-4 py-3.5 text-left hover:bg-black/[0.01] transition-colors"
            >
              {/* Position */}
              <div className="shrink-0 mr-3">
                <PosBadge index={index} />
              </div>

              {/* Team info */}
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-[14px] text-gray-900">{team.name}</span>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {team.picks.filter((p) => p.golfer && p.golfer.score < 900).length}/
                  {team.picks.length} golfers active
                </p>
              </div>

              {/* Total score badge */}
              <div
                className={`score-badge mr-2 ${
                  team.totalScore >= 900
                    ? 'score-badge-na'
                    : team.totalScore < 0
                      ? 'score-badge-under'
                      : team.totalScore > 0
                        ? 'score-badge-over'
                        : 'score-badge-even'
                }`}
              >
                <span className="text-xs">{team.totalScoreDisplay}</span>
              </div>

              {/* Expand chevron */}
              <motion.div
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="shrink-0"
              >
                <ChevronDown className="w-5 h-5 text-gray-300" />
              </motion.div>
            </button>

            {/* Expanded golfer scorecard */}
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="scorecard-inner px-4 pb-3 pt-2">
                    {team.picks
                      .slice()
                      .sort((a, b) => (a.golfer?.score ?? 999) - (b.golfer?.score ?? 999))
                      .map((pick, i) => {
                        const disp = golferScoreDisplay(
                          pick.golfer?.score,
                          pick.golfer?.scoreDisplay,
                        );
                        const badgeCls = golferScoreBadge(
                          pick.golfer?.score,
                          pick.golfer?.scoreDisplay,
                        );

                        return (
                          <div
                            key={pick.pickName}
                            className="flex items-center py-2.5 border-b border-masters-green/[0.06] last:border-0"
                          >
                            <span className="w-6 text-xs text-gray-300 font-mono">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-gray-700 font-medium">
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
                            {/* Mini score badge */}
                            <div
                              className={`flex items-center justify-center rounded-full text-[11px] font-bold shrink-0 w-9 h-9 ${badgeCls}`}
                            >
                              {disp}
                            </div>
                          </div>
                        );
                      })}
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
