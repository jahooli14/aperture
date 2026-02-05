import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ChevronRight,
  Clock,
  Target,
  TrendingUp,
  BookOpen,
  Edit3,
  ArrowLeft
} from 'lucide-react'
import type { ManuscriptState, NarrativeSection } from '../types/manuscript'

interface StoryDashboardProps {
  manuscript: ManuscriptState
  onBack: () => void
}

const SECTION_INFO: Record<NarrativeSection, { label: string; color: string; target: number }> = {
  departure: { label: 'Departure', color: 'text-blue-400', target: 15000 },
  escape: { label: 'The Escape', color: 'text-green-400', target: 12000 },
  rupture: { label: 'The Rupture', color: 'text-red-400', target: 8000 },
  alignment: { label: 'The Alignment', color: 'text-purple-400', target: 10000 },
  reveal: { label: 'The Reveal', color: 'text-amber-400', target: 10000 }
}

export default function StoryDashboard({ manuscript, onBack }: StoryDashboardProps) {
  const navigate = useNavigate()

  // Calculate progress by section
  const sectionProgress = (['departure', 'escape', 'rupture', 'alignment', 'reveal'] as NarrativeSection[]).map(section => {
    const scenesInSection = manuscript.scenes.filter(s => s.section === section)
    const words = scenesInSection.reduce((sum, s) => sum + s.wordCount, 0)
    const target = SECTION_INFO[section].target
    const progress = Math.min(100, (words / target) * 100)
    const completed = scenesInSection.filter(s => s.status === 'complete').length

    return {
      section,
      label: SECTION_INFO[section].label,
      color: SECTION_INFO[section].color,
      words,
      target,
      progress,
      sceneCount: scenesInSection.length,
      completedScenes: completed
    }
  })

  // Last edited info
  const lastEditedScene = manuscript.lastEditedSceneId
    ? manuscript.scenes.find(s => s.id === manuscript.lastEditedSceneId)
    : null

  const formatLastEdited = () => {
    if (!manuscript.lastEditedAt) return null
    const date = new Date(manuscript.lastEditedAt)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  // This week's writing
  const thisWeekWords = manuscript.sessions
    .filter(s => {
      const sessionDate = new Date(s.date)
      const now = new Date()
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return sessionDate >= weekAgo
    })
    .reduce((sum, s) => sum + s.wordsAdded, 0)

  // Quick win: find scenes that need attention
  const needsAttention = manuscript.scenes
    .filter(s => s.validationStatus === 'red' || s.validationStatus === 'yellow')
    .slice(0, 3)

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-ink-800">
        <button onClick={onBack} className="p-2 -ml-2">
          <ArrowLeft className="w-5 h-5 text-ink-400" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-ink-50 truncate">{manuscript.title}</h1>
          <p className="text-xs text-ink-500">{manuscript.totalWordCount.toLocaleString()} words total</p>
        </div>
        <button
          onClick={() => navigate('/toc')}
          className="px-3 py-1.5 bg-ink-800 rounded-lg text-xs text-ink-300 hover:text-ink-100"
        >
          Open
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-safe">
        {/* Quick Resume */}
        {lastEditedScene && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => navigate(`/edit/${lastEditedScene.id}`)}
            className="w-full p-4 bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-800/50 rounded-xl text-left"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Edit3 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span className="text-xs text-blue-400 font-medium">Continue writing</span>
                </div>
                <h3 className="text-sm font-medium text-ink-100 mb-1 truncate">
                  {lastEditedScene.title}
                </h3>
                <div className="text-xs text-ink-500">
                  {formatLastEdited()} • {lastEditedScene.wordCount} words
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-blue-400 flex-shrink-0" />
            </div>
          </motion.button>
        )}

        {/* This Week */}
        {thisWeekWords > 0 && (
          <div className="p-4 bg-ink-900/50 border border-ink-800 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <h3 className="text-sm font-medium text-ink-300">This Week</h3>
            </div>
            <div className="text-2xl font-bold text-ink-100">
              {thisWeekWords.toLocaleString()}
            </div>
            <div className="text-xs text-ink-500">words written</div>
          </div>
        )}

        {/* Progress by Section */}
        <div>
          <div className="flex items-center gap-2 mb-3 px-1">
            <Target className="w-4 h-4 text-ink-500" />
            <h3 className="text-sm font-medium text-ink-300">Progress</h3>
          </div>
          <div className="space-y-3">
            {sectionProgress.map((section) => (
              <div key={section.section} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className={section.color}>{section.label}</span>
                  <span className="text-ink-500">
                    {section.words.toLocaleString()} / {section.target.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 bg-ink-900 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${section.progress}%` }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                    style={{
                      opacity: section.progress > 0 ? 1 : 0
                    }}
                  />
                </div>
                <div className="flex items-center gap-3 text-xs text-ink-600">
                  <span>{section.sceneCount} scenes</span>
                  {section.completedScenes > 0 && (
                    <span>• {section.completedScenes} complete</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Wins - Needs Attention */}
        {needsAttention.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3 px-1">
              <Clock className="w-4 h-4 text-ink-500" />
              <h3 className="text-sm font-medium text-ink-300">Quick Fixes</h3>
            </div>
            <div className="space-y-2">
              {needsAttention.map((scene) => (
                <button
                  key={scene.id}
                  onClick={() => navigate(`/edit/${scene.id}`)}
                  className="w-full p-3 bg-ink-900/50 border border-ink-800 rounded-lg text-left hover:bg-ink-800/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm text-ink-200 truncate mb-1">{scene.title}</h4>
                      <p className="text-xs text-ink-500">
                        {scene.validationStatus === 'red' ? 'Needs work' : 'Almost there'}
                      </p>
                    </div>
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
                      scene.validationStatus === 'red' ? 'bg-red-500' : 'bg-yellow-500'
                    }`} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* All Scenes */}
        <button
          onClick={() => navigate('/toc')}
          className="w-full p-4 bg-ink-900/30 border border-ink-800 border-dashed rounded-xl text-ink-400 hover:text-ink-200 hover:border-ink-600 transition-colors"
        >
          <div className="flex items-center justify-center gap-2">
            <BookOpen className="w-4 h-4" />
            <span className="text-sm">View All Scenes</span>
          </div>
        </button>
      </div>
    </div>
  )
}
