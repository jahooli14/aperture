import React, { useState, useEffect } from 'react'
import { ConnectionsList } from '../connections/ConnectionsList'
import { Lightbulb, Zap, PenTool, X, ChevronDown } from 'lucide-react'
import { Project } from '../../types'
import { useProjectStore } from '../../stores/useProjectStore'
import { motion, AnimatePresence } from 'framer-motion'

interface StudioTabProps {
  project: Project
}

interface MagicResult {
  ghost: string
  provocations: string[]
  connections: Array<{ title: string; type: string; insight: string }>
}

export function StudioTab({ project }: StudioTabProps) {
  const { updateProject } = useProjectStore()
  const [draft, setDraft] = useState(project.metadata?.studio_draft || '')
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [connectionCount, setConnectionCount] = useState(0)
  const [isLoadingConnections, setIsLoadingConnections] = useState(true)

  // Magic state
  const [magicResult, setMagicResult] = useState<MagicResult | null>(null)
  const [magicLoading, setMagicLoading] = useState(false)
  const [showMagicPanel, setShowMagicPanel] = useState(false)

  // Auto-save
  useEffect(() => {
    const timer = setTimeout(() => {
      if (draft !== (project.metadata?.studio_draft || '')) {
        handleSave()
      }
    }, 3000)
    return () => clearTimeout(timer)
  }, [draft])

  const handleSave = async () => {
    if (isSaving) return
    setIsSaving(true)
    try {
      await updateProject(project.id, {
        metadata: { ...project.metadata, studio_draft: draft },
      })
      setLastSaved(new Date())
    } catch (error) {
      console.error('Failed to save draft:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleMakeMagic = async () => {
    if (magicLoading) return
    setMagicLoading(true)
    setShowMagicPanel(false)

    try {
      const res = await fetch('/api/brainstorm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'studio-magic',
          projectTitle: project.title,
          projectDescription: project.description || '',
          draft,
          projectId: project.id,
        }),
      })
      const data: MagicResult = await res.json()
      setMagicResult(data)
      setShowMagicPanel(true)
    } catch {
      // silently fail — don't disrupt the writing flow
    } finally {
      setMagicLoading(false)
    }
  }

  const appendGhost = () => {
    if (!magicResult?.ghost) return
    const separator = draft.trim() ? '\n\n' : ''
    setDraft(d => d + separator + magicResult.ghost)
    setShowMagicPanel(false)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Drafting Area */}
      <div className="lg:col-span-2 space-y-4">
        {/* Magic panel — slides in above the editor */}
        <AnimatePresence>
          {showMagicPanel && magicResult && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <div
                className="rounded-xl p-5 space-y-4"
                style={{
                  background: 'rgba(99, 102, 241, 0.06)',
                  border: '1px solid rgba(99, 102, 241, 0.15)',
                }}
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <span
                    className="text-[10px] font-black uppercase tracking-[0.2em]"
                    style={{ color: 'rgba(99, 102, 241, 0.7)' }}
                  >
                    Magic
                  </span>
                  <button
                    onClick={() => setShowMagicPanel(false)}
                    className="opacity-30 hover:opacity-60 transition-opacity"
                    style={{ color: 'var(--brand-text-secondary)' }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Ghost paragraph */}
                {magicResult.ghost && (
                  <div>
                    <p
                      className="text-[13px] leading-relaxed italic mb-2"
                      style={{ color: 'var(--brand-text-secondary)', opacity: 0.7 }}
                    >
                      {magicResult.ghost}
                    </p>
                    <button
                      onClick={appendGhost}
                      className="text-[11px] font-medium px-3 py-1 rounded-full transition-all"
                      style={{
                        background: 'rgba(99, 102, 241, 0.12)',
                        color: 'rgba(129, 140, 248, 0.9)',
                        border: '1px solid rgba(99, 102, 241, 0.2)',
                      }}
                    >
                      + append to draft
                    </button>
                  </div>
                )}

                {/* Provocations */}
                {magicResult.provocations.length > 0 && (
                  <div>
                    <p
                      className="text-[10px] font-black uppercase tracking-[0.15em] mb-2"
                      style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}
                    >
                      Provocations
                    </p>
                    <ul className="space-y-1.5">
                      {magicResult.provocations.map((p, i) => (
                        <li
                          key={i}
                          className="text-[12px] leading-relaxed"
                          style={{ color: 'var(--brand-text-secondary)', opacity: 0.65 }}
                        >
                          — {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Connections */}
                {magicResult.connections.length > 0 && (
                  <div>
                    <p
                      className="text-[10px] font-black uppercase tracking-[0.15em] mb-2"
                      style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}
                    >
                      Collisions
                    </p>
                    <ul className="space-y-2">
                      {magicResult.connections.map((c, i) => (
                        <li key={i}>
                          <p
                            className="text-[11px] font-semibold"
                            style={{ color: 'var(--brand-text-secondary)', opacity: 0.55 }}
                          >
                            {c.title}
                          </p>
                          <p
                            className="text-[11px] leading-relaxed"
                            style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}
                          >
                            {c.insight}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Editor card */}
        <div className="premium-card p-6 bg-gradient-to-br from-indigo-900/10 to-purple-900/10 border-indigo-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-brand-primary/20 text-brand-primary">
                <PenTool className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--brand-text-primary)] leading-none">The Studio</h3>
                <p className="text-[10px] text-brand-text-muted uppercase tracking-widest mt-1">The Workbench for Ideas</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {lastSaved && (
                <span className="text-[10px] text-brand-text-muted font-mono">
                  SAVED: {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              {isSaving && (
                <div className="h-1.5 w-12 bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-brand-primary"
                    animate={{ x: [-48, 48] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                  />
                </div>
              )}
            </div>
          </div>

          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={"This is your blank canvas.\n\nDrop unstructured thoughts, research links, or grand visions here.\nThere are no rules in the studio."}
            className="w-full h-96 bg-transparent border-0 focus:ring-0 text-zinc-200 placeholder:text-zinc-600 resize-none font-serif text-lg leading-relaxed scroll-minimal"
          />

          <div
            className="mt-4 flex justify-between items-center pt-4"
            style={{ borderTop: '1px solid var(--glass-surface)' }}
          >
            <button
              onClick={handleMakeMagic}
              disabled={magicLoading || draft.trim().length < 20}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border flex items-center gap-2 group disabled:opacity-30"
              style={{
                background: magicLoading ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)',
                color: magicLoading ? 'rgba(129,140,248,0.9)' : 'var(--brand-text-muted)',
                borderColor: magicLoading ? 'rgba(99,102,241,0.3)' : 'var(--glass-surface)',
              }}
            >
              <Zap className="h-3 w-3 group-hover:text-indigo-400 transition-colors" />
              {magicLoading ? 'Thinking…' : 'Make it Magic'}
            </button>

            <span className="text-[10px] text-zinc-600 font-mono">
              {draft.length} CHARS
            </span>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {(connectionCount > 0 || isLoadingConnections) && (
          <div className="premium-card p-6 border-zinc-500/10">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4 text-brand-primary" />
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-brand-text-muted">Contextual Sparks</h4>
            </div>
            <div className="text-xs text-brand-text-muted mb-4 leading-relaxed">
              Automatic connections found by the Aperture Engine based on your Studio notes.
            </div>
            <ConnectionsList
              itemType="project"
              itemId={project.id}
              content={`${project.title}\n${project.description || ''}\n${draft}`}
              onCountChange={setConnectionCount}
              onLoadingChange={setIsLoadingConnections}
            />
          </div>
        )}

        <div className="premium-card p-6 border-zinc-500/10 bg-gradient-to-tr from-sky-500/5 to-transparent">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4 text-brand-text-secondary" />
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-brand-text-muted">About The Studio</h4>
          </div>
          <p className="text-xs text-brand-text-muted leading-relaxed">
            Separating <strong>Doing</strong> (Overview) from <strong>Thinking</strong> (Studio) keeps your checklist clean. Use this space to get messy before you commit to tasks.
          </p>
        </div>
      </div>
    </div>
  )
}
