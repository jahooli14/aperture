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
    <div className="min-h-screen bg-masters-cream">
      {/* ─── Header ─── */}
      <header className="relative overflow-hidden bg-gradient-to-br from-masters-green-dark via-masters-green to-masters-green-light header-pattern">
        {/* Dark overlay at bottom for depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/10 pointer-events-none" />

        <div className="relative max-w-2xl mx-auto px-4 pt-8 pb-10 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Flag className="w-5 h-5 text-masters-yellow" />
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Masters Pool
            </h1>
            <Flag className="w-5 h-5 text-masters-yellow" />
          </div>

          <p className="text-masters-yellow/90 font-display text-lg font-semibold">
            Augusta National 2026
          </p>

          {data.roundInfo && (
            <p className="text-white/60 text-sm mt-1">{data.roundInfo}</p>
          )}

          <p className="text-white/40 text-xs mt-3 flex items-center justify-center gap-1">
            Updated {formatTime(data.lastUpdated)}
            {data.loading && <RefreshCw className="w-3 h-3 animate-spin" />}
          </p>
        </div>

        {/* Decorative wave transition to cream background */}
        <svg
          className="absolute bottom-0 left-0 right-0 w-full"
          viewBox="0 0 1440 28"
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            d="M0 28L80 23C160 18 320 8 480 4C640 0 800 2 960 7C1120 12 1280 20 1360 24L1440 28V28H0Z"
            fill="#faf6ed"
          />
        </svg>
      </header>

      {/* ─── Tab bar ─── */}
      <nav className="sticky top-0 z-30 bg-white/90 backdrop-blur-md shadow-sm">
        <div className="max-w-2xl mx-auto px-4">
          <div className="relative flex">
            {(['golfers', 'teams'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3.5 text-xs font-semibold tracking-widest uppercase transition-colors duration-200 ${
                  activeTab === tab ? 'text-masters-green' : 'text-gray-400 hover:text-gray-500'
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">
                  {tab === 'golfers' ? (
                    <Flag className="w-3.5 h-3.5" />
                  ) : (
                    <Trophy className="w-3.5 h-3.5" />
                  )}
                  {tab === 'golfers' ? 'Leaderboard' : 'Teams'}
                </span>
              </button>
            ))}

            {/* Animated yellow underline */}
            <motion.div
              className="absolute bottom-0 h-[3px] bg-masters-yellow rounded-full"
              animate={{ left: activeTab === 'golfers' ? '0%' : '50%', width: '50%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          </div>
        </div>
      </nav>

      {/* ─── Content ─── */}
      <main className="max-w-2xl mx-auto px-4 py-5 pb-10">
        {data.error && (
          <div className="paper-card p-4 mb-4 bg-red-50 border-l-4 border-red-400">
            <p className="text-sm font-medium text-red-700">Could not load scores</p>
            <p className="text-xs text-red-500 mt-1">{data.error}</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
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
      <footer className="text-center py-6 text-[11px] text-gray-400 font-sans">
        Scores via ESPN &middot; Refreshes every 60 s
      </footer>
    </div>
  );
}

export default App;
