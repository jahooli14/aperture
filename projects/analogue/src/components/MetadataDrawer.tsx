import { useState } from 'react'
import { X } from 'lucide-react'
import { SceneNode } from '../types/manuscript'
import QuickBeatInput from './QuickBeatInput'
import CharacterChips from './CharacterChips'
import MotifTagSelector from './MotifTagSelector'
import SceneTimeline from './SceneTimeline'
import ChecklistHeader from './ChecklistHeader'

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
  onRedoPulseCheck: () => void
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
  onRedoPulseCheck,
  currentSceneIndex,
  totalScenes,
  allScenes,
}: MetadataDrawerProps) {
  const [activeTab, setActiveTab] = useState<'scene' | 'review' | 'settings'>('scene')

  const flaggedGlasses = scene.glassesmentions?.filter(m => m.flagged) || []

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
            onClick={() => setActiveTab('review')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'review'
                ? 'text-ink-50 border-b-2 border-ink-50'
                : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            Review
            {flaggedGlasses.length > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-yellow-500 rounded-full" />
            )}
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
            <div className="p-4 space-y-4">
              {/* What happens */}
              <div>
                <label className="block text-sm font-medium text-ink-300 mb-2">
                  What happens in this scene?
                </label>
                <QuickBeatInput
                  scene={scene}
                />
              </div>

              {/* Characters */}
              <div>
                <label className="block text-sm font-medium text-ink-300 mb-2">
                  Characters
                </label>
                <CharacterChips
                  scene={scene}
                  allScenes={allScenes}
                />
              </div>

              {/* Motifs */}
              <div>
                <label className="block text-sm font-medium text-ink-300 mb-2">
                  Motif Tags
                </label>
                <MotifTagSelector
                  scene={scene}
                  allScenes={allScenes}
                />
              </div>

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

              {/* Scene Timeline */}
              <div>
                <label className="block text-sm font-medium text-ink-300 mb-2">
                  Scene Timeline
                </label>
                <SceneTimeline
                  scenes={allScenes}
                  currentSceneId={scene.id}
                  currentChapterId={scene.chapterId || null}
                />
              </div>
            </div>
          )}

          {activeTab === 'review' && (
            <div className="p-4 space-y-4">
              {/* Checklist */}
              <div>
                <label className="block text-sm font-medium text-ink-300 mb-2">
                  Quality Checklist
                </label>
                <ChecklistHeader scene={scene} />
              </div>

              {/* Glasses Mentions */}
              {flaggedGlasses.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-yellow-200 mb-2">
                    Glasses Mentions Review
                  </h3>
                  <p className="text-xs text-yellow-100/80 mb-3">
                    Glasses should be used as a <strong>draw/anchor</strong> (desire, reach for, tempt),
                    not as an <strong>active tool</strong> (wear, look through, see through).
                  </p>

                  <div className="space-y-3">
                    {flaggedGlasses.map((mention) => (
                      <div
                        key={mention.id}
                        className="bg-ink-900/50 rounded p-3 text-sm"
                      >
                        <p className="text-ink-100 italic mb-2">
                          "...{mention.text}..."
                        </p>
                        <p className="text-xs text-yellow-200">
                          This usage may treat glasses as an active tool rather than a metaphorical draw.
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {flaggedGlasses.length === 0 && scene.glassesmentions?.length > 0 && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <p className="text-sm text-green-200">
                    ✓ All glasses mentions are used correctly as draws/anchors
                  </p>
                </div>
              )}

              {scene.glassesmentions?.length === 0 && (
                <div className="bg-ink-800 rounded-lg p-4">
                  <p className="text-sm text-ink-400">
                    No glasses mentions in this scene
                  </p>
                </div>
              )}

              {/* Pulse Check */}
              <div>
                <button
                  onClick={onRedoPulseCheck}
                  className="w-full px-4 py-2 bg-ink-700 hover:bg-ink-600 text-ink-50 rounded font-medium transition-colors"
                >
                  Redo Pulse Check
                </button>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="p-4 space-y-4">
              {/* Text Size */}
              <div>
                <label className="block text-sm font-medium text-ink-300 mb-2">
                  Text Size
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => onTextSizeChange('small')}
                    className={`flex-1 px-4 py-2 rounded font-medium transition-colors ${
                      textSize === 'small'
                        ? 'bg-ink-700 text-ink-50'
                        : 'bg-ink-800 text-ink-400 hover:text-ink-200'
                    }`}
                  >
                    Small
                  </button>
                  <button
                    onClick={() => onTextSizeChange('medium')}
                    className={`flex-1 px-4 py-2 rounded font-medium transition-colors ${
                      textSize === 'medium'
                        ? 'bg-ink-700 text-ink-50'
                        : 'bg-ink-800 text-ink-400 hover:text-ink-200'
                    }`}
                  >
                    Medium
                  </button>
                  <button
                    onClick={() => onTextSizeChange('large')}
                    className={`flex-1 px-4 py-2 rounded font-medium transition-colors ${
                      textSize === 'large'
                        ? 'bg-ink-700 text-ink-50'
                        : 'bg-ink-800 text-ink-400 hover:text-ink-200'
                    }`}
                  >
                    Large
                  </button>
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
