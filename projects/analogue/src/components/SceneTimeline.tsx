import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { SceneNode } from '../types/manuscript'

interface SceneTimelineProps {
  scenes: SceneNode[]
  currentSceneId: string
  currentChapterId: string | null
}

export default function SceneTimeline({
  scenes,
  currentSceneId,
  currentChapterId
}: SceneTimelineProps) {
  const navigate = useNavigate()

  // Filter to current chapter's scenes, sorted by scene number
  const chapterScenes = scenes
    .filter(s => s.chapterId === currentChapterId)
    .sort((a, b) => (a.sceneNumber || 0) - (b.sceneNumber || 0))

  // If no chapter grouping, show all scenes
  const displayScenes = chapterScenes.length > 0 ? chapterScenes : scenes

  const currentIndex = displayScenes.findIndex(s => s.id === currentSceneId)
  const currentScene = displayScenes[currentIndex]

  const getStatusColor = (scene: SceneNode, isCurrent: boolean) => {
    if (isCurrent) return 'bg-white'
    switch (scene.validationStatus) {
      case 'green': return 'bg-status-green'
      case 'yellow': return 'bg-status-yellow'
      case 'red': return 'bg-status-red'
      default:
        // Fallback based on content
        if (!scene.prose || scene.prose.trim() === '') return 'bg-ink-700'
        return 'bg-ink-500'
    }
  }

  const getStatusRing = (scene: SceneNode, isCurrent: boolean) => {
    if (!isCurrent) return ''
    switch (scene.validationStatus) {
      case 'green': return 'ring-2 ring-status-green ring-offset-2 ring-offset-ink-900'
      case 'yellow': return 'ring-2 ring-status-yellow ring-offset-2 ring-offset-ink-900'
      case 'red': return 'ring-2 ring-status-red ring-offset-2 ring-offset-ink-900'
      default: return 'ring-2 ring-ink-500 ring-offset-2 ring-offset-ink-900'
    }
  }

  return (
    <div
      className="px-3 py-1.5 bg-ink-900/50 border-b border-ink-800"
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      {/* Chapter title and progress */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-ink-500 uppercase tracking-wider">
          {currentScene?.chapterTitle || 'Scenes'}
        </span>
        <span className="text-[10px] text-ink-500">
          {currentIndex + 1} of {displayScenes.length}
        </span>
      </div>

      {/* Timeline track */}
      <div className="relative flex items-center gap-1">
        {/* Connecting line */}
        <div className="absolute left-0 right-0 h-0.5 bg-ink-800 top-1/2 -translate-y-1/2 -z-10" />

        {displayScenes.map((scene) => {
          const isCurrent = scene.id === currentSceneId
          const hasContent = scene.prose && scene.prose.trim().length > 0

          return (
            <motion.button
              key={scene.id}
              onClick={() => navigate(`/edit/${scene.id}`)}
              className={`relative flex-shrink-0 transition-all flex flex-col items-center ${
                isCurrent ? 'z-10' : 'z-0'
              }`}
              whileTap={{ scale: 0.9 }}
              title={scene.title}
            >
              {/* Scene dot */}
              <div
                className={`
                  rounded-full transition-all
                  ${isCurrent ? 'w-3.5 h-3.5' : 'w-2 h-2'}
                  ${getStatusColor(scene, isCurrent)}
                  ${getStatusRing(scene, isCurrent)}
                  ${!hasContent && !isCurrent ? 'opacity-50' : ''}
                `}
              />
            </motion.button>
          )
        })}

        {/* Spacer for overflow scrolling */}
        <div className="w-2 flex-shrink-0" />
      </div>
    </div>
  )
}
