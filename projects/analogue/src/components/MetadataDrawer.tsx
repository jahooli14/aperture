import { useState } from 'react'
import { X } from 'lucide-react'
import { SceneNode } from '../types/manuscript'
import { useManuscriptStore } from '../stores/useManuscriptStore'
import QuickBeatInput from './QuickBeatInput'
import CharacterChips from './CharacterChips'
import MotifTagSelector from './MotifTagSelector'
import SceneTimeline from './SceneTimeline'

interface MetadataDrawerProps {
  isOpen: boolean
  onClose: () => void
  scene: SceneNode
  mode: 'edit' | 'read'
  onModeChange: (mode: 'edit' | 'read') => void
  textSize: 'small' | 'medium' | 'large'
  onTextSizeChange: (size: 'small' | 'medium' | 'large') => void
  focusMode: boolean
  onFocusMode: (enabled: boolean) => void
  onExport: () => void
  currentSceneIndex: number
  totalScenes: number
  allScenes: SceneNode[]
}

export default function MetadataDrawer({
  isOpen,
  onClose,
  scene,
  mode,
  onModeChange,
  textSize,
  onTextSizeChange,
  focusMode,
  onFocusMode,
  onExport,
  currentSceneIndex,
  totalScenes,
  allScenes,
}: MetadataDrawerProps) {
  const [activeTab, setActiveTab] = useState<'scene' | 'settings'>('scene')
  const [timelineExpanded, setTimelineExpanded] = useState(false)
  const { updateScene } = useManuscriptStore()

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 bottom-0 w-full sm:w-96 bg-ink-900 border-l border-ink-700 z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-ink-700">
          <h2 className="text-lg font-semibold text-ink-50">Scene Details</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-ink-800 rounded"
          >
            <X className="w-5 h-5 text-ink-300" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-ink-700">
          <button
            onClick={() => setActiveTab('scene')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'scene'
                ? 'text-ink-50 border-b-2 border-ink-50'
                : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            Scene
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'settings'
                ? 'text-ink-50 border-b-2 border-ink-50'
                : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            Settings
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto" style={{ height: 'calc(100vh - 120px)' }}>
          {activeTab === 'scene' && (
            <div className="p-4 space-y-3">
              {/* Section */}
              <div>
                <label className="block text-xs font-medium text-ink-400 mb-1.5">
                  Section
                </label>
                <select
                  value={scene.section}
                  onChange={(e) => updateScene(scene.id, { section: e.target.value as SceneNode['section'] })}
                  className="w-full px-3 py-2 bg-ink-800 border border-ink-700 rounded text-ink-100 text-sm"
                >
                  {['departure', 'escape', 'rupture', 'alignment', 'reveal'].map(id => (
                    <option key={id} value={id}>
                      {id.charAt(0).toUpperCase() + id.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Scene status */}
              <div>
                <label className="block text-xs font-medium text-ink-400 mb-1.5">
                  Status
                </label>
                <div className="flex gap-2">
                  {(['draft', 'in-progress', 'complete'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => updateScene(scene.id, { status: s })}
                      className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                        scene.status === s
                          ? 'bg-ink-600 text-ink-50'
                          : 'bg-ink-800 text-ink-400 hover:text-ink-200'
                      }`}
                    >
                      {s === 'in-progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* What happens */}
              <QuickBeatInput scene={scene} />

              {/* Characters */}
              <CharacterChips
                scene={scene}
                allScenes={allScenes}
              />

              {/* Motifs */}
              <MotifTagSelector
                scene={scene}
                allScenes={allScenes}
              />

              {/* Scene Timeline - Collapsible */}
              <div className="pt-2">
                <button
                  onClick={() => setTimelineExpanded(!timelineExpanded)}
                  className="text-xs text-ink-400 hover:text-ink-200 transition-colors"
                >
                  {timelineExpanded ? '▼' : '▶'} Scene Timeline
                </button>
                {timelineExpanded && (
                  <div className="mt-2">
                    <SceneTimeline
                      scenes={allScenes}
                      currentSceneId={scene.id}
                      currentChapterId={scene.chapterId || null}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="p-4 space-y-4">
              {/* Mode Toggle */}
              <div>
                <label className="block text-sm font-medium text-ink-300 mb-2">
                  Editing Mode
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => onModeChange('edit')}
                    className={`flex-1 px-4 py-2 rounded font-medium transition-colors ${
                      mode === 'edit'
                        ? 'bg-ink-700 text-ink-50'
                        : 'bg-ink-800 text-ink-400 hover:text-ink-200'
                    }`}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onModeChange('read')}
                    className={`flex-1 px-4 py-2 rounded font-medium transition-colors ${
                      mode === 'read'
                        ? 'bg-ink-700 text-ink-50'
                        : 'bg-ink-800 text-ink-400 hover:text-ink-200'
                    }`}
                  >
                    Read
                  </button>
                </div>
              </div>

              {/* Text Size */}
              <div>
                <label className="block text-sm font-medium text-ink-300 mb-2">
                  Text Size
                </label>
                <div className="flex gap-2">
                  {(['small', 'medium', 'large'] as const).map(size => (
                    <button
                      key={size}
                      onClick={() => onTextSizeChange(size)}
                      className={`flex-1 px-4 py-2 rounded font-medium transition-colors ${
                        textSize === size
                          ? 'bg-ink-700 text-ink-50'
                          : 'bg-ink-800 text-ink-400 hover:text-ink-200'
                      }`}
                    >
                      {size.charAt(0).toUpperCase() + size.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Focus Mode */}
              <div>
                <label className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink-300">Focus Mode</span>
                  <button
                    onClick={() => onFocusMode(!focusMode)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      focusMode ? 'bg-ink-600' : 'bg-ink-800'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        focusMode ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </label>
                <p className="text-xs text-ink-500 mt-1">
                  Hides UI elements when not actively using them
                </p>
              </div>

              {/* Export */}
              <div>
                <button
                  onClick={onExport}
                  className="w-full px-4 py-2 bg-ink-700 hover:bg-ink-600 text-ink-50 rounded font-medium transition-colors"
                >
                  Export Manuscript
                </button>
              </div>

              {/* Scene Info */}
              <div className="pt-4 border-t border-ink-700">
                <p className="text-xs text-ink-500">
                  Scene {currentSceneIndex + 1} of {totalScenes}
                </p>
                <p className="text-xs text-ink-500 mt-1">
                  Words: {scene.prose?.split(/\s+/).filter(Boolean).length || 0}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
