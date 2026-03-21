import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Bookmark, Trash2, RotateCcw, BookMarked } from 'lucide-react'
import { useVersionStore } from '../stores/useVersionStore'
import { useManuscriptStore } from '../stores/useManuscriptStore'
import type { ManuscriptVersion } from '../stores/useVersionStore'

interface Props {
  onClose: () => void
}

export default function VersionsPanel({ onClose }: Props) {
  const { versions, isLoading, error, loadVersions, saveVersion, deleteVersion, clearError } = useVersionStore()
  const { manuscript, updateScene } = useManuscriptStore()
  const [nameInput, setNameInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [confirmRestore, setConfirmRestore] = useState<ManuscriptVersion | null>(null)

  useEffect(() => {
    loadVersions()
  }, [])

  if (!manuscript) return null

  const handleSave = async () => {
    setSaving(true)
    await saveVersion(nameInput, manuscript)
    setNameInput('')
    setSaving(false)
  }

  const handleRestore = async (version: ManuscriptVersion) => {
    setRestoring(version.id)
    const currentSceneIds = new Set(manuscript.scenes.map(s => s.id))

    for (const snap of version.scenes) {
      if (!currentSceneIds.has(snap.id)) continue
      await updateScene(snap.id, {
        prose: snap.prose,
        footnotes: snap.footnotes,
        section: snap.section,
        order: snap.order,
        sceneBeat: snap.sceneBeat,
      })
    }

    setRestoring(null)
    setConfirmRestore(null)
    onClose()
  }

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-50 flex flex-col bg-ink-950"
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-ink-800 pt-safe">
        <BookMarked className="w-5 h-5 text-amber-400" />
        <div className="flex-1">
          <div className="text-sm font-medium text-ink-100">Versions</div>
          <div className="text-xs text-ink-500">Saved checkpoints you can restore</div>
        </div>
        <button onClick={onClose} className="p-2 text-ink-500 hover:text-ink-300">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Save new version */}
      <div className="p-4 border-b border-ink-800">
        <p className="text-xs text-ink-500 mb-2">Save a checkpoint before making big changes</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="Name this version (optional)…"
            className="flex-1 px-3 py-2 bg-ink-900 border border-ink-700 rounded-xl text-sm text-ink-100 placeholder:text-ink-600 focus:outline-none focus:border-amber-600/50"
          />
          <button
            onClick={handleSave}
            disabled={saving || isLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 rounded-xl text-sm text-white font-medium disabled:opacity-50"
          >
            <Bookmark className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 px-3 py-2 bg-red-950/50 border border-red-800/50 rounded-lg text-xs text-red-400 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button onClick={clearError}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Version list */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
        {isLoading && versions.length === 0 && (
          <p className="text-sm text-ink-600 text-center py-8">Loading…</p>
        )}
        {!isLoading && versions.length === 0 && (
          <div className="text-center py-12">
            <BookMarked className="w-8 h-8 text-ink-800 mx-auto mb-3" />
            <p className="text-sm text-ink-600">No saved versions yet.</p>
            <p className="text-xs text-ink-700 mt-1">Save a checkpoint before letting AI rewrite your manuscript.</p>
          </div>
        )}
        {versions.map(version => (
          <div
            key={version.id}
            className="p-3 bg-ink-900 border border-ink-800 rounded-xl"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-100 truncate">{version.name}</p>
                <p className="text-xs text-ink-500 mt-0.5">
                  {new Date(version.timestamp).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                  {' · '}
                  {new Date(version.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-xs text-ink-600 mt-1">
                  {version.wordCount.toLocaleString()} words · {version.sceneCount} scenes
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => setConfirmRestore(version)}
                  disabled={restoring !== null}
                  title="Restore this version"
                  className="p-2 text-amber-500/70 hover:text-amber-400 disabled:opacity-40"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setConfirmDelete(version.id)}
                  title="Delete this version"
                  className="p-2 text-ink-600 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Confirm restore dialog */}
      <AnimatePresence>
        {confirmRestore && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex items-end bg-black/60"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-full bg-ink-900 rounded-t-2xl p-5 pb-safe"
            >
              <p className="text-sm font-medium text-ink-100 mb-1">Restore "{confirmRestore.name}"?</p>
              <p className="text-xs text-ink-400 mb-4 leading-relaxed">
                Prose and structure will be restored for scenes that still exist. Scenes added after this checkpoint won't be touched.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmRestore(null)}
                  className="flex-1 py-2.5 bg-ink-800 rounded-xl text-sm text-ink-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRestore(confirmRestore)}
                  disabled={restoring !== null}
                  className="flex-1 py-2.5 bg-amber-600 rounded-xl text-sm text-white font-medium disabled:opacity-50"
                >
                  {restoring ? 'Restoring…' : 'Restore'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm delete dialog */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex items-end bg-black/60"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-full bg-ink-900 rounded-t-2xl p-5 pb-safe"
            >
              <p className="text-sm font-medium text-ink-100 mb-1">Delete this version?</p>
              <p className="text-xs text-ink-400 mb-4">This can't be undone.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-2.5 bg-ink-800 rounded-xl text-sm text-ink-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { deleteVersion(confirmDelete); setConfirmDelete(null) }}
                  className="flex-1 py-2.5 bg-red-800 rounded-xl text-sm text-white font-medium"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
