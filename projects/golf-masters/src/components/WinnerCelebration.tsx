import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Flag } from 'lucide-react';
import { TeamScore } from '../types';

interface Props {
  winner: TeamScore;
  tournamentComplete: boolean;
}

const EASE = [0.22, 1, 0.36, 1] as const;

/** Subtle golden particles drifting upward */
function GoldenSparkles() {
  const particles = [
    { id: 0, x: 12, delay: 1.8, dur: 3.5, size: 2.5 },
    { id: 1, x: 28, delay: 2.4, dur: 4.0, size: 2 },
    { id: 2, x: 44, delay: 1.6, dur: 3.2, size: 3 },
    { id: 3, x: 58, delay: 2.8, dur: 3.8, size: 2 },
    { id: 4, x: 72, delay: 2.0, dur: 4.2, size: 2.5 },
    { id: 5, x: 85, delay: 2.6, dur: 3.4, size: 2 },
    { id: 6, x: 35, delay: 3.2, dur: 3.6, size: 3 },
    { id: 7, x: 65, delay: 3.6, dur: 4.0, size: 2 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-masters-gold/30"
          style={{ left: `${p.x}%`, bottom: '10%', width: p.size, height: p.size }}
          animate={{ y: [0, -280], opacity: [0, 0.4, 0] }}
          transition={{
            duration: p.dur,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
}

export default function WinnerCelebration({ winner, tournamentComplete }: Props) {
  const [showOverlay, setShowOverlay] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Delay the overlay entrance for dramatic effect
  useEffect(() => {
    if (tournamentComplete && !dismissed) {
      const timer = setTimeout(() => setShowOverlay(true), 600);
      return () => clearTimeout(timer);
    }
  }, [tournamentComplete, dismissed]);

  // Lock body scroll while overlay is visible
  useEffect(() => {
    if (showOverlay && !dismissed) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [showOverlay, dismissed]);

  if (!tournamentComplete) return null;

  const sortedPicks = winner.picks
    .slice()
    .sort((a, b) => (a.golfer?.score ?? 999) - (b.golfer?.score ?? 999));

  return (
    <>
      {/* ─── Full-screen celebration overlay ─── */}
      <AnimatePresence>
        {showOverlay && !dismissed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{
              background:
                'radial-gradient(ellipse at 50% 30%, rgba(0, 77, 53, 0.95), rgba(10, 46, 28, 0.98))',
            }}
            onClick={() => setDismissed(true)}
          >
            <GoldenSparkles />

            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.7, ease: EASE }}
              className="relative max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="celebration-card rounded-xl p-8 text-center">
                {/* ── Top decorative rule ── */}
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.6, duration: 0.8, ease: EASE }}
                  className="flex items-center justify-center gap-3 mb-6"
                >
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent to-masters-gold/40" />
                  <Flag className="w-3 h-3 text-masters-gold/60" />
                  <span className="text-masters-gold/50 text-[10px] tracking-[0.3em] uppercase font-sans">
                    The Masters 2026
                  </span>
                  <Flag className="w-3 h-3 text-masters-gold/60" />
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent to-masters-gold/40" />
                </motion.div>

                {/* ── Trophy with glow ── */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.9, duration: 0.6, ease: EASE }}
                  className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full trophy-glow"
                >
                  <Trophy className="w-8 h-8 text-masters-gold" />
                </motion.div>

                {/* ── Champion label ── */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2, duration: 0.5 }}
                  className="text-[11px] tracking-[0.4em] uppercase font-sans font-semibold text-masters-gold/70 mb-2"
                >
                  Pool Champion
                </motion.p>

                {/* ── Winner name with gold shimmer ── */}
                <motion.h2
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.5, duration: 0.7, ease: EASE }}
                  className="font-display text-4xl font-bold shimmer-text mb-3"
                >
                  {winner.name}
                </motion.h2>

                {/* ── Score badge ── */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.9, duration: 0.5 }}
                  className="mb-6"
                >
                  <span className="celebration-score-badge">
                    {winner.totalScoreDisplay}
                  </span>
                </motion.div>

                {/* ── Golfer list ── */}
                <div className="space-y-1.5 mb-6">
                  {sortedPicks.map((pick, i) => (
                    <motion.div
                      key={pick.pickName}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 2.1 + i * 0.12, duration: 0.4 }}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-masters-pine/[0.03]"
                    >
                      <div className="flex items-center gap-2">
                        {pick.golfer?.imageUrl && (
                          <img
                            src={pick.golfer.imageUrl}
                            alt=""
                            className="w-5 h-5 rounded-full object-cover ring-1 ring-masters-gold/20 bg-gray-100"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}
                        <span className="text-sm text-gray-700 font-medium">
                          {pick.golfer?.displayName || pick.pickName}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-bold ${
                          (pick.golfer?.score ?? 999) < 0
                            ? 'text-masters-green'
                            : (pick.golfer?.score ?? 999) > 0
                              ? 'text-red-500'
                              : 'text-gray-500'
                        }`}
                      >
                        {pick.golfer?.scoreDisplay || 'N/A'}
                      </span>
                    </motion.div>
                  ))}
                </div>

                {/* ── Dismiss button ── */}
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 2.8, duration: 0.5 }}
                  onClick={() => setDismissed(true)}
                  className="celebration-btn font-sans"
                >
                  View Leaderboard
                </motion.button>

                {/* ── Bottom decorative rule ── */}
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.8, duration: 0.8, ease: EASE }}
                  className="flex items-center justify-center gap-3 mt-6"
                >
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent to-masters-gold/30" />
                  <span className="text-masters-gold/30 text-[10px] font-display italic">
                    A tradition unlike any other
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent to-masters-gold/30" />
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Persistent winner banner (after overlay dismissed) ─── */}
      {dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="winner-banner mb-4"
        >
          <div className="flex items-center justify-center gap-3 py-3 px-4">
            <Trophy className="w-4 h-4 text-masters-gold" />
            <div className="text-center">
              <p className="text-[9px] uppercase tracking-[0.25em] text-masters-gold/60 font-sans">
                Pool Champion
              </p>
              <p className="font-display text-lg font-bold text-masters-gold">
                {winner.name}
              </p>
            </div>
            <Trophy className="w-4 h-4 text-masters-gold" />
          </div>
        </motion.div>
      )}
    </>
  );
}
