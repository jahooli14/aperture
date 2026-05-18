import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, ChevronLeft, ChevronRight, Bot, History, Wand2,
  Settings2, MessageSquarePlus, X, Check,
} from 'lucide-react'
import { useManuscriptStore } from '../stores/useManuscriptStore'
import { useEditorStore } from '../stores/useEditorStore'
import { useProseHistoryStore } from '../stores/useProseHistoryStore'
import { applyMask, getStorageText } from '../lib/mask'
import { applyRewrite, locateSelection } from '../lib/rewrite'
import RewritePanel from '../components/RewritePanel'
import AIAssistantDrawer from '../components/AIAssistantDrawer'
import VoiceNoteButton from '../components/VoiceNoteButton'

export default function EditorPage() {
  const { sceneId } = useParams<{ sceneId: string }>()
  const navigate = useNavigate()
  const { manuscript, updateScene, toggleMaskMode } = useManuscriptStore()
  const {
    selectedText, selectionStart, selectionEnd, setSelection, clearSelection,
    focusMode, toggleFocusMode, markSaved, textSize, cycleTextSize,
    showAIAssistant, setShowAIAssistant, sessionWordsAdded, startSession, updateSessionWords,
  } = useEditorStore()
  const proseHistory = useProseHistoryStore()

  const proseRef = useRef<HTMLTextAreaElement>(null)
  const cursorRef = useRef(0)
  const debounceRef = useRef<number | null>(null)
  const pendingDisplayRef = useRef<string | null>(null)
  const pristineRef = useRef('')
  const snappedRef = useRef(false)

  const [localProse, setLocalProse] = useState('')
  const [isComposing, setIsComposing] = useState(false)
  const [isRead, setIsRead] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showRewrite, setShowRewrite] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showFootnotes, setShowFootnotes] = useState(false)
  const [readSel, setReadSel] = useState<{ text: string; start: number; top: number; left: number } | null>(null)
  const [touchX, setTouchX] = useState<number | null>(null)

  const scene = manuscript?.scenes.find(s => s.id === sceneId)
  const sorted = useMemo(
    () => manuscript ? [...manuscript.scenes].sort((a, b) => a.order - b.order) : [],
    [manuscript]
  )
  const idx = sorted.findIndex(s => s.id === sceneId)
  const prev = idx > 0 ? sorted[idx - 1] : null
  const next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null

  const displayProse = isRead && scene && manuscript
    ? applyMask(scene.prose, manuscript.protagonistRealName, manuscript.maskModeEnabled)
    : localProse

  useEffect(() => {
    if (scene && manuscript) {
      setLocalProse(applyMask(scene.prose, manuscript.protagonistRealName, manuscript.maskModeEnabled))
    }
  }, [scene?.id, manuscript?.protagonistRealName, manuscript?.maskModeEnabled])

  useEffect(() => {
    if (scene) { pristineRef.current = scene.prose; snappedRef.current = false; startSession(scene.wordCount) }
  }, [scene?.id])

  useEffect(() => {
    const t = setTimeout(() => {
      if (!manuscript) navigate('/', { replace: true })
      else if (!scene) navigate('/m', { replace: true })
    }, 120)
    return () => clearTimeout(t)
  }, [manuscript, scene, navigate])

  // Persist whatever is pending immediately (used on background / scene switch).
  const flushPending = useCallback(() => {
    if (pendingDisplayRef.current == null || !scene || !manuscript) return
    if (debounceRef.current != null) { clearTimeout(debounceRef.current); debounceRef.current = null }
    const raw = getStorageText(pendingDisplayRef.current, manuscript.protagonistRealName, manuscript.maskModeEnabled)
    pendingDisplayRef.current = null
    updateScene(scene.id, { prose: raw })
    markSaved()
  }, [scene, manuscript, updateScene, markSaved])

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flushPending() }
    window.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flushPending)
    return () => {
      window.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flushPending)
      flushPending()
    }
  }, [flushPending])

  const snapPristine = () => {
    if (!snappedRef.current && pristineRef.current.trim() && scene) {
      proseHistory.snapshot(scene.id, pristineRef.current, 'before edits')
      snappedRef.current = true
    }
  }

  const commit = (displayText: string) => {
    if (!scene || !manuscript) return
    pendingDisplayRef.current = displayText
    if (debounceRef.current != null) clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      const raw = getStorageText(displayText, manuscript.protagonistRealName, manuscript.maskModeEnabled)
      pendingDisplayRef.current = null
      updateScene(scene.id, { prose: raw })
      updateSessionWords(raw.trim().split(/\s+/).filter(Boolean).length)
      markSaved()
    }, 250)
  }

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isComposing || !scene) return
    cursorRef.current = e.target.selectionStart
    snapPristine()
    setLocalProse(e.target.value)
    commit(e.target.value)
  }

  useEffect(() => {
    const ta = proseRef.current
    if (!ta) return
    const h = () => { if (document.activeElement === ta && !isComposing) cursorRef.current = ta.selectionStart }
    document.addEventListener('selectionchange', h)
    return () => document.removeEventListener('selectionchange', h)
  }, [isComposing])

  // Keep the caret above the on-screen keyboard when typing near the
  // bottom of a long scene (dropped this in the rebuild — it's essential
  // on a phone, where the caret otherwise hides behind the keyboard).
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    let keyboardOpen = false
    const onResize = () => {
      const ta = proseRef.current
      if (!ta) return
      const diff = window.innerHeight - vv.height
      if (diff > 150 && document.activeElement === ta) {
        keyboardOpen = true
        requestAnimationFrame(() => {
          if (proseRef.current && keyboardOpen) {
            const el = proseRef.current
            const lines = el.value.substring(0, el.selectionStart).split('\n').length
            const lh = parseInt(getComputedStyle(el).lineHeight) || 24
            el.scrollTop = Math.max(0, (lines - 2) * lh)
          }
        })
      } else if (diff < 50) {
        keyboardOpen = false
      }
    }
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [])

  useLayoutEffect(() => {
    if (!isRead && proseRef.current && cursorRef.current > 0) {
      const ta = proseRef.current
      const p = Math.min(cursorRef.current, ta.value.length)
      ta.setSelectionRange(p, p)
    }
  }, [localProse, isRead])

  const onSelect = useCallback(() => {
    const ta = proseRef.current
    if (!ta || !scene) return
    const s = ta.selectionStart, e = ta.selectionEnd
    if (e - s > 3) {
      const t = ta.value.slice(s, e)
      setTimeout(() => {
        if (ta.selectionStart === s && ta.selectionEnd === e) setSelection(t, s, e)
      }, 250)
    } else clearSelection()
  }, [scene, setSelection, clearSelection])

  const handleRewriteAccept = useCallback((newText: string) => {
    if (!scene || !manuscript) return
    const base = isRead
      ? applyMask(scene.prose, manuscript.protagonistRealName, manuscript.maskModeEnabled)
      : localProse
    proseHistory.snapshot(scene.id, getStorageText(base, manuscript.protagonistRealName, manuscript.maskModeEnabled), 'rewrite')
    const { displayProse: np, storageProse: raw } = applyRewrite(
      base, selectionStart, selectionEnd, newText,
      manuscript.protagonistRealName, manuscript.maskModeEnabled
    )
    setLocalProse(np)
    cursorRef.current = selectionStart + newText.length
    updateScene(scene.id, { prose: raw })
    updateSessionWords(raw.trim().split(/\s+/).filter(Boolean).length)
    clearSelection()
    setShowRewrite(false)
  }, [scene, manuscript, localProse, isRead, selectionStart, selectionEnd, proseHistory, updateScene, updateSessionWords, clearSelection])

  const handleReadSelection = useCallback(() => {
    if (!isRead || !scene || !manuscript) return
    const sel = window.getSelection()
    const text = sel?.toString() ?? ''
    if (!sel || sel.isCollapsed) { setReadSel(null); return }
    const base = applyMask(scene.prose, manuscript.protagonistRealName, manuscript.maskModeEnabled)
    const loc = locateSelection(base, text)
    if (!loc) { setReadSel(null); return }
    const r = sel.getRangeAt(0).getBoundingClientRect()
    setReadSel({ text, start: loc.start, top: r.top, left: r.left + r.width / 2 })
  }, [isRead, scene, manuscript])

  const handleVoiceInsert = useCallback((text: string, targetField: 'prose' | 'footnotes') => {
    if (!scene || !manuscript) return
    if (targetField === 'prose') {
      const at = cursorRef.current || localProse.length
      const before = localProse.slice(0, at), after = localProse.slice(at)
      const sep = before.length && !before.endsWith('\n\n') ? '\n\n' : ''
      const np = before + sep + text + (after.length ? '\n\n' : '') + after
      snapPristine()
      setLocalProse(np)
      cursorRef.current = (before + sep + text).length
      const raw = getStorageText(np, manuscript.protagonistRealName, manuscript.maskModeEnabled)
      updateScene(scene.id, { prose: raw })
      updateSessionWords(raw.trim().split(/\s+/).filter(Boolean).length)
    } else {
      const ex = scene.footnotes.trim()
      updateScene(scene.id, { footnotes: ex ? ex + '\n\n' + text : text })
      setShowFootnotes(true)
    }
  }, [scene, manuscript, localProse, updateScene, updateSessionWords])

  if (!scene || !manuscript) {
    return <div className="flex-1 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-ink-700 border-t-ink-300 rounded-full animate-spin" />
    </div>
  }

  const aiContext = {
    manuscriptTitle: manuscript.title,
    sectionLabel: scene.chapterTitle ?? 'Manuscript',
    sceneTitle: scene.title,
    sceneBeat: scene.sceneBeat,
    prose: scene.prose,
  }
  const footnotes = scene.footnotes.split(/\n\n+/).map(s => s.trim()).filter(Boolean)

  return (
    <div
      className={`flex-1 flex flex-col min-h-0 bg-ink-950 pt-safe text-size-${textSize}`}
      onTouchStart={e => { const t = e.target as HTMLElement; setTouchX(t.tagName === 'TEXTAREA' ? null : e.touches[0].clientX) }}
      onTouchEnd={e => {
        if (touchX == null) return
        const d = touchX - e.changedTouches[0].clientX
        if (d > 90 && next) navigate(`/edit/${next.id}`)
        else if (d < -90 && prev) navigate(`/edit/${prev.id}`)
        setTouchX(null)
      }}
    >
      <header className={`flex items-center px-2 py-2.5 transition-opacity ${focusMode ? 'opacity-0 pointer-events-none' : ''}`}>
        <button onClick={() => { flushPending(); navigate('/m') }} className="p-2 text-ink-400"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="flex-1 text-center text-sm font-medium text-ink-200 truncate px-2">{scene.title}</h1>
        {sessionWordsAdded > 0 && <span className="text-xs text-amber-500 px-1">+{sessionWordsAdded}</span>}
        {sceneId && proseHistory.hasSnapshots(sceneId) && (
          <button onClick={() => setShowHistory(v => !v)} className={`p-2 ${showHistory ? 'text-amber-400' : 'text-ink-400'}`}><History className="w-5 h-5" /></button>
        )}
        <VoiceNoteButton ctx={aiContext} onInsert={handleVoiceInsert} />
        <button onClick={() => setShowAIAssistant(!showAIAssistant)} className={`p-2 ${showAIAssistant ? 'text-purple-400' : 'text-ink-400'}`}><Bot className="w-5 h-5" /></button>
        <button onClick={() => setShowSettings(true)} className="p-2 text-ink-400"><Settings2 className="w-5 h-5" /></button>
      </header>

      {/* History */}
      <AnimatePresence>
        {showHistory && sceneId && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-amber-950/15 border-y border-amber-900/30">
            <div className="p-3">
              <p className="text-[11px] text-amber-500/80 mb-2">Edit history — tap to restore</p>
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {proseHistory.getSnapshots(sceneId).map((snap, i) => (
                  <button key={i} onClick={async () => {
                    await updateScene(sceneId, { prose: snap.prose })
                    setLocalProse(applyMask(snap.prose, manuscript.protagonistRealName, manuscript.maskModeEnabled))
                    proseHistory.remove(sceneId, i); setShowHistory(false)
                  }} className="w-full text-left px-3 py-2 bg-ink-900 rounded-lg">
                    <div className="flex justify-between text-[11px] mb-0.5">
                      <span className="text-amber-500/70">{snap.trigger}</span>
                      <span className="text-ink-600">{new Date(snap.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-[11px] text-ink-500 truncate">{snap.prose.slice(0, 80)}…</p>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prose */}
      <div className="flex-1 relative min-h-0">
        {isRead ? (
          <div className="absolute inset-0 overflow-y-auto px-5 py-4 pb-32" onMouseUp={handleReadSelection} onTouchEnd={handleReadSelection}>
            {!displayProse ? (
              <p className="text-ink-700 italic">Empty. Switch to Edit to write.</p>
            ) : (
              <div className="reading max-w-prose mx-auto">
                <p className="text-[11px] text-ink-700 mb-5">Select any text to redraft it.</p>
                {displayProse.split(/\n\n+/).map((para, i) => para.trim() && (
                  <p key={i} className="text-ink-200 leading-[1.85] mb-5" style={{ textIndent: i ? '1.4em' : 0 }}>
                    {para.split('\n').map((ln, j) => <span key={j}>{ln}{j < para.split('\n').length - 1 && <br />}</span>)}
                  </p>
                ))}
                {footnotes.length > 0 && (
                  <div className="mt-8 pt-4 border-t border-ink-800 space-y-2">
                    {footnotes.map((f, i) => <p key={i} className="text-ink-500 text-sm leading-relaxed"><span className="text-ink-600">[{i + 1}]</span> {f}</p>)}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="absolute inset-0 overflow-y-auto pb-32" style={{ scrollPaddingBottom: '160px' }}>
            <textarea
              ref={proseRef}
              value={displayProse}
              onChange={onChange}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={e => { setIsComposing(false); if (scene) { snapPristine(); setLocalProse(e.currentTarget.value); commit(e.currentTarget.value) } }}
              onSelect={onSelect}
              onMouseDown={() => clearSelection()}
              placeholder="Begin writing…"
              className="w-full h-full px-5 py-4 bg-transparent text-ink-100 placeholder:text-ink-700 resize-none prose-edit focus:outline-none"
              style={{ WebkitTapHighlightColor: 'transparent', fontSize: '16px', minHeight: '60vh' }}
              autoCapitalize="sentences" autoCorrect="on" spellCheck
            />
          </div>
        )}

        {/* Read-mode floating redraft */}
        {isRead && readSel && (
          <button
            onPointerDown={e => e.preventDefault()}
            onClick={() => { setSelection(readSel.text, readSel.start, readSel.start + readSel.text.length); setReadSel(null); setShowRewrite(true) }}
            style={{ position: 'fixed', top: Math.max(56, readSel.top - 46), left: readSel.left, transform: 'translateX(-50%)', zIndex: 30 }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 rounded-full text-xs font-medium text-white shadow-lg">
            <Wand2 className="w-3.5 h-3.5" /> Redraft
          </button>
        )}

        {/* Edit-mode selection bar */}
        <AnimatePresence>
          {selectedText && !isRead && (
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
              className="fixed bottom-20 left-4 right-4 z-30 flex items-center gap-2 px-3 py-2.5 bg-ink-900 border border-ink-700 rounded-2xl shadow-xl pb-safe">
              <span className="flex-1 text-xs text-ink-500 truncate">"{selectedText.slice(0, 28)}…"</span>
              <button onClick={() => setShowRewrite(true)} className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 rounded-xl text-xs font-medium text-white">
                <Wand2 className="w-3.5 h-3.5" /> Redraft
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footnotes drawer */}
      <AnimatePresence>
        {showFootnotes ? (
          <motion.div initial={{ height: 0 }} animate={{ height: '34%' }} exit={{ height: 0 }}
            className="border-t border-ink-800 bg-ink-900 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2">
              <MessageSquarePlus className="w-4 h-4 text-ink-500" />
              <span className="text-[11px] uppercase tracking-wider text-ink-500 flex-1">Notes</span>
              <button onClick={() => setShowFootnotes(false)} className="text-xs text-ink-500">Close</button>
            </div>
            <textarea
              value={scene.footnotes}
              onChange={e => updateScene(scene.id, { footnotes: e.target.value })}
              placeholder="Notes, inner voice, ideas…"
              className="flex-1 w-full px-4 pb-4 bg-transparent text-ink-300 text-sm leading-relaxed placeholder:text-ink-700 resize-none focus:outline-none"
            />
          </motion.div>
        ) : !focusMode && (
          <button onClick={() => setShowFootnotes(true)}
            className="fixed bottom-20 right-4 w-11 h-11 bg-ink-900 border border-ink-700 rounded-full flex items-center justify-center text-ink-400 shadow-lg z-20">
            <MessageSquarePlus className="w-5 h-5" />
          </button>
        )}
      </AnimatePresence>

      {/* Scene nav */}
      <div className={`fixed bottom-4 left-0 right-0 flex items-center justify-center gap-3 pb-safe transition-opacity ${focusMode ? 'opacity-0 pointer-events-none' : ''}`}>
        <button onClick={() => prev && navigate(`/edit/${prev.id}`)} disabled={!prev}
          className="flex items-center gap-1 px-3 py-2 bg-ink-900/90 border border-ink-800 rounded-full text-xs text-ink-300 disabled:opacity-30 backdrop-blur-sm">
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>
        <span className="text-[11px] text-ink-600">{idx + 1} / {sorted.length}</span>
        <button onClick={() => next && navigate(`/edit/${next.id}`)} disabled={!next}
          className="flex items-center gap-1 px-3 py-2 bg-ink-900/90 border border-ink-800 rounded-full text-xs text-ink-300 disabled:opacity-30 backdrop-blur-sm">
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Settings sheet */}
      <AnimatePresence>
        {showSettings && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowSettings(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-ink-900 border-t border-ink-700 rounded-t-2xl p-5 pb-safe space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink-100">Scene</span>
                <button onClick={() => setShowSettings(false)} className="p-1 text-ink-400"><X className="w-4 h-4" /></button>
              </div>

              <button onClick={() => {
                const base = isRead ? applyMask(scene.prose, manuscript.protagonistRealName, manuscript.maskModeEnabled) : localProse
                setSelection(base, 0, base.length); setShowSettings(false); setShowRewrite(true)
              }} disabled={!scene.prose.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-amber-600 rounded-xl text-white font-medium disabled:opacity-40">
                <Wand2 className="w-4 h-4" /> Redraft whole scene
              </button>

              {([
                ['Mode', ['Edit', 'Read'], isRead ? 'Read' : 'Edit', (v: string) => setIsRead(v === 'Read')],
                ['Text size', ['small', 'medium', 'large'], textSize, (v: string) => {
                  const order = ['small', 'medium', 'large']
                  let n = (order.indexOf(v) - order.indexOf(textSize) + 3) % 3
                  while (n--) cycleTextSize()
                }],
              ] as const).map(([label, opts, cur, set]) => (
                <div key={label}>
                  <p className="text-xs text-ink-500 mb-1.5">{label}</p>
                  <div className="flex gap-2">
                    {opts.map(o => (
                      <button key={o} onClick={() => set(o)}
                        className={`flex-1 py-2.5 rounded-xl text-sm capitalize ${cur === o ? 'bg-ink-700 text-ink-50' : 'bg-ink-800 text-ink-400'}`}>{o}</button>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-300">Focus mode</span>
                <button onClick={() => toggleFocusMode()}
                  className={`relative w-11 h-6 rounded-full ${focusMode ? 'bg-amber-600' : 'bg-ink-700'}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${focusMode ? 'left-6' : 'left-1'}`} />
                </button>
              </div>

              <button onClick={() => { toggleMaskMode(); }}
                className="w-full flex items-center justify-between py-2 text-sm text-ink-300">
                <span>Mask protagonist name</span>
                {manuscript.maskModeEnabled && <Check className="w-4 h-4 text-amber-400" />}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRewrite && selectedText && (
          <RewritePanel passage={selectedText} ctx={aiContext}
            onClose={() => { setShowRewrite(false); clearSelection() }}
            onAccept={handleRewriteAccept} />
        )}
      </AnimatePresence>

      <AIAssistantDrawer isOpen={showAIAssistant} onClose={() => setShowAIAssistant(false)} ctx={aiContext} />
    </div>
  )
}
