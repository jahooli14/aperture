/**
 * Article Completion Dialog
 * Shown when marking article as read - captures thoughts about the article
 * Now with automatic project and thought suggestions for seamless interlinking
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { Label } from '../ui/label'
import { Mic, Type, Loader2, Target, ExternalLink, Brain } from 'lucide-react'
import { VoiceInput } from '../VoiceInput'
import type { Article } from '../../types/reading'
import type { Project, Memory } from '../../types'

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
  const navigate = useNavigate()
  const [mode, setMode] = useState<'voice' | 'text'>('text')
  const [textInput, setTextInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [relatedProjects, setRelatedProjects] = useState<Project[]>([])
  const [relatedThoughts, setRelatedThoughts] = useState<Memory[]>([])
  const [loadingRelated, setLoadingRelated] = useState(false)

  // Fetch related projects and thoughts when dialog opens
  useEffect(() => {
    if (open && article) {
      fetchRelatedItems()
    }
  }, [open, article])

  const fetchRelatedItems = async () => {
    if (!article) return

    setLoadingRelated(true)
    try {
      // Fetch related projects (from connection_suggestions table via connections API)
      const projectsResponse = await fetch(`/api/connections?action=suggestions&id=${article.id}&type=article&target_type=project&limit=3`)
      if (projectsResponse.ok) {
        const projectsData = await projectsResponse.json()
        setRelatedProjects(projectsData.suggestions || [])
      }

      // Fetch related thoughts (from connection_suggestions table via connections API)
      const thoughtsResponse = await fetch(`/api/connections?action=suggestions&id=${article.id}&type=article&target_type=memory&limit=3`)
      if (thoughtsResponse.ok) {
        const thoughtsData = await thoughtsResponse.json()
        setRelatedThoughts(thoughtsData.suggestions || [])
      }
    } catch (error) {
      console.error('Failed to fetch related items:', error)
    } finally {
      setLoadingRelated(false)
    }
  }

  const handleLinkToProject = async (projectId: string) => {
    if (!article) return

    try {
      await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: 'article',
          source_id: article.id,
          target_type: 'project',
          target_id: projectId
        })
      })
      // Remove from suggestions after linking
      setRelatedProjects(prev => prev.filter(p => p.id !== projectId))
    } catch (error) {
      console.error('Failed to link article to project:', error)
    }
  }

  const handleLinkToThought = async (thoughtId: string) => {
    if (!article) return

    try {
      await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: 'article',
          source_id: article.id,
          target_type: 'thought',
          target_id: thoughtId
        })
      })
      // Remove from suggestions after linking
      setRelatedThoughts(prev => prev.filter(t => t.id !== thoughtId))
    } catch (error) {
      console.error('Failed to link article to thought:', error)
    }
  }

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
          <DialogTitle className="text-2xl font-bold mb-3" style={{ color: 'var(--premium-text-primary)' }}>
            Capture Your Thoughts
          </DialogTitle>
          <DialogDescription className="text-base leading-relaxed" style={{ color: 'var(--premium-text-secondary)' }}>
            What did you learn from "{article.title}"?
          </DialogDescription>
        </DialogHeader>

        {/* Mode Toggle */}
        <div className="flex gap-3 justify-center my-6">
          <button
            onClick={() => setMode('text')}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl font-medium transition-all"
            style={{
              backgroundColor: mode === 'text' ? 'var(--premium-blue)' : 'rgba(255, 255, 255, 0.05)',
              color: mode === 'text' ? 'white' : 'var(--premium-text-secondary)',
              transform: mode === 'text' ? 'scale(1.05)' : 'scale(1)'
            }}
          >
            <Type className="h-5 w-5" />
            Text
          </button>
          <button
            onClick={() => setMode('voice')}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl font-medium transition-all"
            style={{
              backgroundColor: mode === 'voice' ? 'var(--premium-blue)' : 'rgba(255, 255, 255, 0.05)',
              color: mode === 'voice' ? 'white' : 'var(--premium-text-secondary)',
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
              <Label htmlFor="thought-text" className="text-sm font-medium mb-2 block" style={{ color: 'var(--premium-text-primary)' }}>
                Your thoughts (key takeaways, questions, connections)
              </Label>
              <textarea
                id="thought-text"
                placeholder={`• Main insight from the article\n• How this relates to my work\n• Questions it raised`}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                rows={6}
                className="w-full rounded-xl px-4 py-3 text-base transition-all focus:outline-none focus:ring-2 resize-none"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--premium-text-primary)',
                  borderWidth: '1px',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  borderStyle: 'solid',
                  fontFamily: 'inherit'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--premium-blue)'
                  e.target.style.backgroundColor = 'rgba(59, 130, 246, 0.05)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                  e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
                }}
              />
            </div>

            {/* Related Items Section */}
            {(relatedProjects.length > 0 || relatedThoughts.length > 0) && (
              <div className="pt-4 border-t space-y-4" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                {/* Related Projects */}
                {relatedProjects.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="h-4 w-4" style={{ color: 'var(--premium-blue)' }} />
                      <h4 className="text-sm font-semibold" style={{ color: 'var(--premium-text-primary)' }}>
                        Related Projects
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {relatedProjects.map((project) => (
                        <div
                          key={project.id}
                          className="flex items-center justify-between gap-2 p-3 rounded-lg border hover:bg-white/5 transition-all"
                          style={{ borderColor: 'rgba(59, 130, 246, 0.2)', backgroundColor: 'rgba(59, 130, 246, 0.05)' }}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'var(--premium-text-primary)' }}>
                              {project.title}
                            </p>
                            {project.description && (
                              <p className="text-xs truncate" style={{ color: 'var(--premium-text-tertiary)' }}>
                                {project.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleLinkToProject(project.id)}
                              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:bg-white/10"
                              style={{
                                color: 'var(--premium-blue)'
                              }}
                            >
                              Link
                            </button>
                            <button
                              onClick={() => navigate(`/projects/${project.id}`)}
                              className="p-1.5 rounded-lg transition-all hover:bg-white/10"
                              style={{
                                color: 'var(--premium-text-secondary)'
                              }}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Related Thoughts */}
                {relatedThoughts.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Brain className="h-4 w-4" style={{ color: 'var(--premium-indigo)' }} />
                      <h4 className="text-sm font-semibold" style={{ color: 'var(--premium-text-primary)' }}>
                        Related Thoughts
                      </h4>
                    </div>
                    <div className="space-y-2">
                      {relatedThoughts.map((thought) => (
                        <div
                          key={thought.id}
                          className="flex items-center justify-between gap-2 p-3 rounded-lg border hover:bg-white/5 transition-all"
                          style={{ borderColor: 'rgba(99, 102, 241, 0.2)', backgroundColor: 'rgba(99, 102, 241, 0.05)' }}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'var(--premium-text-primary)' }}>
                              {thought.title}
                            </p>
                            {thought.body && (
                              <p className="text-xs truncate" style={{ color: 'var(--premium-text-tertiary)' }}>
                                {thought.body}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleLinkToThought(thought.id)}
                              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:bg-white/10"
                              style={{
                                color: 'var(--premium-blue)'
                              }}
                            >
                              Link
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {loadingRelated && (
              <div className="flex items-center justify-center gap-2 py-3 text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
                <Loader2 className="h-4 w-4 animate-spin" />
                Finding related items...
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={handleSkip}
                disabled={loading}
                className="px-6 py-3 rounded-xl font-medium transition-all hover:bg-white/5"
                style={{
                  color: 'var(--premium-text-secondary)'
                }}
              >
                Skip
              </button>
              <button
                onClick={handleSubmit}
                disabled={!textInput.trim() || loading}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50"
                style={{
                  backgroundColor: !textInput.trim() || loading ? 'rgba(59, 130, 246, 0.3)' : 'var(--premium-blue)',
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
            <div className="text-sm text-center mb-4" style={{ color: 'var(--premium-text-secondary)' }}>
              Record your thoughts about this article
            </div>

            <VoiceInput
              onTranscript={handleVoiceTranscript}
            />

            <div className="flex justify-center">
              <button
                onClick={handleSkip}
                disabled={loading}
                className="px-6 py-3 rounded-xl font-medium transition-all hover:bg-white/5"
                style={{
                  color: 'var(--premium-text-secondary)'
                }}
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
