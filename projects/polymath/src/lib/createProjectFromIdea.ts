/**
 * Turns a queued ProjectIdea into a real project. Used by both
 * ProjectIdeasHome (the full deck's save button) and TodaysAnswerCard (a
 * chip tap) — this used to be copied by hand into each, which meant two
 * places to keep in sync for one operation.
 */

import type { Project } from '../types'
import { api } from './apiClient'
import { useProjectIdeasStore, type ProjectIdea } from '../stores/useProjectIdeasStore'

export async function createProjectFromIdea(
  idea: ProjectIdea,
  createProject: (data: Partial<Project>) => Promise<Project>,
): Promise<Project> {
  // For Read mode lead the description with the pattern — that's the line
  // worth keeping as the project's own reminder of why it's the right one.
  // Fold the next step in so it isn't lost (the API auto-scaffolds tasks
  // from the description).
  const description = [
    idea.mode === 'read' && idea.pattern ? idea.pattern : null,
    idea.pitch,
    idea.next_step ? `First move: ${idea.next_step}` : null,
  ].filter(Boolean).join('\n\n')

  // No `type` set — the generator doesn't know a project's domain (tech,
  // art, music...), and guessing wrong (this used to hardcode 'Creative')
  // means the project carries the wrong color everywhere it's shown from
  // then on. Leaving it unset falls through to the theme system's
  // title-hash color instead of a confident wrong label.
  //
  // One call plans the steps from the idea itself, so the project arrives
  // with a real list rather than an empty one. An empty project isn't
  // just unhelpful: `is_shaped: false` filters it out of the priority
  // selector, the warm row and the answer card, so it saves and then
  // appears to vanish. A finish line is only kept when the idea genuinely
  // named one — never derived from the pitch's last sentence, which was
  // just as likely to be a flourish as a done-condition.
  let tasks: any[] = []
  let endGoal: string | null = null
  let tags: string[] = []
  try {
    const shaped = await api.post('utilities?resource=shape-project', {
      dump: [idea.title, idea.pattern, idea.pitch, idea.why_now, idea.next_step].filter(Boolean).join('\n'),
      title: idea.title,
    }) as { tasks?: any[]; end_goal?: string | null; tags?: string[] }
    if (Array.isArray(shaped?.tasks)) tasks = shaped.tasks
    if (typeof shaped?.end_goal === 'string' && shaped.end_goal.trim()) endGoal = shaped.end_goal.trim()
    if (Array.isArray(shaped?.tags)) tags = shaped.tags
  } catch (err) {
    console.warn('[createProjectFromIdea] planning failed:', err)
  }

  const created = await createProject({
    title: idea.title,
    description,
    status: 'active',
    metadata: {
      tasks,
      progress: 0,
      is_shaped: tasks.length > 0,
      from_idea: idea.id,
      ...(endGoal ? { end_goal: endGoal, end_goal_source: 'guide' as const } : {}),
      project_mode: endGoal ? 'completion' : 'recurring',
      ...(tags.length ? { tags } : {}),
      // Mark one-hour things so they're distinguishable from full
      // projects (a tonight-sized commitment, not an open-ended one).
      ...(idea.mode === 'hour' ? { scope: 'hour' } : {}),
    },
  })

  // Mark it built so the server clears it from the pending queue and the
  // generator's avoid-list never re-proposes it. Best-effort — the
  // project is already created, so a feedback hiccup shouldn't block the
  // user.
  try {
    await api.post('utilities?resource=project-ideas-feedback', { id: idea.id, status: 'built' })
  } catch {
    // Non-fatal: the project exists; the queue reconciles on next load.
  }

  // Shared store — every surface reading the queue loses this idea
  // immediately, not just the one that resolved it.
  useProjectIdeasStore.getState().removeIdea(idea.id)

  return created
}
