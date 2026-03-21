import { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Trash2, CheckCircle2, XCircle, Bot, ChevronsRight } from 'lucide-react'
import { useStructuralAIStore } from '../stores/useStructuralAIStore'
import { useManuscriptStore } from '../stores/useManuscriptStore'
import type { StructuralContext, StructuralAction } from '../lib/gemini'
import type { NarrativeSection } from '../types/manuscript'

interface Props {
  onClose: () => void
}

const SECTION_ORDER: NarrativeSection[] = ['departure', 'escape', 'rupture', 'alignment', 'reveal']

function buildContext(
  manuscript: NonNullable<ReturnType<typeof useManuscriptStore.getState>['manuscript']>
): StructuralContext {
  return {
    manuscriptTitle: manuscript.title,
    scenes: [...manuscript.scenes]
      .sort((a, b) => {
        const si = SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section)
        return si !== 0 ? si : a.order - b.order
      })
      .map(s => ({
        id: s.id,
        title: s.title,
        section: s.section,
        order: s.order,
        wordCount: s.wordCount,
        sceneBeat: s.sceneBeat,
        prose: s.prose
      }))
  }
}

function actionLabel(
  action: StructuralAction,
  manuscript: NonNullable<ReturnType<typeof useManuscriptStore.getState>['manuscript']>
): string {
  if (action.type === 'move_scene') {
    const scene = manuscript.scenes.find(s => s.id === action.sceneId)
    const target = action.targetBeforeSceneId
      ? manuscript.scenes.find(s => s.id === action.targetBeforeSceneId)
      : null
    const where = target ? `before "${target.title}"` : `end of ${action.targetSection}`
    return `Move "${scene?.title ?? action.sceneId}" → ${where}`
  }
  if (action.type === 'edit_prose') {
    const scene = manuscript.scenes.find(s => s.id === action.sceneId)
    const words = action.newProse.split(/\s+/).length
    return `Edit prose in "${scene?.title ?? action.sceneId}" (${words} words)`
  }
  if (action.type === 'create_scene') {
    const before = action.targetBeforeSceneId
      ? manuscript.scenes.find(s => s.id === action.targetBeforeSceneId)
      : null
    const where = before ? `before "${before.title}"` : `end of ${action.section}`
    return `Create scene "${action.title}" [${action.section}] — ${where}`
  }
  return 'Apply change'
}

export default function StructuralChatbot({ onClose }: Props) {
  const {
    messages, isLoading, streamingContent, pendingActions,
    error, sendMessage, clearMessages, dismissAction, clearAllPending, clearError
  } = useStructuralAIStore()
  const { manuscript, reorderScenes, updateScene, createScene } = useManuscriptStore()
  const [input, setInput] = useState('')
  const [applying, setApplying] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent, pendingActions])

  if (!manuscript) return null

  const ctx = buildContext(manuscript)

  const handleSend = () => {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    sendMessage(text, ctx)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const applyAction = async (action: StructuralAction) => {
    if (action.type === 'move_scene') {
      const sorted = [...manuscript.scenes].sort((a, b) => {
        const si = SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section)
        return si !== 0 ? si : a.order - b.order
      })
      const moving = sorted.find(s => s.id === action.sceneId)
      if (!moving) return
      if (moving.section !== action.targetSection) {
        await updateScene(action.sceneId, { section: action.targetSection as NarrativeSection })
      }
      const without = sorted.filter(s => s.id !== action.sceneId)
      const insertIdx = action.targetBeforeSceneId
        ? without.findIndex(s => s.id === action.targetBeforeSceneId)
        : without.length
      without.splice(insertIdx < 0 ? without.length : insertIdx, 0, moving)
      await reorderScenes(without.map(s => s.id))
    }

    if (action.type === 'edit_prose') {
      await updateScene(action.sceneId, { prose: action.newProse })
    }

    if (action.type === 'create_scene') {
      const newScene = await createScene(action.section as NarrativeSection, action.title)
      await updateScene(newScene.id, {
        sceneBeat: action.sceneBeat,
        prose: action.proseFramework
      })
      // Reorder: insert before targetBeforeSceneId if specified
      if (action.targetBeforeSceneId) {
        const sorted = [...manuscript.scenes, newScene].sort((a, b) => {
          const si = SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section)
          return si !== 0 ? si : a.order - b.order
        })
        const without = sorted.filter(s => s.id !== newScene.id)
        const insertIdx = without.findIndex(s => s.id === action.targetBeforeSceneId)
        without.splice(insertIdx < 0 ? without.length : insertIdx, 0, newScene)
        await reorderScenes(without.map(s => s.id))
      }
    }
  }

  const handleApplyOne = async (index: number) => {
    const action = pendingActions[index]
    if (!action) return
    setApplying(true)
    await applyAction(action)
    dismissAction(index)
    setApplying(false)
  }

  const handleApplyAll = async () => {
    setApplying(true)
    for (const action of pendingActions) {
      await applyAction(action)
    }
    clearAllPending()
    setApplying(false)
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
        <Bot className="w-5 h-5 text-section-alignment" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-ink-100">Structure Editor</div>
          <div className="text-xs text-ink-500">
            gemini-3-flash-preview · {ctx.scenes.length} scenes · {manuscript.totalWordCount.toLocaleString()} words
          </div>
        </div>
        <button
          onClick={clearMessages}
          className="p-2 text-ink-500 hover:text-ink-300"
          title="Clear conversation"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button onClick={onClose} className="p-2 text-ink-500 hover:text-ink-300">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="text-center py-8">
            <Bot className="w-8 h-8 text-ink-700 mx-auto mb-3" />
            <p className="text-sm text-ink-500 max-w-xs mx-auto">
              The full manuscript is loaded. Ask for top-down analysis, major cuts, rewrites, new scenes — anything.
            </p>
            <div className="mt-4 space-y-1.5 text-xs text-ink-700 max-w-xs mx-auto text-left">
              <p>"This character needs more build-up — add a scene before chapter 3"</p>
              <p>"The cabin scene is too on-the-nose. Cut the woods section and move it earlier"</p>
              <p>"Review the whole arc and tell me where it sags"</p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-section-alignment/20 text-ink-100 rounded-br-sm'
                  : 'bg-ink-900 text-ink-200 rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Streaming */}
        {isLoading && streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[85%] bg-ink-900 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-ink-200 leading-relaxed whitespace-pre-wrap">
              {streamingContent}
              <span className="inline-block w-1 h-3 bg-ink-500 animate-pulse ml-0.5 align-middle" />
            </div>
          </div>
        )}

        {isLoading && !streamingContent && (
          <div className="flex justify-start">
            <div className="bg-ink-900 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-ink-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-ink-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-ink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Pending actions */}
      <AnimatePresence>
        {pendingActions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mx-4 mb-3 p-3 bg-section-alignment/10 border border-section-alignment/30 rounded-xl"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-section-alignment font-medium">
                {pendingActions.length} proposed change{pendingActions.length !== 1 ? 's' : ''}
              </p>
              {pendingActions.length > 1 && (
                <button
                  onClick={handleApplyAll}
                  disabled={applying}
                  className="flex items-center gap-1 px-2.5 py-1 bg-section-alignment rounded-lg text-xs text-white font-medium disabled:opacity-50"
                >
                  <ChevronsRight className="w-3 h-3" />
                  Apply all
                </button>
              )}
            </div>
            <div className="space-y-2">
              {pendingActions.map((action, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-xs text-ink-500 mt-0.5 shrink-0">{i + 1}.</span>
                  <p className="flex-1 text-xs text-ink-200 leading-relaxed">{actionLabel(action, manuscript)}</p>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => handleApplyOne(i)}
                      disabled={applying}
                      className="flex items-center gap-1 px-2 py-1 bg-section-alignment/80 rounded text-xs text-white disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => dismissAction(i)}
                      disabled={applying}
                      className="flex items-center gap-1 px-2 py-1 bg-ink-800 rounded text-xs text-ink-400 disabled:opacity-50"
                    >
                      <XCircle className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 px-3 py-2 bg-red-950/50 border border-red-800/50 rounded-lg text-xs text-red-400 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button onClick={clearError}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-ink-800 pb-safe">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe a structural change..."
            rows={1}
            className="flex-1 px-3 py-2.5 bg-ink-900 border border-ink-700 rounded-xl text-sm text-ink-100 placeholder:text-ink-600 resize-none focus:outline-none focus:border-ink-500"
            style={{ maxHeight: '100px', overflowY: 'auto' }}
            disabled={isLoading || applying}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || applying}
            className="flex-shrink-0 p-2.5 bg-section-alignment rounded-xl text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
