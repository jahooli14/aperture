import { useState } from 'react';
import { motion } from 'framer-motion';
import { Info } from 'lucide-react';
import { useSettingsStore } from '../stores/useSettingsStore';
import { milestones, calculateAgeInWeeks, formatAgeRange, type Milestone } from '../data/milestones';

export function MilestonesView() {
  const { settings } = useSettingsStore();
  const [showInfo, setShowInfo] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>('all');

  const babyAgeWeeks = settings?.baby_birthdate ? calculateAgeInWeeks(settings.baby_birthdate) : 0;

  // Group milestones by category
  const milestonesByCategory = {
    physical: milestones.filter((m) => m.category === 'physical'),
    social: milestones.filter((m) => m.category === 'social'),
    communication: milestones.filter((m) => m.category === 'communication'),
    cognitive: milestones.filter((m) => m.category === 'cognitive'),
  };

  const categoryInfo = {
    physical: {
      label: 'Physical Development',
      description: 'Movement, coordination, and motor skills',
      color: 'purple',
    },
    social: {
      label: 'Social Development',
      description: 'Interactions, relationships, and emotional responses',
      color: 'pink',
    },
    communication: {
      label: 'Communication',
      description: 'Language, sounds, and expressing needs',
      color: 'blue',
    },
    cognitive: {
      label: 'Learning & Thinking',
      description: 'Problem-solving, understanding, and imagination',
      color: 'green',
    },
  };

  const getMilestoneStatus = (milestone: Milestone): 'upcoming' | 'current' | 'past' => {
    if (babyAgeWeeks < milestone.ageRangeWeeks.start - milestone.advanceNoticeWeeks) {
      return 'upcoming';
    } else if (babyAgeWeeks <= milestone.ageRangeWeeks.end) {
      return 'current';
    } else {
      return 'past';
    }
  };

  const getColorClasses = (color: string, status: 'upcoming' | 'current' | 'past') => {
    const opacity = status === 'past' ? 'opacity-50' : status === 'current' ? '' : 'opacity-75';

    const colors: Record<string, any> = {
      purple: {
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        text: 'text-purple-800',
        badge: 'bg-purple-100 text-purple-700',
      },
      pink: {
        bg: 'bg-pink-50',
        border: 'border-pink-200',
        text: 'text-pink-800',
        badge: 'bg-pink-100 text-pink-700',
      },
      blue: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-800',
        badge: 'bg-blue-100 text-blue-700',
      },
      green: {
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-800',
        badge: 'bg-green-100 text-green-700',
      },
    };

    return { ...colors[color], opacity };
  };

  const renderMilestone = (milestone: Milestone, color: string) => {
    const status = getMilestoneStatus(milestone);
    const colors = getColorClasses(color, status);

    return (
      <motion.div
        key={milestone.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${colors.bg} ${colors.border} border rounded-lg p-4 ${colors.opacity}`}
      >
        <div className="flex items-start gap-3">
          <div className="text-3xl flex-shrink-0" aria-hidden="true">
            {milestone.icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.badge}`}>
                {formatAgeRange(milestone.ageRangeWeeks.start, milestone.ageRangeWeeks.end)}
              </span>
              {status === 'current' && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700">
                  ✨ Look out for this
                </span>
              )}
            </div>

            <h4 className={`font-semibold ${colors.text} mb-1`}>{milestone.title}</h4>
            <p className={`text-sm ${colors.text} opacity-90`}>{milestone.description}</p>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Developmental Milestones</h2>
        <p className="text-gray-600 text-sm mb-4">
          Based on NHS guidance. Every baby develops at their own pace - these are rough guides, not a checklist.
        </p>

        <button
          onClick={() => setShowInfo(true)}
          className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          <Info className="w-4 h-4" />
          Important information about milestones
        </button>
      </div>

      {/* Category Filter */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setExpandedCategory('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              expandedCategory === 'all'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Milestones
          </button>
          {Object.entries(categoryInfo).map(([key, info]) => (
            <button
              key={key}
              onClick={() => setExpandedCategory(expandedCategory === key ? null : key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                expandedCategory === key
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {info.label}
            </button>
          ))}
        </div>
      </div>

      {/* Milestones List */}
      <div className="space-y-6">
        {(expandedCategory === 'all'
          ? Object.entries(milestonesByCategory)
          : [[expandedCategory, milestonesByCategory[expandedCategory as keyof typeof milestonesByCategory]]]
        ).map(([category, categoryMilestones]) => {
          const info = categoryInfo[category as keyof typeof categoryInfo];
          if (!categoryMilestones || !Array.isArray(categoryMilestones)) return null;

          return (
            <div key={String(category)} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900 mb-1">{info.label}</h3>
                <p className="text-sm text-gray-600">{info.description}</p>
              </div>

              <div className="space-y-3">
                {categoryMilestones.map((milestone: Milestone) =>
                  renderMilestone(milestone, info.color)
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info about baby's age */}
      {settings?.baby_birthdate && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Your baby is approximately {Math.floor(babyAgeWeeks / 4)} months old.</strong>{' '}
            Milestones highlighted with ✨ are in your baby's current age range.
          </p>
        </div>
      )}

      {/* Info Modal */}
      {showInfo && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowInfo(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
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
                <Info className="w-5 h-5" />
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

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800">
                  <strong>⚠️ Important:</strong> These milestones are for information only.
                  If you have any concerns about your baby's development, always speak to
                  your health visitor or GP.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  <strong>💡 Did you know?</strong> Not all babies crawl - some shuffle on
                  their bottoms instead, and that's completely normal! Every child finds
                  their own way to develop.
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
    </div>
  );
}
