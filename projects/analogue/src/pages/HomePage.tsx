import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Upload, Trash2, Cloud, CloudOff, RefreshCw, LogOut, Download, Feather } from 'lucide-react'
import { useManuscriptStore } from '../stores/useManuscriptStore'
import { useAuthStore } from '../stores/useAuthStore'
import { fullSync } from '../lib/sync'
import type { ManuscriptState } from '../types/manuscript'
import ImportModal, { type ImportedScene } from '../components/ImportModal'
import ExportModal from '../components/ExportModal'

export default function HomePage() {
  const navigate = useNavigate()
  const { createManuscript, importScenes, loadManuscript, deleteManuscript, getAllManuscripts, clearCurrentManuscript } = useManuscriptStore()
  const { user, isConfigured, signOut } = useAuthStore()

  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [exporting, setExporting] = useState<ManuscriptState | null>(null)
  const [title, setTitle] = useState('')
  const [all, setAll] = useState<ManuscriptState[]>([])
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => { refresh() }, [])
  const refresh = async () => setAll(await getAllManuscripts())

  const handleCreate = async () => {
    if (!title.trim()) return
    await createManuscript(title.trim())
    setTitle(''); setShowCreate(false)
    navigate('/m')
  }

  const handleImport = async (scenes: ImportedScene[]) => {
    await createManuscript(title.trim() || 'Untitled')
    await importScenes(scenes)
    setShowImport(false); setShowCreate(false); setTitle('')
    navigate('/m')
  }

  const open = async (ms: ManuscriptState) => {
    await loadManuscript(ms.id)
    navigate('/m')
  }

  const handleSync = async () => {
    if (!user) return
    setSyncing(true)
    try { await fullSync(user.id); await refresh() } finally { setSyncing(false) }
  }

  const since = (s: string) => {
    const d = Math.floor((Date.now() - new Date(s).getTime()) / 86400000)
    return d === 0 ? 'today' : d === 1 ? 'yesterday' : d < 7 ? `${d}d ago` : new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="flex-1 flex flex-col px-5 pt-safe pb-safe overflow-y-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-2 text-ink-300">
          <Feather className="w-5 h-5" />
          <span className="text-sm font-semibold tracking-tight">Analogue</span>
        </div>
        <div className="flex items-center gap-1">
          {user ? (
            <>
              <button onClick={handleSync} disabled={syncing} className="p-2 text-ink-500 active:text-ink-200" aria-label="Sync">
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={() => signOut()} className="p-2 text-ink-500 active:text-ink-200" aria-label="Sign out">
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : isConfigured ? (
            <button onClick={() => navigate('/login')} className="text-xs text-ink-400 px-3 py-1.5 bg-ink-900 rounded-full">
              Sign in to sync
            </button>
          ) : (
            <span className="flex items-center gap-1 text-xs text-ink-600"><CloudOff className="w-3.5 h-3.5" /> Offline</span>
          )}
          {user && <Cloud className="w-3.5 h-3.5 text-status-green ml-1" />}
        </div>
      </div>

      <div className="mt-6 mb-7">
        <h1 className="text-3xl font-bold text-ink-50 tracking-tight">Your books</h1>
        <p className="text-ink-500 text-sm mt-1">Redraft toward publication.</p>
      </div>

      <div className="space-y-2.5 flex-1">
        {all.map(ms => {
          const pct = ms.totalWordCount > 0 ? Math.min(100, Math.round((ms.totalWordCount / 80000) * 100)) : 0
          return (
            <motion.div key={ms.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="group bg-ink-900 border border-ink-800 rounded-2xl p-4 flex items-center gap-4 active:border-amber-700/60 transition-colors"
            >
              <button onClick={() => open(ms)} className="flex-1 min-w-0 text-left">
                <div className="text-ink-50 font-semibold truncate">{ms.title}</div>
                <div className="text-ink-500 text-xs mt-0.5">
                  {ms.totalWordCount.toLocaleString()} words · {since(ms.updatedAt)}
                </div>
                <div className="mt-2.5 h-1 rounded-full bg-ink-800 overflow-hidden">
                  <div className="h-full bg-amber-600 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </button>
              <div className="flex flex-col gap-1">
                <button onClick={() => setExporting(ms)} className="p-2 text-ink-600 active:text-ink-200" aria-label="Export">
                  <Download className="w-4 h-4" />
                </button>
                <button onClick={() => setDeleteId(ms.id)} className="p-2 text-ink-600 active:text-red-400" aria-label="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )
        })}

        {all.length === 0 && (
          <div className="text-center py-16 text-ink-600 text-sm">No books yet. Start one below.</div>
        )}
      </div>

      {/* Actions */}
      <div className="sticky bottom-0 pt-4 pb-2 bg-gradient-to-t from-ink-950 via-ink-950 to-transparent space-y-2">
        {!showCreate ? (
          <button onClick={() => { clearCurrentManuscript(); setShowCreate(true) }}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-600 rounded-2xl text-white font-medium active:bg-amber-500">
            <Plus className="w-5 h-5" /> New book
          </button>
        ) : (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            <input value={title} onChange={e => setTitle(e.target.value)} autoFocus
              placeholder="Book title"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              className="w-full p-3.5 bg-ink-900 border border-ink-700 rounded-2xl text-ink-100 placeholder:text-ink-600 focus:outline-none focus:border-amber-600/60" />
            <div className="flex gap-2">
              <button onClick={() => { setShowCreate(false); setTitle('') }}
                className="flex-1 py-3 border border-ink-700 rounded-2xl text-ink-400">Cancel</button>
              <button onClick={() => setShowImport(true)}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-ink-800 rounded-2xl text-ink-200">
                <Upload className="w-4 h-4" /> Import
              </button>
              <button onClick={handleCreate} disabled={!title.trim()}
                className="flex-1 py-3 bg-amber-600 rounded-2xl text-white font-medium disabled:opacity-40">Create</button>
            </div>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {deleteId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5" onClick={() => setDeleteId(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} onClick={e => e.stopPropagation()}
              className="w-full max-w-xs bg-ink-900 border border-ink-700 rounded-2xl p-5">
              <h3 className="text-ink-100 font-medium mb-1">Delete this book?</h3>
              <p className="text-ink-400 text-sm mb-4">"{all.find(m => m.id === deleteId)?.title}" and all its scenes. Can't be undone.</p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteId(null)} className="flex-1 py-3 border border-ink-700 rounded-xl text-ink-300">Cancel</button>
                <button onClick={async () => { await deleteManuscript(deleteId); await refresh(); setDeleteId(null) }}
                  className="flex-1 py-3 bg-red-600 rounded-xl text-white font-medium">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showImport && <ImportModal onImport={handleImport} onClose={() => setShowImport(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {exporting && <ExportModal manuscript={exporting} onClose={() => setExporting(null)} />}
      </AnimatePresence>
    </div>
  )
}
