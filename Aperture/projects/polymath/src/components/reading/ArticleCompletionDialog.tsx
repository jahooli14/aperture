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
      // Fetch related projects
      const projectsResponse = await fetch(`/api/projects?resource=suggestions&source_type=article&source_id=${article.id}&target_type=project&limit=3`)
      if (projectsResponse.ok) {
        const projectsData = await projectsResponse.json()
        setRelatedProjects(projectsData.suggestions || [])
      }

      // Fetch related thoughts
      const thoughtsResponse = await fetch(`/api/projects?resource=suggestions&source_type=article&source_id=${article.id}&target_type=thought&limit=3`)
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
                placeholder={`• Main insight from the article\n• How this relates to my work\n• Questions it raised`}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                rows={6}
                className="mt-2 text-base"
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
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleLinkToProject(project.id)}
                              className="text-xs px-3 py-1 h-auto"
                            >
                              Link
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate(`/projects/${project.id}`)}
                              className="h-auto p-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
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
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleLinkToThought(thought.id)}
                              className="text-xs px-3 py-1 h-auto"
                            >
                              Link
                            </Button>
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
