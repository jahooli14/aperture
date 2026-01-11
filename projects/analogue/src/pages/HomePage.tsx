import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, BookOpen, Feather, Upload } from 'lucide-react'
import { useManuscriptStore } from '../stores/useManuscriptStore'
import ImportModal, { type ImportedScene } from '../components/ImportModal'

export default function HomePage() {
  const navigate = useNavigate()
  const { manuscript, createManuscript, importScenes } = useManuscriptStore()
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [title, setTitle] = useState('')
  const [protagonistName, setProtagonistName] = useState('')

  const handleCreate = async () => {
    if (!title.trim()) return
    await createManuscript(title.trim(), protagonistName.trim())
    navigate('/toc')
  }

  const handleImport = async (scenes: ImportedScene[]) => {
    if (!title.trim()) {
      setTitle('Imported Manuscript')
    }
    await createManuscript(title.trim() || 'Imported Manuscript', protagonistName.trim())
    await importScenes(scenes)
    setShowImport(false)
    navigate('/toc')
  }

  const handleContinue = () => {
    if (manuscript) {
      navigate('/toc')
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 pt-safe pb-safe">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <Feather className="w-12 h-12 text-ink-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-ink-100 mb-2">Analogue</h1>
        <p className="text-ink-400 text-sm">Manuscript IDE</p>
      </motion.div>

      {!showCreate ? (
        <div className="w-full max-w-xs space-y-4">
          {manuscript && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={handleContinue}
              className="w-full flex items-center gap-3 p-4 bg-ink-900 border border-ink-700 rounded-lg text-left"
            >
              <BookOpen className="w-5 h-5 text-section-departure" />
              <div className="flex-1 min-w-0">
                <div className="text-ink-100 font-medium truncate">
                  {manuscript.title}
                </div>
                <div className="text-ink-500 text-xs">
                  {manuscript.totalWordCount.toLocaleString()} words · {manuscript.scenes.length} scenes
                </div>
              </div>
            </motion.button>
          )}

          <button
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center justify-center gap-2 p-4 border border-dashed border-ink-600 rounded-lg text-ink-400 hover:text-ink-200 hover:border-ink-400 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>New Manuscript</span>
          </button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-xs space-y-4"
        >
          <div>
            <label className="block text-xs text-ink-500 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled Manuscript"
              className="w-full p-3 bg-ink-900 border border-ink-700 rounded-lg text-ink-100 placeholder:text-ink-600"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs text-ink-500 mb-1">
              Protagonist's Real Name (for YYYY mask)
            </label>
            <input
              type="text"
              value={protagonistName}
              onChange={(e) => setProtagonistName(e.target.value)}
              placeholder="Optional"
              className="w-full p-3 bg-ink-900 border border-ink-700 rounded-lg text-ink-100 placeholder:text-ink-600"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setShowCreate(false)}
              className="flex-1 p-3 border border-ink-700 rounded-lg text-ink-400"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!title.trim()}
              className="flex-1 p-3 bg-section-departure rounded-lg text-white font-medium disabled:opacity-50"
            >
              Create
            </button>
          </div>

          {/* Import option */}
          <button
            onClick={() => setShowImport(true)}
            className="w-full flex items-center justify-center gap-2 p-3 bg-ink-800 rounded-lg text-ink-300 hover:text-ink-100 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span className="text-sm">Import existing manuscript</span>
          </button>
        </motion.div>
      )}

      {/* Import Modal */}
      <AnimatePresence>
        {showImport && (
          <ImportModal
            onImport={handleImport}
            onClose={() => setShowImport(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
