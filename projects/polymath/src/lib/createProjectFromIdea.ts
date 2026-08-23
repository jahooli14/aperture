/**
 * Turns a queued ProjectIdea into a real project. Used by both
 * ProjectIdeasHome (the full deck's save button) and TodaysAnswerCard (a
 * chip tap) — this used to be copied by hand into each, which meant two
 * places to keep in sync for one operation.
 */

import type { Project } from '../types'
import { api } from './apiClient'
import { useProjectIdeasStore, type ProjectIdea } from '../stores/useProjectIdeasStore'

// Every idea prompt ends its pitch with "what done looks like," so that
// last sentence IS the finish line. Falls back to a concrete line built
// from the title when the pitch is a single sentence (template ideas).
export function deriveFinishLine(idea: ProjectIdea): string {
  const sentences = idea.pitch.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean)
  if (sentences.length >= 2) return sentences[sentences.length - 1]
  return `${idea.title.replace(/\.$/, '')} exists as a finished thing you can show someone.`
}

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
  // title-hash color instead of a confident wrong label; the user can set
  // the real type later via shaping, same as the finish line.
  const created = await createProject({
    title: idea.title,
    description,
    status: 'active',
    metadata: {
      tasks: [],
      progress: 0,
      is_shaped: false,
      from_idea: idea.id,
      end_goal: deriveFinishLine(idea),
      project_mode: 'completion',
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
