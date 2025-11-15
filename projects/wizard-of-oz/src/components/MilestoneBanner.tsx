import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Info } from 'lucide-react';
import { useSettingsStore } from '../stores/useSettingsStore';
import { getUpcomingMilestones, calculateAgeInWeeks, formatAgeRange, type Milestone } from '../data/milestones';

const DISMISSED_MILESTONES_KEY = 'dismissed-milestones';

export function MilestoneBanner() {
  const { settings } = useSettingsStore();
  const [currentMilestone, setCurrentMilestone] = useState<Milestone | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [dismissedMilestones, setDismissedMilestones] = useState<string[]>([]);

  useEffect(() => {
    // Load dismissed milestones from localStorage
    const dismissed = localStorage.getItem(DISMISSED_MILESTONES_KEY);
    if (dismissed) {
      setDismissedMilestones(JSON.parse(dismissed));
    }
  }, []);

  useEffect(() => {
    if (!settings?.baby_birthdate) return;

    const babyAgeWeeks = calculateAgeInWeeks(settings.baby_birthdate);
    const upcomingMilestones = getUpcomingMilestones(babyAgeWeeks);

    // Filter out dismissed milestones
    const visibleMilestones = upcomingMilestones.filter(
      (m) => !dismissedMilestones.includes(m.id)
    );

    // Show the first non-dismissed milestone
    if (visibleMilestones.length > 0) {
      setCurrentMilestone(visibleMilestones[0]);
    } else {
      setCurrentMilestone(null);
    }
  }, [settings?.baby_birthdate, dismissedMilestones]);

  const handleDismiss = () => {
    if (!currentMilestone) return;

    const newDismissed = [...dismissedMilestones, currentMilestone.id];
    setDismissedMilestones(newDismissed);
    localStorage.setItem(DISMISSED_MILESTONES_KEY, JSON.stringify(newDismissed));
    setCurrentMilestone(null);
  };

  if (!currentMilestone) return null;

  const categoryColors = {
    physical: {
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      text: 'text-purple-800',
      icon: 'text-purple-600',
      badge: 'bg-purple-100 text-purple-700',
    },
    social: {
      bg: 'bg-pink-50',
      border: 'border-pink-200',
      text: 'text-pink-800',
      icon: 'text-pink-600',
      badge: 'bg-pink-100 text-pink-700',
    },
    communication: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      icon: 'text-blue-600',
      badge: 'bg-blue-100 text-blue-700',
    },
    cognitive: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-800',
      icon: 'text-green-600',
      badge: 'bg-green-100 text-green-700',
    },
  };

  const colors = categoryColors[currentMilestone.category];

  const categoryLabels = {
    physical: 'Physical',
    social: 'Social',
    communication: 'Communication',
    cognitive: 'Learning',
  };

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`${colors.bg} ${colors.border} border rounded-xl p-4 mb-6 relative`}
        >
          <button
            onClick={handleDismiss}
            className={`absolute top-2 right-2 p-1 ${colors.text} hover:opacity-70 transition-opacity rounded-full`}
            aria-label="Dismiss milestone"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-3 pr-8">
            <div className="text-4xl flex-shrink-0" aria-hidden="true">
              {currentMilestone.icon}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
                  {categoryLabels[currentMilestone.category]}
                </span>
                <span className={`text-xs ${colors.text} opacity-80`}>
                  {formatAgeRange(
                    currentMilestone.ageRangeWeeks.start,
                    currentMilestone.ageRangeWeeks.end
                  )}
                </span>
              </div>

              <h3 className={`font-semibold ${colors.text} mb-1`}>
                {currentMilestone.title}
              </h3>

              <p className={`text-sm ${colors.text} opacity-90`}>
                {currentMilestone.description}
              </p>

              <button
                onClick={() => setShowInfo(true)}
                className={`mt-2 text-xs ${colors.icon} hover:underline flex items-center gap-1`}
              >
                <Info className="w-3 h-3" />
                About milestones
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Info Modal */}
      <AnimatePresence>
        {showInfo && (
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowInfo(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">About Developmental Milestones</h2>
                <button
                  onClick={() => setShowInfo(false)}
                  className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-sm text-gray-700">
                <p className="font-semibold text-gray-900">
                  Every baby is unique and develops at their own pace.
                </p>

                <p>
                  These milestones are based on NHS guidance and represent a rough guide to
                  typical development - not a checklist or test.
                </p>

                <p>
                  There's a wide range of normal development. Some babies reach milestones
                  earlier, some later. Both are perfectly normal!
                </p>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    <strong>💡 Remember:</strong> If you have any concerns about your baby's
                    development, speak to your health visitor or GP. They're there to support
                    you, not to judge.
                  </p>
                </div>

                <p className="text-xs text-gray-600">
                  Source: NHS Start4Life and NHS.uk developmental guidance
                </p>
              </div>

              <button
                onClick={() => setShowInfo(false)}
                className="mt-6 w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                Got it
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
