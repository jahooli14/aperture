/**
 * Article Completion Dialog
 * Shown when marking article as read - captures thoughts about the article
 */

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { Label } from '../ui/label'
import { Mic, Type, Loader2 } from 'lucide-react'
import { VoiceInput } from '../VoiceInput'
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
        <DialogHeader>
          <DialogTitle className="text-xl">Capture Your Thoughts</DialogTitle>
          <DialogDescription className="text-base">
            What did you learn from "{article.title}"?
          </DialogDescription>
        </DialogHeader>

        {/* Mode Toggle */}
        <div className="flex gap-2 justify-center my-4">
          <Button
            variant={mode === 'text' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('text')}
            className="gap-2"
          >
            <Type className="h-4 w-4" />
            Text
          </Button>
          <Button
            variant={mode === 'voice' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('voice')}
            className="gap-2"
          >
            <Mic className="h-4 w-4" />
            Voice
          </Button>
        </div>

        {/* Text Mode */}
        {mode === 'text' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="thought-text" className="text-sm">
                Your thoughts (key takeaways, questions, connections)
              </Label>
              <Textarea
                id="thought-text"
                placeholder="• Main insight from the article&#10;• How this relates to my work&#10;• Questions it raised"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                rows={6}
                className="mt-2 text-base"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                onClick={handleSkip}
                disabled={loading}
              >
                Skip
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!textInput.trim() || loading}
                className="gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Thought
              </Button>
            </div>
          </div>
        )}

        {/* Voice Mode */}
        {mode === 'voice' && (
          <div className="space-y-4">
            <div className="text-sm text-neutral-600 text-center mb-4">
              Record your thoughts about this article
            </div>

            <VoiceInput
              onTranscript={handleVoiceTranscript}
            />

            <div className="flex justify-center">
              <Button
                variant="ghost"
                onClick={handleSkip}
                disabled={loading}
                size="sm"
              >
                Skip for now
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
