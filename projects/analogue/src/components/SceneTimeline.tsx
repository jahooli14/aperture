import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { SceneNode } from '../types/manuscript'

interface SceneTimelineProps {
  scenes: SceneNode[]
  currentSceneId: string
  currentChapterId: string | null
}

// Character colors for consistent visual tracking
const characterColors = [
  'bg-section-departure',
  'bg-section-escape',
  'bg-section-rupture',
  'bg-section-alignment',
  'bg-section-reveal',
  'bg-purple-500',
  'bg-pink-500',
  'bg-cyan-500',
]

const getCharacterColor = (name: string) => {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return characterColors[hash % characterColors.length]
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

  // Get all unique characters in the chapter for the legend
  const chapterCharacters = Array.from(
    new Set(displayScenes.flatMap(s => s.charactersPresent || []))
  ).sort()

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
      className="px-4 py-2 bg-ink-900/50 border-b border-ink-800"
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      {/* Chapter title and progress */}
      <div className="flex items-center justify-between mb-2">
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

        {displayScenes.map((scene, index) => {
          const isCurrent = scene.id === currentSceneId
          const hasContent = scene.prose && scene.prose.trim().length > 0
          const characters = scene.charactersPresent || []

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
                  ${isCurrent ? 'w-4 h-4' : 'w-2.5 h-2.5'}
                  ${getStatusColor(scene, isCurrent)}
                  ${getStatusRing(scene, isCurrent)}
                  ${!hasContent && !isCurrent ? 'opacity-50' : ''}
                `}
              />

              {/* Character presence indicators */}
              {characters.length > 0 && (
                <div className="flex items-center gap-px mt-1">
                  {characters.slice(0, 3).map(char => (
                    <div
                      key={char}
                      className={`w-1.5 h-1.5 rounded-full ${getCharacterColor(char)} ${isCurrent ? 'opacity-100' : 'opacity-60'}`}
                      title={char}
                    />
                  ))}
                  {characters.length > 3 && (
                    <span className="text-[7px] text-ink-500 ml-0.5">+{characters.length - 3}</span>
                  )}
                </div>
              )}

              {/* Current scene indicator - small number below */}
              {isCurrent && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-3 whitespace-nowrap"
                >
                  <span className="text-[9px] text-ink-400 max-w-[60px] truncate block text-center">
                    {scene.sceneNumber || index + 1}
                  </span>
                </motion.div>
              )}
            </motion.button>
          )
        })}

        {/* Spacer for overflow scrolling */}
        <div className="w-2 flex-shrink-0" />
      </div>

      {/* Word count bar (proportional) */}
      <div className="flex items-end gap-px mt-4 h-2">
        {displayScenes.map((scene) => {
          const maxWords = Math.max(...displayScenes.map(s => s.wordCount || 1))
          const height = Math.max(2, (scene.wordCount / maxWords) * 8)
          const isCurrent = scene.id === currentSceneId

          return (
            <div
              key={scene.id}
              className={`flex-1 rounded-t transition-all ${
                isCurrent ? 'bg-ink-400' : 'bg-ink-800'
              }`}
              style={{ height: `${height}px` }}
              title={`${scene.wordCount} words`}
            />
          )
        })}
      </div>

      {/* Character legend (if any characters tracked) */}
      {chapterCharacters.length > 0 && (
        <div className="flex items-center gap-2 mt-2 overflow-x-auto scrollbar-hide">
          {chapterCharacters.slice(0, 5).map(char => (
            <div key={char} className="flex items-center gap-1 flex-shrink-0">
              <div className={`w-2 h-2 rounded-full ${getCharacterColor(char)}`} />
              <span className="text-[9px] text-ink-500">{char}</span>
            </div>
          ))}
          {chapterCharacters.length > 5 && (
            <span className="text-[9px] text-ink-600">+{chapterCharacters.length - 5} more</span>
          )}
        </div>
      )}
    </div>
  )
}
