/**
 * Daily Actionable Queue Page
 * Shows max 3 projects for today based on context
 */

import { useEffect, useState } from 'react'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { VoiceInput } from '../components/VoiceInput'
import { Zap, Settings, Clock, Battery, MapPin, ArrowRight, X, Sparkles, Lightbulb } from 'lucide-react'
import type { ProjectScore, UserContext, DailyQueueResponse, GapPrompt, CreativeOpportunity } from '../types'

export function DailyQueuePage() {
  const [queue, setQueue] = useState<ProjectScore[]>([])
  const [context, setContext] = useState<UserContext | null>(null)
  const [totalProjects, setTotalProjects] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showContextDialog, setShowContextDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gapPrompts, setGapPrompts] = useState<GapPrompt[]>([])
  const [creativeOpportunities, setCreativeOpportunities] = useState<CreativeOpportunity[]>([])
  const [promptsLoading, setPromptsLoading] = useState(false)
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(false)

  useEffect(() => {
    fetchQueue()
    fetchGapPrompts()
    fetchCreativeOpportunities()
  }, [])

  const fetchQueue = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/projects?resource=daily-queue')
      if (!response.ok) throw new Error('Failed to fetch queue')
      const data: DailyQueueResponse = await response.json()
      setQueue(data.queue)
      setContext(data.context)
      setTotalProjects(data.total_projects)
    } catch (err) {
      console.error('Failed to fetch queue:', err)
      setError(err instanceof Error ? err.message : 'Failed to load queue')
    } finally {
      setLoading(false)
    }
  }

  const updateContext = async (newContext: Partial<UserContext>) => {
    try {
      const response = await fetch('/api/projects?resource=context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContext)
      })
      if (!response.ok) throw new Error('Failed to update context')
      const data = await response.json()
      setContext(data.context)
      setShowContextDialog(false)
      // Refresh queue with new context
      fetchQueue()
    } catch (err) {
      console.error('Failed to update context:', err)
    }
  }

  const fetchGapPrompts = async () => {
    setPromptsLoading(true)
    try {
      const response = await fetch('/api/onboarding?resource=gap-analysis')
      if (response.ok) {
        const data = await response.json()
        setGapPrompts(data.prompts || [])
      }
    } catch (err) {
      console.error('Failed to fetch gap prompts:', err)
    } finally {
      setPromptsLoading(false)
    }
  }

  const fetchCreativeOpportunities = async () => {
    setOpportunitiesLoading(true)
    try {
      const response = await fetch('/api/analytics?resource=opportunities')
      if (response.ok) {
        const data = await response.json()
        setCreativeOpportunities(data.opportunities || [])
      }
    } catch (err) {
      console.error('Failed to fetch creative opportunities:', err)
    } finally {
      setOpportunitiesLoading(false)
    }
  }

  const skipProject = (projectId: string) => {
    setQueue(prev => prev.filter(p => p.project_id !== projectId))
  }

  const dismissPrompt = (promptId: string) => {
    setGapPrompts(prev => prev.filter(p => p.id !== promptId))
  }

  const dismissOpportunity = (oppId: string) => {
    setCreativeOpportunities(prev => prev.filter(o => o.id !== oppId))
  }

  const handlePromptResponse = (promptId: string, transcript: string) => {
    // TODO: Save the response to the database
    console.log('Gap prompt response:', { promptId, transcript })
    // For now, just dismiss the prompt
    dismissPrompt(promptId)
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'hot_streak': return '🔥'
      case 'needs_attention': return '⚠️'
      case 'fresh_energy': return '✨'
      default: return '💡'
    }
  }

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'hot_streak': return 'Hot Streak'
      case 'needs_attention': return 'Needs Attention'
      case 'fresh_energy': return 'Fresh Energy'
      default: return 'Available'
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'hot_streak': return 'from-blue-500 to-red-500'
      case 'needs_attention': return 'from-amber-500 to-blue-500'
      case 'fresh_energy': return 'from-purple-500 to-pink-500'
      default: return 'from-gray-400 to-gray-500'
    }
  }

  const formatTime = (minutes?: number) => {
    if (!minutes) return '~1 hour'
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours} hour${hours > 1 ? 's' : ''}`
  }

  const formatEnergy = (energy?: string) => {
    if (!energy) return 'Moderate'
    return energy.charAt(0).toUpperCase() + energy.slice(1)
  }

  if (loading) {
    return (
      <div className="min-h-screen py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="pro-card">
            <CardContent className="py-24">
              <div className="text-center text-neutral-600">
                <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-900 border-r-transparent mb-4"></div>
                <p className="text-lg">Loading your queue...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-12 pb-24">
      {/* Header */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
        <div className="text-center">
          <div className="inline-flex items-center justify-center mb-4">
            <Zap className="h-12 w-12 text-blue-900" />
          </div>
          <h1 className="text-4xl font-bold mb-3" style={{ color: 'var(--premium-text-primary)' }}>
            Today's Focus
          </h1>
          <p className="text-lg" style={{ color: 'var(--premium-text-secondary)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Context Bar */}
        {context && (
          <Card className="mb-8 premium-card border-2" style={{ borderColor: 'var(--premium-blue)' }}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-6 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5" style={{ color: 'var(--premium-blue)' }} />
                    <span className="font-medium" style={{ color: 'var(--premium-text-primary)' }}>
                      {context.available_time === 'quick' && 'Quick (<30 min)'}
                      {context.available_time === 'moderate' && 'Moderate (30 min - 2 hours)'}
                      {context.available_time === 'deep' && 'Deep (2+ hours)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Battery className="h-5 w-5" style={{ color: 'var(--premium-blue)' }} />
                    <span className="font-medium" style={{ color: 'var(--premium-text-primary)' }}>
                      {formatEnergy(context.current_energy)} energy
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" style={{ color: 'var(--premium-blue)' }} />
                    <span className="font-medium" style={{ color: 'var(--premium-text-primary)' }}>
                      {context.available_context.join(', ') || 'Desk'}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowContextDialog(true)}
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Edit Context
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Card className="mb-6 border-red-300 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-sm text-red-600">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Gap-Filling Prompts */}
        {gapPrompts.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--premium-text-primary)' }}>
              <Lightbulb className="h-6 w-6 text-amber-600" />
              Quick Question
            </h2>
            {gapPrompts.slice(0, 1).map(prompt => (
              <Card key={prompt.id} className="premium-card border-2" style={{ borderColor: 'var(--premium-amber)' }}>
                <CardContent className="pt-6">
                  <div className="mb-4">
                    <p className="text-lg font-medium mb-2" style={{ color: 'var(--premium-text-primary)' }}>
                      {prompt.prompt_text}
                    </p>
                    <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
                      💡 {prompt.reasoning}
                    </p>
                  </div>
                  <div className="space-y-3">
                    <VoiceInput
                      onTranscript={(transcript) => handlePromptResponse(prompt.id, transcript)}
                      maxDuration={30}
                      autoSubmit={true}
                    />
                    <Button
                      variant="outline"
                      onClick={() => dismissPrompt(prompt.id)}
                      className="w-full"
                    >
                      Skip
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Creative Opportunities */}
        {creativeOpportunities.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--premium-text-primary)' }}>
              <Sparkles className="h-6 w-6 text-purple-600" />
              Project Opportunity
            </h2>
            {creativeOpportunities.slice(0, 1).map(opp => (
              <Card key={opp.id} className="premium-card border-2" style={{ borderColor: 'var(--premium-indigo)' }}>
                <CardContent className="pt-6">
                  <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--premium-text-primary)' }}>
                    {opp.title}
                  </h3>
                  <p className="mb-4" style={{ color: 'var(--premium-text-secondary)' }}>
                    {opp.description}
                  </p>

                  <div className="mb-4 p-4 premium-glass-subtle rounded-lg">
                    <p className="text-sm font-medium mb-2" style={{ color: 'var(--premium-text-primary)' }}>
                      Why this fits you:
                    </p>
                    <ul className="space-y-1">
                      {opp.why_you.map((reason, i) => (
                        <li key={i} className="text-sm flex items-start gap-2" style={{ color: 'var(--premium-text-secondary)' }}>
                          <span style={{ color: 'var(--premium-indigo)' }} className="mt-1">✓</span>
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {opp.revenue_potential && (
                    <div className="mb-4 p-3 premium-glass-subtle rounded-lg border" style={{ borderColor: 'var(--premium-emerald)' }}>
                      <p className="text-sm font-medium" style={{ color: 'var(--premium-emerald)' }}>
                        💰 Revenue potential: {opp.revenue_potential}
                      </p>
                    </div>
                  )}

                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2" style={{ color: 'var(--premium-text-primary)' }}>
                      Next steps:
                    </p>
                    <ol className="space-y-1">
                      {opp.next_steps.map((step, i) => (
                        <li key={i} className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
                          {i + 1}. {step}
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="flex gap-3">
                    <Button className="btn-primary flex-1">
                      Create Project
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => dismissOpportunity(opp.id)}
                    >
                      Not Interested
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {queue.length === 0 && !loading && (
          <Card className="pro-card">
            <CardContent className="py-16">
              <div className="max-w-2xl mx-auto text-center">
                <div className="inline-flex items-center justify-center mb-4">
                  <Zap className="h-16 w-16 text-blue-900" />
                </div>
                <h3 className="text-2xl font-bold mb-4" style={{ color: 'var(--premium-text-primary)' }}>
                  {totalProjects === 0 ? 'No active projects yet' : 'Nothing to work on right now'}
                </h3>
                <p className="text-lg mb-8" style={{ color: 'var(--premium-text-secondary)' }}>
                  {totalProjects === 0
                    ? 'Create your first project or build a suggestion to get started.'
                    : 'All your projects are either blocked or don\'t match your current context. Try changing your context or viewing all projects.'}
                </p>
                <div className="flex gap-4 justify-center">
                  <Button
                    onClick={() => window.location.href = '/projects'}
                    className="btn-primary"
                  >
                    View All Projects
                  </Button>
                  <Button
                    onClick={() => window.location.href = '/suggestions'}
                    variant="outline"
                  >
                    Browse Suggestions
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Queue Projects */}
        {queue.length > 0 && (
          <div className="space-y-6">
            {queue.map((score) => {
              const project = score.project
              const tasks = project.metadata?.tasks || []
              const nextTask = tasks.find(t => !t.done)
              const nextStep = nextTask?.text
              const progress = project.metadata?.progress

              return (
                <Card
                  key={score.project_id}
                  className="pro-card hover:shadow-xl transition-shadow"
                >
                  <CardContent className="pt-6">
                    {/* Category Badge */}
                    <div className="mb-4">
                      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium text-white bg-gradient-to-r ${getCategoryColor(score.category)}`}>
                        <span>{getCategoryIcon(score.category)}</span>
                        {getCategoryLabel(score.category)}
                      </span>
                    </div>

                    {/* Project Title & Description */}
                    <div className="mb-4">
                      <h3 className="text-2xl font-bold mb-2" style={{ color: 'var(--premium-text-primary)' }}>
                        {project.title}
                      </h3>
                      {project.description && (
                        <p style={{ color: 'var(--premium-text-secondary)' }}>{project.description}</p>
                      )}
                    </div>

                    {/* Match Reason */}
                    <div className="mb-4 p-3 premium-glass-subtle rounded-lg border" style={{ borderColor: 'var(--premium-blue)' }}>
                      <p className="text-sm font-medium" style={{ color: 'var(--premium-text-primary)' }}>
                        {score.match_reason}
                      </p>
                    </div>

                    {/* Progress Bar */}
                    {progress !== undefined && (
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium" style={{ color: 'var(--premium-text-secondary)' }}>Progress</span>
                          <span className="text-sm font-bold" style={{ color: 'var(--premium-text-primary)' }}>{progress}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-amber-500 transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Next Step */}
                    {nextStep && (
                      <div className="mb-4 p-4 bg-gradient-to-r from-blue-500 to-amber-500 rounded-lg">
                        <p className="text-sm font-medium text-white mb-1">Next Step</p>
                        <p className="text-white font-semibold">{nextStep}</p>
                      </div>
                    )}

                    {/* Requirements */}
                    <div className="mb-6 flex items-center gap-4 text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {formatTime(project.estimated_next_step_time)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Battery className="h-4 w-4" />
                        {formatEnergy(project.energy_level)} energy
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                      <Button
                        onClick={() => window.location.href = `/projects`}
                        className="btn-primary flex-1 flex items-center justify-center gap-2"
                      >
                        Continue
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => skipProject(score.project_id)}
                        className="flex items-center gap-2"
                      >
                        <X className="h-4 w-4" />
                        Skip Today
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {/* Also Available */}
            {totalProjects > queue.length && (
              <Card className="premium-card border-2 border-dashed" style={{ borderColor: 'var(--premium-text-tertiary)' }}>
                <CardContent className="pt-6 text-center">
                  <p className="mb-4" style={{ color: 'var(--premium-text-secondary)' }}>
                    💡 <strong style={{ color: 'var(--premium-text-primary)' }}>{totalProjects - queue.length} more projects</strong> available
                  </p>
                  <Button
                    onClick={() => window.location.href = '/projects'}
                    variant="outline"
                  >
                    View All Projects
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Skip Day */}
            <Card className="premium-card border-2" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
              <CardContent className="pt-6 text-center">
                <p className="mb-4 premium-text-platinum">
                  Not feeling it today? That's okay.
                </p>
                <button
                  onClick={() => setQueue([])}
                  className="px-6 py-3 rounded-lg border-2 transition-all font-medium premium-text-platinum hover:bg-white/5"
                  style={{ borderColor: 'rgba(255, 255, 255, 0.2)' }}
                >
                  🚫 Take a Break
                </button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Context Dialog */}
      {showContextDialog && context && (
        <ContextDialog
          context={context}
          onSave={updateContext}
          onClose={() => setShowContextDialog(false)}
        />
      )}
    </div>
  )
}

interface ContextDialogProps {
  context: UserContext
  onSave: (context: Partial<UserContext>) => void
  onClose: () => void
}

function ContextDialog({ context, onSave, onClose }: ContextDialogProps) {
  const [availableTime, setAvailableTime] = useState(context.available_time)
  const [currentEnergy, setCurrentEnergy] = useState(context.current_energy)
  const [availableContext, setAvailableContext] = useState(context.available_context)

  const toggleContext = (ctx: string) => {
    setAvailableContext(prev =>
      prev.includes(ctx) ? prev.filter(c => c !== ctx) : [...prev, ctx]
    )
  }

  const handleSave = () => {
    onSave({
      available_time: availableTime,
      current_energy: currentEnergy,
      available_context: availableContext
    })
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg premium-card">
        <CardContent className="pt-6">
          <h2 className="text-2xl font-bold mb-6 premium-text-platinum">Set Today's Context</h2>

          {/* Available Time */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3 premium-text-platinum">
              How much time do you have?
            </label>
            <div className="space-y-2">
              {[
                { value: 'quick', label: 'Quick (< 30 min)' },
                { value: 'moderate', label: 'Moderate (30 min - 2 hours)' },
                { value: 'deep', label: 'Deep (2+ hours)' }
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => setAvailableTime(option.value as any)}
                  className="w-full p-3 rounded-lg border-2 transition-all text-left premium-text-platinum"
                  style={{
                    borderColor: availableTime === option.value ? 'var(--premium-blue)' : 'rgba(255, 255, 255, 0.1)',
                    backgroundColor: availableTime === option.value ? 'rgba(59, 130, 246, 0.15)' : 'transparent'
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Energy Level */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3 premium-text-platinum">
              What's your energy level?
            </label>
            <div className="space-y-2">
              {[
                { value: 'low', label: 'Low (tired, maintenance only)' },
                { value: 'moderate', label: 'Moderate (normal work)' },
                { value: 'high', label: 'High (flow state, creative)' }
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => setCurrentEnergy(option.value as any)}
                  className="w-full p-3 rounded-lg border-2 transition-all text-left premium-text-platinum"
                  style={{
                    borderColor: currentEnergy === option.value ? 'var(--premium-blue)' : 'rgba(255, 255, 255, 0.1)',
                    backgroundColor: currentEnergy === option.value ? 'rgba(59, 130, 246, 0.15)' : 'transparent'
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Context */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3 premium-text-platinum">
              Where are you / what's available?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {['desk', 'computer', 'tools', 'workshop', 'mobile'].map(ctx => (
                <button
                  key={ctx}
                  onClick={() => toggleContext(ctx)}
                  className="p-3 rounded-lg border-2 transition-all premium-text-platinum"
                  style={{
                    borderColor: availableContext.includes(ctx) ? 'var(--premium-blue)' : 'rgba(255, 255, 255, 0.1)',
                    backgroundColor: availableContext.includes(ctx) ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    fontWeight: availableContext.includes(ctx) ? 600 : 400
                  }}
                >
                  {ctx.charAt(0).toUpperCase() + ctx.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              className="flex-1 px-6 py-3 rounded-lg font-medium transition-all"
              style={{
                backgroundColor: 'var(--premium-blue)',
                color: '#ffffff'
              }}
            >
              Update Queue
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-lg font-medium border-2 transition-all premium-text-platinum hover:bg-white/5"
              style={{
                borderColor: 'rgba(255, 255, 255, 0.2)'
              }}
            >
              Cancel
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
