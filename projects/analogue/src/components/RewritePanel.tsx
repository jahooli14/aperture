import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Wand2, Send, Check, RotateCcw, Loader2, AlertCircle } from 'lucide-react'
import { useAIStore } from '../stores/useAIStore'
import { streamRewrite } from '../lib/gemini'
import type { GeminiContext } from '../lib/gemini'

const PRESETS: { label: string; instruction: string }[] = [
  { label: 'Tighten', instruction: 'Cut the flab. Same meaning, fewer words, stronger verbs.' },
  { label: 'Sharper', instruction: 'Make it more vivid and specific. Concrete nouns, sharper images.' },
  { label: 'Simpler', instruction: 'Plainer language. Shorter sentences. Nothing ornate.' },
  { label: 'Smoother', instruction: 'Fix the rhythm and any clunky transitions so it reads aloud well.' },
  { label: 'Show, don’t tell', instruction: 'Turn stated emotion or summary into action, sensation, and detail.' },
  { label: 'Fix grammar', instruction: 'Fix grammar, punctuation, and typos only. Do not change the style.' },
  { label: 'Shorter', instruction: 'Cut this to about half the length, keeping only what matters.' },
]

interface Props {
  passage: string
  ctx: GeminiContext
  onClose: () => void
  onAccept: (newText: string) => void
}

export default function RewritePanel({ passage, ctx, onClose, onAccept }: Props) {
  const apiKey = useAIStore(s => s.apiKey) || import.meta.env.VITE_GEMINI_API_KEY || null
  const [custom, setCustom] = useState('')
  const [result, setResult] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastInstruction, setLastInstruction] = useState<string | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    resultRef.current?.scrollTo({ top: resultRef.current.scrollHeight })
  }, [result])

  const run = async (instruction: string) => {
    if (!apiKey) {
      setError('Add a Google AI key in the AI assistant first.')
      return
    }
    if (isStreaming) return
    setLastInstruction(instruction)
    setResult('')
    setError(null)
    setIsStreaming(true)
    try {
      let full = ''
      for await (const chunk of streamRewrite(apiKey, passage, instruction, ctx)) {
        full += chunk
        setResult(full)
      }
      setResult(full.trim())
    } catch (err) {
      const m = err instanceof Error ? err.message : 'Something went wrong'
      setError(m.includes('API_KEY') || m.includes('403') ? 'Invalid API key.' : m)
    } finally {
      setIsStreaming(false)
    }
  }

  const handleCustom = () => {
    const text = custom.trim()
    if (!text) return
    setCustom('')
    run(text)
  }

  const hasResult = result.length > 0 || isStreaming

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-ink-900 border-t border-ink-700 rounded-t-2xl flex flex-col"
        style={{ maxHeight: '88vh' }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-ink-700 flex-shrink-0">
          <Wand2 className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-ink-100 flex-1">Rewrite passage</span>
          <button onClick={onClose} className="p-1.5 rounded text-ink-400 hover:text-ink-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div ref={resultRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {/* Original */}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-ink-600 mb-1">Original</p>
            <p className="text-sm text-ink-400 leading-relaxed whitespace-pre-wrap line-clamp-6">
              {passage}
            </p>
          </div>

          {/* Result */}
          {hasResult && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-amber-500/80 mb-1">
                {isStreaming ? 'Rewriting…' : 'Rewritten'}
              </p>
              <div className="text-sm text-ink-100 leading-relaxed whitespace-pre-wrap bg-amber-950/20 border border-amber-800/30 rounded-lg p-3">
                {result || (
                  <span className="flex items-center gap-2 text-ink-400">
                    <Loader2 className="w-3 h-3 animate-spin" /> Thinking…
                  </span>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-900/30 border border-red-800/50 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* Accept / retry bar */}
        {result && !isStreaming && (
          <div className="flex gap-2 px-3 py-2 border-t border-ink-800 flex-shrink-0">
            <button
              onClick={() => onAccept(result.trim())}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-600 rounded-lg text-sm font-medium text-white"
            >
              <Check className="w-4 h-4" /> Replace
            </button>
            <button
              onClick={() => lastInstruction && run(lastInstruction)}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-ink-800 border border-ink-700 rounded-lg text-sm text-ink-300"
            >
              <RotateCcw className="w-4 h-4" /> Again
            </button>
          </div>
        )}

        {/* Presets */}
        <div className="px-3 py-2 border-t border-ink-800 flex gap-2 overflow-x-auto flex-shrink-0">
          {PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => run(p.instruction)}
              disabled={isStreaming}
              className="flex-shrink-0 px-3 py-1.5 bg-ink-800 hover:bg-ink-700 border border-ink-700 rounded-full text-xs text-ink-300 hover:text-ink-100 disabled:opacity-40 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom instruction */}
        <div className="px-3 py-3 border-t border-ink-700 flex gap-2 items-end flex-shrink-0 pb-safe">
          <textarea
            value={custom}
            onChange={e => setCustom(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleCustom()
              }
            }}
            placeholder="Or describe the change you want…"
            rows={1}
            className="flex-1 px-3 py-2 bg-ink-800 border border-ink-700 rounded-xl text-sm text-ink-100 placeholder:text-ink-500 resize-none focus:outline-none focus:border-amber-600"
            style={{ maxHeight: '100px', fontSize: '16px' }}
          />
          <button
            onClick={handleCustom}
            disabled={!custom.trim() || isStreaming}
            className="p-2.5 bg-amber-600 rounded-xl text-white disabled:opacity-40 flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </>
  )
}
