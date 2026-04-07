/**
 * Article Completion Dialog
 * Shown when marking article as read - captures thoughts about the article
 * Now with automatic project and thought suggestions for seamless interlinking
 */

import { useState, useEffect } from 'react'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { Label } from '../ui/label'
import { Mic, Type, Loader2 } from 'lucide-react'
import { VoiceInput } from '../VoiceInput'
import { ItemInsightStrip } from '../ItemInsightStrip'
import type { Article } from '../../types/reading'

interface ArticleCompletionDialogProps {
  article: Article | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onCapture: (data: { text?: string; audio?: Blob }) => Promise<void>
  onSkip: () => void
}

export function ArticleCompletionDialog({
  article,
  open,
  onOpenChange,
  onCapture,
  onSkip
}: ArticleCompletionDialogProps) {

  const [mode, setMode] = useState<'voice' | 'text'>('text')
  const [textInput, setTextInput] = useState('')
  const [loading, setLoading] = useState(false)


  const handleSubmit = async () => {
    if (!textInput.trim()) return

    setLoading(true)
    try {
      await onCapture({ text: textInput })
      setTextInput('')
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to capture thought:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleVoiceTranscript = (text: string) => {
    // VoiceInput provides transcript - we'll capture it as text
    setLoading(true)
    onCapture({ text })
      .then(() => {
        onOpenChange(false)
      })
      .catch((error) => {
        console.error('Failed to capture voice thought:', error)
      })
      .finally(() => {
        setLoading(false)
      })
  }

  const handleSkip = () => {
    onSkip()
    onOpenChange(false)
  }

  if (!article) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader className="mb-2">
          <DialogTitle className="text-2xl font-bold mb-3" style={{ color: "var(--brand-primary)" }}>
            Capture Your Thoughts
          </DialogTitle>
          <DialogDescription className="text-base leading-relaxed" style={{ color: "var(--brand-primary)" }}>
            What did you learn from "{article.title}"?
          </DialogDescription>
        </DialogHeader>

        {/* Mode Toggle */}
        <div className="flex gap-3 justify-center my-6">
          <button
            onClick={() => setMode('text')}
            className="flex items-center gap-2 px-6 py-3 font-medium transition-all"
            style={{
              borderRadius: '4px',
              boxShadow: mode === 'text' ? '0 4px 16px rgba(0,0,0,0.5)' : '0 2px 8px rgba(0,0,0,0.3)',
              backgroundColor: mode === 'text' ? 'var(--brand-primary)' : 'var(--glass-surface)',
              color: mode === 'text' ? 'white' : 'var(--brand-text-secondary)',
              transform: mode === 'text' ? 'scale(1.05)' : 'scale(1)'
            }}
          >
            <Type className="h-5 w-5" />
            Text
          </button>
          <button
            onClick={() => setMode('voice')}
            className="flex items-center gap-2 px-6 py-3 font-medium transition-all"
            style={{
              borderRadius: '4px',
              boxShadow: mode === 'voice' ? '0 4px 16px rgba(0,0,0,0.5)' : '0 2px 8px rgba(0,0,0,0.3)',
              backgroundColor: mode === 'voice' ? 'var(--brand-primary)' : 'var(--glass-surface)',
              color: mode === 'voice' ? 'white' : 'var(--brand-text-secondary)',
              transform: mode === 'voice' ? 'scale(1.05)' : 'scale(1)'
            }}
          >
            <Mic className="h-5 w-5" />
            Voice
          </button>
        </div>

        {/* Text Mode */}
        {mode === 'text' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="thought-text" className="text-sm font-medium mb-2 block" style={{ color: "var(--brand-primary)" }}>
                Your thoughts (key takeaways, questions, connections)
              </Label>
              <textarea
                id="thought-text"
                placeholder={` Main insight from the article\n How this relates to my work\n Questions it raised`}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                rows={6}
                className="w-full rounded-lg px-4 py-3 text-base transition-all focus:outline-none focus:ring-2 resize-none"
                style={{
                  backgroundColor: 'var(--glass-surface)',
                  color: 'var(--brand-text-primary)',
                  borderWidth: '1px',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  borderStyle: 'solid',
                  fontFamily: 'inherit'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--brand-primary)'
                  e.target.style.backgroundColor = 'rgba(59, 130, 246, 0.05)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                  e.target.style.backgroundColor = 'var(--glass-surface)'
                }}
              />
            </div>

            <ItemInsightStrip title={article.title ?? ''} />

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={handleSkip}
                disabled={loading}
                className="px-6 py-3 rounded-xl font-medium transition-all hover:bg-[var(--glass-surface)]"

                style={{ color: "var(--brand-primary)" }}
              >
                Skip
              </button>
              <button
                onClick={handleSubmit}
                disabled={!textInput.trim() || loading}
                className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all disabled:opacity-50"
                style={{
                  backgroundColor: !textInput.trim() || loading ? 'rgba(59, 130, 246, 0.3)' : 'var(--brand-primary)',
                  color: 'white'
                }}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Thought
              </button>
            </div>
          </div>
        )}

        {/* Voice Mode */}
        {mode === 'voice' && (
          <div className="space-y-6">
            <div className="text-sm text-center mb-4" style={{ color: "var(--brand-primary)" }}>
              Record your thoughts about this article
            </div>

            <VoiceInput
              onTranscript={handleVoiceTranscript}
            />

            <div className="flex justify-center">
              <button
                onClick={handleSkip}
                disabled={loading}
                className="px-6 py-3 rounded-xl font-medium transition-all hover:bg-[var(--glass-surface)]"

                style={{ color: "var(--brand-primary)" }}
              >
                Skip for now
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
