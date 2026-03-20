import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Bot, AlertCircle, Key, Loader2 } from 'lucide-react'
import { useAIStore } from '../stores/useAIStore'
import type { GeminiContext } from '../lib/gemini'

const QUICK_ACTIONS = [
  { label: 'Continue the scene', prompt: 'Continue this scene from where it leaves off. Write the next 2–3 paragraphs, matching the existing voice and tone.' },
  { label: 'What next?', prompt: 'What could happen next in this scene or the next scene? Give me 3 concrete ideas.' },
  { label: 'Punch it up', prompt: 'Rewrite the last paragraph with more energy, specificity, and emotional punch. Keep the same meaning.' },
  { label: 'Summarise', prompt: 'Write a one-sentence scene beat summarising what happens in this scene.' },
  { label: 'Check the flow', prompt: 'Read the scene and tell me: does it flow well? Are there any clunky transitions, repetitions, or places where the pace drags? Be specific.' },
]

interface Props {
  isOpen: boolean
  onClose: () => void
  ctx: GeminiContext
}

export default function AIAssistantDrawer({ isOpen, onClose, ctx }: Props) {
  const { apiKey, messages, isLoading, streamingContent, error, setApiKey, sendMessage, clearMessages, clearError } = useAIStore()
  const [input, setInput] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const [showKeyInput, setShowKeyInput] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleSend = async (messageText?: string) => {
    const text = (messageText ?? input).trim()
    if (!text || isLoading) return
    setInput('')
    await sendMessage(text, ctx)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSaveKey = () => {
    if (keyInput.trim()) {
      setApiKey(keyInput.trim())
      setKeyInput('')
      setShowKeyInput(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/30"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-ink-900 border-t border-ink-700 rounded-t-2xl flex flex-col"
            style={{ maxHeight: '80vh', height: '72vh' }}
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-ink-700 flex-shrink-0">
              <Bot className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-ink-100 flex-1">AI Assistant</span>
              <span className="text-xs text-ink-500 mr-2">gemini-3.1-flash-lite</span>
              <button
                onClick={() => { setShowKeyInput(!showKeyInput); clearError() }}
                className="p-1.5 rounded text-ink-400 hover:text-ink-200"
                title="API Key"
              >
                <Key className="w-4 h-4" />
              </button>
              {messages.length > 0 && (
                <button
                  onClick={clearMessages}
                  className="text-xs text-ink-500 hover:text-ink-300 px-2 py-1"
                >
                  Clear
                </button>
              )}
              <button onClick={onClose} className="p-1.5 rounded text-ink-400 hover:text-ink-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* API Key Input */}
            <AnimatePresence>
              {showKeyInput && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden flex-shrink-0"
                >
                  <div className="p-3 bg-ink-800 border-b border-ink-700 flex gap-2">
                    <input
                      type="password"
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      placeholder="Paste Google AI Studio API key..."
                      className="flex-1 px-3 py-2 bg-ink-900 border border-ink-600 rounded-lg text-sm text-ink-100 placeholder:text-ink-600"
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveKey()}
                      autoFocus
                    />
                    <button
                      onClick={handleSaveKey}
                      disabled={!keyInput.trim()}
                      className="px-3 py-2 bg-purple-600 rounded-lg text-sm text-white disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                  <div className="px-3 py-1.5 bg-ink-800 border-b border-ink-700">
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-purple-400 underline"
                    >
                      Get a key from Google AI Studio →
                    </a>
                    {apiKey && (
                      <span className="text-xs text-green-400 ml-3">✓ Key saved</span>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* No API key prompt */}
            {!apiKey && !showKeyInput && (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-3">
                <Bot className="w-8 h-8 text-purple-400/50" />
                <p className="text-ink-300 text-sm">Add your Google AI Studio key to start chatting with your manuscript.</p>
                <button
                  onClick={() => setShowKeyInput(true)}
                  className="px-4 py-2 bg-purple-600 rounded-lg text-sm text-white"
                >
                  Add API Key
                </button>
              </div>
            )}

            {/* Messages */}
            {apiKey && (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                  {messages.length === 0 && !isLoading && (
                    <div className="text-center py-4">
                      <p className="text-ink-500 text-sm">Ask anything about your scene, or use a quick action below.</p>
                    </div>
                  )}

                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                          msg.role === 'user'
                            ? 'bg-purple-600 text-white rounded-br-sm'
                            : 'bg-ink-800 text-ink-100 rounded-bl-sm'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}

                  {/* Streaming response */}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm leading-relaxed bg-ink-800 text-ink-100 whitespace-pre-wrap">
                        {streamingContent || (
                          <span className="flex items-center gap-2 text-ink-400">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Thinking...
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

                  <div ref={messagesEndRef} />
                </div>

                {/* Quick actions */}
                <div className="px-3 py-2 border-t border-ink-800 flex gap-2 overflow-x-auto flex-shrink-0">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => handleSend(action.prompt)}
                      disabled={isLoading}
                      className="flex-shrink-0 px-3 py-1.5 bg-ink-800 hover:bg-ink-700 border border-ink-700 rounded-full text-xs text-ink-300 hover:text-ink-100 disabled:opacity-40 transition-colors"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>

                {/* Input */}
                <div className="px-3 py-3 border-t border-ink-700 flex gap-2 items-end flex-shrink-0 pb-safe">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything about your scene..."
                    rows={1}
                    className="flex-1 px-3 py-2 bg-ink-800 border border-ink-700 rounded-xl text-sm text-ink-100 placeholder:text-ink-500 resize-none focus:outline-none focus:border-purple-600"
                    style={{ maxHeight: '100px' }}
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isLoading}
                    className="p-2.5 bg-purple-600 rounded-xl text-white disabled:opacity-40 flex-shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
