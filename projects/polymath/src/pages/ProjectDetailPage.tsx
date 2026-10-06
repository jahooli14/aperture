/**
 * Project Detail Page
 *
 * Two jobs, and nothing else competing with them:
 *   - a project you're working on: the one next move, Go, and a box to tell
 *     it what changed (NextMovePanel);
 *   - a project you've put down: enough to remember what it is and where you
 *     stopped — what it's about, when you last touched it, your own last
 *     note, a move that gets you back in — so you can pick it up in a minute.
 *
 * Below the move: the finish line if there is one, how far along it is, what
 * you've made, and a notes space. The Guide chat, the old step list, the
 * lineage breadcrumb and the "what's pausing this" prompt used to sit here
 * too; each answered "what next?" a little differently from the card above it.
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, MoreVertical, Target, Star, Sprout, ArrowLeft } from 'lucide-react'
import { useProjectStore } from '../stores/useProjectStore'
import { useSessionStore } from '../stores/useSessionStore'
import { SessionContract } from '../components/session/SessionContract'
import { ProjectNotes } from '../components/projects/ProjectNotes'
import { ProjectArc } from '../components/projects/ProjectArc'
import { MadeWall } from '../components/projects/MadeWall'
import { NextMovePanel } from '../components/projects/NextMovePanel'
import { Button } from '../components/ui/button'
import { useToast } from '../components/ui/toast'
import { useConfirmDialog } from '../components/ui/confirm-dialog'
import { EditProjectDialog } from '../components/projects/EditProjectDialog'
import { ProjectCompletionModal } from '../components/projects/ProjectCompletionModal'
import { CompletionRitual } from '../components/projects/CompletionRitual'
import type { Project, Memory } from '../types'
import { supabase } from '../lib/supabase'
import { fetchWithTimeout } from '../lib/network'
import { isRetired, GRAVEYARD_STATUS } from '../utils/projectStatus'

import { SubtleBackground } from '../components/SubtleBackground'
import { ApiError } from '../lib/apiClient'

/** A date, not "3 months ago": the date is a fact about the project, the
 *  count of months reads as an accusation (SPEC.md: never show time since
 *  last touched as a number). */
function lastWorkedOn(iso: string): string {
  const d = new Date(iso)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { fetchProjects, deleteProject, updateProject, syncProject, setPriority } = useProjectStore()
  const activeSessionProjectId = useSessionStore(s => s.active?.project_id ?? null)
  const [sessionOpen, setSessionOpen] = useState(false)
  // Go on the move IS the decision; "change it" opens without starting.
  const [sessionAutoStart, setSessionAutoStart] = useState(false)

  const project = useProjectStore(state => state.allProjects.find(p => p.id === id))

  // "5 mixes so far" on a project whose finish line repeats. Computed here
  // rather than imported from api/_lib/project-cycles.ts, which is the source
  // of truth for the shape but is server-side — shipped src code never reaches
  // across into api/. Kept trivial so the duplication is a plural rule.
  const cycleCount = (() => {
    const cycle = (project?.metadata as { cycle?: { unit?: unknown; done?: unknown } } | undefined)?.cycle
    const unit = typeof cycle?.unit === 'string' ? cycle.unit.trim() : ''
    const done = typeof cycle?.done === 'number' ? cycle.done : 0
    if (!unit || done <= 0) return null
    const plural = done === 1 ? unit : (/(s|x|z|ch|sh)$/i.test(unit) ? `${unit}es` : `${unit}s`)
    return `${done} ${plural} so far`
  })()

  const [sparkedByMemories, setSparkedByMemories] = useState<Memory[]>([])

  // Local-first: only block on a loader when the project isn't in the store.
  const [loading, setLoading] = useState(!project)
  const [showMenu, setShowMenu] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [showRetroRitual, setShowRetroRitual] = useState(false)
  const [showAbout, setShowAbout] = useState(false)

  const [editingGoal, setEditingGoal] = useState(false)
  const [tempGoal, setTempGoal] = useState('')
  const goalInputRef = useRef<HTMLTextAreaElement>(null)
  const { addToast } = useToast()
  const { confirm, dialog: confirmDialog } = useConfirmDialog()
  // The project currently in view. A fetch for a previous project (after
  // navigating A->B) must not write its details onto B's page.
  const activeIdRef = useRef(id)

  const loadProjectDetails = useCallback(async () => {
    if (!id) return
    if (!useProjectStore.getState().allProjects.find(p => p.id === id)) setLoading(true)
    try {
      const response = await fetchWithTimeout(`/api/projects?id=${id}`)
      if (!response.ok) throw new Error('Failed to fetch project details')
      const data = await response.json()
      if (data.project && activeIdRef.current === id) syncProject(data.project)
    } catch (error) {
      console.warn('[ProjectDetail] Fetch failed:', error)
      // Only say anything if there's cached content to fall back on, and tell
      // a real offline state from a server failure.
      if (useProjectStore.getState().allProjects.find(p => p.id === id)) {
        const offline = typeof navigator !== 'undefined' && !navigator.onLine
        addToast({
          title: offline ? 'Offline' : "Couldn't refresh",
          description: 'Showing cached project content',
          variant: 'default',
        })
      }
    } finally {
      setLoading(false)
    }
  }, [id, syncProject, addToast])

  useEffect(() => {
    activeIdRef.current = id
    // The same page instance serves every project: nothing from the last one
    // may carry over.
    setSparkedByMemories([])
    setSessionOpen(false)
    setSessionAutoStart(false)
    void loadProjectDetails()
  }, [id, loadProjectDetails])

  // A session running on this project when the page mounts is one to rejoin,
  // not to start again.
  useEffect(() => {
    if (activeSessionProjectId && activeSessionProjectId === id) setSessionOpen(true)
  }, [activeSessionProjectId, id])

  // The thought(s) this project grew from.
  useEffect(() => {
    if (!id) return
    const loadSparkedBy = async () => {
      const { data: connections } = await supabase
        .from('connections')
        .select('source_id')
        .eq('target_type', 'project')
        .eq('target_id', id)
        .eq('connection_type', 'inspired_by')
        .eq('source_type', 'memory')
      if (!connections?.length) { setSparkedByMemories([]); return }
      const memoryIds = connections.map((c: { source_id: string }) => c.source_id)
      const { data: memories } = await supabase
        .from('memories')
        .select('id, title, body, created_at')
        .in('id', memoryIds)
      setSparkedByMemories((memories as Memory[]) || [])
    }
    loadSparkedBy().catch(console.warn)
  }, [id])

  const handleDelete = async () => {
    if (!project) return
    const confirmed = await confirm({
      title: `Delete "${project.title}"?`,
      description: 'This action cannot be undone. The project and all its notes will be permanently removed.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive',
    })
    if (!confirmed) return
    try {
      await deleteProject(project.id)
      addToast({ title: 'Project deleted', description: `"${project.title}" has been removed.`, variant: 'success' })
      navigate('/projects')
    } catch (error) {
      addToast({
        title: 'Failed to delete project',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    }
  }

  const saveGoal = async () => {
    if (!project) { setEditingGoal(false); return }
    setEditingGoal(false)
    try {
      await updateProject(project.id, {
        metadata: { ...project.metadata, end_goal: tempGoal.trim(), end_goal_source: 'manual' },
      })
      addToast({ title: 'Goal updated', variant: 'success' })
    } catch (error) {
      addToast({
        title: 'Failed to update goal',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    }
  }

  const startEditGoal = () => {
    setTempGoal((project?.metadata?.end_goal as string | undefined) || '')
    setEditingGoal(true)
    setTimeout(() => goalInputRef.current?.focus(), 0)
  }

  const handleStatusChange = async (newStatus: Project['status']) => {
    if (!project) return
    try {
      await updateProject(project.id, { status: newStatus })
      if (newStatus === 'completed') {
        setShowCompletionModal(true)
        setShowRetroRitual(true)
      } else {
        addToast({ title: 'Status updated', description: `Project is now ${newStatus}`, variant: 'success' })
      }
    } catch (error) {
      addToast({
        title: 'Failed to update status',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    }
  }

  // Which one project is live: the one the home card is built around. The
  // old "priority" star and the live state are the same thing now; only the
  // wording was out of date.
  const handleToggleLive = async () => {
    if (!project) return
    try {
      await setPriority(project.id)
    } catch (err: unknown) {
      const isCapReached = err instanceof ApiError && (err.details as { error?: string } | undefined)?.error === 'focus_cap_reached'
      addToast(isCapReached
        ? {
            title: 'You already have a live project',
            description: 'Take the current one off live first, then make this one live.',
            variant: 'destructive',
          }
        : {
            title: "Couldn't change that",
            description: err instanceof Error ? err.message : 'Try again in a moment.',
            variant: 'destructive',
          })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--brand-bg)' }}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" style={{ color: 'var(--brand-primary)' }} />
          <p style={{ color: 'var(--brand-text-secondary)' }}>Loading project...</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--brand-bg)' }}>
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--brand-text-primary)' }}>Project not found</h2>
          <Button onClick={() => navigate('/projects')} variant="outline">Back to Projects</Button>
        </div>
      </div>
    )
  }

  const parked = project.status === 'dormant'
  const lastTouched = project.last_active || project.updated_at || null
  const description = project.description?.trim() || ''
  const endGoal = (project.metadata?.end_goal as string | undefined) || ''
  const hasCycle = !!(project.metadata as { cycle?: unknown } | undefined)?.cycle

  return (
    <div className="min-h-screen page-bottom relative" style={{ backgroundColor: 'var(--brand-bg)' }}>
      <SubtleBackground />
      <div className="max-w-2xl mx-auto px-5 sm:px-6 pb-4">
        <header className="page-masthead mb-6">
          <div className="page-masthead-text">
            <button
              onClick={() => navigate('/projects')}
              className="back-link"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Your projects
            </button>
          </div>
          <div className="page-masthead-actions">
            <div className="relative flex items-center gap-2">
              <button onClick={() => setShowMenu(!showMenu)} className="masthead-action press-spring" aria-label="More options">
                <MoreVertical className="h-5 w-5" />
              </button>

              {showMenu && (
                <>
                  <div className="fixed inset-0 z-50" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 w-52 max-w-[calc(100vw-2rem)] p-1.5 z-[60] dialog-surface">
                    <button
                      onClick={() => { setShowMenu(false); setShowEditDialog(true) }}
                      className="w-full px-3.5 py-3 text-left text-[14px] font-medium transition-colors hover:bg-white/[0.05] rounded-xl min-h-[44px]"
                      style={{ color: 'var(--brand-text-primary)', opacity: 0.9 }}
                    >
                      Edit details
                    </button>
                    {!isRetired(project.status) && (
                      <>
                        <button
                          onClick={() => { setShowMenu(false); handleStatusChange(parked ? 'active' : 'dormant') }}
                          className="w-full px-3.5 py-3 text-left text-[14px] font-medium transition-colors hover:bg-white/[0.05] rounded-xl min-h-[44px]"
                          style={{ color: 'var(--brand-text-primary)', opacity: 0.9 }}
                        >
                          {parked ? 'Pick this back up' : 'Park it'}
                        </button>
                        <button
                          onClick={async () => {
                            setShowMenu(false)
                            const ok = await confirm({
                              title: `Send "${project.title}" to the graveyard?`,
                              description: 'It stops surfacing on Home but stays in the graveyard view — you can revive it later.',
                              confirmText: 'Send to graveyard',
                              cancelText: 'Cancel',
                              variant: 'destructive',
                            })
                            if (ok) handleStatusChange(GRAVEYARD_STATUS)
                          }}
                          className="w-full px-3.5 py-3 text-left text-[14px] font-medium transition-colors hover:bg-white/[0.05] rounded-xl min-h-[44px]"
                          style={{ color: 'var(--brand-text-primary)', opacity: 0.9 }}
                        >
                          Send to graveyard
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => { setShowMenu(false); handleDelete() }}
                      className="w-full px-3.5 py-3 text-left text-[14px] font-medium transition-colors hover:bg-red-500/10 rounded-xl text-red-400 min-h-[44px]"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <h1 className="page-hero mb-3">{project.title}</h1>

        {/* One quiet line of state, then the chips. */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {!isRetired(project.status) && (
            <button
              onClick={handleToggleLive}
              title={project.is_priority ? 'Take this off live' : 'Make this your live project'}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors"
              style={
                project.is_priority
                  ? { color: 'rgb(var(--brand-primary-rgb))', background: 'rgba(var(--brand-primary-rgb),0.08)' }
                  : { color: 'var(--brand-text-secondary)', background: 'rgba(255,255,255,0.03)', opacity: 0.7 }
              }
            >
              <Star className={`h-3 w-3 ${project.is_priority ? 'fill-current' : ''}`} />
              {project.is_priority ? 'Live' : 'Make it live'}
            </button>
          )}
          {(parked || project.status === 'completed') && (
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--brand-text-secondary)', opacity: 0.85 }}>
              {parked ? 'Parked' : 'Finished'}
            </span>
          )}
          {((project.metadata?.tags as string[] | undefined) ?? []).slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[11px] font-medium px-2.5 py-1 rounded-lg"
              style={{ color: 'var(--brand-text-secondary)', opacity: 0.78, background: 'rgba(255,255,255,0.04)' }}
            >
              {tag}
            </span>
          ))}
          {lastTouched && (
            <span className="text-[11px]" style={{ color: 'var(--brand-text-muted)' }}>
              last worked on {lastWorkedOn(lastTouched)}
            </span>
          )}
        </div>

        {/* What it is — for the project you've put down and want to remember. */}
        {description && (
          <button
            onClick={() => setShowAbout(v => !v)}
            className="text-left w-full mb-4"
            aria-expanded={showAbout}
          >
            <p
              className={`text-[15px] leading-relaxed ${showAbout ? '' : 'line-clamp-3'}`}
              style={{ color: 'var(--brand-text-secondary)', fontFamily: 'var(--brand-font-body)' }}
            >
              {description}
            </p>
          </button>
        )}

        {/* Where it came from. */}
        {sparkedByMemories.length > 0 && (
          <div className="mb-4 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Sprout className="h-3 w-3" style={{ color: 'var(--brand-text-secondary)', opacity: 0.69 }} />
              <span className="text-[11px] font-medium tracking-wide lowercase" style={{ color: 'var(--brand-text-secondary)', opacity: 0.69 }}>sparked by</span>
            </div>
            {sparkedByMemories.slice(0, 2).map(m => (
              <p key={m.id} className="text-[13px] italic leading-relaxed line-clamp-2 pl-4" style={{ color: 'var(--brand-text-primary)', opacity: 0.81 }}>
                "{m.body || m.title}"
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-5 sm:px-6 space-y-8">
        {/* The one session engine, run in place: the same contract the home
            runs, opened here so you can look around first and then start
            without leaving. */}
        {sessionOpen && (
          <SessionContract
            project={project}
            autoStart={sessionAutoStart}
            onDone={() => { setSessionOpen(false); setSessionAutoStart(false); void fetchProjects() }}
            onFinish={() => handleStatusChange('completed')}
          />
        )}

        {/* Everything below goes while the contract is open: one thing on
            screen, exactly as the home clears around a session. */}
        {!sessionOpen && (
          <>
            <NextMovePanel
              project={project}
              onGo={() => { setSessionAutoStart(true); setSessionOpen(true) }}
              onChange={() => { setSessionAutoStart(false); setSessionOpen(true) }}
              onFinish={() => handleStatusChange('completed')}
            />

            {/* What done looks like — only when the user has actually said.
                An empty "What does done look like?" box on every project is
                the question this app doesn't ask: plenty of real projects are
                ongoing and have no end. */}
            {(endGoal || editingGoal) && (
              <div
                data-finish-line
                className="rounded-2xl p-5 cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                onClick={!editingGoal ? startEditGoal : undefined}
              >
                <span className="text-[11px] font-medium tracking-wide mb-2 flex items-center gap-1.5 lowercase" style={{ color: 'rgb(var(--brand-primary-rgb))', opacity: 0.85 }}>
                  <Target className="h-3 w-3" /> done when
                </span>
                {editingGoal ? (
                  <div className="space-y-3">
                    <textarea
                      ref={goalInputRef}
                      value={tempGoal}
                      onChange={(e) => setTempGoal(e.target.value)}
                      rows={3}
                      placeholder="What does done look like?"
                      className="field w-full p-3 resize-none text-base"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void saveGoal() }
                        else if (e.key === 'Escape') setEditingGoal(false)
                      }}
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={(e) => { e.stopPropagation(); setEditingGoal(false) }} className="px-3 py-1.5 text-[11px] font-medium rounded-lg hover:bg-white/[0.05]" style={{ color: 'var(--brand-text-secondary)' }}>Cancel</button>
                      <button onClick={(e) => { e.stopPropagation(); void saveGoal() }} className="px-3 py-1.5 text-[11px] font-medium rounded-lg" style={{ background: 'rgba(var(--brand-primary-rgb),0.12)', color: 'rgb(var(--brand-primary-rgb))' }}>Save</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-[15px] sm:text-base font-medium leading-relaxed italic font-serif text-center" style={{ color: 'var(--brand-text-primary)', opacity: 0.92 }}>
                      {endGoal}
                    </p>
                    {/* On a repeating project the finish line is ONE of them,
                        so the count says how far this has actually got. A
                        number of real things made — never a streak. */}
                    {cycleCount && (
                      <p className="text-[11px] uppercase tracking-wide text-center" style={{ color: 'rgb(var(--brand-primary-rgb))', opacity: 0.81 }}>
                        {cycleCount}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Not on a repeating project — metadata.cycle has its own version
                of this (the count above), and the backend never writes
                milestones for one. */}
            {!hasCycle && (
              <ProjectArc
                milestones={(project.metadata?.milestones as never[] | undefined) || []}
                targetDate={project.metadata?.target_date as string | undefined}
              />
            )}

            <MadeWall projectId={project.id} />

            <div data-notes-section className="pb-32 pt-2">
              <ProjectNotes projectId={project.id} notesDoc={project.notes_doc} />
            </div>
          </>
        )}
      </div>

      {confirmDialog}

      {project && (
        <EditProjectDialog project={project} isOpen={showEditDialog} onOpenChange={setShowEditDialog} />
      )}

      {project && (
        <ProjectCompletionModal
          project={project}
          sparkedByMemories={sparkedByMemories}
          isOpen={showCompletionModal}
          onClose={() => setShowCompletionModal(false)}
        />
      )}

      {/* Retrospective — three questions, feeds new sparks */}
      {project && (
        <CompletionRitual project={project} isOpen={showRetroRitual} onClose={() => setShowRetroRitual(false)} />
      )}
    </div>
  )
}

// Default export for lazy loading
export default ProjectDetailPage
