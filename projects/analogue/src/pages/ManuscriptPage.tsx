import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Plus, ChevronRight, ChevronDown, MoreVertical, X,
  ChevronUp, Trash2, Bot, BookMarked, Download, Eye, EyeOff, ArrowRight,
} from 'lucide-react'
import { useManuscriptStore } from '../stores/useManuscriptStore'
import type { SceneNode } from '../types/manuscript'
import StructuralChatbot from '../components/StructuralChatbot'
import VersionsPanel from '../components/VersionsPanel'
import ExportModal from '../components/ExportModal'

export default function ManuscriptPage() {
  const navigate = useNavigate()
  const { manuscript, createScene, deleteScene, reorderScenes, updateScene, updateManuscript, toggleMaskMode } = useManuscriptStore()
  const [addingTo, setAddingTo] = useState<string | 'loose' | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [delId, setDelId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleText, setTitleText] = useState('')
  const [showStructure, setShowStructure] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const [showExport, setShowExport] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => { if (!manuscript) navigate('/', { replace: true }) }, 120)
    return () => clearTimeout(t)
  }, [manuscript, navigate])

  const ordered = useMemo(
    () => manuscript ? [...manuscript.scenes].sort((a, b) => a.order - b.order) : [],
    [manuscript]
  )

  const groups = useMemo(() => {
    const out: { id: string; title: string | null; scenes: SceneNode[] }[] = []
    for (const s of ordered) {
      const key = s.chapterId ?? '__loose__'
      let g = out.find(x => x.id === key)
      if (!g) { g = { id: key, title: s.chapterId ? (s.chapterTitle || 'Chapter') : null, scenes: [] }; out.push(g) }
      g.scenes.push(s)
    }
    return out
  }, [ordered])

  if (!manuscript) {
    return <div className="flex-1 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-ink-700 border-t-ink-300 rounded-full animate-spin" />
    </div>
  }

  const target = 80000
  const pct = Math.min(100, Math.round((manuscript.totalWordCount / target) * 100))

  const addScene = async (chapter: { id: string; title: string | null } | null) => {
    if (!newTitle.trim()) return
    const scene = await createScene('departure', newTitle.trim())
    if (chapter && chapter.id !== '__loose__') {
      const peers = ordered.filter(s => s.chapterId === chapter.id)
      await updateScene(scene.id, {
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        sceneNumber: peers.length + 1,
      })
    }
    setNewTitle(''); setAddingTo(null)
    navigate(`/edit/${scene.id}`)
  }

  const addChapter = async () => {
    if (!newTitle.trim()) return
    const scene = await createScene('departure', 'Scene 1')
    const chapterId = `ch-${Date.now()}`
    await updateScene(scene.id, {
      chapterId, chapterTitle: newTitle.trim(), sceneNumber: 1,
    })
    setNewTitle(''); setAddingTo(null)
    navigate(`/edit/${scene.id}`)
  }

  const move = async (scene: SceneNode, dir: -1 | 1) => {
    const i = ordered.findIndex(s => s.id === scene.id)
    const j = i + dir
    if (j < 0 || j >= ordered.length) return
    const arr = [...ordered]
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    await reorderScenes(arr.map(s => s.id))
    setOpenMenu(null)
  }

  const toggle = (id: string) => setCollapsed(p => {
    const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  const firstScene = ordered[0]

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-ink-950 pt-safe">
      <header className="flex items-center gap-2 px-3 py-3">
        <button onClick={() => navigate('/')} className="p-2 -ml-1 text-ink-400"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              autoFocus value={titleText}
              onChange={e => setTitleText(e.target.value)}
              onBlur={() => { if (titleText.trim()) updateManuscript({ title: titleText.trim() }); setEditingTitle(false) }}
              onKeyDown={e => { if (e.key === 'Enter') { if (titleText.trim()) updateManuscript({ title: titleText.trim() }); setEditingTitle(false) } }}
              className="w-full bg-ink-900 border border-ink-700 rounded-lg px-2 py-1 text-ink-100 text-base"
            />
          ) : (
            <button onClick={() => { setTitleText(manuscript.title); setEditingTitle(true) }} className="text-left w-full">
              <div className="text-ink-50 font-semibold truncate">{manuscript.title}</div>
              <div className="text-xs text-ink-500">{manuscript.totalWordCount.toLocaleString()} / {target.toLocaleString()} words · {pct}%</div>
            </button>
          )}
        </div>
        <button onClick={() => toggleMaskMode()} className="p-2 text-ink-500" aria-label="Mask">
          {manuscript.maskModeEnabled ? <EyeOff className="w-5 h-5 text-amber-400" /> : <Eye className="w-5 h-5" />}
        </button>
      </header>

      <div className="px-4 h-1 mb-1">
        <div className="h-1 rounded-full bg-ink-900 overflow-hidden">
          <div className="h-full bg-amber-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto">
        {[
          { icon: Bot, label: 'Structure', fn: () => setShowStructure(true) },
          { icon: BookMarked, label: 'Versions', fn: () => setShowVersions(true) },
          { icon: Download, label: 'Export', fn: () => setShowExport(true) },
        ].map(b => (
          <button key={b.label} onClick={b.fn}
            className="flex items-center gap-1.5 px-3 py-2 bg-ink-900 rounded-full text-xs text-ink-300 whitespace-nowrap active:bg-ink-800">
            <b.icon className="w-4 h-4" /> {b.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-28">
        {groups.map(g => {
          const isCh = g.id !== '__loose__'
          const isOpen = !collapsed.has(g.id)
          return (
            <div key={g.id} className="mb-2">
              {isCh && (
                <button onClick={() => toggle(g.id)}
                  className="w-full flex items-center gap-2 px-2 py-2.5 text-left">
                  {isOpen ? <ChevronDown className="w-4 h-4 text-ink-600" /> : <ChevronRight className="w-4 h-4 text-ink-600" />}
                  <span className="text-sm font-semibold text-ink-200 flex-1 truncate">{g.title}</span>
                  <span className="text-[11px] text-ink-600">{g.scenes.reduce((n, s) => n + s.wordCount, 0).toLocaleString()}w</span>
                </button>
              )}
              <AnimatePresence initial={false}>
                {isOpen && g.scenes.map(scene => (
                  <motion.div key={scene.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className={`flex items-center ${isCh ? 'pl-7' : ''}`}>
                      <button onClick={() => navigate(`/edit/${scene.id}`)}
                        className="flex-1 min-w-0 text-left px-2 py-3 active:bg-ink-900/60 rounded-xl">
                        <div className="text-ink-100 text-sm truncate">{scene.title}</div>
                        <div className="text-[11px] text-ink-600 mt-0.5">{scene.wordCount.toLocaleString()} words</div>
                      </button>
                      <button onClick={() => setOpenMenu(openMenu === scene.id ? null : scene.id)} className="p-2.5 text-ink-600">
                        {openMenu === scene.id ? <X className="w-4 h-4" /> : <MoreVertical className="w-4 h-4" />}
                      </button>
                    </div>
                    <AnimatePresence>
                      {openMenu === scene.id && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden">
                          <div className={`flex items-center gap-1 py-2 ${isCh ? 'pl-7' : ''}`}>
                            <button onClick={() => move(scene, -1)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-ink-400 bg-ink-900 rounded-lg">
                              <ChevronUp className="w-3.5 h-3.5" /> Up
                            </button>
                            <button onClick={() => move(scene, 1)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-ink-400 bg-ink-900 rounded-lg">
                              <ChevronDown className="w-3.5 h-3.5" /> Down
                            </button>
                            <div className="flex-1" />
                            <button onClick={() => { setDelId(scene.id); setOpenMenu(null) }}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-400 bg-ink-900 rounded-lg">
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isOpen && (
                addingTo === g.id ? (
                  <div className={`flex gap-2 py-2 ${isCh ? 'pl-7' : ''}`}>
                    <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addScene({ id: g.id, title: g.title }); if (e.key === 'Escape') setAddingTo(null) }}
                      placeholder="Scene title"
                      className="flex-1 px-3 py-2 bg-ink-900 border border-ink-700 rounded-lg text-sm text-ink-100 placeholder:text-ink-600" />
                    <button onClick={() => addScene({ id: g.id, title: g.title })} disabled={!newTitle.trim()}
                      className="px-3 py-2 bg-amber-600 rounded-lg text-sm text-white disabled:opacity-40">Add</button>
                  </div>
                ) : (
                  <button onClick={() => { setAddingTo(g.id); setNewTitle('') }}
                    className={`flex items-center gap-1.5 px-2 py-2 text-xs text-ink-600 active:text-ink-400 ${isCh ? 'pl-7' : ''}`}>
                    <Plus className="w-3.5 h-3.5" /> Add scene
                  </button>
                )
              )}
            </div>
          )
        })}

        {/* Add chapter */}
        {addingTo === '__newchapter__' ? (
          <div className="flex gap-2 py-2 px-2">
            <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addChapter(); if (e.key === 'Escape') setAddingTo(null) }}
              placeholder="Chapter title"
              className="flex-1 px-3 py-2 bg-ink-900 border border-ink-700 rounded-lg text-sm text-ink-100 placeholder:text-ink-600" />
            <button onClick={addChapter} disabled={!newTitle.trim()}
              className="px-3 py-2 bg-amber-600 rounded-lg text-sm text-white disabled:opacity-40">Add</button>
          </div>
        ) : (
          <button onClick={() => { setAddingTo('__newchapter__'); setNewTitle('') }}
            className="flex items-center gap-1.5 px-2 py-3 text-xs text-ink-600 active:text-ink-400">
            <Plus className="w-3.5 h-3.5" /> New chapter
          </button>
        )}
      </div>

      {/* Continue CTA */}
      {firstScene && (
        <div className="fixed bottom-0 left-0 right-0 px-5 pb-safe pt-4 bg-gradient-to-t from-ink-950 to-transparent">
          <button onClick={() => navigate(`/edit/${firstScene.id}`)}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-600 rounded-2xl text-white font-medium active:bg-amber-500 mb-2">
            Continue redrafting <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      <AnimatePresence>{showStructure && <StructuralChatbot onClose={() => setShowStructure(false)} />}</AnimatePresence>
      <AnimatePresence>{showVersions && <VersionsPanel onClose={() => setShowVersions(false)} />}</AnimatePresence>
      <AnimatePresence>{showExport && <ExportModal manuscript={manuscript} onClose={() => setShowExport(false)} />}</AnimatePresence>

      <AnimatePresence>
        {delId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5" onClick={() => setDelId(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} onClick={e => e.stopPropagation()}
              className="w-full max-w-xs bg-ink-900 border border-ink-700 rounded-2xl p-5">
              <h3 className="text-ink-100 font-medium mb-1">Delete scene?</h3>
              <p className="text-ink-400 text-sm mb-4">"{ordered.find(s => s.id === delId)?.title}" and its content.</p>
              <div className="flex gap-2">
                <button onClick={() => setDelId(null)} className="flex-1 py-3 border border-ink-700 rounded-xl text-ink-300">Cancel</button>
                <button onClick={async () => { await deleteScene(delId); setDelId(null) }}
                  className="flex-1 py-3 bg-red-600 rounded-xl text-white font-medium">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
