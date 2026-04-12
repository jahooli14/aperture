import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Flag, Trophy } from 'lucide-react';
import { useLeaderboard } from './hooks/useLeaderboard';
import GolferLeaderboard from './components/GolferLeaderboard';
import TeamLeaderboard from './components/TeamLeaderboard';

type Tab = 'golfers' | 'teams';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('golfers');
  const data = useLeaderboard();

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen">
      {/* Thin decorative green stripe at very top */}
      <div className="green-stripe" />

      {/* ─── Header ─── */}
      <header className="relative overflow-hidden bg-gradient-to-b from-[#0a2e1c] via-masters-green-dark to-masters-green header-pattern">
        {/* Radial light bloom from top center */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,255,255,0.08),transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/15 pointer-events-none" />

        <div className="relative max-w-2xl mx-auto px-4 pt-12 pb-16 text-center">
          {/* Augusta National crest line */}
          <div className="inline-flex items-center gap-4 mb-5">
            <div className="h-px w-10 bg-gradient-to-r from-transparent to-masters-yellow/40" />
            <Flag className="w-3.5 h-3.5 text-masters-yellow/50" />
            <span className="text-masters-yellow/60 text-[10px] tracking-[0.3em] uppercase font-sans font-medium">
              Augusta National
            </span>
            <Flag className="w-3.5 h-3.5 text-masters-yellow/50" />
            <div className="h-px w-10 bg-gradient-to-l from-transparent to-masters-yellow/40" />
          </div>

          <h1 className="font-display text-5xl sm:text-6xl font-bold text-white tracking-tight leading-none">
            Masters Pool
          </h1>

          <p className="text-masters-yellow font-display text-2xl font-semibold mt-2 tracking-wider">
            2026
          </p>

          {data.roundInfo && (
            <div className="mt-5 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.06] backdrop-blur-sm border border-white/[0.08]">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white/60 text-xs font-sans">{data.roundInfo}</span>
            </div>
          )}

          <p className="text-white/25 text-[11px] mt-3 flex items-center justify-center gap-1.5 font-sans">
            Updated {formatTime(data.lastUpdated)}
            {data.loading && <RefreshCw className="w-3 h-3 animate-spin" />}
          </p>
        </div>

        {/* Torn-paper edge transition */}
        <svg
          className="absolute bottom-0 left-0 right-0 w-full"
          viewBox="0 0 1200 40"
          fill="none"
          preserveAspectRatio="none"
          style={{ height: '20px' }}
        >
          <path
            d="M0,40 L0,18 Q30,22 60,16 Q90,10 120,14 Q150,18 180,12 Q210,6 240,10 Q270,14 300,8 Q330,2 360,6 Q390,10 420,4 Q450,0 480,4 Q510,8 540,2 Q570,0 600,6 Q630,12 660,8 Q690,4 720,10 Q750,16 780,10 Q810,4 840,8 Q870,12 900,6 Q930,0 960,4 Q990,8 1020,2 Q1050,0 1080,6 Q1110,12 1140,8 Q1170,4 1200,10 L1200,40 Z"
            fill="#faf6ed"
          />
        </svg>
      </header>

      {/* ─── Paper tab navigation ─── */}
      <div className="sticky top-0 z-30">
        <div className="bg-masters-cream border-b border-masters-green/[0.06]">
          <div className="max-w-2xl mx-auto px-4">
            <div className="flex gap-1 pt-1">
              {(['golfers', 'teams'] as Tab[]).map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`paper-tab ${isActive ? 'paper-tab-active z-10' : 'paper-tab-inactive'}`}
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      {tab === 'golfers' ? (
                        <Flag className="w-3.5 h-3.5" />
                      ) : (
                        <Trophy className="w-3.5 h-3.5" />
                      )}
                      {tab === 'golfers' ? 'Leaderboard' : 'Teams'}
                    </span>
                    {/* Active tab Masters green accent line */}
                    {isActive && (
                      <motion.div
                        layoutId="tab-accent"
                        className="absolute top-0 left-2 right-2 h-[3px] bg-masters-green rounded-b-full"
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Content ─── */}
      <main className="max-w-2xl mx-auto px-4 py-5 pb-12">
        {data.error && (
          <div className="paper-card p-4 mb-4 bg-red-50 border-l-4 border-red-400">
            <p className="text-sm font-medium text-red-700">Could not load scores</p>
            <p className="text-xs text-red-500 mt-1">{data.error}</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            {activeTab === 'golfers' ? (
              <GolferLeaderboard golfers={data.golfers} loading={data.loading} />
            ) : (
              <TeamLeaderboard teams={data.teams} loading={data.loading} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t border-masters-green/[0.06]">
        <div className="max-w-2xl mx-auto px-4 py-8 text-center">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="h-px w-6 bg-gradient-to-r from-transparent to-masters-green/20" />
            <Flag className="w-3 h-3 text-masters-green/20" />
            <div className="h-px w-6 bg-gradient-to-l from-transparent to-masters-green/20" />
          </div>
          <p className="text-[11px] text-gray-400 font-sans">
            Scores via ESPN &middot; Refreshes every 60s
          </p>
          <p className="text-[11px] text-masters-green/30 font-display italic mt-2">
            A tradition unlike any other
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
