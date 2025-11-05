import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, Check, Calendar, Camera, X } from 'lucide-react';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useMilestoneStore } from '../stores/useMilestoneStore';
import { usePhotoStore } from '../stores/usePhotoStore';
import { milestones, calculateAgeInWeeks, formatAgeRange, type Milestone } from '../data/milestones';

export function MilestonesView() {
  const { settings } = useSettingsStore();
  const { fetchAchievements, addAchievement, deleteAchievement, isAchieved, getAchievement, error: milestoneError, loading: milestoneLoading } = useMilestoneStore();
  const { photos } = usePhotoStore();
  const [showInfo, setShowInfo] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>('all');
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [achievementDate, setAchievementDate] = useState('');
  const [achievementNotes, setAchievementNotes] = useState('');
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);

  // Fetch achievements on mount
  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

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

  const handleMilestoneClick = (milestone: Milestone) => {
    if (isAchieved(milestone.id)) {
      // If already achieved, allow user to uncheck
      const achievement = getAchievement(milestone.id);
      if (achievement && confirm(`Unmark "${milestone.title}"?`)) {
        deleteAchievement(achievement.id);
      }
    } else {
      // Open achievement dialog
      setSelectedMilestone(milestone);
      setAchievementDate(new Date().toISOString().split('T')[0]); // Default to today
      setAchievementNotes('');
      setSelectedPhotoId(null);
    }
  };

  const handleSaveAchievement = async () => {
    if (!selectedMilestone || !achievementDate) return;

    try {
      await addAchievement({
        milestone_id: selectedMilestone.id,
        achieved_date: achievementDate,
        photo_id: selectedPhotoId === '' ? null : selectedPhotoId,
        notes: achievementNotes.trim() || null,
      });

      // Success - close dialog and reset form
      setSelectedMilestone(null);
      setAchievementDate('');
      setAchievementNotes('');
      setSelectedPhotoId(null);
    } catch (error) {
      console.error('Failed to save achievement:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to save milestone: ${errorMessage}\n\nPlease check the console for more details.`);
    }
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
    const achieved = isAchieved(milestone.id);
    const achievement = getAchievement(milestone.id);

    return (
      <motion.button
        key={milestone.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => handleMilestoneClick(milestone)}
        className={`${colors.bg} ${colors.border} border rounded-lg p-4 ${colors.opacity} w-full text-left transition-all hover:shadow-md ${
          achieved ? 'ring-2 ring-green-500' : ''
        }`}
      >
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <div className="flex-shrink-0 mt-1">
            <div
              className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                achieved
                  ? 'bg-green-500 border-green-500'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              {achieved && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
            </div>
          </div>

          <div className="text-3xl flex-shrink-0" aria-hidden="true">
            {milestone.icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.badge}`}>
                {formatAgeRange(milestone.ageRangeWeeks.start, milestone.ageRangeWeeks.end)}
              </span>
              {status === 'current' && !achieved && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700">
                  ✨ Look out for this
                </span>
              )}
              {achieved && achievement && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                  ✓ Achieved {new Date(achievement.achieved_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
            </div>

            <h4 className={`font-semibold ${colors.text} mb-1 ${achieved ? 'line-through' : ''}`}>
              {milestone.title}
            </h4>
            <p className={`text-sm ${colors.text} opacity-90`}>{milestone.description}</p>

            {/* Show photo and notes if tagged */}
            {achieved && achievement && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                {achievement.photo_id && (
                  <span className="flex items-center gap-1 bg-white/50 px-2 py-1 rounded">
                    <Camera className="w-3 h-3" />
                    Photo attached
                  </span>
                )}
                {achievement.notes && (
                  <span className="bg-white/50 px-2 py-1 rounded italic">
                    "{achievement.notes}"
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.button>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Migration Error Banner */}
      {milestoneError && milestoneError.includes('table has not been created') && (
        <div className="mb-6 p-6 bg-red-50 border-2 border-red-200 rounded-lg">
          <h3 className="text-lg font-bold text-red-900 mb-2">⚙️ Setup Required</h3>
          <p className="text-sm text-red-800 mb-4">
            The milestones feature requires a database migration to be run.
          </p>
          <div className="bg-white p-4 rounded border border-red-200">
            <p className="text-sm font-semibold text-gray-900 mb-2">To fix this:</p>
            <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
              <li>Go to your <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Supabase Dashboard</a></li>
              <li>Open the SQL Editor</li>
              <li>Copy and run the contents of <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">supabase/migrations/006_add_milestone_tracking.sql</code></li>
              <li>Reload this page</li>
            </ol>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm font-semibold"
          >
            Reload Page
          </button>
        </div>
      )}

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

      {/* Achievement Dialog */}
      <AnimatePresence>
        {selectedMilestone && (
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedMilestone(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selectedMilestone.icon}</span>
                  <h2 className="text-xl font-bold text-gray-900">Mark as Achieved</h2>
                </div>
                <button
                  onClick={() => setSelectedMilestone(null)}
                  className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <h3 className="font-semibold text-gray-900 mb-4">{selectedMilestone.title}</h3>

              <div className="space-y-4">
                {/* Date picker */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    When did this happen?
                  </label>
                  <input
                    type="date"
                    value={achievementDate}
                    onChange={(e) => setAchievementDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                  />
                </div>

                {/* Photo picker */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Camera className="w-4 h-4 inline mr-1" />
                    Link to a photo (optional)
                  </label>
                  <select
                    value={selectedPhotoId || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSelectedPhotoId(value === '' ? null : value);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                  >
                    <option value="">No photo</option>
                    {photos.map((photo) => (
                      <option key={photo.id} value={photo.id}>
                        {new Date(photo.upload_date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (optional)
                  </label>
                  <textarea
                    value={achievementNotes}
                    onChange={(e) => setAchievementNotes(e.target.value)}
                    placeholder="Add any details about this milestone..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setSelectedMilestone(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAchievement}
                  disabled={!achievementDate}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
