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
import { Loader2, MoreVertical, Star, Sprout, ArrowLeft } from 'lucide-react'
import { useProjectStore } from '../stores/useProjectStore'
import { useSessionStore } from '../stores/useSessionStore'
import { SessionContract } from '../components/session/SessionContract'
import { ProjectNotes } from '../components/projects/ProjectNotes'
import { NextMovePanel } from '../components/projects/NextMovePanel'
import { ProjectThemes } from '../components/projects/ProjectThemes'
import { UpdateSheet } from '../components/projects/UpdateSheet'
import { UpToSpeed } from '../components/projects/UpToSpeed'
import { isActivelyWorked, readThemes } from '../lib/projectThemes'
import { Button } from '../components/ui/button'
import { useToast } from '../components/ui/toast'
import { useConfirmDialog } from '../components/ui/confirm-dialog'
import { EditProjectDialog } from '../components/projects/EditProjectDialog'
import { blockedReason } from '../lib/season'
import { FinishedItButton } from '../components/projects/FinishedItButton'
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
  const [updateOpen, setUpdateOpen] = useState(false)
  // Go on the move IS the decision; "change it" opens without starting.
  const [sessionAutoStart, setSessionAutoStart] = useState(false)

  const project = useProjectStore(state => state.allProjects.find(p => p.id === id))

  const [sparkedByMemories, setSparkedByMemories] = useState<Memory[]>([])

  // Local-first: only block on a loader when the project isn't in the store.
  const [loading, setLoading] = useState(!project)
  const [showMenu, setShowMenu] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [showRetroRitual, setShowRetroRitual] = useState(false)
  const [showAbout, setShowAbout] = useState(false)

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
  // Being worked on and has themes: they lead (with Go) and the move steps
  // aside. Otherwise the move is the way back in. Either way: notes below.
  const steering = project.status !== 'completed' && project.status !== 'graveyard'
    && readThemes(project.metadata).length > 0 && isActivelyWorked(project)

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
              className="quiet-pill transition-colors"
              data-on={project.is_priority ? 'true' : 'false'}
            >
              <Star className={`h-3 w-3 ${project.is_priority ? 'fill-current' : ''}`} />
              {project.is_priority ? 'Live' : 'Make it live'}
            </button>
          )}
          {(parked || project.status === 'completed') && (
            <span className="quiet-pill">
              {parked ? 'Parked' : 'Finished'}
            </span>
          )}
          {((project.metadata?.tags as string[] | undefined) ?? []).slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="quiet-pill"
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
        {updateOpen && project && <UpdateSheet project={project} onClose={() => setUpdateOpen(false)} />}
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
            {/* Back after a while: where things stand, from your own notes.
                The move panel under it is the way back in. */}
            <UpToSpeed project={project} />

            {/* Keep in mind — weeks, not one session. Shown on the home card
                while you're working on it. A project you haven't touched and
                never wrote lines for doesn't get an empty prompt: its way
                back in is the move below. */}
            {project.status !== 'completed' && project.status !== 'graveyard'
              && (readThemes(project.metadata).length > 0 || project.is_priority || isActivelyWorked(project)) && (
              <ProjectThemes project={project} onGo={() => setUpdateOpen(true)} />
            )}

            {/* The way back in: the move, unless themes are leading, or it
                can't be started yet (nothing to write a move for). */}
            {!steering && !blockedReason(project) && (
              <NextMovePanel
                project={project}
                onGo={() => { setSessionAutoStart(true); setSessionOpen(true) }}
                onChange={() => { setSessionAutoStart(false); setSessionOpen(true) }}
                onFinish={() => handleStatusChange('completed')}
              />
            )}

            <FinishedItButton project={project} />

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
