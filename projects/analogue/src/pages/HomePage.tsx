import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, BookOpen, Feather, Upload, Trash2, AlertTriangle, Cloud, CloudOff, RefreshCw, User, LogOut } from 'lucide-react'
import { useManuscriptStore } from '../stores/useManuscriptStore'
import { useAuthStore } from '../stores/useAuthStore'
import { fullSync } from '../lib/sync'
import type { ManuscriptState } from '../types/manuscript'
import ImportModal, { type ImportedScene } from '../components/ImportModal'

export default function HomePage() {
  const navigate = useNavigate()
  const { manuscript, createManuscript, importScenes, loadManuscript, deleteManuscript, getAllManuscripts, clearCurrentManuscript } = useManuscriptStore()
  const { user, isConfigured, signOut } = useAuthStore()

  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [title, setTitle] = useState('')
  const [protagonistName, setProtagonistName] = useState('')
  const [allManuscripts, setAllManuscripts] = useState<ManuscriptState[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  // Load all manuscripts on mount
  useEffect(() => {
    loadAllManuscripts()
  }, [])

  const loadAllManuscripts = async () => {
    const manuscripts = await getAllManuscripts()
    setAllManuscripts(manuscripts)
  }

  const handleCreate = async () => {
    if (!title.trim()) return
    await createManuscript(title.trim(), protagonistName.trim())
    await loadAllManuscripts()
    navigate('/toc')
  }

  const handleImport = async (scenes: ImportedScene[]) => {
    if (!title.trim()) {
      setTitle('Imported Manuscript')
    }
    await createManuscript(title.trim() || 'Imported Manuscript', protagonistName.trim())
    await importScenes(scenes)
    await loadAllManuscripts()
    setShowImport(false)
    navigate('/toc')
  }

  const handleOpenManuscript = async (ms: ManuscriptState) => {
    await loadManuscript(ms.id)
    navigate('/toc')
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    try {
      await deleteManuscript(id)
      await loadAllManuscripts()
      setDeleteConfirm(null)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleStartNew = () => {
    clearCurrentManuscript()
    setShowCreate(true)
  }

  const handleSync = async () => {
    if (!user) return

    setIsSyncing(true)
    setSyncMessage(null)

    try {
      const result = await fullSync(user.id)

      if (result.success) {
        setSyncMessage(`Synced: ${result.downloaded} downloaded, ${result.uploaded} uploaded`)
        await loadAllManuscripts()
      } else {
        setSyncMessage(result.error || 'Sync failed')
      }
    } catch (error) {
      setSyncMessage('Sync failed')
    } finally {
      setIsSyncing(false)
      // Clear message after 3 seconds
      setTimeout(() => setSyncMessage(null), 3000)
    }
  }

  const handleSignOut = async () => {
    await signOut()
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return 'Today'
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    }
  }

  return (
    <div className="flex-1 flex flex-col p-6 pt-safe pb-safe overflow-y-auto">
      {/* Auth status bar */}
      <div className="flex items-center justify-between mb-4">
        {user ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-1 bg-ink-900 rounded text-xs text-ink-400">
              <Cloud className="w-3 h-3 text-status-green" />
              <span className="truncate max-w-[120px]">{user.email}</span>
            </div>
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="p-2 text-ink-500 hover:text-ink-300"
              title="Sync with cloud"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleSignOut}
              className="p-2 text-ink-500 hover:text-ink-300"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : isConfigured ? (
          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-2 px-3 py-1.5 bg-ink-900 rounded text-xs text-ink-400 hover:text-ink-200"
          >
            <User className="w-3 h-3" />
            Sign in to sync
          </button>
        ) : (
          <div className="flex items-center gap-1 px-2 py-1 bg-ink-900 rounded text-xs text-ink-500">
            <CloudOff className="w-3 h-3" />
            Offline mode
          </div>
        )}

        {syncMessage && (
          <span className="text-xs text-ink-400">{syncMessage}</span>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <Feather className="w-10 h-10 text-ink-400 mx-auto mb-3" />
        <h1 className="text-xl font-bold text-ink-100 mb-1">Analogue</h1>
        <p className="text-ink-500 text-xs">Manuscript IDE</p>
      </motion.div>

      {!showCreate ? (
        <div className="w-full max-w-sm mx-auto space-y-3">
          {/* All manuscripts list */}
          {allManuscripts.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs text-ink-500 uppercase tracking-wide px-1">Your Manuscripts</h2>
              {allManuscripts.map((ms) => (
                <motion.div
                  key={ms.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2"
                >
                  <button
                    onClick={() => handleOpenManuscript(ms)}
                    className={`flex-1 flex items-center gap-3 p-3 bg-ink-900 border rounded-lg text-left transition-colors ${
                      manuscript?.id === ms.id
                        ? 'border-section-departure'
                        : 'border-ink-800 hover:border-ink-700'
                    }`}
                  >
                    <BookOpen className={`w-4 h-4 flex-shrink-0 ${
                      manuscript?.id === ms.id ? 'text-section-departure' : 'text-ink-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-ink-100 text-sm font-medium truncate">
                        {ms.title}
                      </div>
                      <div className="text-ink-500 text-xs">
                        {ms.totalWordCount.toLocaleString()} words · {formatDate(ms.updatedAt)}
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(ms.id)}
                    className="p-2 text-ink-600 hover:text-red-400 transition-colors"
                    aria-label="Delete manuscript"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </div>
          )}

          {/* New manuscript button */}
          <button
            onClick={handleStartNew}
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
          className="w-full max-w-xs mx-auto space-y-4"
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
              onClick={() => { setShowCreate(false); setTitle(''); setProtagonistName('') }}
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

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => !isDeleting && setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xs bg-ink-900 border border-ink-700 rounded-xl p-5"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-ink-100 font-medium mb-1">Delete Manuscript?</h3>
                  <p className="text-ink-400 text-sm">
                    This will permanently delete "{allManuscripts.find(m => m.id === deleteConfirm)?.title}" and all its scenes. This cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={isDeleting}
                  className="flex-1 p-3 border border-ink-700 rounded-lg text-ink-300 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  disabled={isDeleting}
                  className="flex-1 p-3 bg-red-600 rounded-lg text-white font-medium disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
